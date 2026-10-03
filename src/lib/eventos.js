// ============ BARRIDO DE EVENTOS (idea 3) ============
// Una vez al día (cron de Vercel → /api/barrido) recorremos todas las fuentes que podemos
// y guardamos la agenda de los próximos 14 días. Así cada plan ya sabe qué pasa ese día
// sin depender de que Gemini lo encuentre en sus 2-3 búsquedas en directo.
//
// Fuentes:
//  1. Datos abiertos de la Junta de Castilla y León: agenda cultural oficial, con fechas y coordenadas.
//  2. Gemini con Google Search, en varias búsquedas dirigidas a las agendas locales
//     (Ayuntamiento, Diputación, Diario de León, Leonoticias, iLeón, auditorios, museos, fiestas de pueblos...).
import { comando, enSegundoPlano, guardarJSON, leerJSON, nuevoId, varios } from "./almacen";
import { haversineKm } from "./planUtils";
import { hoyEnLeon } from "./estadisticas";
import { deduplicar, ordenarPorHora } from "./agenda";
import { MUNICIPIOS, ZONAS, zonaDe, zonaMasCercana } from "./zonas";
import { llamarGemini as llamarGeminiConPlanB, extraerJSON } from "./gemini";

const DIAS_VENTANA = 14;
// Mismos límites de la provincia que usa el mapa
const LIMITES = { latMin: 41.8, latMax: 43.45, lonMin: -7.35, lonMax: -4.45 };

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const esFecha = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const enProvincia = (lat, lon) => lat >= LIMITES.latMin && lat <= LIMITES.latMax && lon >= LIMITES.lonMin && lon <= LIMITES.lonMax;

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Fuente 1: Junta de Castilla y León (Opendatasoft) ----------
// No dependemos de los nombres exactos de las columnas: buscamos cada dato por patrón,
// así un cambio de nombre en el portal no rompe el barrido.
function campo(registro, patrones) {
  const claves = Object.keys(registro);
  for (const p of patrones) {
    const k = claves.find((c) => p.test(c));
    if (k != null && registro[k] != null && registro[k] !== "") return registro[k];
  }
  return null;
}

function fechaDe(valor) {
  if (!valor) return null;
  const m = String(valor).match(/(\d{4})-(\d{2})-(\d{2})/) || String(valor).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
}

function limpiarHtml(t) {
  return String(t || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizarRegistroJCyL(r) {
  const geo = campo(r, [/geo_?point/i, /coordenadas/i, /^geo/i]);
  let lat = Number(campo(r, [/^latitud/i, /^lat$/i]));
  let lon = Number(campo(r, [/^longitud/i, /^lon$/i, /^lng$/i]));
  if ((!lat || !lon) && geo && typeof geo === "object") { lat = Number(geo.lat); lon = Number(geo.lon); }
  const provincia = normalizar(campo(r, [/provincia/i]));
  const titulo = limpiarHtml(campo(r, [/^titulo/i, /^title/i, /^nombre_evento/i, /^nombre$/i]));
  const fecha = fechaDe(campo(r, [/fecha_?inicio/i, /fecha_de_inicio/i, /^fecha$/i, /start/i]));
  if (!titulo || !fecha) return null;
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0;
  const esLeon = provincia ? provincia.includes("leon") : tieneCoords && enProvincia(lat, lon);
  if (!esLeon) return null;
  return {
    titulo,
    fecha,
    fechaFin: fechaDe(campo(r, [/fecha_?fin/i, /fecha_de_fin/i, /end/i])),
    hora: limpiarHtml(campo(r, [/^hora/i])) || null,
    lugar: limpiarHtml(campo(r, [/lugar_celebracion/i, /nombre_lugar/i, /^lugar/i, /espacio/i, /recinto/i])) || null,
    localidad: limpiarHtml(campo(r, [/localidad/i, /municipio/i, /poblacion/i])) || null,
    precio: limpiarHtml(campo(r, [/precio/i, /entrada/i])) || null,
    categoria: limpiarHtml(campo(r, [/categoria/i, /tematica/i, /tipo/i])) || null,
    descripcion: limpiarHtml(campo(r, [/descripcion/i])).slice(0, 280) || null,
    fuente: campo(r, [/enlace/i, /^url/i, /link/i]) || "https://datosabiertos.jcyl.es/",
    lat: tieneCoords ? lat : null,
    lon: tieneCoords ? lon : null,
    origen: "jcyl",
  };
}

async function fuenteJCyL(desde, hasta) {
  const base = "https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records";
  const eventos = [];
  // Búsqueda de texto "León" (incluye la provincia en la dirección o el nombre) y filtramos después
  for (let offset = 0; offset < 600; offset += 100) {
    const url = `${base}?limit=100&offset=${offset}&where=${encodeURIComponent('"León"')}`;
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "CazurronicsPlanner/1.0" } });
    if (!res.ok) throw new Error(`JCyL respondió ${res.status}`);
    const datos = await res.json();
    const registros = datos.results || [];
    for (const r of registros) {
      const e = normalizarRegistroJCyL(r);
      if (e && e.fecha <= hasta && (e.fechaFin || e.fecha) >= desde) eventos.push(e);
    }
    if (registros.length < 100) break;
  }
  return eventos;
}

// ---------- Fuente 2: Gemini + Google Search, búsquedas dirigidas ----------
export const BUSQUEDAS = [
  { tema: "conciertos y música en directo", pistas: "aytoleon.es, Auditorio Ciudad de León, Espacio Vías, salas de conciertos, Diario de León, Leonoticias, iLeón, entradas.com, ticketmaster" },
  { tema: "teatro, danza, cine, monólogos y espectáculos", pistas: "Teatro El Albéitar, Auditorio Ciudad de León, Teatro Bergidum (Ponferrada), Teatro Gullón (Astorga), Instituto Leonés de Cultura (dipuleon.es)" },
  { tema: "exposiciones, museos y visitas guiadas", pistas: "MUSAC, Museo de León, Palacio del Conde Luna, Catedral de León, Real Colegiata de San Isidoro, Casa Botines, Turismo León (leon.es)" },
  { tema: "mercados, mercadillos, ferias de artesanía y jornadas gastronómicas", pistas: "Mercado del Conde Luna, ferias del Bierzo, jornadas de la cecina, del botillo y del cocido, Diario de León agenda" },
  { tema: "fiestas patronales, romerías y eventos en pueblos de la provincia", pistas: "Ponferrada, Astorga, La Bañeza, Villablino, Sahagún, Valencia de Don Juan, el Bierzo, la Montaña, Diputación de León" },
  { tema: "deporte, rutas guiadas, actividades al aire libre y planes para niños", pistas: "Cultural Leonesa, Ademar, Abanca Ademar, rutas de senderismo guiadas, ludotecas, actividades municipales" },
  { tema: "mercados semanales, mercadillos fijos, rastros y mercados de abastos (los que se repiten cada semana: indica en diasSemana qué días se celebran)", pistas: "mercado de la Plaza Mayor y del Conde Luna de León, mercadillos de los pueblos, rastro, mercados de productores, ayuntamientos de la provincia" },
  { tema: "exposiciones temporales abiertas ahora, ferias, festivales y ciclos que duran varios días o semanas (marca permanente: true si siguen abiertas sin fecha de cierre clara)", pistas: "salas de exposiciones, MUSAC, Museo de León, ILC, ferias de muestras, festivales de música y cine, ciclos culturales, jornadas gastronómicas" },
];

// Formato que pedimos a Gemini en todas las búsquedas de eventos
const FORMATO_EVENTO = `[{"titulo":"...","fecha":"AAAA-MM-DD (o null si se repite cada semana)","fechaFin":"AAAA-MM-DD o null","diasSemana":"null o lista de días que se repite, 0=domingo..6=sábado, p. ej. [3,6]","permanente":"true si es algo abierto durante semanas (exposición, feria) sin fecha de cierre clara","hora":"20:30 o null","lugar":"recinto","localidad":"municipio exacto donde se celebra (León, Ponferrada, Astorga, Villablino...)","precio":"Gratis / 12€ / null","categoria":"concierto|teatro|exposicion|mercado|feria|fiesta|festival|deporte|infantil|gastronomia|visita|otro","descripcion":"una frase","fuente":"https://...","lat":null,"lon":null}]`;

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
function leerDiasSemana(v) {
  if (!Array.isArray(v)) return null;
  const dias = v.map((d) => (typeof d === "number" ? d : DIAS.indexOf(normalizar(d)))).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return dias.length ? [...new Set(dias)] : null;
}
const diaDeLaSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

// Las búsquedas del barrido usan modelos "lite" con su propia cuota (ver lib/gemini.js),
// para no quitarle cuota a los planes de la gente
async function llamarGemini(prompt, msMax = 50000) {
  return llamarGeminiConPlanB(prompt, { para: "barrido", temperatura: 0.1, msMax });
}

// La lista de eventos de la respuesta (aunque venga con ```json, frases o citas "[1]" alrededor)
export function extraerListaJSON(texto) {
  return extraerJSON(texto, "[") || [];
}

export function validarEventoIA(e, desde, hasta) {
  if (!e || typeof e !== "object") return null;
  const titulo = limpiarHtml(e.titulo).slice(0, 140);
  const diasSemana = leerDiasSemana(e.diasSemana);
  const permanente = e.permanente === true || e.permanente === "true";
  // Lo recurrente (mercado de los sábados) o lo abierto durante semanas (una exposición)
  // no necesita fecha exacta: vale para toda la ventana.
  let fecha = esFecha(e.fecha) ? e.fecha : null;
  if (!fecha && (diasSemana || permanente)) fecha = desde;
  if (!titulo || !fecha || fecha > hasta) return null;
  let fechaFin = esFecha(e.fechaFin) && e.fechaFin >= fecha ? e.fechaFin : null;
  if (!fechaFin && (diasSemana || permanente)) fechaFin = hasta;
  if ((fechaFin || fecha) < desde) return null;
  // Solo aceptamos una URL real citada por el modelo (no los enlaces internos de Google)
  const fuente = typeof e.fuente === "string" && /^https?:\/\//.test(e.fuente) && !/vertexaisearch|grounding-api/.test(e.fuente) ? e.fuente : null;
  if (!fuente) return null; // sin fuente verificable no lo publicamos
  const lat = Number(e.lat), lon = Number(e.lon);
  const coords = Number.isFinite(lat) && Number.isFinite(lon) && enProvincia(lat, lon);
  return {
    titulo, fecha, fechaFin,
    hora: e.hora ? String(e.hora).slice(0, 20) : null,
    lugar: e.lugar ? limpiarHtml(e.lugar).slice(0, 100) : null,
    localidad: e.localidad ? limpiarHtml(e.localidad).slice(0, 60) : null,
    precio: e.precio ? String(e.precio).slice(0, 40) : null,
    categoria: e.categoria ? String(e.categoria).slice(0, 40) : null,
    descripcion: e.descripcion ? limpiarHtml(e.descripcion).slice(0, 280) : null,
    fuente,
    lat: coords ? lat : null,
    lon: coords ? lon : null,
    diasSemana,
    permanente: permanente || undefined,
    origen: "web",
  };
}

// ============ BARRIDO A LO BESTIA, POR TRAMOS ============
// Para pillar TODO lo que pasa en la provincia hacemos ~40 búsquedas al día, repartidas en 5 tramos
// (cada tramo cabe de sobra en el minuto que da Vercel). Cada tramo guarda lo suyo y luego se fusiona todo
// en la agenda de cada día, sin repetidos. El cron lanza un tramo cada hora de madrugada (vercel.json).
//
// Que sea CIERTO: cada evento necesita fecha dentro de la ventana y una URL de fuente, y esa fuente se comprueba:
//  · si es de una web que Google Search ha consultado de verdad en esa búsqueda → vale;
//  · si no, abrimos la URL: si existe, vale; si da 404 o el dominio no existe → fuera (era inventada).

const GRUPOS_ZONA = [
  { id: "cultura", nombre: "cultura y música", tema: "conciertos, música en directo, teatro, cine, monólogos, magia, exposiciones, presentaciones de libros, charlas y actividades culturales de ayuntamientos, casas de cultura y asociaciones" },
  { id: "fiestas", nombre: "fiestas, ferias y mercados", tema: "fiestas patronales, romerías, verbenas, ferias de muestras y de ganado, mercados y mercadillos (también los semanales: indica en diasSemana qué días), jornadas gastronómicas, catas, matanzas y degustaciones" },
  { id: "aire", nombre: "deporte, rutas y familia", tema: "deporte, carreras populares, marchas, rutas guiadas y de senderismo, visitas guiadas a monumentos y museos, actividades de naturaleza, talleres y planes para niños y familias" },
];

function semana(desde, n) { return [sumarDias(desde, n * 7), sumarDias(desde, n * 7 + 6)]; }

// León capital, a fondo: por tipo de sitio (el barrido gordo la recorre así; los pueblos, municipio a municipio)
const CAPITAL_A_FONDO = [
  ["salas y bares con música en directo, conciertos, jam sessions y DJ", "Barrio Húmedo, Barrio Romántico, El Ensanche, Espacio Vías, salas de conciertos de León, Leonoticias, iLeón, Diario de León agenda"],
  ["teatro, danza, cine, monólogos, magia y espectáculos", "Auditorio Ciudad de León, Teatro El Albéitar, Teatro San Francisco, cines de León, Fundación Sierra Pambley, venta de entradas"],
  ["exposiciones, museos, visitas guiadas y patrimonio", "MUSAC, Museo de León, Palacio del Conde Luna, Catedral, San Isidoro, Casa Botines, San Marcos, Turismo León"],
  ["actividades de centros cívicos, bibliotecas, Universidad de León, asociaciones vecinales y culturales, presentaciones de libros y charlas", "aytoleon.es, centros cívicos, Biblioteca Pública de León, ULE, Instituto Leonés de Cultura, Club de Prensa"],
  ["deporte en directo, carreras populares, rutas y planes para niños y familias", "Cultural Leonesa, Ademar, Baloncesto León, carreras populares de León, ludotecas, actividades municipales infantiles"],
  ["mercados, mercadillos, ferias, jornadas gastronómicas, catas y fiestas de barrio", "Mercado de la Plaza Mayor, Mercado del Conde Luna, ferias en la ciudad, fiestas de barrios de León, jornadas gastronómicas"],
];

// Trocea una lista en grupos de n
const trozos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
// Reparte búsquedas en tramos de máximo 10 (cada tramo cabe en el minuto que da Vercel)
const enTramos = (prefijo, nombre, busquedas) => trozos(busquedas, 10).map((bs, i, todos) => ({ id: `${prefijo}${i}`, nombre: `${nombre} · parte ${i + 1}/${todos.length}`, busquedas: bs }));

// Todos los tramos que existen:
//  · d0..d4  barrido diario (de madrugada): temas generales y las comarcas por tipo de plan
//  · r       repaso de novedades (2 veces al día): hoy y los 3 próximos días, zona por zona
//  · m0..m8  barrido GORDO (cada 2 días): municipio a municipio por toda la provincia + la capital a fondo
export function definirTramos(desde = hoyEnLeon()) {
  const hasta = sumarDias(desde, DIAS_VENTANA - 1);
  const general = (n) => {
    const [a, b] = semana(desde, n);
    return BUSQUEDAS.map((bq) => ({ ...bq, nombre: `${bq.tema.split(" (")[0]} · ${n ? "semana que viene" : "esta semana"}`, desde: a, hasta: b }));
  };
  const porZona = (g) => ZONAS.filter((z) => z.id !== "leon").map((z) => ({
    nombre: `${z.nombre} · ${g.nombre}`,
    zona: z.id,
    tema: `${g.tema} en ${z.nombre}: ${z.pueblos.slice(0, 18).join(", ")} y el resto de sus pueblos`,
    pistas: `${z.pistas}, webs y redes de sus ayuntamientos y juntas vecinales, asociaciones culturales, peñas, comisiones de fiestas`,
    donde: `${z.nombre}, provincia de León (España)`,
    desde, hasta,
  }));
  const diario = [
    { id: "d0", nombre: "Diario · León y provincia, esta semana", jcyl: true, busquedas: general(0) },
    { id: "d1", nombre: "Diario · León y provincia, semana que viene", busquedas: general(1) },
    { id: "d2", nombre: "Diario · comarcas, cultura y música", busquedas: porZona(GRUPOS_ZONA[0]) },
    { id: "d3", nombre: "Diario · comarcas, fiestas, ferias y mercados", busquedas: porZona(GRUPOS_ZONA[1]) },
    { id: "d4", nombre: "Diario · comarcas, deporte, rutas y familia", busquedas: porZona(GRUPOS_ZONA[2]) },
  ];
  const corto = sumarDias(desde, 3);
  const repaso = [{
    id: "r", nombre: "Repaso de novedades (hoy y 3 días)",
    busquedas: ZONAS.map((z) => ({
      nombre: `Novedades · ${z.nombre}`, zona: z.id,
      tema: `todo lo que se ha anunciado para hoy y los próximos 3 días (también lo publicado a última hora: conciertos, fiestas, mercadillos, ferias, actividades, deporte, rutas)`,
      pistas: `${z.pistas}, prensa local de hoy, redes de ayuntamientos y organizadores`,
      donde: z.id === "leon" ? "León capital (España)" : `${z.nombre} (${z.pueblos.slice(0, 10).join(", ")}), provincia de León (España)`,
      desde, hasta: corto,
    })),
  }];
  const gordo = [
    ...CAPITAL_A_FONDO.map(([tema, pistas]) => ({ nombre: `León capital · ${tema.split(",")[0]}`, zona: "leon", tema, pistas, donde: "León capital (España)", desde, hasta })),
    ...ZONAS.filter((z) => MUNICIPIOS[z.id]).flatMap((z) => trozos(MUNICIPIOS[z.id], 3).map((grupo) => ({
      nombre: `${grupo.join(", ")}`,
      zona: z.id,
      tema: `TODO lo que se celebra en los municipios de ${grupo.join(", ")} y en sus pueblos y pedanías: fiestas patronales, romerías, verbenas, conciertos, teatro, cine, exposiciones, mercadillos, ferias, jornadas gastronómicas, matanzas, deporte, carreras, rutas y visitas guiadas, talleres y actividades para niños`,
      pistas: `webs, Facebook e Instagram de los ayuntamientos de ${grupo.join(", ")}, juntas vecinales, comisiones de fiestas, asociaciones culturales, ${z.pistas}`,
      donde: `${grupo.join(", ")} (${z.nombre}, provincia de León, España)`,
      desde, hasta,
    }))),
  ];
  return [...diario, ...repaso, ...enTramos("m", "Barrido gordo", gordo)];
}
export const tramoPorId = (id, desde) => definirTramos(desde).find((t) => t.id === id) || null;
export const IDS_TRAMOS = definirTramos("2026-01-01").map((t) => t.id);
export const TRAMOS_DIARIOS = IDS_TRAMOS.filter((id) => id.startsWith("d"));
export const TRAMOS_GORDOS = IDS_TRAMOS.filter((id) => id.startsWith("m"));
// Compatibilidad: un número 0..4 es un tramo diario
export const idTramo = (t) => (typeof t === "number" || /^\d+$/.test(String(t)) ? `d${t}` : String(t));
export const NUM_TRAMOS = TRAMOS_DIARIOS.length;

async function fuenteBusqueda({ tema, pistas, donde, zona, desde, hasta }, msMax = 42000) {
  const prompt = `
    Eres el documentalista de Cazurronics Planner. Busca en Internet ${tema} en ${donde || "León capital y en la provincia de León (España)"}
    que se celebren entre el ${desde} y el ${hasta}, ambos incluidos.
    Mira sobre todo estas fuentes: ${pistas}. Consulta también agendas de prensa local, webs oficiales y venta de entradas.
    Haz varias búsquedas distintas (por pueblo, por tipo de plan y por fecha) para no dejarte nada.
    REGLAS: solo eventos con fecha confirmada en una fuente real; no inventes nada; la URL de "fuente" tiene que ser
    la página exacta donde lo has leído. Si un mismo evento sale en varias webs, ponlo UNA sola vez.
    Incluye también lo que no es de un solo día: mercados semanales (con diasSemana), exposiciones abiertas, ferias y festivales.
    Devuelve SOLO un array JSON (máximo 30 elementos) con este formato:
    ${FORMATO_EVENTO}
  `;
  const { texto, dominios } = await llamarGemini(prompt, msMax);
  const eventos = extraerListaJSON(texto).map((e) => validarEventoIA(e, desde, hasta)).filter(Boolean)
    .map((e) => (zona ? { ...e, zonaBusqueda: zona } : e)); // pista de zona por si el evento no trae municipio
  return { eventos, dominios };
}

// ---------- Comprobar que la fuente es de verdad ----------
const dominioDe = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export function dominioConsultado(url, dominios) {
  const d = dominioDe(url);
  if (!d || !dominios?.size) return false;
  for (const t of dominios) if (d === t || d.endsWith(`.${t}`) || t.endsWith(`.${d}`)) return true;
  return false;
}

// "ok" (la página existe) · "mal" (404, 410 o dominio inexistente) · "duda" (no se pudo saber a tiempo)
export async function comprobarUrl(url, ms = 3500) {
  try {
    const r = await fetch(url, {
      method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CazurronicsBot/1.0; +https://cazurronics.es)", Range: "bytes=0-4096" },
    });
    try { await r.body?.cancel(); } catch {}
    if (r.status === 404 || r.status === 410) return "mal";
    return r.status < 400 ? "ok" : "duda";
  } catch (e) {
    const codigo = `${e?.cause?.code || ""} ${e?.message || ""}`;
    return /ENOTFOUND|EAI_AGAIN|getaddrinfo|Invalid URL/i.test(codigo) ? "mal" : "duda";
  }
}

// Filtra una lista de eventos dejando solo los de fuente comprobada. Devuelve { buenos, descartados }
export async function verificarFuentes(eventos, dominios, { limite = Date.now() + 12000, enParalelo = 16 } = {}) {
  const porComprobar = [...new Set(eventos.filter((e) => e.origen !== "jcyl" && !dominioConsultado(e.fuente, dominios)).map((e) => e.fuente))];
  const estado = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(enParalelo, porComprobar.length) }, async () => {
    while (i < porComprobar.length) {
      const url = porComprobar[i++];
      const quedan = limite - Date.now();
      estado.set(url, quedan > 800 ? await comprobarUrl(url, Math.min(3500, quedan - 300)) : "duda");
    }
  }));
  const buenos = [], descartados = [];
  for (const e of eventos) {
    const ok = e.origen === "jcyl" || dominioConsultado(e.fuente, dominios) || estado.get(e.fuente) === "ok";
    (ok ? buenos : descartados).push(e);
  }
  return { buenos, descartados };
}

// Lanza tareas con un máximo de N a la vez
async function enTandas(tareas, maximo = 6) {
  const resultados = new Array(tareas.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      try { resultados[i] = { status: "fulfilled", value: await tareas[i]() }; }
      catch (reason) { resultados[i] = { status: "rejected", reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(maximo, tareas.length) }, trabajador));
  return resultados;
}

// ---------- Fusión ----------
function claveEvento(e) {
  return `${e.fecha}|${normalizar(e.titulo).replace(/[^a-z0-9]/g, "").slice(0, 32)}`;
}

export function fusionarPorDia(listas, desde, hasta) {
  const porDia = {};
  for (const e of listas.flat()) {
    const ultimo = e.fechaFin && e.fechaFin > e.fecha ? e.fechaFin : e.fecha;
    // un evento de varios días aparece en cada uno de ellos (dentro de la ventana)
    for (let d = e.fecha < desde ? desde : e.fecha, n = 0; d <= ultimo && d <= hasta && n < DIAS_VENTANA; d = sumarDias(d, 1), n++) {
      if (e.diasSemana?.length && !e.diasSemana.includes(diaDeLaSemana(d))) continue; // solo los días que se repite
      const dia = (porDia[d] ||= new Map());
      const k = claveEvento({ ...e, fecha: d });
      const previo = dia.get(k);
      // si se repite, nos quedamos con el que tenga más datos (y preferimos la fuente oficial)
      const puntos = (x) => (x.origen === "jcyl" ? 3 : 0) + (x.hora ? 1 : 0) + (x.lugar ? 1 : 0) + (x.lat != null ? 1 : 0);
      if (!previo || puntos(e) > puntos(previo)) dia.set(k, e);
    }
  }
  // además del nombre exacto, quitamos lo que es lo mismo con otro nombre ("Mercadillo Plaza Mayor" = "Mercado de la Plaza Mayor")
  return Object.fromEntries(Object.entries(porDia).map(([d, m]) => [d, ordenarPorHora(deduplicar([...m.values()]))]));
}

// Ejecuta UN tramo del barrido (o los diarios, uno detrás de otro, si no se dice cuál)
export async function barrerEventos({ tramo } = {}) {
  if (tramo == null) {
    let ultimo = null;
    for (const id of TRAMOS_DIARIOS) ultimo = await barrerEventos({ tramo: id });
    return ultimo;
  }
  const id = idTramo(tramo);
  const inicio = Date.now();
  const desde = hoyEnLeon();
  const hasta = sumarDias(desde, DIAS_VENTANA - 1);
  const def = tramoPorId(id, desde);
  if (!def) throw new Error(`El tramo ${id} no existe`);
  const informe = { tramo: id, nombre: def.nombre, desde, hasta, inicio: new Date(inicio).toISOString(), fuentes: {} };

  const tareas = [
    ...(def.jcyl ? [["Junta de Castilla y León (datos abiertos)", async () => ({ eventos: await fuenteJCyL(desde, hasta), dominios: new Set() })]] : []),
    ...def.busquedas.map((b) => [b.nombre, () => fuenteBusqueda(b)]),
  ];
  const resultados = await enTandas(tareas.map(([, f]) => f), 10);

  let encontrados = 0, descartados = 0, errores = 0;
  const nuevos = [];
  const limite = inicio + 54000; // todo el tramo cabe en el minuto de Vercel
  await Promise.all(resultados.map(async (r, i) => {
    const nombre = tareas[i][0];
    if (r.status !== "fulfilled") { errores++; informe.fuentes[nombre] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 200) }; return; }
    const { buenos, descartados: malos } = await verificarFuentes(r.value.eventos, r.value.dominios, { limite });
    encontrados += r.value.eventos.length; descartados += malos.length;
    informe.fuentes[nombre] = { ok: true, eventos: buenos.length, ...(malos.length ? { descartados: malos.length } : {}) };
    nuevos.push(...buenos.map((e) => ({ ...e, verificado: true })));
  }));

  informe.nuevos = nuevos.length ? await sumarALaAgenda(nuevos, desde, hasta) : 0;
  Object.assign(informe, { encontrados, descartados, errores, busquedas: tareas.length, fin: new Date().toISOString() });
  await guardarJSON(`eventos:tramo:${id}`, informe, 7 * 24 * 3600);
  await resumirBarridos();
  return informe;
}

// Mete eventos en la agenda de cada día SIN BORRAR lo que ya había: lo nuevo entra, lo repetido
// (aunque tenga otro nombre) no se duplica, y de cada repetido nos quedamos con la versión más completa.
// Lo antiguo sin fuente comprobada (de versiones anteriores de la web) se limpia aquí.
// Devuelve cuántos eventos nuevos han entrado.
// Cerrojo de la agenda: un solo proceso a la vez reescribe eventos:FECHA. Si dos escribieran a la vez
// (un cron y un plan, por ejemplo), el último borraría lo que acaba de meter el otro.
async function conCerrojo(tarea) {
  const marca = nuevoId(12);
  let mio = false;
  for (let intento = 0; intento < 40; intento++) {
    if (await comando(["SET", "barrido:fusion", marca, "NX", "EX", 30])) { mio = true; break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  try {
    return await tarea();
  } finally {
    // Solo lo suelta quien lo cogió (antes, quien se cansaba de esperar podía borrar el cerrojo de otro)
    if (mio && (await comando(["GET", "barrido:fusion"]).catch(() => null)) === marca) {
      await comando(["DEL", "barrido:fusion"]).catch(() => null);
    }
  }
}

async function sumarALaAgenda(eventos, desde, hasta) {
  return conCerrojo(async () => {
    const porDia = fusionarPorDia([eventos], desde, hasta);
    const fechas = Object.keys(porDia);
    if (!fechas.length) return 0;
    const actuales = await varios(fechas.map((f) => ["GET", `eventos:${f}`]));
    const fiable = (e) => e.verificado || e.origen === "jcyl";
    let nuevos = 0;
    const comandos = fechas.map((f, i) => {
      let antes = [];
      try { antes = JSON.parse(actuales[i] || "[]").filter(fiable); } catch {}
      const junto = ordenarPorHora(deduplicar([...antes, ...porDia[f]]));
      nuevos += Math.max(0, junto.length - antes.length);
      return ["SET", `eventos:${f}`, JSON.stringify(junto), "EX", 21 * 24 * 3600];
    });
    await varios(comandos);
    return nuevos;
  });
}

// Resumen para el panel: cada tramo con su última pasada, y el total de la agenda
export async function resumirBarridos() {
  const desde = hoyEnLeon();
  const fechas = Array.from({ length: DIAS_VENTANA }, (_, i) => sumarDias(desde, i));
  const [informes, dias] = await Promise.all([
    varios(IDS_TRAMOS.map((id) => ["GET", `eventos:tramo:${id}`])),
    varios(fechas.map((f) => ["GET", `eventos:${f}`])),
  ]);
  const leer = (v) => { try { return JSON.parse(v); } catch { return null; } };
  const lista = informes.map(leer);
  const hechos = lista.filter(Boolean);
  const defs = definirTramos(desde);
  await guardarJSON("eventos:ultimoBarrido", {
    desde, hasta: fechas.at(-1),
    fin: hechos.map((x) => x.fin).sort().at(-1) || null,
    total: dias.reduce((s, v) => s + (leer(v) || []).length, 0),
    descartados: hechos.reduce((s, x) => s + (x.descartados || 0), 0),
    tramos: IDS_TRAMOS.map((id, i) => ({
      tramo: id, nombre: lista[i]?.nombre || defs.find((d) => d.id === id)?.nombre, fin: lista[i]?.fin || null,
      busquedas: lista[i]?.busquedas || defs.find((d) => d.id === id)?.busquedas.length, nuevos: lista[i]?.nuevos ?? null,
      eventos: lista[i] ? Object.values(lista[i].fuentes || {}).reduce((s, r) => s + (r.eventos || 0), 0) : null,
      descartados: lista[i]?.descartados || 0, errores: lista[i]?.errores || 0,
    })),
    // Solo las búsquedas que han fallado (para no llenar el panel con 100 filas)
    fuentes: Object.fromEntries(hechos.flatMap((x) => Object.entries(x.fuentes || {}).filter(([, r]) => !r.ok))),
  });
}

// ---------- Lectura ----------
export async function eventosDelDia(fecha, { lat, lon, radio } = {}) {
  if (!esFecha(fecha)) return [];
  const lista = (await leerJSON(`eventos:${fecha}`)) || [];
  if (lat == null || lon == null || !radio) return lista;
  return lista.filter((e) => cercaDe(e, Number(lat), Number(lon), Number(radio)));
}

// ¿Está este evento dentro de la zona de búsqueda? Con coordenadas, por distancia.
// Sin coordenadas, por su zona (León capital, Bierzo, Astorga...): así un plan de 3 km en la capital
// no se llena de cosas de Babia o de los Ancares.
const RADIO_ZONA = { leon: 4.5, alfoz: 11 };
export function cercaDe(e, lat, lon, radio) {
  if (e.lat != null && e.lon != null) return haversineKm(lat, lon, Number(e.lat), Number(e.lon)) <= radio * 1.2;
  if (radio >= 60) return true; // toda la provincia
  const zona = zonaDe(e);
  if (zona === "otros") return false;
  if (zona === zonaMasCercana(lat, lon)) return true;
  const z = ZONAS.find((x) => x.id === zona);
  const [zl, zo] = z.centroReal || [z.lat, z.lon];
  return haversineKm(lat, lon, zl, zo) <= radio + (RADIO_ZONA[zona] || 25);
}

export async function eventosProximos(dias = DIAS_VENTANA) {
  const desde = hoyEnLeon();
  const fechas = Array.from({ length: dias }, (_, i) => sumarDias(desde, i));
  const res = await varios(fechas.map((f) => ["GET", `eventos:${f}`]));
  return fechas.map((fecha, i) => {
    let eventos = [];
    try { eventos = JSON.parse(res[i] || "[]"); } catch {}
    return { fecha, eventos };
  });
}

export function eventosParaPrompt(eventos, max = 30) {
  if (!eventos.length) return "";
  const lineas = ordenarPorHora(deduplicar(eventos)).slice(0, max).map((e) =>
    `- ${e.titulo}${e.hora ? ` (${e.hora})` : ""}${e.lugar ? ` en ${e.lugar}` : ""}${e.localidad ? `, ${e.localidad}` : ""}${e.precio ? ` · ${e.precio}` : ""}${e.categoria ? ` [${e.categoria}]` : ""} · fuente: ${e.fuente}`
  );
  return `AGENDA VERIFICADA DE ESE DÍA (barrido de fuentes locales: eventos, mercadillos, ferias, exposiciones y fiestas).
OBLIGATORIO: si alguno encaja con lo que pide el usuario, el plan DEBE incluirlo (con su hora real y su campo "fuente"). Si hay varios compatibles, mezcla eventos con sitios para comer o tomar algo:
${lineas.join("\n")}`;
}

// ============ BARRIDO A MEDIDA DE CADA PETICIÓN ============
// Además del barrido diario, cada plan lanza 4 búsquedas en paralelo pensadas para ESA petición:
// lo que pide el usuario ese día, lo que está en marcha aunque no sea de un día (mercadillos,
// ferias, exposiciones), los pueblos de alrededor y planes concretos para su "apetece".
// Lo que encuentra se suma a la agenda de ese día, así la agenda crece con cada búsqueda.
function huella(texto) {
  let h = 0;
  for (const c of normalizar(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export async function barridoAMedida({ fecha, apetece, zona, radio, lat, lon }) {
  if (!esFecha(fecha)) return [];
  const clave = `amedida:${fecha}:${huella(`${zona}|${Math.round(Number(radio))}|${apetece}`)}`;
  const enCache = await leerJSON(clave).catch(() => null);
  if (enCache) return enCache;

  const nombreDia = DIAS[diaDeLaSemana(fecha)];
  const donde = `${zona || "León"} (provincia de León, España), en un radio de ${radio} km`;
  const peticion = String(apetece || "").slice(0, 300) || "un plan de ocio";
  const temas = [
    `eventos, actividades y planes del ${fecha} (${nombreDia}) en ${donde} relacionados con lo que pide el usuario: "${peticion}"`,
    `todo lo que está en marcha el ${fecha} (${nombreDia}) en ${donde} aunque no sea de un solo día: mercadillos y mercados que se celebran los ${nombreDia}s, ferias, exposiciones temporales abiertas, festivales, fiestas patronales, jornadas gastronómicas y ciclos`,
    `fiestas, romerías, ferias y eventos en los pueblos y localidades cercanas a ${donde} el ${fecha}`,
    `planes concretos y especiales para "${peticion}" en ${donde} ese ${nombreDia}: visitas guiadas, catas, talleres, rutas, conciertos pequeños, actividades con reserva`,
  ];
  const prompt = (tema) => `
    Eres el documentalista de Cazurronics Planner. Busca en Internet, en todas las fuentes que puedas
    (webs de ayuntamientos y de la Diputación de León, Junta de Castilla y León, prensa local como Diario de León, Leonoticias o iLeón,
    redes y webs de los organizadores, venta de entradas, turismo), ${tema}.
    REGLAS: solo cosas confirmadas en una fuente real; no inventes nada; incluye la URL exacta donde lo has visto.
    Devuelve SOLO un array JSON (máximo 15 elementos) con este formato:
    ${FORMATO_EVENTO}
  `;
  const resultados = await Promise.allSettled(temas.map((t) => llamarGemini(prompt(t), 22000)));
  // Solo lo que tiene fuente comprobada (web consultada de verdad por Google, o URL que existe)
  const limite = Date.now() + 5000;
  const comprobados = await Promise.all(resultados.filter((r) => r.status === "fulfilled").map(async (r) => {
    const lista = extraerListaJSON(r.value.texto).map((e) => validarEventoIA(e, fecha, fecha)).filter(Boolean);
    return (await verificarFuentes(lista, r.value.dominios, { limite })).buenos;
  }));
  const encontrados = comprobados.flat().map((e) => ({ ...e, origen: "peticion", verificado: true }));

  const delDia = fusionarPorDia([encontrados], fecha, fecha)[fecha] || [];
  const cerca = lat != null && lon != null
    ? delDia.filter((e) => cercaDe(e, Number(lat), Number(lon), Number(radio)))
    : delDia;

  // Caché 6 h para la misma petición y suma a la agenda pública de ese día.
  // En segundo plano: el plan no espera por estas escrituras (ni por el cerrojo de la agenda).
  enSegundoPlano(() => guardarJSON(clave, cerca, 6 * 3600), "barrido a medida (caché)");
  if (cerca.length) enSegundoPlano(() => sumarAlDia(fecha, cerca), "barrido a medida (agenda)");
  return cerca;
}

// Con el mismo cerrojo que el barrido de los crons, para no pisarse
async function sumarAlDia(fecha, nuevos) {
  await conCerrojo(async () => {
    const actuales = (await leerJSON(`eventos:${fecha}`)) || [];
    const fusion = fusionarPorDia([actuales, nuevos], fecha, fecha)[fecha] || [];
    await guardarJSON(`eventos:${fecha}`, fusion, 21 * 24 * 3600);
  });
}

// Une la agenda guardada con la del barrido a medida, sin duplicados
export function unirEventos(...listas) {
  return ordenarPorHora(deduplicar(listas.flat().filter(Boolean)));
}

// Pone al día lo más atrasado: un tramo diario con más de 20 h, o uno del barrido gordo con más de 46 h
// (en local, donde no hay cron, así la agenda se va llenando sola). Se llama en segundo plano con after().
export async function asegurarBarridoReciente() {
  // En producción ya están los crons de Vercel: aquí no se lanza nada, para no gastar la cuota de Gemini
  // justo cuando mucha gente está pidiendo planes (solo en local, donde no hay cron)
  if (process.env.VERCEL) return false;
  // Como mucho un tramo cada 10 minutos
  if (!(await comando(["SET", "barrido:pausa", "1", "NX", "EX", 600]))) return false;
  const ids = [...TRAMOS_DIARIOS, ...TRAMOS_GORDOS];
  const informes = await varios(ids.map((id) => ["GET", `eventos:tramo:${id}`]));
  const edad = (v) => { try { const f = JSON.parse(v)?.fin; return f ? Date.now() - Date.parse(f) : Infinity; } catch { return Infinity; } };
  const atrasados = ids.map((id, i) => ({ id, edad: edad(informes[i]), max: (id.startsWith("m") ? 46 : 20) * 3600 * 1000 }))
    .filter((t) => t.edad >= t.max)
    .sort((a, b) => (a.id[0] === b.id[0] ? b.edad - a.edad : a.id.startsWith("d") ? -1 : 1)); // primero los diarios
  for (const t of atrasados) {
    if (!(await comando(["SET", `barrido:cerrojo:${t.id}`, "1", "NX", "EX", 300]))) continue; // ese tramo ya está en marcha
    await barrerEventos({ tramo: t.id });
    return t.id;
  }
  return false;
}
