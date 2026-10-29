// ============ MONTAR UN PLAN ============
// Lo que hace /api/plan de verdad, separado para poder compararlo desde el panel (/panel/comparar)
// sin guardar nada ni sumar estadísticas.
//
// Dos modos:
//  · conGoogle = true  (el de siempre): Gemini busca en Google en cada plan. Cada búsqueda se cobra aparte.
//  · conGoogle = false (ahorro): Gemini NO busca. Los eventos salen de la agenda verificada (barrido diario
//    + barrido a medida de esta petición) y los sitios del catálogo de locales comprobados + lo que conoce.
//    Después, como siempre, cada parada se comprueba en Google Places (nombre, nota, teléfono, horario).
// El modo ahorro es el de serie: en la comparación (/panel/comparar) los planes salen igual de bien y así ningún
// plan paga búsquedas. PLANES_CON_GOOGLE=1 en Vercel vuelve al modo con búsqueda.
import { llamarGemini, extraerJSON } from './gemini';
import { sinRomper } from './almacen';
import { presupuestoAPriceLevel, ajustarAlPresupuesto, obtenerLocalidad, obtenerPrevisionTiempo, enriquecerParada } from './planUtils';
import { eventosDelDia, eventosParaPrompt, barridoAMedida, unirEventos } from './eventos';
import { preferenciasComunidad, sitiosComprobados, sitiosParaPrompt } from './lugares';
import { deduplicar, leerHora, mismoEvento, ordenarPorHora } from './agenda';
import { filtrarMasEseDia } from './intencion';
import { AVISO_MAPA, avisoSitio, enProvinciaLeon, sitioFueraEnTexto } from './provincia';

// Solo León capital y provincia. Se mira ANTES de la IA y de Google: un plan de fuera no gasta nada.
export function fueraDeLeon({ lat, lon, texto }) {
  if (!enProvinciaLeon(lat, lon)) return AVISO_MAPA;
  const sitio = sitioFueraEnTexto(texto);
  return sitio ? avisoSitio(sitio) : null;
}

export const planesConGoogle = () => /^(1|si|sí|true)$/i.test(String(process.env.PLANES_CON_GOOGLE || '').trim());

// Devuelve { exito: true, plan, prevision, masEseDia, nombreZona, uso } o { exito: false, mensaje }
export async function montarPlan(peticion, { conGoogle = planesConGoogle(), inicio = Date.now(), msIA = 55000, msTotal = 58000 } = {}) {
  const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;
  const fuera = fueraDeLeon({ lat, lon, texto: apetece });
  if (fuera) return { exito: false, mensaje: fuera };
  const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);

  const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de la provincia de León';
  // En paralelo con el tiempo: 1) la agenda guardada de ese día, 2) un barrido a medida de ESTA petición
  // (eventos, mercadillos, ferias, exposiciones, pueblos cercanos...), 3) lo que la comunidad ha valorado en la zona
  // y 4) en modo ahorro, los locales reales ya comprobados del radio. Si algo falla, el plan sale igual.
  const [previsionTiempo, eventosDia, eventosAMedida, prefs, sitios] = await Promise.all([
    obtenerPrevisionTiempo(lat, lon, fecha),
    sinRomper(eventosDelDia(fecha, { lat, lon, radio }), 'eventos'),
    sinRomper(barridoAMedida({ fecha, apetece, zona: nombreZona, radio, lat, lon }), 'barrido a medida'),
    sinRomper(preferenciasComunidad(lat, lon, radio), 'preferencias'),
    conGoogle ? null : sinRomper(sitiosComprobados(lat, lon, radio), 'sitios comprobados'),
  ]);

  const agendaDelDia = unirEventos(eventosAMedida || [], eventosDia || []);
  const bloqueAgenda = eventosParaPrompt(agendaDelDia);
  const bloqueComunidad = [
    prefs?.favoritos?.length ? `FAVORITOS DE LA COMUNIDAD CAZURRONICS en esta zona (gente que fue y le encantó; priorízalos si encajan): ${prefs.favoritos.join(', ')}.` : '',
    prefs?.evitar?.length ? `EVITA estos sitios (malas experiencias reales de usuarios): ${prefs.evitar.join(', ')}.` : '',
  ].filter(Boolean).join('\n');

  const bloqueTiempo = previsionTiempo
    ? `PREVISIÓN DEL TIEMPO REAL: ${previsionTiempo}. ADAPTA EL PLAN PRINCIPAL ESTRICTAMENTE A ESTE CLIMA. Al final de la descripción añade SIEMPRE una nota secundaria: "(Alternativa por si cambia el tiempo: [sitio real])".` : '';

  const instruccionBusqueda = conGoogle
    ? `1. Busca en Google Search eventos efímeros para ${fecha} (y también mercadillos, ferias, exposiciones y fiestas que estén en marcha ese día) y sitios bien valorados.`
    : `1. Los eventos (conciertos, mercadillos, ferias, exposiciones, fiestas...) salen SOLO de la AGENDA VERIFICADA de arriba: no añadas eventos que no estén en ella. Los sitios (bares, restaurantes, cafeterías, museos, monumentos, parques...) elígelos entre los SITIOS REALES COMPROBADOS cuando encajen, o entre sitios reales y bien valorados que conozcas con seguridad en esa zona. Antes de decidir, compara varias opciones de cada tipo y quédate con la mejor combinación de calidad, precio, distancia y lo que pide el usuario.`;

  const prompt = `
      Eres Cazurronics Planner. Crea un plan en León (solo León capital y provincia, España).
      DATOS: Zona: ${nombreZona} (Lat ${lat}, Lon ${lon}). Radio: ${radio}km. Presupuesto TOTAL: ${presupuestoMin}€ - ${presupuestoMax}€. Apetece: "${apetece}". Fecha: ${fecha}.
      ${bloqueTiempo}
      ${bloqueAgenda}
      ${conGoogle ? '' : sitiosParaPrompt(sitios)}
      ${bloqueComunidad}
      ALCANCE (lo más importante): dale a la persona EXACTAMENTE lo que pide, ni más ni menos.
      - Si pide algo CONCRETO (por ejemplo "una charla", "un concierto", "dónde ver el partido", "un sitio para comer cocido"), devuelve SOLO eso: normalmente 1 parada, y como mucho 2 o 3 si son opciones del mismo tipo a distintas horas. NO añadas comidas, copas, paseos ni visitas que no ha pedido.
      - Si pide varias cosas (por ejemplo "comer y luego salir de fiesta"), una parada por cada cosa pedida, en ese orden.
      - Solo si pide un plan abierto SIN tema concreto ("un plan", "qué hacer", "sorpréndeme", "pasar el día") monta un plan completo de varias paradas. Si menciona un tema concreto, manda el tema aunque diga "plan" (por ejemplo "un plan con charla" = solo la charla).
      - La alternativa por si cambia el tiempo va dentro de la descripción, nunca como parada extra.
      - Si no hay nada real que cumpla lo pedido ese día, devuelve [] en vez de rellenar con otras cosas.
      INSTRUCCIONES:
      ${instruccionBusqueda}
      2. No inventes nada. No te salgas del radio ni de la provincia de León: nada de Zamora, Asturias, Palencia, Galicia ni otras provincias, aunque estén cerca. Si lo que pide es en otra provincia, devuelve []. No repitas el mismo sitio o evento con otro nombre. Ordena las paradas por hora.
      BARES Y RESTAURANTES: si no conoces con seguridad uno real en esa zona (pasa mucho en los pueblos), no te inventes el nombre: pon de título el tipo y el pueblo (por ejemplo "Restaurante en Boñar") y lo buscamos en Google Maps. En su descripción no inventes especialidades, platos, premios ni historia.
      3. Devuelve SOLO JSON estricto con este formato:
      [{"hora": "12:00", "titulo": "Nombre Oficial", "descripcion": "Descripción del sitio.", "precio": "10€", "resenas": "4.5/5", "transporte": "5 min andando", "lat": 42.59, "lon": -5.56, "tipo": "bar", "lugar": null, "telefono": "No disponible", "web": "No disponible", "horario": "12:00 - 16:00", "fuente": "URL del evento o null"}]
      "lugar": si la parada es un evento, ruta, mercadillo, concierto o similar, el local, plaza o recinto CONCRETO donde se celebra o empieza (por ejemplo "Bar Rebote", "Plaza de San Martín"); para un bar, restaurante o negocio normal, null.
      "tipo" es uno de: bar, restaurante, cafeteria, discoteca, monumento, parque, museo, exposicion, concierto, teatro, mercadillo, feria, fiesta, festival, evento, ruta, deporte.
    `;

  // Gemini con plan B: si un modelo está saturado, prueba otro (ver lib/gemini.js)
  const { texto: textoIA, uso } = await llamarGemini(prompt, { para: 'usuario', tarea: 'planes', temperatura: 0.2, google: conGoogle, json: !conGoogle, msMax: Math.min(50000, inicio + msIA - Date.now()) });
  const rutaBruta = extraerJSON(textoIA, '[');
  if (!rutaBruta) throw new SyntaxError('La IA no devolvió una lista de paradas');
  // Lista vacía = no hay nada real que cumpla lo pedido: mejor decirlo que rellenar con otras cosas
  if (rutaBruta.length === 0) return { exito: false, uso, mensaje: `No hemos encontrado nada real que encaje con «${String(apetece || 'lo que pides').slice(0, 60)}» ese día 🦁 Prueba con otra fecha o amplía el radio.` };

  // Todas las paradas se comprueban A LA VEZ en Google Places (antes, una detrás de otra):
  // el resultado es el mismo y en el mismo orden, pero tarda lo que la más lenta, no la suma de todas.
  const contexto = { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY, limite: inicio + msTotal };
  const enriquecidas = await Promise.all(
    rutaBruta
      .filter((p) => p && typeof p === 'object' && typeof p.titulo === 'string' && p.titulo.trim())
      .map((p) => enriquecerParada(p, contexto).catch((e) => {
        console.error('[plan] parada', e?.message || e);
        return { parada: null, problemaConfigPlaces: null };
      }))
  );

  const rutaValidada = [];
  let problemaGlobal = null, fueraDeProvincia = 0;
  for (const { parada, problemaConfigPlaces } of enriquecidas) {
    if (problemaConfigPlaces) problemaGlobal = problemaConfigPlaces;
    // Lo que Google sitúa fuera de la provincia no entra (p. ej. un bar de Benavente con radio grande desde La Bañeza)
    if (parada && enProvinciaLeon(parada.lat, parada.lon)) rutaValidada.push(parada);
    else if (parada) fueraDeProvincia++;
  }

  // Si todo lo que salió era de fuera, el plan no es de León: se dice claro
  if (rutaValidada.length === 0 && fueraDeProvincia) return { exito: false, uso, mensaje: AVISO_MAPA.replace('Mueve el punto del mapa dentro de la provincia', 'Pide algo de la provincia') };
  if (rutaValidada.length === 0) return { exito: false, uso, mensaje: problemaGlobal ? `Error en Google Places: ${problemaGlobal}` : "No encontramos locales reales en esa zona. Amplía el radio." };

  const rutaFinal = ajustarAlPresupuesto(rutaValidada, presupuestoMax);
  if (rutaFinal.length === 0) return { exito: false, uso, mensaje: "Presupuesto muy bajo para esta zona." };

  // Paradas en orden cronológico y sin repetir el mismo sitio con otro nombre
  const sinRepetir = deduplicar(rutaFinal.map((p) => ({ ...p, categoria: p.tipo })));
  rutaFinal.splice(0, rutaFinal.length, ...sinRepetir.map(({ categoria, ...p }) => p));
  rutaFinal.sort((a, b) => (leerHora(a.hora).min ?? 24 * 60) - (leerHora(b.hora).min ?? 24 * 60));

  // El resto de la agenda de ese día que no ha entrado en el plan ("Más cosas ese día")
  // (sin lo que ya está en la ruta, aunque tenga otro nombre, y ordenado por hora)
  // Si el plan es algo concreto (1-2 paradas), solo cosas parecidas a lo pedido, no toda la agenda
  const masEseDia = ordenarPorHora(
    filtrarMasEseDia(agendaDelDia, rutaFinal, apetece).filter((e) => !rutaFinal.some((p) => mismoEvento(e, { titulo: p.titulo, lugar: p.lugar, hora: p.hora, categoria: p.tipo })))
  ).slice(0, 12);

  return { exito: true, plan: rutaFinal, prevision: previsionTiempo, masEseDia, nombreZona, uso };
}
