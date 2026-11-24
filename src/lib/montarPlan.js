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
import { REGLA_DATOS, textoParaPrompt } from './blindaje';
import { presupuestoAPriceLevel, ajustarAlPresupuesto, obtenerLocalidad, obtenerPrevisionTiempo, enriquecerParada, haversineKm, TIPOS_CON_FICHA_OBLIGATORIA } from './planUtils';
import { eventosDelDia, eventosParaPrompt, barridoAMedida, unirEventos } from './eventos';
import { preferenciasComunidad, sitiosComprobados, sitiosParaPrompt } from './lugares';
import { deduplicar, esDeVariosDias, fueraDeTemporada, leerHora, mismoEvento, ordenarPorHora } from './agenda';
import { esDelTipo, filtrarMasEseDia, paradasPedidas, pideAgenda, quitarNoPedidas, tiposIguales } from './intencion';
import { seParecen } from './nombres';
import { AVISO_MAPA, avisoSitio, enProvinciaLeon, sitioFueraEnTexto } from './provincia';
import { dentroDelTopeDiario } from './freno';
import { agendaParaRutas, parajesParaPrompt, rutasParaPrompt } from './rutas';
import { centrarEnPueblo } from './pueblos';

// Solo León capital y provincia. Se mira ANTES de la IA y de Google: un plan de fuera no gasta nada.
export function fueraDeLeon({ lat, lon, texto }) {
  if (!enProvinciaLeon(lat, lon)) return AVISO_MAPA;
  const sitio = sitioFueraEnTexto(texto);
  return sitio ? avisoSitio(sitio) : null;
}

export const planesConGoogle = () => /^(1|si|sí|true)$/i.test(String(process.env.PLANES_CON_GOOGLE || '').trim());

// Si en la zona no sale nada, un segundo intento con toda la provincia (una llamada más a la IA y a Google, solo en ese caso).
// Tope diario para toda la web: 5, unos 0,50 $ al día como mucho (se cambia con PLANES_AMPLIADOS_MAX_DIA en Vercel; ojo, 0 = sin tope).
// Sin 20 s por delante no se intenta.
const MS_MINIMO_AMPLIAR = 20000;
const RADIO_PROVINCIA = 150;

// Pedidos solo de comer o beber ("comer y luego unas cañas", "cenar cocido"): no necesitan buscar eventos en Google.
// La agenda guardada sigue entrando; lo que se ahorra es la búsqueda a medida, la llamada más cara de cada plan.
const COMER_BEBER = /\b(?:comer|comida|cena|cenar|almorzar|almuerzo|desayun\w*|merendar|merienda|tapas?|tapeo|tapear|pinchos?|vinos?|vermu\w*|canas?|cervezas?|copas?|cocido|cecina|botillo|restaurantes?|bar|bares|cafe|cafeteria|brunch|menu|raciones?|asador|mesones?|pizza|hamburguesa|sushi|vegano|vegetariano|chuleton|cordero|lechazo|marisco|pulpo|dulces?|postres?|chocolate)\b/g;
const OTRA_COSA = /\b(?:concierto|musica|fiesta|evento|plan|planes|hacer|ver|visita|museo|exposicion|ruta|teatro|cine|mercad\w*|feria|charla|jornadas?|cata|catas|festival|deporte|partido|ninos|familia|actividad\w*|sorprend\w*|ocio|baile|bailar|discoteca)\b/;
const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function soloComerYBeber(apetece) {
  const t = sinTildes(apetece);
  return new RegExp(COMER_BEBER.source).test(t) && !OTRA_COSA.test(t.replace(COMER_BEBER, ' '));
}

// Lo que dura horas aunque la agenda solo dé la de apertura: «Expojoven 10:00» sigue abierta a las 16:00.
// Antes se trataba como un concierto (fuera una hora después de empezar) y desaparecía del plan a media mañana.
const DURA_HORAS = /\b(?:expo|feria|ferias|festival|jornadas?|mercad|muestra|exposicion|exposiciones|congreso|salon|encuentro|certamen|campeonato|torneo|magosto|fiestas?|romeria|verbena|semana|dia de|dia del|mercadillo|rastro|parque infantil|belen|nacimiento|iluminacion|on ice|pista de hielo)/;
const CATEGORIA_LARGA = /^(?:feria|festival|exposicion|mercado|mercadillo|gastronomia|fiesta)$/;
const sinTildesMin = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function duraHoras(e) {
  return CATEGORIA_LARGA.test(sinTildesMin(e?.categoria)) || DURA_HORAS.test(sinTildesMin(e?.titulo));
}

// Plan para hoy: fuera lo que empezó hace más de una hora (y no dura varios días) o ya ha terminado.
// Una feria, una exposición o una fiesta sin hora de cierre se da por abierta hasta las 21:00 (o 3 h si empieza tarde).
export function quitarPasados(agenda, fecha, ahora = new Date()) {
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);
  if (fecha !== hoy) return agenda;
  const [h, m] = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora).split(':').map(Number);
  const yaSon = h * 60 + m;
  return agenda.filter((e) => {
    if (e?.permanente || e?.diasSemana?.length || (e?.fechaFin && e.fechaFin > e.fecha)) {
      const { fin } = leerHora(e?.hora);
      return fin == null || fin > yaSon;
    }
    const { min, fin } = leerHora(e?.hora);
    if (fin != null) return fin > yaSon;
    if (min != null && duraHoras(e)) return Math.max(21 * 60, min + 180) > yaSon;
    return min == null || min + 60 > yaSon;
  });
}

// El aviso que ve la persona encima del plan
export function avisoCercano({ apetece, radio, lat, lon, plan }) {
  const pedido = String(apetece || 'lo que buscas').trim().slice(0, 60) || 'lo que buscas';
  if (plan.some((p) => p.parecido)) return `No hemos encontrado «${pedido}». Lo más parecido que hay es esto.`;
  const km = Math.min(...plan.map((p) => haversineKm(lat, lon, Number(p.lat), Number(p.lon))).filter(Number.isFinite));
  if (km > radio) return `En ${radio} km a la redonda no hay nada de «${pedido}». Lo más cercano es esto, a ${Math.round(km)} km.`;
  return `Ese día no hay «${pedido}» tal cual. Lo más cercano es esto.`;
}

// Sin cupo de Google o con la clave mal: el detalle técnico va al registro (planUtils), no a la persona
export const MENSAJE_GOOGLE_NO_RESPONDE = 'Ahora mismo no podemos comprobar los sitios 🦁 Prueba otra vez en un rato.';

export const mensajeSinNadaEnProvincia = (apetece) => `No hemos encontrado «${String(apetece || 'lo que buscas').trim().slice(0, 60) || 'lo que buscas'}» en toda la provincia ese día 🦁 Prueba con otra fecha o pídelo con menos detalle.`;

// ---------- Cuántos sitios y qué hay hoy ----------
const DE_RUTA = new Set(['bar', 'discoteca']);
const PRECIO_TIPICO = { bar: '2-4€', cafeteria: '2-4€', discoteca: '8-12€', restaurante: '15-25€', museo: '3-6€', monumento: 'Gratis' };
// Lo que se le dice a la IA cuando pide un número de sitios. Manda sobre «normalmente 1 parada».
export function bloquePedido(pedido) {
  if (!pedido) return '';
  const { n, tipo, plural } = pedido;
  const comoRuta = DE_RUTA.has(tipo)
    ? `en orden de ruta, a poca distancia andando unos de otros (5-15 min), unos 45-60 min en cada uno y la primera a su hora natural (bares desde las 19:30 si no dice otra hora)${tipo === 'bar' ? '. "precio" de cada bar: una consumición con tapa (2-4€), no una comida' : ''}`
    : 'como opciones para elegir, a la misma hora natural (comer 14:00, cenar 21:00, café 17:00), de zonas o estilos distintos';
  return `- CUÁNTOS (manda sobre todo lo demás): pide ${n} ${plural}. Devuelve EXACTAMENTE ${n} paradas de tipo "${tipo}", cada una un local real DISTINTO con su nombre propio (elige primero entre los SITIOS REALES COMPROBADOS de ese tipo), ${comoRuta}. Si además pide otra cosa (cenar, un concierto...), añade esa parada aparte. Nunca devuelvas menos de ${n} ${plural}.`;
}
export const BLOQUE_AGENDA = `- PIDE LA AGENDA DEL DÍA ("qué hay", "qué hacer", "eventos"): devuelve entre 4 y 6 paradas, todas de la AGENDA VERIFICADA, con su hora real y su "fuente". Primero lo que solo pasa ese día y lo más grande (ferias, festivales, conciertos, teatro, fiestas, partidos), después talleres y exposiciones; visitas a museos o monumentos que se hacen cualquier día, solo si falta. Variedad de tipos y de horas. Sin bares ni restaurantes, salvo que los pida.`;

// «Más cosas ese día»: primero lo que solo pasa ese día (conciertos, ferias, fiestas...) y luego lo que dura semanas
// (exposiciones, visitas). Antes iba por hora y lo de «todo el día» llenaba los 12 huecos: el concierto de la noche no salía.
export function elegirMasEseDia(lista, max = 12) {
  const unicos = lista.filter((e) => !esDeVariosDias(e) && !/^visita/i.test(String(e?.categoria || '')));
  const resto = lista.filter((e) => !unicos.includes(e));
  return ordenarPorHora([...unicos, ...resto].slice(0, max));
}

const enriquecerSeguro = (p, contexto) => enriquecerParada(p, contexto).catch((e) => {
  console.error('[plan] parada', e?.message || e);
  return { parada: null, problemaConfigPlaces: null };
});
const esDeComerOBeber = (tipo) => TIPOS_CON_FICHA_OBLIGATORIA.includes(String(tipo || '').toLowerCase());

// Si dos paradas de comer o beber acaban en el mismo local de Google, la segunda se busca otra vez sin ese local.
// Las búsquedas de Places están en caché (72 h): solo cuesta la ficha del local nuevo.
export async function separarRepetidos(enriquecidas, originales, contexto, enriquecer = enriquecerSeguro) {
  const usados = new Set();
  for (let i = 0; i < enriquecidas.length; i++) {
    const id = enriquecidas[i]?.parada?.placeId;
    if (!id) continue;
    if (!usados.has(id)) { usados.add(id); continue; }
    if (!esDeComerOBeber(originales[i]?.tipo) || Date.now() > contexto.limite - 4000) continue; // lo quita deduplicar
    const otra = await enriquecer(originales[i], { ...contexto, excluir: new Set(usados) });
    enriquecidas[i] = otra?.parada?.placeId && !usados.has(otra.parada.placeId) ? otra : { parada: null, problemaConfigPlaces: otra?.problemaConfigPlaces || null };
    if (enriquecidas[i].parada?.placeId) usados.add(enriquecidas[i].parada.placeId);
  }
}

const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const HORA_NATURAL = { bar: 20 * 60, discoteca: 23 * 60 + 30, restaurante: 14 * 60, cafeteria: 17 * 60, museo: 11 * 60, monumento: 11 * 60 };
const BUSQUEDAS_DE_RESERVA = {
  bar: ['Bar de tapas', 'Bar de vinos', 'Cervecería', 'Taberna', 'Bar', 'Pub'],
  restaurante: ['Restaurante', 'Mesón', 'Asador', 'Restaurante de cocina leonesa'],
  cafeteria: ['Cafetería', 'Café', 'Pastelería cafetería'],
  discoteca: ['Discoteca', 'Pub de copas'],
  museo: ['Museo'],
  monumento: ['Monumento'],
};
function andando(a, b) {
  const km = haversineKm(Number(a.lat), Number(a.lon), Number(b.lat), Number(b.lon));
  if (!Number.isFinite(km)) return '';
  return km <= 2.5 ? `${Math.max(2, Math.round((km / 4.5) * 60))} min andando desde la parada anterior` : `${Math.round(km)} km en coche desde la parada anterior`;
}

// Completa el plan hasta los N sitios pedidos: primero locales ya comprobados del catálogo (cerca del último), luego
// búsquedas de reserva en Google Maps de la zona («Bar de tapas en Boñar»). Cada uno pasa por la misma comprobación
// (ficha real, abierto ese día, en la provincia) y nunca repite un local. Solo se gasta Places si la IA se quedó corta.
export async function completarPedido(ruta, pedido, { sitios, contexto, fecha, ahora = new Date() }, enriquecer = enriquecerSeguro) {
  const delTipo = () => ruta.filter((p) => esDelTipo(p, pedido.tipo));
  let faltan = pedido.n - delTipo().length;
  if (faltan <= 0) return 0;
  const usados = new Set(ruta.map((p) => p.placeId).filter(Boolean));
  const ultimo = delTipo().at(-1);
  const [la, lo] = ultimo ? [Number(ultimo.lat), Number(ultimo.lon)] : [Number(contexto.lat), Number(contexto.lon)];
  const tipos = tiposIguales(pedido.tipo);
  const delCatalogo = (sitios || [])
    .filter((s) => tipos.includes(String(s.t || '').toLowerCase()) && !ruta.some((p) => seParecen(p.titulo, s.n) || seParecen(p.nombreGoogle || '', s.n)))
    .sort((a, b) => haversineKm(la, lo, a.la, a.lo) - haversineKm(la, lo, b.la, b.lo))
    .map((s) => ({ titulo: s.n, tipo: pedido.tipo, precio: s.p || PRECIO_TIPICO[pedido.tipo] || null, lat: s.la, lon: s.lo, descripcion: '' }));
  const zona = contexto.nombreZona || 'León';
  const reserva = (BUSQUEDAS_DE_RESERVA[pedido.tipo] || ['Bar']).map((q) => ({ titulo: `${q} en ${zona}`, tipo: pedido.tipo, precio: PRECIO_TIPICO[pedido.tipo] || null, descripcion: '' }));
  const candidatos = [...delCatalogo.slice(0, 8), ...reserva];

  // Las horas libres. En ruta: detrás del último bar mientras sea antes de las 22:30; si no, antes del primero (un martes
  // en un pueblo los bares cierran pronto: «3 bares en Boñar» con el primero a las 21:30 se quedaba en 1) y, si no queda
  // otra, más tarde. Opciones (restaurantes, cafés): todas a la misma hora. Si es para hoy, nunca antes de ahora.
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);
  const [h, m] = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora).split(':').map(Number);
  const yaSon = fecha === hoy ? Math.ceil((h * 60 + m + 30) / 15) * 15 : 0;
  const enRuta = DE_RUTA.has(pedido.tipo);
  const minutos = delTipo().map((p) => leerHora(p.hora).min).filter((x) => x != null);
  const natural = Math.max(HORA_NATURAL[pedido.tipo] ?? 20 * 60, yaSon);
  const pasos = Array.from({ length: faltan + 2 }, (_, k) => (k + 1) * 50);
  let huecos;
  if (!enRuta) huecos = [minutos[0] ?? natural];
  else if (!minutos.length) huecos = [natural, ...pasos.map((d) => natural + d)].filter((x) => x < 24 * 60);
  else {
    const [primero, ultimoMin] = [Math.min(...minutos), Math.max(...minutos)];
    const despues = pasos.map((d) => ultimoMin + d);
    huecos = [
      ...despues.filter((x) => x <= 22 * 60 + 30),
      ...pasos.map((d) => primero - d).filter((x) => x >= Math.max(yaSon, 18 * 60)),
      ...despues.filter((x) => x > 22 * 60 + 30 && x < 24 * 60),
    ];
  }
  if (!huecos.length) huecos = [Math.min(natural, 24 * 60 - 1)];

  const añadidos = new Set();
  let añadidas = 0, i = 0;
  while (faltan > 0 && i < candidatos.length && huecos.length && Date.now() < contexto.limite - 4000) {
    const tanda = candidatos.slice(i, i + faltan);
    i += tanda.length;
    // Cada uno de la tanda prueba una hora libre distinta. Si dos caen en el mismo local, el segundo no entra y se tira del
    // siguiente candidato; si el local estaba cerrado a esa hora, esa hora pasa al final de la cola
    const horas = tanda.map((_, j) => huecos[j % huecos.length]);
    const hechas = await Promise.all(tanda.map((p, j) => enriquecer({ ...p, hora: hhmm(horas[j]) }, { ...contexto, excluir: new Set(usados) })));
    hechas.forEach((r, j) => {
      const p = r?.parada, hueco = horas[j];
      const k = huecos.indexOf(hueco);
      if (!p) { if (r?.cerrado && enRuta && k >= 0) huecos.push(...huecos.splice(k, 1)); return; }
      if (faltan <= 0 || !enProvinciaLeon(p.lat, p.lon)) return;
      if (p.placeId && usados.has(p.placeId)) return;
      if (ruta.some((x) => seParecen(x.titulo, p.titulo))) return;
      if (p.placeId) usados.add(p.placeId);
      p.hora = hhmm(hueco);
      ruta.push(p);
      añadidos.add(p);
      añadidas++;
      faltan--;
      if (enRuta && k >= 0) huecos.splice(k, 1);
    });
  }
  // Cómo se llega a cada bar añadido: desde el anterior por hora
  if (enRuta) {
    const orden = delTipo().sort((a, b) => (leerHora(a.hora).min ?? 0) - (leerHora(b.hora).min ?? 0));
    orden.forEach((p, k) => { if (k > 0 && añadidos.has(p)) p.transporte = andando(orden[k - 1], p); });
  }
  return añadidas;
}

// Devuelve { exito: true, plan, prevision, masEseDia, nombreZona, uso, aviso? } o { exito: false, mensaje, vacio? }
export async function montarPlan(peticionOriginal, opciones = {}) {
  const { inicio = Date.now(), msIA = 55000 } = opciones;
  // «Cuevas en Sahelices de Sabero» con el mapa en León (el punto de serie): el plan va a Sahelices, no a León
  const { peticion, pueblo } = centrarEnPueblo(peticionOriginal);
  const centro = pueblo ? { centro: [peticion.lat, peticion.lon], radio: peticion.radio } : {};
  const avisoPueblo = pueblo ? `Plan en ${pueblo.nombre}, como has escrito (el punto del mapa estaba en otro sitio).` : null;
  const resultado = await montarEnZona(peticion, opciones, inicio, msIA);
  if (!pueblo || !resultado.exito) return resultado;
  return { ...resultado, ...centro, aviso: resultado.aviso || avisoPueblo };
}

async function montarEnZona(peticion, opciones, inicio, msIA) {
  const primero = await intentoPlan(peticion, { ...opciones, inicio });
  if (primero.exito || !primero.vacio || inicio + msIA - Date.now() < MS_MINIMO_AMPLIAR) return primero;
  if (!(await dentroDelTopeDiario('plan-ampliado', Number(process.env.PLANES_AMPLIADOS_MAX_DIA ?? 5)))) return primero;
  const amplio = await intentoPlan({ ...peticion, radio: Math.max(Number(peticion.radio) || 0, RADIO_PROVINCIA) }, { ...opciones, inicio, ampliado: true }).catch((e) => {
    console.error('[plan] intento ampliado', e?.message || e);
    return null;
  });
  // Ya se ha buscado en toda la provincia: "amplía el radio" no serviría de nada
  if (amplio?.vacio) return { ...primero, mensaje: mensajeSinNadaEnProvincia(peticion.apetece) };
  if (!amplio?.exito) return primero;
  return { ...amplio, ampliado: true, aviso: avisoCercano({ ...peticion, plan: amplio.plan }) };
}

async function intentoPlan(peticion, { conGoogle = planesConGoogle(), inicio = Date.now(), msIA = 55000, msTotal = 58000, ampliado = false } = {}) {
  const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;
  // «4 bares» = 4 bares; «qué hay hoy» = la agenda del día. Se lee sin IA (lib/intencion.js)
  const pedido = paradasPedidas(apetece);
  const agendaPedida = pideAgenda(apetece);
  const fuera = fueraDeLeon({ lat, lon, texto: apetece });
  if (fuera) return { exito: false, mensaje: fuera };
  const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);

  const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de la provincia de León';
  // En paralelo con el tiempo: 1) la agenda guardada de ese día, 2) un barrido a medida de ESTA petición
  // (eventos, mercadillos, ferias, exposiciones, pueblos cercanos...), 3) lo que la comunidad ha valorado en la zona
  // y 4) en modo ahorro, los locales reales ya comprobados del radio. Si algo falla, el plan sale igual.
  const [tiempo, eventosDia, eventosAMedida, prefs, sitios] = await Promise.all([
    obtenerPrevisionTiempo(lat, lon, fecha),
    sinRomper(eventosDelDia(fecha, { lat, lon, radio }), 'eventos'),
    ampliado || soloComerYBeber(apetece) ? null : sinRomper(barridoAMedida({ fecha, apetece, zona: nombreZona, radio, lat, lon }), 'barrido a medida'),
    sinRomper(preferenciasComunidad(lat, lon, radio), 'preferencias'),
    conGoogle && !pedido ? null : sinRomper(sitiosComprobados(lat, lon, radio, 40, pedido ? tiposIguales(pedido.tipo) : null), 'sitios comprobados'),
  ]);
  const previsionTiempo = tiempo?.texto || null; // lo que ve la persona; lo de "día malo" es solo para la IA

  // Nada de "Actividades Verano" en noviembre: ni para la IA ni en Más cosas ese día
  // Y si el plan es para hoy, nada que ya haya empezado hace rato o terminado
  const agendaDelDia = quitarPasados(unirEventos(eventosAMedida || [], eventosDia || []).filter((e) => !fueraDeTemporada(e, fecha)), fecha);
  const bloqueAgenda = eventosParaPrompt(agendaParaRutas(agendaDelDia, apetece), agendaPedida ? 40 : 30);
  const bloqueComunidad = [
    prefs?.favoritos?.length ? `FAVORITOS DE LA COMUNIDAD CAZURRONICS en esta zona (gente que fue y le encantó; priorízalos si encajan): ${prefs.favoritos.join(', ')}.` : '',
    prefs?.evitar?.length ? `EVITA estos sitios (malas experiencias reales de usuarios): ${prefs.evitar.join(', ')}.` : '',
  ].filter(Boolean).join('\n');

  // Manda lo que pide la persona: el tiempo decide cuánto se avisa, no qué se propone. Solo en un plan abierto elige el tiempo.
  const bloqueTiempo = previsionTiempo
    ? `PREVISIÓN DEL TIEMPO REAL: ${previsionTiempo}. Si pide algo concreto, también de exterior (naturaleza, una ruta, una terraza), dáselo aunque haga mal tiempo: el tiempo no cambia el tema. Si pide un plan abierto sin tema, elige según el tiempo. Al final de la descripción añade SIEMPRE una nota secundaria: "(Alternativa por si cambia el tiempo: [sitio real])".${tiempo.dia === 'malo' ? ' ESE DÍA HACE MALO: en las paradas de exterior empieza la descripción avisando del tiempo con una frase y que la alternativa sea un sitio real a cubierto.' : ''}` : '';

  const instruccionBusqueda = conGoogle
    ? `1. Busca en Google Search eventos efímeros para ${fecha} (y también mercadillos, ferias, exposiciones y fiestas que estén en marcha ese día) y sitios bien valorados.`
    : `1. Los eventos (conciertos, mercadillos, ferias, exposiciones, fiestas...) salen SOLO de la AGENDA VERIFICADA de arriba: no añadas eventos que no estén en ella. Los sitios (bares, restaurantes, cafeterías, museos, monumentos, parques...) elígelos entre los SITIOS REALES COMPROBADOS cuando encajen, o entre sitios reales y bien valorados que conozcas con seguridad en esa zona. Antes de decidir, compara varias opciones de cada tipo y quédate con la mejor combinación de calidad, precio, distancia y lo que pide el usuario.`;

  // Si el plan es para hoy, la IA tiene que saber qué hora es: un plan con paradas ya pasadas no sirve
  const ahora = new Date();
  const hoyEnLeon = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);
  const horaEnLeon = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(ahora);
  const bloqueHoy = fecha === hoyEnLeon ? `EL PLAN ES PARA HOY Y SON LAS ${horaEnLeon}: todas las paradas empiezan después de esta hora.` : '';

  const prompt = `
      Eres Cazurronics Planner. Crea un plan en León (solo León capital y provincia, España).
      DATOS: Zona: ${nombreZona} (Lat ${lat}, Lon ${lon}). Radio: ${radio}km. Presupuesto TOTAL: ${presupuestoMin}€ - ${presupuestoMax}€. Apetece: ${textoParaPrompt(apetece)}. Fecha: ${fecha}.
      ${REGLA_DATOS}
      ${bloqueHoy}
      ${bloqueTiempo}
      ${bloqueAgenda}
      ${conGoogle && !pedido ? '' : sitiosParaPrompt(sitios)}
      ${rutasParaPrompt(apetece, lat, lon, radio)}
      ${soloComerYBeber(apetece) ? '' : parajesParaPrompt(lat, lon, radio)}
      ${bloqueComunidad}
      ALCANCE (lo más importante): dale a la persona EXACTAMENTE lo que pide, ni más ni menos.
      ${bloquePedido(pedido)}
      ${agendaPedida ? BLOQUE_AGENDA : ''}
      - Si pide algo CONCRETO sin decir cuántos (por ejemplo "una charla", "un concierto", "dónde ver el partido", "un sitio para comer cocido"), devuelve SOLO eso: normalmente 1 parada, y como mucho 2 o 3 si son opciones del mismo tipo a distintas horas. NO añadas comidas, copas, paseos ni visitas que no ha pedido.
      - Si pide varias cosas (por ejemplo "comer y luego salir de fiesta"), una parada por cada cosa pedida, en ese orden.
      - Solo si pide un plan abierto SIN tema concreto ("un plan", "qué hacer", "sorpréndeme", "pasar el día") monta un plan completo de varias paradas. Si menciona un tema concreto, manda el tema aunque diga "plan" (por ejemplo "un plan con charla" = solo la charla).
      - Cada parada a su hora natural: comer entre 13:30 y 15:30, cenar entre 20:30 y 22:30, copas y fiesta desde las 23:00, salvo que pida otra hora. "Comer" o "cenar" es un sitio donde se come (restaurante, mesón o bar de comidas): un evento de la agenda no lo sustituye. Deja tiempo real entre paradas (lo que dura cada una más el camino) y un orden que no obligue a ir y volver. En "transporte" pon cómo se llega desde la parada anterior.
      - LOS PUEBLOS: si la zona es un pueblo o pide algo de un pueblo, propón lo de ese pueblo y su entorno (cuevas, cascadas, miradores, lagos, hoces, museos, castros, ermitas, rutas) con su nombre oficial, antes que irte a la capital o a otro sitio más famoso. Una cueva, cascada, mirador, lago u hoces es tipo "parque". Si no conoces con seguridad ninguno real en ese pueblo, no lo inventes.
      - La alternativa por si cambia el tiempo va dentro de la descripción, nunca como parada extra.
      ${ampliado
    ? '- En la zona que eligió no había nada, así que ahora vale toda la provincia: dale lo pedido, lo más cerca posible de ese punto. Si lo que pide no existe en ninguna parte, propón la cosa real más parecida (la misma clase de actividad) y pon "parecido": true en esa parada. Nunca inventes un sitio ni un evento; si no hay nada ni parecido, devuelve [].'
    : '- Si no hay nada real que cumpla lo pedido ese día, devuelve [] en vez de rellenar con otras cosas.'}
      - Una ruta para caminar o en bici no es una carrera, ni al revés. Si pide caminar o una ruta y no hay ninguna guiada en la agenda, propón una ruta real que se pueda hacer cualquier día (tipo "ruta", con el nombre con el que se conoce). Una carrera, un trail o un torneo solo si está en la agenda.
      - Antes de responder, repasa la lista: cada parada tiene que corresponder a algo que ha pedido. Si pide "tapeo y cenar", son esas dos: no añadas mercados, visitas ni exposiciones porque estén en la agenda.
      INSTRUCCIONES:
      ${instruccionBusqueda}
      2. No inventes nada. No te salgas del radio ni de la provincia de León: nada de Zamora, Asturias, Palencia, Galicia ni otras provincias, aunque estén cerca. Si lo que pide es en otra provincia, devuelve []. No repitas el mismo sitio o evento con otro nombre. Ordena las paradas por hora.
      ABIERTO ESE DÍA: solo sitios que abran la fecha del plan y a la hora de la parada. Fuera de mayo a septiembre no propongas chiringuitos, merenderos, piscinas, quioscos ni terrazas de verano: suelen estar cerrados aunque Google diga otra cosa.
      BARES Y RESTAURANTES: si no conoces con seguridad uno real en esa zona (pasa mucho en los pueblos), no te inventes el nombre: pon de título el tipo y el pueblo (por ejemplo "Restaurante en Boñar") y lo buscamos en Google Maps. En su descripción no inventes especialidades, platos, premios ni historia.
      3. Devuelve SOLO JSON estricto con este formato:
      [{"hora": "12:00", "titulo": "Nombre Oficial", "descripcion": "Descripción del sitio.", "precio": "10€", "resenas": "4.5/5", "transporte": "5 min andando", "lat": 42.59, "lon": -5.56, "tipo": "bar", "lugar": null, "telefono": "No disponible", "web": "No disponible", "horario": "12:00 - 16:00", "fuente": "URL del evento o null"}]
      "lugar": si la parada es un evento, ruta, mercadillo, concierto o similar, el local, plaza o recinto CONCRETO donde se celebra o empieza (por ejemplo "Bar Rebote", "Plaza de San Martín"); para un bar, restaurante o negocio normal, null.
      "precio": solo el importe de esa parada, corto ("12€", "10-15€" o "Gratis"), sin explicaciones ni paréntesis. Si la parada es comer o cenar, es lo que cuesta comer allí, no una consumición.
      "tipo" es uno de: bar, restaurante, cafeteria, discoteca, monumento, parque, museo, exposicion, concierto, teatro, mercadillo, feria, fiesta, festival, evento, ruta, deporte.
    `;

  // Gemini con plan B: si un modelo está saturado, prueba otro (ver lib/gemini.js)
  const { texto: textoIA, uso } = await llamarGemini(prompt, { sistema: REGLA_DATOS, para: 'usuario', tarea: 'planes', temperatura: 0.2, google: conGoogle, json: !conGoogle, msMax: Math.min(50000, inicio + msIA - Date.now()) });
  const rutaBruta = extraerJSON(textoIA, '[');
  if (!rutaBruta) throw new SyntaxError('La IA no devolvió una lista de paradas');
  // Lista vacía = no hay nada real que cumpla lo pedido: mejor decirlo que rellenar con otras cosas
  // (si pidió «4 bares», no: esos se buscan abajo entre los locales reales de la zona)
  if (rutaBruta.length === 0 && !pedido) return { exito: false, vacio: true, uso, mensaje: `No hemos encontrado nada real que encaje con «${String(apetece || 'lo que pides').slice(0, 60)}» ese día 🦁 Prueba con otra fecha o amplía el radio.` };

  // Todas las paradas se comprueban A LA VEZ en Google Places (antes, una detrás de otra):
  // el resultado es el mismo y en el mismo orden, pero tarda lo que la más lenta, no la suma de todas.
  const contexto = { fecha, lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY, limite: inicio + msTotal, fuentes: conGoogle ? null : new Set(agendaDelDia.map((e) => e.fuente).filter(Boolean)) };
  const paradasIA = quitarNoPedidas(rutaBruta
    .filter((p) => p && typeof p === 'object' && typeof p.titulo === 'string' && p.titulo.trim()), apetece);
  const enriquecidas = await Promise.all(paradasIA.map((p) => enriquecerSeguro(p, contexto)));
  // Dos bares que Google lleva al mismo local (pasa con «Bar en Boñar» o con nombres que no conoce) eran antes UNO solo
  await separarRepetidos(enriquecidas, paradasIA, contexto);

  const rutaValidada = [];
  let problemaGlobal = null, fueraDeProvincia = 0;
  for (const { parada, problemaConfigPlaces } of enriquecidas) {
    if (problemaConfigPlaces) problemaGlobal = problemaConfigPlaces;
    // Lo que Google sitúa fuera de la provincia no entra (p. ej. un bar de Benavente con radio grande desde La Bañeza)
    if (parada && enProvinciaLeon(parada.lat, parada.lon)) rutaValidada.push(parada);
    else if (parada) fueraDeProvincia++;
  }

  // Pidió 4 bares y la IA (o Google) dejó menos: se completa con locales reales del radio, primero los ya comprobados
  if (pedido) await completarPedido(rutaValidada, pedido, { sitios, contexto, fecha });

  // Si todo lo que salió era de fuera, el plan no es de León: se dice claro
  if (rutaValidada.length === 0 && fueraDeProvincia) return { exito: false, uso, mensaje: AVISO_MAPA.replace('Mueve el punto del mapa dentro de la provincia', 'Pide algo de la provincia') };
  if (rutaValidada.length === 0) return { exito: false, vacio: !problemaGlobal, uso, mensaje: problemaGlobal ? MENSAJE_GOOGLE_NO_RESPONDE : "No encontramos locales reales en esa zona. Amplía el radio." };

  const rutaFinal = ajustarAlPresupuesto(rutaValidada, presupuestoMax, pedido?.n || 1);
  if (rutaFinal.length === 0) return { exito: false, uso, mensaje: "Presupuesto muy bajo para esta zona." };

  // Paradas en orden cronológico y sin repetir el mismo sitio con otro nombre
  const sinRepetir = deduplicar(rutaFinal.map((p) => ({ ...p, categoria: p.tipo })));
  rutaFinal.splice(0, rutaFinal.length, ...sinRepetir.map(({ categoria, ...p }) => p));
  rutaFinal.sort((a, b) => (leerHora(a.hora).min ?? 24 * 60) - (leerHora(b.hora).min ?? 24 * 60));

  // El resto de la agenda de ese día que no ha entrado en el plan ("Más cosas ese día")
  // (sin lo que ya está en la ruta, aunque tenga otro nombre, y ordenado por hora)
  // Si el plan es algo concreto (1-2 paradas), solo cosas parecidas a lo pedido, no toda la agenda
  // Si pregunta «qué hay hoy», se enseña toda la agenda (no solo lo parecido) y lo de ese día va antes que lo de siempre
  const restoAgenda = (agendaPedida ? agendaDelDia : filtrarMasEseDia(agendaDelDia, rutaFinal, apetece))
    .filter((e) => !rutaFinal.some((p) => mismoEvento(e, { titulo: p.titulo, lugar: p.lugar, hora: p.hora, categoria: p.tipo })));
  const masEseDia = elegirMasEseDia(restoAgenda, agendaPedida ? 20 : 12);

  return { exito: true, plan: rutaFinal, prevision: previsionTiempo, masEseDia, nombreZona, uso };
}
