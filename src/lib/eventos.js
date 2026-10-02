// ============ BARRIDO DE EVENTOS (idea 3) ============
// Una vez al día (cron de Vercel → /api/barrido) recorremos todas las fuentes que podemos
// y guardamos la agenda de los próximos 14 días. Así cada plan ya sabe qué pasa ese día
// sin depender de que Gemini lo encuentre en sus 2-3 búsquedas en directo.
//
// Fuentes:
//  1. Datos abiertos de la Junta de Castilla y León: agenda cultural oficial, con fechas y coordenadas.
//  2. Gemini con Google Search, en varias búsquedas dirigidas a las agendas locales
//     (Ayuntamiento, Diputación, Diario de León, Leonoticias, iLeón, auditorios, museos, fiestas de pueblos...).
import { comando, guardarJSON, leerJSON, varios } from "./almacen";
import { haversineKm } from "./planUtils";
import { hoyEnLeon } from "./estadisticas";

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
const FORMATO_EVENTO = `[{"titulo":"...","fecha":"AAAA-MM-DD (o null si se repite cada semana)","fechaFin":"AAAA-MM-DD o null","diasSemana":"null o lista de días que se repite, 0=domingo..6=sábado, p. ej. [3,6]","permanente":"true si es algo abierto durante semanas (exposición, feria) sin fecha de cierre clara","hora":"20:30 o null","lugar":"recinto","localidad":"León","precio":"Gratis / 12€ / null","categoria":"concierto|teatro|exposicion|mercado|feria|fiesta|festival|deporte|infantil|gastronomia|visita|otro","descripcion":"una frase","fuente":"https://...","lat":null,"lon":null}]`;

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
function leerDiasSemana(v) {
  if (!Array.isArray(v)) return null;
  const dias = v.map((d) => (typeof d === "number" ? d : DIAS.indexOf(normalizar(d)))).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return dias.length ? [...new Set(dias)] : null;
}
const diaDeLaSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

async function llamarGemini(prompt, msMax = 50000) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    signal: AbortSignal.timeout(msMax),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.1 } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const datos = await res.json();
  const candidato = datos.candidates?.[0];
  const texto = (candidato?.content?.parts || []).map((p) => p.text || "").join("\n");
  return { texto };
}

export function extraerListaJSON(texto) {
  const ini = texto.indexOf("[");
  const fin = texto.lastIndexOf("]");
  if (ini === -1 || fin <= ini) return [];
  try { const v = JSON.parse(texto.slice(ini, fin + 1)); return Array.isArray(v) ? v : []; } catch { return []; }
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

async function fuenteBusqueda({ tema, pistas }, desde, hasta) {
  const prompt = `
    Eres el documentalista de Cazurronics Planner. Busca en Internet ${tema} en León capital y en la provincia de León (España)
    que se celebren entre el ${desde} y el ${hasta}, ambos incluidos.
    Mira sobre todo estas fuentes: ${pistas}. Consulta también agendas de prensa local y webs oficiales.
    REGLAS: solo eventos con fecha confirmada en una fuente real; no inventes nada; incluye la URL exacta donde lo has visto.
    Incluye también lo que no es de un solo día: mercados semanales (con diasSemana), exposiciones abiertas, ferias y festivales.
    Devuelve SOLO un array JSON (máximo 25 elementos) con este formato:
    ${FORMATO_EVENTO}
  `;
  const { texto } = await llamarGemini(prompt);
  return extraerListaJSON(texto).map((e) => validarEventoIA(e, desde, hasta)).filter(Boolean);
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
  return Object.fromEntries(Object.entries(porDia).map(([d, m]) => [d, [...m.values()]]));
}

export async function barrerEventos() {
  const desde = hoyEnLeon();
  const hasta = sumarDias(desde, DIAS_VENTANA - 1);
  const informe = { desde, hasta, inicio: new Date().toISOString(), fuentes: {} };

  const tareas = [
    ["jcyl", () => fuenteJCyL(desde, hasta)],
    ...BUSQUEDAS.map((b) => [`web: ${b.tema}`, () => fuenteBusqueda(b, desde, hasta)]),
  ];
  const resultados = await Promise.allSettled(tareas.map(([, f]) => f()));
  const listas = [];
  resultados.forEach((r, i) => {
    const nombre = tareas[i][0];
    if (r.status === "fulfilled") { informe.fuentes[nombre] = { ok: true, eventos: r.value.length }; listas.push(r.value); }
    else informe.fuentes[nombre] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 200) };
  });

  // Conservamos lo que han encontrado las búsquedas a medida de los usuarios (origen "peticion")
  const fechas = Array.from({ length: DIAS_VENTANA }, (_, i) => sumarDias(desde, i));
  const previos = await varios(fechas.map((f) => ["GET", `eventos:${f}`]));
  const dePeticiones = previos.flatMap((v) => { try { return JSON.parse(v || "[]").filter((e) => e.origen === "peticion"); } catch { return []; } });
  if (dePeticiones.length) informe.fuentes["búsquedas de usuarios (conservadas)"] = { ok: true, eventos: dePeticiones.length };

  const porDia = fusionarPorDia([...listas, dePeticiones], desde, hasta);
  const comandos = [];
  for (let d = desde, i = 0; i < DIAS_VENTANA; d = sumarDias(d, 1), i++) {
    comandos.push(["SET", `eventos:${d}`, JSON.stringify(porDia[d] || []), "EX", 21 * 24 * 3600]);
  }
  await varios(comandos);
  informe.total = Object.values(porDia).reduce((s, l) => s + l.length, 0);
  informe.fin = new Date().toISOString();
  await guardarJSON("eventos:ultimoBarrido", informe);
  return informe;
}

// ---------- Lectura ----------
export async function eventosDelDia(fecha, { lat, lon, radio } = {}) {
  if (!esFecha(fecha)) return [];
  const lista = (await leerJSON(`eventos:${fecha}`)) || [];
  if (lat == null || lon == null || !radio) return lista;
  return lista.filter((e) => e.lat == null || haversineKm(Number(lat), Number(lon), e.lat, e.lon) <= Number(radio) * 1.2);
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

export function eventosParaPrompt(eventos, max = 20) {
  if (!eventos.length) return "";
  const lineas = eventos.slice(0, max).map((e) =>
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
  const encontrados = resultados
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => extraerListaJSON(r.value.texto).map((e) => validarEventoIA(e, fecha, fecha)).filter(Boolean))
    .map((e) => ({ ...e, origen: "peticion" }));

  const delDia = fusionarPorDia([encontrados], fecha, fecha)[fecha] || [];
  const cerca = lat != null && lon != null
    ? delDia.filter((e) => e.lat == null || haversineKm(Number(lat), Number(lon), e.lat, e.lon) <= Number(radio) * 1.2)
    : delDia;

  // Caché 6 h para la misma petición y suma a la agenda pública de ese día
  await guardarJSON(clave, cerca, 6 * 3600).catch(() => null);
  if (cerca.length) await sumarAlDia(fecha, cerca).catch(() => null);
  return cerca;
}

async function sumarAlDia(fecha, nuevos) {
  const actuales = (await leerJSON(`eventos:${fecha}`)) || [];
  const fusion = fusionarPorDia([actuales, nuevos], fecha, fecha)[fecha] || [];
  await guardarJSON(`eventos:${fecha}`, fusion, 21 * 24 * 3600);
}

// Une la agenda guardada con la del barrido a medida, sin duplicados
export function unirEventos(...listas) {
  const vistos = new Map();
  for (const e of listas.flat().filter(Boolean)) {
    const k = normalizar(e.titulo).replace(/[^a-z0-9]/g, "").slice(0, 32);
    if (!vistos.has(k)) vistos.set(k, e);
  }
  return [...vistos.values()];
}

// Si el barrido diario no se ha hecho en las últimas 20 h (por ejemplo, en local, donde no hay cron),
// lo lanza una sola vez. Se llama en segundo plano con after(), sin hacer esperar a nadie.
export async function asegurarBarridoReciente() {
  const ultimo = await leerJSON("eventos:ultimoBarrido");
  const edad = ultimo?.fin ? Date.now() - Date.parse(ultimo.fin) : Infinity;
  if (edad < 20 * 3600 * 1000) return false;
  const libre = await comando(["SET", "barrido:cerrojo", "1", "NX", "EX", 300]);
  if (!libre) return false; // ya hay otro barrido en marcha
  await barrerEventos();
  return true;
}
