// ============ LUGARES: datos propios de cada sitio (ideas 4 y 6) ============
// Cada vez que un sitio sale en un plan, se abre su ficha, alguien pulsa "Llamar" o lo valora
// después de ir, lo apuntamos aquí. Con eso:
//  · el planificador prioriza lo que a la gente le ha gustado de verdad (y evita lo que no),
//  · cada negocio puede ver sus estadísticas en un enlace privado firmado,
//  · las páginas SEO tienen contenido propio ("dónde comer en León").
import { createHmac, timingSafeEqual } from "node:crypto";
import { comando, varios, aObjeto, aRanking } from "./almacen";
import { haversineKm } from "./planUtils";

const SECRETO = process.env.NEGOCIOS_SECRETO || process.env.PANEL_CLAVE || "";
const TIPOS_COMER = ["bar", "restaurante", "cafeteria", "cafetería", "taberna", "sidreria", "sidrería"];

export function slug(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function claveLugar(parada) {
  if (parada?.placeId) return `p_${String(parada.placeId).replace(/[^\w-]/g, "").slice(0, 120)}`;
  const s = slug(parada?.titulo);
  return s ? `s_${s}` : null;
}

export const claveValida = (k) => typeof k === "string" && /^[ps]_[\w-]{1,120}$/.test(k);

// Modo prueba: al entrar en /panel el navegador guarda la marca cz_prueba=1 y, desde entonces, lo que hagas con
// ese navegador (planes, fichas, llamadas, valoraciones) no suma a las cifras de ningún local. Así tus pruebas no
// inflan los números que luego enseñas a un negocio. Se desactiva en Captación → Ajustes.
export const esPrueba = (request) => /(?:^|;\s*)cz_prueba=1(?:;|$)/.test(request?.headers?.get?.("cookie") || "");

// ¿Es un NEGOCIO real (un local con ficha en Google) y no un evento, una ruta o una idea genérica?
// Los eventos ("Ruta de la morcilla", "Tapeo por el Húmedo") se buscaban en Google y, si algún bar coincidía
// por casualidad, le sumaban apariciones. Ahora solo cuentan los tipos de negocio con ficha real cuyo nombre
// en Google se parece al de la parada.
export const TIPOS_NEGOCIO = ["bar", "restaurante", "cafeteria", "cafetería", "taberna", "sidreria", "sidrería", "pub", "discoteca", "museo"];
const PALABRAS_VACIAS = new Set(["bar", "restaurante", "cafeteria", "cafe", "pub", "taberna", "mesón", "meson", "de", "del", "la", "el", "los", "las", "y", "en", "leon", "casa", "museo"]);
const palabras = (t) => slug(t).split("-").filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));
const seParecen = (a, b) => {
  const sa = slug(a), sb = slug(b);
  if (!sa || !sb) return false;
  if (sa.includes(sb) || sb.includes(sa)) return true;
  const pb = new Set(palabras(b));
  return palabras(a).some((w) => pb.has(w));
};
// El tipo de negocio lo dice Google si lo sabe (así un evento que se celebra en un museo o un bar cuenta para ESE local);
// si no, vale el tipo que puso la IA.
const TIPO_POR_GOOGLE = [["bar", "bar"], ["restaurant", "restaurante"], ["cafe", "cafeteria"], ["night_club", "discoteca"], ["museum", "museo"]];
export function tipoNegocio(p) {
  const g = Array.isArray(p?.tiposGoogle) ? p.tiposGoogle : [];
  const deGoogle = TIPO_POR_GOOGLE.find(([k]) => g.includes(k))?.[1];
  if (deGoogle) return deGoogle;
  const t = String(p?.tipo || "").toLowerCase();
  return TIPOS_NEGOCIO.includes(t) ? t : null;
}
// Nombre de Google más presentable: si viene todo en mayúsculas, a minúsculas con inicial en cada palabra
const bonito = (n) => {
  const s = String(n || "").trim();
  if (!s || s !== s.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s\-(])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase()).replace(/ (De|Del|Y|En) /g, (m, w) => " " + w.toLowerCase() + " ");
};
// Cuenta como local si tiene ficha de Google, es un tipo de negocio y su nombre en Google es el de la parada
// o el del sitio donde se celebra ("lugar").
export const esNegocio = (p) => !!(p?.placeId && p.nombreGoogle && tipoNegocio(p) && (seParecen(p.titulo, p.nombreGoogle) || (p.lugar && seParecen(p.lugar, p.nombreGoogle))));

// Para fichas ya guardadas (también las antiguas): un negocio real tiene ficha de Google y un tipo de negocio
export const fichaEsNegocio = (f) => !!(f?.placeId && TIPOS_NEGOCIO.includes(String(f.tipo || "").toLowerCase()));

// Al guardar un plan: ficha del sitio + contador de apariciones + rankings
export async function registrarApariciones(paradas) {
  const c = [];
  for (const p of paradas) {
    const k = p.lugarId;
    if (!claveValida(k) || !esNegocio(p)) continue;
    c.push(["SET", `lugar:${k}`, JSON.stringify({
      clave: k, nombre: bonito(p.nombreGoogle) || p.titulo, tipo: tipoNegocio(p) || p.tipo || null, placeId: p.placeId || null,
      lat: p.lat ?? null, lon: p.lon ?? null, foto: p.fotoOficial || null,
      precio: p.precio || null, resenas: p.resenas || null, actualizado: Date.now(),
    })]);
    c.push(["HINCRBY", `lugarstats:${k}`, "apariciones", 1]);
    c.push(["ZINCRBY", "ranking:apariciones", 1, k]);
    if (TIPOS_COMER.includes(String(p.tipo || "").toLowerCase())) c.push(["ZINCRBY", "ranking:comer", 1, k]);
  }
  await varios(c);
}

export async function registrarAccionLugar(k, accion) {
  if (!claveValida(k) || !["detalle", "llamar", "web"].includes(accion)) return;
  await comando(["HINCRBY", `lugarstats:${k}`, accion, 1]);
}

// "¿Fuiste? ¿Qué tal?" — una valoración por persona y parada (HSETNX evita duplicados)
export async function registrarValoracion({ planId, indice, votante, valor, lugarId }) {
  if (!["bien", "mal", "nofui"].includes(valor) || !claveValida(lugarId)) return false;
  const nueva = await comando(["HSETNX", `valoraciones:${planId}`, `${indice}|${votante}`, valor]);
  if (Number(nueva) !== 1) return false;
  const c = [["HINCRBY", `lugarstats:${lugarId}`, valor, 1]];
  if (valor === "bien") c.push(["ZINCRBY", "ranking:gusta", 1, lugarId]);
  if (valor === "mal") c.push(["ZINCRBY", "ranking:gusta", -1, lugarId]);
  await varios(c);
  return true;
}

const leerFicha = (texto) => { try { return texto ? JSON.parse(texto) : null; } catch { return null; } };

// Ficha + contadores de VARIOS sitios en una sola petición al almacén (antes, dos peticiones por sitio).
// Devuelve una lista alineada con "claves" (null donde no hay ficha).
export async function leerLugares(claves) {
  const validas = claves.filter(claveValida);
  const r = await varios(validas.flatMap((k) => [["GET", `lugar:${k}`], ["HGETALL", `lugarstats:${k}`]]));
  const porClave = new Map(validas.map((k, i) => {
    const ficha = leerFicha(r[i * 2]);
    if (!ficha) return [k, null];
    const s = aObjeto(r[i * 2 + 1]);
    const n = (x) => Number(s[x]) || 0;
    return [k, {
      ...ficha, clave: k,
      stats: { apariciones: n("apariciones"), detalle: n("detalle"), llamar: n("llamar"), web: n("web"), bien: n("bien"), mal: n("mal"), nofui: n("nofui") },
    }];
  }));
  return claves.map((k) => porClave.get(k) || null);
}

export async function leerLugar(k) {
  if (!claveValida(k)) return null;
  return (await leerLugares([k]))[0];
}

// Top de un ranking con la ficha de cada sitio
export async function topLugares(ranking = "ranking:apariciones", cuantos = 20) {
  // Se piden de más porque luego se descartan los que no son negocios (datos antiguos) y los repetidos
  const lista = aRanking(await comando(["ZREVRANGE", ranking, 0, Math.max(cuantos * 4, 40) - 1, "WITHSCORES"]));
  const fichas = await leerLugares(lista.map((r) => r.miembro));
  const vistos = new Set();
  const salida = [];
  lista.forEach((r, i) => {
    const f = fichas[i];
    if (!fichaEsNegocio(f)) return;
    const nombre = slug(f.nombre);
    if (vistos.has(nombre)) return;
    vistos.add(nombre);
    salida.push({ ...f, puntos: r.puntos });
  });
  return salida.slice(0, cuantos);
}

// Para el prompt del planificador: lo que gusta (y lo que no) dentro del radio elegido
export async function preferenciasComunidad(lat, lon, radio) {
  const lista = aRanking(await comando(["ZREVRANGE", "ranking:gusta", 0, 299, "WITHSCORES"]));
  const relevantes = lista.filter((r) => r.puntos >= 2 || r.puntos <= -2);
  // Todas las fichas en una sola petición (se hace en cada plan, así que cuenta)
  const fichas = (await varios(relevantes.map((r) => ["GET", `lugar:${r.miembro}`]))).map(leerFicha);
  const cerca = relevantes
    .map((r, i) => ({ ...r, ficha: fichas[i] }))
    .filter((r) => r.ficha && r.ficha.lat != null && haversineKm(lat, lon, r.ficha.lat, r.ficha.lon) <= Number(radio) * 1.1);
  return {
    favoritos: cerca.filter((r) => r.puntos >= 2).slice(0, 12).map((r) => r.ficha.nombre),
    evitar: cerca.filter((r) => r.puntos <= -2).slice(-8).map((r) => r.ficha.nombre),
  };
}

// ---------- Enlaces privados para negocios ----------
// token = base64url(clave) + "." + firma HMAC. Nadie puede fabricar el enlace de otro local
// sin conocer NEGOCIOS_SECRETO (o PANEL_CLAVE).
const b64 = (s) => Buffer.from(s).toString("base64url");
const firma = (k) => createHmac("sha256", SECRETO).update(`negocio:${k}`).digest("base64url").slice(0, 22);

export function tokenNegocio(k) {
  if (!SECRETO || !claveValida(k)) return null;
  return `${b64(k)}.${firma(k)}`;
}

export function claveDesdeToken(token) {
  if (!SECRETO || typeof token !== "string") return null;
  const [parte, f] = decodeURIComponent(token).split(".");
  if (!parte || !f) return null;
  let k;
  try { k = Buffer.from(parte, "base64url").toString(); } catch { return null; }
  if (!claveValida(k)) return null;
  const esperado = Buffer.from(firma(k));
  const recibido = Buffer.from(f);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  return k;
}

// Comparación de la clave del panel sin filtrar información por tiempos
const limpiarClave = (v) => String(v || "").trim().replace(/^["']|["']$/g, "").trim();

export function claveDePanelValida(clave) {
  const real = limpiarClave(process.env.PANEL_CLAVE);
  if (!real || typeof clave !== "string") return false;
  const a = Buffer.from(limpiarClave(clave));
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Buscar un local por nombre (para el buscador del panel): recorre todos los sitios que han salido en algún plan
export async function buscarLugares(texto, max = 20) {
  const q = slug(texto).replace(/-/g, " ").trim();
  if (q.length < 2) return [];
  const claves = (await comando(["ZREVRANGE", "ranking:apariciones", 0, 4999])) || [];
  const fichas = await varios(claves.map((k) => ["GET", `lugar:${k}`]));
  const encontrados = [];
  fichas.forEach((f, i) => {
    if (encontrados.length >= max || !f) return;
    const ficha = leerFicha(f);
    if (fichaEsNegocio(ficha) && slug(ficha.nombre).replace(/-/g, " ").includes(q)) encontrados.push(claves[i]);
  });
  return (await leerLugares(encontrados)).filter(Boolean);
}
