import { llamarGemini, ErrorIA } from '../../../lib/gemini';
import { NextResponse, after } from 'next/server';
import { presupuestoAPriceLevel, ajustarAlPresupuesto, obtenerLocalidad, obtenerPrevisionTiempo, enriquecerParada } from '../../../lib/planUtils';
import { guardarJSON, nuevoId, sinRomper } from '../../../lib/almacen';
import { eventosDelDia, eventosParaPrompt, barridoAMedida, unirEventos, asegurarBarridoReciente } from '../../../lib/eventos';
import { claveLugar, esPrueba, preferenciasComunidad, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';
import { deduplicar, leerHora, mismoEvento, ordenarPorHora } from '../../../lib/agenda';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = body;
    const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
    const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);

    const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de la provincia de León';
    // NUEVO: en paralelo con el tiempo, 1) la agenda guardada de ese día, 2) un barrido a medida
    // de ESTA petición (eventos, mercadillos, ferias, exposiciones, pueblos cercanos...) y
    // 3) lo que la comunidad ha valorado en la zona. Si algo falla, el plan sale igual que antes.
    const [previsionTiempo, eventosDia, eventosAMedida, prefs] = await Promise.all([
      obtenerPrevisionTiempo(lat, lon, fecha),
      sinRomper(eventosDelDia(fecha, { lat, lon, radio }), 'eventos'),
      sinRomper(barridoAMedida({ fecha, apetece, zona: nombreZona, radio, lat, lon }), 'barrido a medida'),
      sinRomper(preferenciasComunidad(lat, lon, radio), 'preferencias'),
    ]);
    // Si la agenda diaria está vacía o caducada (p. ej. en local, sin cron), se rellena en segundo plano
    after(() => sinRomper(asegurarBarridoReciente(), 'barrido diario'));

    const agendaDelDia = unirEventos(eventosAMedida || [], eventosDia || []);
    const bloqueAgenda = eventosParaPrompt(agendaDelDia);
    const bloqueComunidad = [
      prefs?.favoritos?.length ? `FAVORITOS DE LA COMUNIDAD CAZURRONICS en esta zona (gente que fue y le encantó; priorízalos si encajan): ${prefs.favoritos.join(', ')}.` : '',
      prefs?.evitar?.length ? `EVITA estos sitios (malas experiencias reales de usuarios): ${prefs.evitar.join(', ')}.` : '',
    ].filter(Boolean).join('\n');
    
    const bloqueTiempo = previsionTiempo
      ? `PREVISIÓN DEL TIEMPO REAL: ${previsionTiempo}. ADAPTA EL PLAN PRINCIPAL ESTRICTAMENTE A ESTE CLIMA. Al final de la descripción añade SIEMPRE una nota secundaria: "(Alternativa por si cambia el tiempo: [sitio real])".` : '';

    const prompt = `
      Eres Cazurronics Planner. Crea un plan en León. 
      DATOS: Zona: ${nombreZona} (Lat ${lat}, Lon ${lon}). Radio: ${radio}km. Presupuesto TOTAL: ${presupuestoMin}€ - ${presupuestoMax}€. Apetece: "${apetece}". Fecha: ${fecha}.
      ${bloqueTiempo}
      ${bloqueAgenda}
      ${bloqueComunidad}
      INSTRUCCIONES:
      1. Busca en Google Search eventos efímeros para ${fecha} (y también mercadillos, ferias, exposiciones y fiestas que estén en marcha ese día) y sitios bien valorados.
      2. No inventes nada. No te salgas del radio. No repitas el mismo sitio o evento con otro nombre. Ordena las paradas por hora.
      3. Devuelve SOLO JSON estricto con este formato:
      [{"hora": "12:00", "titulo": "Nombre Oficial", "descripcion": "Descripción del sitio.", "precio": "10€", "resenas": "4.5/5", "transporte": "5 min andando", "lat": 42.59, "lon": -5.56, "tipo": "bar", "telefono": "No disponible", "web": "No disponible", "horario": "12:00 - 16:00", "fuente": "URL del evento o null"}]
      "tipo" es uno de: bar, restaurante, cafeteria, discoteca, monumento, parque, museo, exposicion, concierto, teatro, mercadillo, feria, fiesta, festival, evento, ruta, deporte.
    `;

    // Gemini con plan B: si un modelo está saturado, prueba otro (ver lib/gemini.js)
    const { texto: textoIA } = await llamarGemini(prompt, { para: 'usuario', temperatura: 0.2 });
    const jsonLimpio = textoIA.substring(textoIA.indexOf('['), textoIA.lastIndexOf(']') + 1);
    const rutaBruta = JSON.parse(jsonLimpio);

    const rutaValidada = [];
    let problemaGlobal = null;

    for (const paradaBruta of rutaBruta) {
      const { parada, problemaConfigPlaces } = await enriquecerParada(paradaBruta, { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY });
      if (problemaConfigPlaces) problemaGlobal = problemaConfigPlaces;
      if (parada) rutaValidada.push(parada);
    }

    if (rutaValidada.length === 0) return NextResponse.json({ exito: false, mensaje: problemaGlobal ? `Error en Google Places: ${problemaGlobal}` : "No encontramos locales reales en esa zona. Amplía el radio." }, { status: 200 });

    const rutaFinal = ajustarAlPresupuesto(rutaValidada, presupuestoMax);
    if (rutaFinal.length === 0) return NextResponse.json({ exito: false, mensaje: "Presupuesto muy bajo para esta zona." }, { status: 200 });

    // NUEVO: paradas en orden cronológico y sin repetir el mismo sitio con otro nombre
    const sinRepetir = deduplicar(rutaFinal.map((p) => ({ ...p, categoria: p.tipo })));
    rutaFinal.splice(0, rutaFinal.length, ...sinRepetir.map(({ categoria, ...p }) => p));
    rutaFinal.sort((a, b) => (leerHora(a.hora).min ?? 24 * 60) - (leerHora(b.hora).min ?? 24 * 60));

    // NUEVO: cada parada lleva su identificador de lugar (para estadísticas y valoraciones)
    for (const parada of rutaFinal) parada.lugarId = claveLugar(parada);

    // NUEVO: guardamos el plan para poder compartirlo (/plan/ID) y votarlo en grupo
    const planId = nuevoId();
    // NUEVO: el resto de la agenda de ese día que no ha entrado en el plan ("Más cosas ese día")
    // (sin lo que ya está en la ruta, aunque tenga otro nombre, y ordenado por hora)
    const masEseDia = ordenarPorHora(
      agendaDelDia.filter((e) => !rutaFinal.some((p) => mismoEvento(e, { titulo: p.titulo, lugar: p.lugar, hora: p.hora, categoria: p.tipo })))
    ).slice(0, 12);

    const guardado = await sinRomper(guardarJSON(`plan:${planId}`, {
      id: planId, creado: Date.now(), fecha, apetece, zona: nombreZona,
      centro: [lat, lon], radio, presupuesto: { min: presupuestoMin, max: presupuestoMax },
      prevision: previsionTiempo, itinerario: rutaFinal, masEseDia,
    }, 120 * 24 * 3600), 'guardar plan');
    await Promise.all([
      sinRomper(esPrueba(request) ? null : registrarApariciones(rutaFinal), 'apariciones'),
      sinRomper(registrar('plan'), 'estadísticas'),
    ]);

    return NextResponse.json({ exito: true, plan: rutaFinal, prevision: previsionTiempo, planId: guardado ? planId : null, masEseDia });
  } catch (error) {
    console.error('[plan]', error?.message || error);
    const mensaje = error instanceof ErrorIA && (error.estado === 402 || error.estado === 403)
      ? 'Estamos recargando la IA 🦁 Vuelve en un ratito y tendrás tu plan.'
      : error instanceof ErrorIA && error.estado === 429
      ? 'Hay muchísima gente montando planes ahora mismo 🦁 Prueba otra vez en un minuto.'
      : error instanceof SyntaxError
        ? 'La IA ha devuelto un plan a medias. Dale otra vez, que ahora sale.'
        : 'La IA no ha respondido a tiempo. Prueba otra vez en unos segundos.';
    return NextResponse.json({ exito: false, mensaje, ...(process.env.NODE_ENV === 'development' ? { detalle: error?.fallos || String(error?.stack || error).slice(0, 400) } : {}) }, { status: 200 });
  }
}