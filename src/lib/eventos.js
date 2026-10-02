// ============ BARRIDO DE EVENTOS (idea 3) ============
// Una vez al día (cron de Vercel → /api/barrido) recorremos todas las fuentes que podemos
// y guardamos la agenda de los próximos 14 días. Así cada plan ya sabe qué pasa ese día
// sin depender de que Gemini lo encuentre en sus 2-3 búsquedas en directo.
//
// Fuentes:
//  1. Datos abiertos de la Junta de Castilla y León: agenda cultural oficial, con fechas y coordenadas.
//  2. Gemini con Google Search, en varias búsquedas dirigidas a las agendas locales
//     (Ayuntamiento, Diputación, Diario de León, Leonoticias, iLeón, auditorios, museos, fiestas de pueblos...).
import { guardarJSON, leerJSON, varios } from "./almacen";
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
];

async function llamarGemini(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
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
  const fecha = esFecha(e.fecha) ? e.fecha : null;
  if (!titulo || !fecha || fecha > hasta) return null;
  const fechaFin = esFecha(e.fechaFin) && e.fechaFin >= fecha ? e.fechaFin : null;
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
    origen: "web",
  };
}

async function fuenteBusqueda({ tema, pistas }, desde, hasta) {
  const prompt = `
    Eres el documentalista de Cazurronics Planner. Busca en Internet ${tema} en León capital y en la provincia de León (España)
    que se celebren entre el ${desde} y el ${hasta}, ambos incluidos.
    Mira sobre todo estas fuentes: ${pistas}. Consulta también agendas de prensa local y webs oficiales.
    REGLAS: solo eventos con fecha confirmada en una fuente real; no inventes nada; incluye la URL exacta donde lo has visto.
    Devuelve SOLO un array JSON (máximo 25 elementos) con este formato:
    [{"titulo":"...","fecha":"AAAA-MM-DD","fechaFin":"AAAA-MM-DD o null","hora":"20:30 o null","lugar":"recinto","localidad":"León","precio":"Gratis / 12€ / null","categoria":"concierto|teatro|exposicion|mercado|fiesta|deporte|infantil|gastronomia|otro","descripcion":"una frase","fuente":"https://...","lat":null,"lon":null}]
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

  const porDia = fusionarPorDia(listas, desde, hasta);
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

export function eventosParaPrompt(eventos, max = 15) {
  if (!eventos.length) return "";
  const lineas = eventos.slice(0, max).map((e) =>
    `- ${e.titulo}${e.hora ? ` (${e.hora})` : ""}${e.lugar ? ` en ${e.lugar}` : ""}${e.localidad ? `, ${e.localidad}` : ""}${e.precio ? ` · ${e.precio}` : ""}`
  );
  return `AGENDA VERIFICADA DE ESE DÍA (de nuestro barrido diario de fuentes locales). Si alguno encaja con lo que pide el usuario, inclúyelo con su hora real:\n${lineas.join("\n")}`;
}
