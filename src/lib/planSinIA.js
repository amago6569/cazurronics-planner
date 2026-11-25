// ============ PLAN SIN IA ============
// El plan B de Alejandro (24-11-2026): si Gemini no responde (sin saldo, clave rechazada, tope de gasto del día, caído),
// el plan sale igual, montado con lo que ya está comprobado: la agenda verificada del día, el catálogo de locales que ya
// han pasado por Google Places y las rutas y parajes de lib/rutas.js. 0 € de IA. Cada parada pasa por la misma
// comprobación de siempre (enriquecerParada: ficha real, abierto ese día y a esa hora, dentro de la provincia).
// Nunca más «Estamos recargando la IA».
import { enriquecerParada, haversineKm } from './planUtils';
import { esDeVariosDias, familia, leerHora } from './agenda';
import { paradasPedidas, pideAgenda, tiposIguales } from './intencion';
import { enProvinciaLeon } from './provincia';
import { PARAJES, RUTAS } from './rutas';
import { seParecen } from './nombres';

const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

// Cómo se llega desde la parada anterior: andando hasta 2,5 km (4,5 km/h), si no en coche
export function andando(a, b) {
  const km = haversineKm(Number(a.lat), Number(a.lon), Number(b.lat), Number(b.lon));
  if (!Number.isFinite(km)) return '';
  return km <= 2.5 ? `${Math.max(2, Math.round((km / 4.5) * 60))} min andando desde la parada anterior` : `${Math.round(km)} km en coche desde la parada anterior`;
}

export const PRECIO_TIPICO = { bar: '2-4€', cafeteria: '3-5€', discoteca: '8-12€', restaurante: '15-25€', museo: '3-6€', monumento: 'Gratis', ruta: 'Gratis', parque: 'Gratis' };
const DURA = { bar: 50, cafeteria: 45, restaurante: 90, discoteca: 120, museo: 90, ruta: 180, parque: 120 };
const BUSCAR_EN_MAPS = { bar: 'Bar de tapas', restaurante: 'Restaurante', cafeteria: 'Cafetería', discoteca: 'Pub de copas', museo: 'Museo' };

// Lo que pide, en el orden en que lo escribe. Cada hueco es un tipo de local (con su hora natural), un trozo de la agenda
// (familias de lib/agenda.js) o una ruta. El primero que encaja se queda con ese trozo de texto: «salir de fiesta» es
// una discoteca, no las fiestas del pueblo.
const HUECOS = [
  [/\bdesayun\w*/, { tipo: 'cafeteria', hora: 9 * 60 + 30 }],
  [/\b(?:salir de fiesta|de marcha|copas?|discotecas?|bailar|pub)\b/, { tipo: 'discoteca', hora: 23 * 60 + 30 }],
  [/\b(?:vermu\w*|aperitivo)\b/, { tipo: 'bar', hora: 13 * 60, n: 2 }],
  [/\b(?:comer|comida|almorzar|almuerzo|menu|cocido|lechazo|asador|meson|restaurantes?)\b/, { tipo: 'restaurante', hora: 14 * 60 }],
  [/\b(?:merendar|merienda|cafes?|cafeterias?|chocolate|churros|dulces?|postres?|brunch)\b/, { tipo: 'cafeteria', hora: 17 * 60 + 30 }],
  [/\b(?:tapas?|tapear|tapeo|pinchos?|vinos?|canas?|cervezas?|tomar algo|bares?|potes?|potear)\b/, { tipo: 'bar', hora: 20 * 60, n: 2 }],
  [/\b(?:cenar|cena)\b/, { tipo: 'restaurante', hora: 21 * 60 }],
  [/\b(?:conciertos?|musica|directo)\b/, { agenda: ['musica'] }],
  [/\b(?:teatro|cine|monologos?|espectaculos?|danza|magia|circo)\b/, { agenda: ['escena'] }],
  [/\b(?:charlas?|conferencias?|presentacion|libros?|coloquio|talleres?)\b/, { agenda: ['charla'] }],
  [/\b(?:partidos?|futbol|baloncesto|balonmano|deporte)\b/, { agenda: ['deporte'] }],
  [/\b(?:mercad\w*|rastro|ferias?|artesan\w*)\b/, { agenda: ['mercado', 'feria'] }],
  [/\b(?:fiestas?|romeria|verbena|san froilan|patronales)\b/, { agenda: ['fiesta'] }],
  [/\b(?:museos?|exposicion\w*|arte|cultura\w*|historia|patrimonio)\b/, { agenda: ['expo', 'escena'], tipo: 'museo', hora: 11 * 60 }],
  [/\b(?:ninos|ninas|crios|familia|infantil|peques|chavales)\b/, { agenda: ['infantil'], ruta: true }],
  [/\b(?:ruta|caminar|caminata|andar|senderismo|naturaleza|montana|excursion|bici|cuevas?|cascadas?|mirador|hoces|lago)\b/, { ruta: true }],
];
const ES_CHARLA = /charla|conferencia|presentaci|coloquio|ponencia|taller|club de lectura|mesa redonda/;

// «Cenar algo leonés», «un cocido», «comida típica»: el restaurante se busca primero en Google Maps por esa cocina
// («Restaurante de cocina leonesa en León»), antes que el mejor valorado del catálogo, que no sabe qué cocina tiene.
// El 24-11-2026 «cenar algo leonés» daba el restaurante de un hotel. null si no pide ninguna cocina.
export function cocinaPedida(apetece) {
  const t = ` ${sinTildes(apetece)} `;
  if (/\bcocido/.test(t)) return /maragat|astorga|castrillo/.test(t) ? 'Restaurante de cocido maragato' : 'Restaurante con cocido';
  if (/\bbotillo/.test(t)) return 'Restaurante con botillo';
  if (/\b(?:leones[ae]?s?|tipic[oa]s?|tradicional(?:es)?|de la tierra|casera|cecina|morcilla|lechazo|cocina de aqui)\b/.test(t)) return 'Restaurante de cocina leonesa';
  return null;
}

// [{ pos, tipo?, hora?, n?, agenda?, ruta? }] en el orden del texto. Sin nada reconocible: plan abierto (vacío)
export function huecosPedidos(apetece) {
  const t = ` ${sinTildes(apetece).replace(/\s+/g, ' ')} `;
  const usados = [];
  const huecos = [];
  for (const [re, hueco] of HUECOS) {
    const g = new RegExp(re.source, 'g');
    for (const m of t.matchAll(g)) {
      const ini = m.index, fin = m.index + m[0].length;
      if (usados.some(([a, b]) => ini < b && fin > a)) continue;
      usados.push([ini, fin]);
      huecos.push({ pos: ini, ...hueco });
      break;
    }
  }
  // «4 bares» manda sobre el hueco de bar genérico
  const pedido = paradasPedidas(apetece);
  if (pedido) {
    const i = huecos.findIndex((h) => h.tipo && tiposIguales(pedido.tipo).includes(h.tipo));
    if (i >= 0) huecos[i] = { ...huecos[i], tipo: pedido.tipo, n: pedido.n, agenda: null };
    else huecos.push({ pos: -1, tipo: pedido.tipo, n: pedido.n, hora: { bar: 20 * 60, restaurante: 14 * 60, cafeteria: 17 * 60 + 30, discoteca: 23 * 60 + 30, museo: 11 * 60, monumento: 11 * 60 }[pedido.tipo] ?? 20 * 60 });
  }
  return huecos.sort((a, b) => a.pos - b.pos);
}

// El tipo de parada que se le da a un evento de la agenda
const TIPO_EVENTO = { musica: 'concierto', escena: 'teatro', expo: 'exposicion', mercado: 'mercadillo', feria: 'feria', fiesta: 'fiesta', deporte: 'deporte', visita: 'ruta' };
export function tipoDeEvento(e) {
  const c = sinTildes(e?.categoria);
  if (/^(?:concierto|teatro|exposicion|mercadillo|feria|fiesta|festival|deporte|ruta)$/.test(c)) return c;
  return TIPO_EVENTO[familia(e)] || 'evento';
}

// Eventos de la agenda que encajan con un hueco: primero lo que solo pasa ese día y con hora
export function eventosDelHueco(agenda, familias) {
  const encaja = (e) => familias.some((f) => (f === 'charla' ? ES_CHARLA.test(sinTildes(`${e?.titulo} ${e?.categoria}`)) : familia(e) === f));
  return (agenda || []).filter(encaja).sort((a, b) => Number(esDeVariosDias(a)) - Number(esDeVariosDias(b)) || Number(leerHora(a.hora).min == null) - Number(leerHora(b.hora).min == null));
}

// Lo más destacado del día para un plan abierto o «qué hay hoy»: lo que solo pasa ese día, con hora, sin visitas de siempre
export function destacadosDelDia(agenda, cuantos) {
  const visitaDeSiempre = (e) => /^visita/.test(sinTildes(e?.categoria)) && esDeVariosDias(e);
  return [...(agenda || [])].filter((e) => !visitaDeSiempre(e))
    .sort((a, b) => Number(esDeVariosDias(a)) - Number(esDeVariosDias(b)) || Number(leerHora(a.hora).min == null) - Number(leerHora(b.hora).min == null))
    .slice(0, cuantos);
}

// La hora a la que se propone un evento: la suya; si es «todo el día» (una feria, una exposición), a media mañana
// o, si es para hoy, en cuanto se pueda. Nunca «Todo el día».
function horaDeEvento(e, desde) {
  const { min } = leerHora(e?.hora);
  if (min != null) return Math.max(min, desde);
  return Math.max(11 * 60, desde);
}

// Las coordenadas de la agenda solo se fían si vienen de los datos abiertos de la Junta (las del barrido las pone la IA)
const paradaDeEvento = (e, hora) => ({
  titulo: e.titulo, tipo: tipoDeEvento(e), hora: hhmm(hora), lugar: e.lugar || null, fuente: e.fuente || null,
  descripcion: e.descripcion || '', precio: e.precio || 'Consultar', lat: e.lat, lon: e.lon,
  ...(e.origen === 'jcyl' && e.lat != null && e.lon != null ? { coordsFiables: true } : {}),
});

// Rutas y parajes de la lista dentro del radio, el más cercano primero
export function rutasCerca(lat, lon, radio) {
  return [...PARAJES.map((p) => ({ ...p, tipo: 'parque' })), ...RUTAS.map((r) => ({ ...r, tipo: 'ruta', que: `ruta señalizada en ${r.zona}` }))]
    .map((r) => ({ ...r, km: haversineKm(Number(lat), Number(lon), r.lat, r.lon) }))
    .filter((r) => r.km <= Math.max(Number(radio) || 0, 5) * 1.1)
    .sort((a, b) => a.km - b.km);
}

// Locales del catálogo de ese tipo, ordenados para ir andando: los que están a ≤1,2 km (15 min) del punto de partida,
// por nota de la comunidad; luego el resto por cercanía
export function localesParaHueco(sitios, tipo, desde, evitar = []) {
  const tipos = tiposIguales(tipo);
  const lista = (sitios || []).filter((s) => tipos.includes(String(s.t || '').toLowerCase()) && !evitar.some((n) => seParecen(n, s.n)))
    .map((s) => ({ ...s, km: haversineKm(desde.lat, desde.lon, s.la, s.lo) }));
  const cerca = lista.filter((s) => s.km <= 1.2).sort((a, b) => (b.g || 0) - (a.g || 0) || (b.v || 0) - (a.v || 0) || a.km - b.km);
  const lejos = lista.filter((s) => s.km > 1.2).sort((a, b) => a.km - b.km);
  return [...cerca, ...lejos];
}

const enriquecerSeguro = (p, contexto) => enriquecerParada(p, contexto).catch((e) => {
  console.error('[plan sin IA] parada', e?.message || e);
  return { parada: null };
});

// Prueba candidatos de uno en uno (como mucho «intentos») hasta que uno pasa la comprobación de Google
async function primeroQueValga(candidatos, contexto, usados, enriquecer, intentos = 3) {
  for (const c of candidatos.slice(0, intentos)) {
    if (Date.now() > contexto.limite - 3000) return null;
    const r = await enriquecer(c, { ...contexto, excluir: new Set(usados.ids) });
    const p = r?.parada;
    if (!p || !enProvinciaLeon(p.lat, p.lon)) continue;
    if (p.placeId && usados.ids.has(p.placeId)) continue;
    if (usados.nombres.some((n) => seParecen(n, p.titulo))) continue;
    return p;
  }
  return null;
}

// Devuelve { plan, faltan: [textos de lo que no se ha encontrado] }
// datos: { peticion, agenda (ya filtrada por fecha/temporada/hora), sitios (catálogo del radio), contexto (el de enriquecerParada), ahora }
export async function montarSinIA({ peticion, agenda, sitios, contexto, ahora = new Date() }, enriquecer = enriquecerSeguro) {
  const { apetece, fecha, lat, lon, radio } = peticion;
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);
  const [h, m] = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora).split(':').map(Number);
  // Si es para hoy, nada antes de dentro de media hora (redondeado al cuarto)
  const desde = fecha === hoy ? Math.ceil((h * 60 + m + 30) / 15) * 15 : 0;
  const usados = { ids: new Set(), nombres: [] };
  const plan = [];
  const faltan = [];
  const apuntar = (p) => { plan.push(p); if (p.placeId) usados.ids.add(p.placeId); usados.nombres.push(p.titulo); };

  // «Qué hay hoy»: la agenda del día, sin locales
  if (pideAgenda(apetece)) {
    const lista = destacadosDelDia(agenda, 6);
    const hechas = await Promise.all(lista.map((e) => enriquecer(paradaDeEvento(e, horaDeEvento(e, desde)), contexto)));
    for (const r of hechas) if (r?.parada && enProvinciaLeon(r.parada.lat, r.parada.lon) && !usados.nombres.some((n) => seParecen(n, r.parada.titulo))) apuntar(r.parada);
    if (!plan.length) faltan.push('eventos en la agenda de ese día');
    return { plan, faltan };
  }

  let huecos = huecosPedidos(apetece);
  // Plan abierto («un plan», «sorpréndeme»): lo más destacado del día y algo de comer o beber cerca, a su hora
  if (!huecos.length) {
    const noche = /\b(?:noche|cenar|cena)\b/.test(sinTildes(apetece)) || desde >= 19 * 60;
    huecos = [{ agenda: ['*'] }, noche ? { tipo: 'restaurante', hora: 21 * 60 } : { tipo: 'restaurante', hora: 14 * 60 }, ...(noche ? [{ tipo: 'bar', hora: 23 * 60, n: 1 }] : [])];
  }

  let punto = { lat: Number(lat), lon: Number(lon) };
  let reloj = desde;
  for (const hueco of huecos) {
    if (Date.now() > contexto.limite - 3000) break;
    // 1) De la agenda
    if (hueco.agenda) {
      const eventos = hueco.agenda[0] === '*' ? destacadosDelDia(agenda, 3) : eventosDelHueco(agenda, hueco.agenda);
      const candidatos = eventos.filter((e) => !usados.nombres.some((n) => seParecen(n, e.titulo)))
        .map((e) => paradaDeEvento(e, horaDeEvento(e, desde)));
      const p = await primeroQueValga(candidatos, contexto, usados, enriquecer);
      if (p) {
        apuntar(p);
        punto = { lat: Number(p.lat), lon: Number(p.lon) };
        const { min, fin } = leerHora(p.hora);
        reloj = Math.max(reloj, (fin ?? (min ?? reloj) + 90));
        if (!hueco.ruta) continue;
      } else if (!hueco.tipo && !hueco.ruta) {
        faltan.push(`${hueco.agenda[0] === '*' ? 'eventos' : hueco.agenda.join(' o ')} en la agenda de ese día`);
        continue;
      }
    }
    // 2) Una ruta o un paraje de la lista
    if (hueco.ruta) {
      const r = rutasCerca(lat, lon, radio).find((x) => !usados.nombres.some((n) => seParecen(n, x.nombre)));
      if (!r) { faltan.push('rutas o parajes dentro del radio'); continue; }
      const hora = Math.max(11 * 60, desde);
      const p = await primeroQueValga([{ titulo: r.nombre, tipo: r.tipo, hora: hhmm(hora), descripcion: `${r.que.charAt(0).toUpperCase()}${r.que.slice(1)}.`, precio: 'Gratis', lat: r.lat, lon: r.lon }], contexto, usados, enriquecer, 1);
      if (p) { apuntar(p); punto = { lat: Number(p.lat), lon: Number(p.lon) }; reloj = Math.max(reloj, hora + DURA[r.tipo]); }
      else faltan.push(r.nombre);
      continue;
    }
    // 3) Locales: catálogo comprobado y, si no hay, búsqueda en Google Maps de la zona («Bar de tapas en Boñar»)
    if (!hueco.tipo) continue;
    const n = Math.max(1, hueco.n || 1);
    const dura = DURA[hueco.tipo] || 60;
    let hora = Math.max(hueco.hora ?? 20 * 60, reloj, desde);
    // Orden: los del catálogo a 15 min andando, luego una búsqueda en Maps de la zona y, por último, los del catálogo más lejos
    const cocina = hueco.tipo === 'restaurante' ? cocinaPedida(apetece) : null;
    const probarA = (h) => {
      const aParada = (s) => ({ titulo: s.n, tipo: hueco.tipo, hora: hhmm(Math.min(h, 24 * 60 - 1)), precio: s.p || PRECIO_TIPICO[hueco.tipo] || null, lat: s.la, lon: s.lo, descripcion: '' });
      const enMaps = (q) => ({ titulo: `${q} en ${contexto.nombreZona || 'León'}`, tipo: hueco.tipo, hora: hhmm(Math.min(h, 24 * 60 - 1)), precio: PRECIO_TIPICO[hueco.tipo] || null, descripcion: '' });
      const locales = localesParaHueco(sitios, hueco.tipo, punto, usados.nombres);
      const cerca = locales.filter((s) => s.km <= 1.2).slice(0, 3).map(aParada);
      const lejos = locales.filter((s) => s.km > 1.2).slice(0, 2).map(aParada);
      const reserva = BUSCAR_EN_MAPS[hueco.tipo] ? [enMaps(BUSCAR_EN_MAPS[hueco.tipo])] : [];
      const candidatos = [...(cocina ? [enMaps(cocina)] : []), ...cerca, ...reserva, ...lejos];
      return primeroQueValga(candidatos, contexto, usados, enriquecer, candidatos.length);
    };
    // «3 bares en Boñar» un martes: a las 20:50 ya no hay nada abierto y salía 1 bar. Si detrás del primero ya está todo
    // cerrado, se prueba antes de él (como mucho hasta las 18:00, o 2 horas antes si es de mediodía), igual que en montarPlan
    let primera = null, haciaAtras = false;
    for (let i = 0; i < n; i++) {
      if (Date.now() > contexto.limite - 3000) break;
      const suelo = primera == null ? 0 : Math.max(desde, primera >= 19 * 60 ? 18 * 60 : primera - 120);
      let aLas = haciaAtras ? primera - dura : hora;
      let p = aLas >= suelo ? await probarA(aLas) : null;
      if (!p && !haciaAtras && primera != null) {
        haciaAtras = true;
        aLas = primera - dura;
        if (aLas >= suelo) p = await probarA(aLas);
      }
      if (!p) { faltan.push(`${hueco.tipo === 'cafeteria' ? 'cafetería' : hueco.tipo} abierto a las ${hhmm(hora)}`); break; }
      if (!p.precio) p.precio = PRECIO_TIPICO[hueco.tipo] || null;
      p.hora = hhmm(Math.min(aLas, 24 * 60 - 1));
      apuntar(p);
      punto = { lat: Number(p.lat), lon: Number(p.lon) };
      if (haciaAtras) { primera = aLas; continue; }
      if (primera == null) primera = aLas;
      hora += dura;
      reloj = Math.max(reloj, hora);
    }
  }

  // Cómo se llega desde la anterior, en orden de hora
  plan.sort((a, b) => (leerHora(a.hora).min ?? 0) - (leerHora(b.hora).min ?? 0));
  plan.forEach((p, i) => { p.transporte = i ? andando(plan[i - 1], p) : ''; });
  return { plan, faltan };
}

// El aviso que va encima de un plan sin IA: qué falta, dicho claro (nunca se rellena con otra cosa)
export function avisoSinIA(faltan) {
  if (!faltan?.length) return null;
  return `No hemos encontrado ${faltan.slice(0, 3).join(', ')}. Te dejamos lo que sí hay.`;
}
