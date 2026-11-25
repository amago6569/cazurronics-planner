// ============ FUENTES FIABLES Y PÁGINAS QUE NOMBRAN EL EVENTO ============
// Señales para confirmar un evento sin preguntar a Google (0 €, y el cupo gratis se queda para el barrido):
//  · Lista blanca: webs oficiales y prensa local de León. Si el enlace no contesta a tiempo pero es de una de ellas,
//    el evento entra igual (si la página no existe, 404, se descarta como siempre).
//  · La página nombra el evento: sale la fecha, el pueblo y el año que toca. Solo sirve para CONFIRMAR; si no sale,
//    el evento no se tira: va a Google como antes.
//  · Dos webs distintas traen el mismo evento: cuenta como confirmado.
// Para añadir una web fiable: una entrada en OFICIALES (el dominio sin www) o un patrón en OFICIALES_PATRON.
const OFICIALES = new Set([
  "aytoleon.es", "leon.es", "ponferrada.org", "dipuleon.es", "jcyl.es", "turismocastillayleon.com",
  "diariodeleon.es", "leonoticias.com", "lanuevacronica.com", "ileon.eldiario.es", "infobierzo.com",
  "auditoriociudaddeleon.net", "musac.es", "leonsurdigital.com",
]);
// Ayuntamientos: aytoastorga.es, ayuntamientodeboñar.es, aytosanandresdelrabanedo.es…
const OFICIALES_PATRON = /^(ayto|ayuntamiento|aytode)[a-z0-9-]*\.(es|org|com)$/;
const SOCIALES = /(^|\.)(facebook|fb|instagram|tiktok|twitter|x)\.com$/;

export const dominioDe = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export const esSocial = (url) => SOCIALES.test(dominioDe(url));
export function esOficial(url) {
  const d = dominioDe(url);
  if (!d) return false;
  if (OFICIALES_PATRON.test(d)) return true;
  for (const o of OFICIALES) if (d === o || d.endsWith(`.${o}`)) return true;
  return false;
}

// Enlaces que no son una fuente: una búsqueda de Google o de Bing, un mapa o un acortador. La IA los pone cuando no
// encuentra la página del evento. Una búsqueda siempre «existe» y repite el nombre, el pueblo y la fecha que se le
// pidieron, así que pasaba por comprobada: el 24-11-2026, 87 de los 471 planes de la agenda tenían una de estas.
export function esBuscador(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (/^(maps\.app\.)?goo\.gl$/.test(host) || host === "duckduckgo.com") return true;
  if (/^(maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return host.startsWith("maps.") || /^\/(search|url|maps)\b/.test(u.pathname);
  return host === "bing.com" && u.pathname.startsWith("/search");
}

// google.com/url?q=https://la-web-de-verdad → https://la-web-de-verdad
export function desenvolverEnlace(url) {
  try {
    const u = new URL(url);
    if (/^(www\.)?google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") {
      const real = u.searchParams.get("q") || u.searchParams.get("url");
      if (/^https?:\/\//.test(real || "") && !esBuscador(real)) return real;
    }
  } catch { /* no es una URL: se deja como está */ }
  return url;
}

// Webs distintas en las que ha salido el evento (la suya y las que trajeron otros empleados). Un buscador no cuenta.
export const websDistintas = (e) => new Set([e.fuente, ...(e.fuentesVistas || [])].filter((u) => !esBuscador(u)).map(dominioDe).filter(Boolean)).size;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const plano = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// El texto visible de una página HTML (sin scripts, estilos ni etiquetas)
export function textoDeHtml(html) {
  return String(html || "")
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

// ============ LA HORA QUE DICE LA PÁGINA ============
// El 24-11-2026, 70 de los 162 planes sueltos de la agenda no tenían hora (14 de ellos conciertos), y un plan pone cada
// parada a una hora concreta (R4 de PLANES.md): sin la de verdad, se la inventa. Aquí se busca en la página del evento,
// junto al título, una hora escrita como «20:30», «20.30 h», «20 h» o «a las 20». Solo vale si en todo lo que rodea al
// título sale UNA sola hora; con dos o ninguna, null (mejor sin hora que con una equivocada).
const VACIAS_HORA = new Set(["para", "con", "del", "las", "los", "una", "unos", "unas", "por", "sobre", "entre", "desde", "hasta", "leon", "2025", "2026", "2027",
  "concierto", "conciertos", "fiesta", "fiestas", "taller", "talleres", "exposicion", "teatro", "festival", "feria", "jornada", "jornadas", "mercado", "visita", "ruta", "presentacion", "actividad", "actividades"]);
const HORAS_EN_TEXTO = /\ba las (\d{1,2})(?:[:.]([0-5]\d))?\b|\b(\d{1,2}):([0-5]\d)\b|\b(\d{1,2})[.,]([0-5]\d)\s?h(?:oras|rs?)?\b|\b(\d{1,2})\s?h(?:oras)?\b/g;
// 25-11-2026: las 3 primeras horas propuestas eran de OTRO evento de la misma lista («21:30» de Uncut puesta a Kamikaze
// Helmets en la agenda de conciertos de mycontt; «12:45» del acto del 25N puesta a la pista de hielo de Valencia de Don
// Juan). Una página con 3 o más fechas o 3 o más horas distintas es una lista de eventos: de ahí no se saca ninguna hora.
const MES_CORTO = "ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic";
function fechasDistintas(t) {
  const vistas = new Set();
  const poner = (d, m) => { if (d >= 1 && d <= 31 && m >= 1 && m <= 12) vistas.add(`${d}-${m}`); };
  for (const x of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:\\s+de)?\\s+(${MES_CORTO})[a-z]*\\b`, "g"))) poner(Number(x[1]), MES_CORTO.split("|").indexOf(x[2]) + 1);
  for (const x of t.matchAll(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*\d{2,4})?\b/g)) poner(Number(x[1]), Number(x[2]));
  for (const x of t.matchAll(/\b(\d{1,2})\.(\d{1,2})\.\d{4}\b/g)) poner(Number(x[1]), Number(x[2]));
  for (const x of t.matchAll(/\b\d{4}-(\d{2})-(\d{2})\b/g)) poner(Number(x[2]), Number(x[1]));
  return vistas.size;
}
function horasDistintas(t) {
  const vistas = new Set();
  for (const m of t.matchAll(HORAS_EN_TEXTO)) {
    const h = Number(m[1] ?? m[3] ?? m[5] ?? m[7]), min = Number(m[2] ?? m[4] ?? m[6] ?? 0);
    if (h <= 23) vistas.add(h * 60 + min);
  }
  return vistas.size;
}
const esListaDeEventos = (t) => fechasDistintas(t) >= 3 || horasDistintas(t) >= 3;

export function horaEnPagina(texto, e) {
  const t = plano(texto);
  if (esListaDeEventos(t)) return null;
  const claves = [...new Set(plano(e?.titulo).replace(/[^a-z0-9ñ ]+/g, " ").split(" ").filter((p) => p.length >= 4 && !VACIAS_HORA.has(p)))];
  if (!claves.length) return null;
  const guia = [...claves].sort((a, b) => b.length - a.length)[0];
  const horas = new Set();
  let desde = 0, ventanas = 0;
  for (let pos = t.indexOf(guia); pos !== -1 && ventanas < 20; pos = t.indexOf(guia, desde)) {
    desde = pos + guia.length;
    // «de 10 a 14 h», «10:00-14:00»: vale la de empezar
    const ventana = t.slice(Math.max(0, pos - 250), pos + 350)
      .replace(/\b(\d{1,2}):(\d{2})\s*(?:a|-|–)\s*\d{1,2}:\d{2}\b/g, "$1:$2")
      .replace(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:a|-|–)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:h|horas)\b/g, (_, h, m) => `${h}:${m || "00"}`);
    // El título tiene que estar ahí casi entero, no solo su palabra más larga
    if (claves.filter((c) => ventana.includes(c)).length < Math.ceil(claves.length * 0.6)) continue;
    ventanas++;
    for (const m of ventana.matchAll(HORAS_EN_TEXTO)) {
      const h = Number(m[1] ?? m[3] ?? m[5] ?? m[7]), min = Number(m[2] ?? m[4] ?? m[6] ?? 0);
      if (h > 23) continue;
      horas.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }
  return horas.size === 1 ? [...horas][0] : null;
}

// ¿La página dice ese día? «21 de noviembre», «21 nov», «21/11», «21-11-2026», «2026-11-21»
function nombraFecha(t, fecha) {
  const [a, m, d] = String(fecha || "").split("-").map(Number);
  if (!a || !m || !d) return false;
  const mes = MESES[m - 1];
  return new RegExp(`\\b0?${d}(?:\\s+de)?\\s+(?:${mes}|${mes.slice(0, 3)}\\b)`).test(t)
    || new RegExp(`\\b0?${d}\\s*[/.-]\\s*0?${m}\\b`).test(t)
    || t.includes(`${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

// Sale la fecha (el primer o el último día), el pueblo (si lo sabemos) y, si la página habla de años, el que toca.
// Así una página de las fiestas de 2025 no confirma las de 2026.
export function paginaLoNombra(texto, e) {
  const t = plano(texto);
  if (t.length < 40) return false;
  if (!nombraFecha(t, e.fecha) && !(e.fechaFin && nombraFecha(t, e.fechaFin))) return false;
  const pueblo = plano(e.localidad).trim();
  if (pueblo && !t.includes(pueblo)) return false;
  const anos = new Set(t.match(/\b20\d{2}\b/g) || []);
  return !anos.size || anos.has(String(e.fecha).slice(0, 4));
}

// El dominio no existe (ENOTFOUND) o la URL está mal escrita: la página no existe. Un fallo pasajero del DNS
// (EAI_AGAIN) no prueba nada: antes tiraba eventos buenos, y con el repaso de enlaces los quitaría de la agenda.
export function paginaQueNoExiste(e) {
  const codigo = `${e?.cause?.code || ""} ${e?.code || ""} ${e?.message || ""}`;
  return /ENOTFOUND|Invalid URL/i.test(codigo) && !/EAI_AGAIN/i.test(codigo);
}

// Descarga la página (como mucho ~400 KB de texto): { estado: "ok" | "mal" | "duda", texto }
export async function leerPagina(url, ms = 8000) {
  try {
    const r = await fetch(url, {
      method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CazurronicsBot/1.0; +https://cazurronics.es)" },
    });
    if (r.status === 404 || r.status === 410) { try { await r.body?.cancel(); } catch {} return { estado: "mal", texto: "" }; }
    if (r.status >= 400) { try { await r.body?.cancel(); } catch {} return { estado: "duda", texto: "" }; }
    const html = await r.text().catch(() => "");
    return { estado: "ok", texto: textoDeHtml(html.slice(0, 400000)) };
  } catch (e) {
    return { estado: paginaQueNoExiste(e) ? "mal" : "duda", texto: "" };
  }
}
