// ============ LUGARES: datos propios de cada sitio (ideas 4 y 6) ============
// Cada vez que un sitio sale en un plan, se abre su ficha, alguien pulsa "Llamar" o lo valora
// después de ir, lo apuntamos aquí. Con eso:
//  · el planificador prioriza lo que a la gente le ha gustado de verdad (y evita lo que no),
//  · cada negocio puede ver sus estadísticas en un enlace privado firmado,
//  · las páginas SEO tienen contenido propio ("dónde comer en León").
import { createHmac, timingSafeEqual } from "node:crypto";
import { comando, varios, leerJSON, aObjeto, aRanking } from "./almacen";
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

// Al guardar un plan: ficha del sitio + contador de apariciones + rankings
export async function registrarApariciones(paradas) {
  const c = [];
  for (const p of paradas) {
    const k = p.lugarId;
    if (!claveValida(k)) continue;
    c.push(["SET", `lugar:${k}`, JSON.stringify({
      clave: k, nombre: p.titulo, tipo: p.tipo || null, placeId: p.placeId || null,
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

export async function leerLugar(k) {
  if (!claveValida(k)) return null;
  const [ficha, stats] = await Promise.all([leerJSON(`lugar:${k}`), comando(["HGETALL", `lugarstats:${k}`])]);
  if (!ficha) return null;
  const s = aObjeto(stats);
  const n = (x) => Number(s[x]) || 0;
  return {
    ...ficha,
    stats: { apariciones: n("apariciones"), detalle: n("detalle"), llamar: n("llamar"), web: n("web"), bien: n("bien"), mal: n("mal"), nofui: n("nofui") },
  };
}

// Top de un ranking con la ficha de cada sitio
export async function topLugares(ranking = "ranking:apariciones", cuantos = 20) {
  const lista = aRanking(await comando(["ZREVRANGE", ranking, 0, cuantos - 1, "WITHSCORES"]));
  const fichas = await Promise.all(lista.map((r) => leerLugar(r.miembro)));
  return lista.map((r, i) => fichas[i] && { ...fichas[i], puntos: r.puntos }).filter(Boolean);
}

// Para el prompt del planificador: lo que gusta (y lo que no) dentro del radio elegido
export async function preferenciasComunidad(lat, lon, radio) {
  const lista = aRanking(await comando(["ZREVRANGE", "ranking:gusta", 0, 299, "WITHSCORES"]));
  const relevantes = lista.filter((r) => r.puntos >= 2 || r.puntos <= -2);
  const fichas = await Promise.all(relevantes.map((r) => leerJSON(`lugar:${r.miembro}`)));
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
export function claveDePanelValida(clave) {
  const real = process.env.PANEL_CLAVE;
  if (!real || typeof clave !== "string") return false;
  const a = Buffer.from(clave);
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
    try {
      const ficha = JSON.parse(f);
      if (slug(ficha.nombre).replace(/-/g, " ").includes(q)) encontrados.push(claves[i]);
    } catch {}
  });
  return (await Promise.all(encontrados.map(leerLugar))).filter(Boolean);
}
