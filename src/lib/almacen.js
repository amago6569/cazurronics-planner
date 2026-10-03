// ============ ALMACÉN DE DATOS ============
// Guarda planes, votos, valoraciones, estadísticas y la agenda de eventos.
//
// · En producción usa Redis de Upstash por su API REST (sin instalar nada).
//   En Vercel: Storage → Marketplace → "Upstash for Redis" → Connect. Eso crea solas las
//   variables KV_REST_API_URL y KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL / _TOKEN).
// · En local, si no hay esas variables, guarda todo en memoria: funciona para probar,
//   pero se borra al reiniciar `npm run dev`.

const URL_REDIS = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_REDIS = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const usaRedis = Boolean(URL_REDIS && TOKEN_REDIS);

if (!usaRedis && process.env.NODE_ENV === "production") {
  console.warn("[almacén] Sin Redis configurado: los datos se guardan en memoria y se perderán. Conecta Upstash en Vercel.");
}

// ---------- Redis (Upstash REST) ----------
async function redis(comando) {
  const res = await fetch(URL_REDIS, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(comando),
    cache: "no-store",
  });
  const datos = await res.json();
  if (datos.error) throw new Error(`[almacén] ${datos.error}`);
  return datos.result;
}

async function redisPipeline(comandos) {
  if (!comandos.length) return [];
  const res = await fetch(`${URL_REDIS}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
    cache: "no-store",
  });
  const datos = await res.json();
  return datos.map((r) => {
    if (r.error) throw new Error(`[almacén] ${r.error}`);
    return r.result;
  });
}

// ---------- Memoria (desarrollo) ----------
const mem = globalThis.__cazurroMem || (globalThis.__cazurroMem = { kv: new Map(), caduca: new Map() });

function vivo(clave) {
  const t = mem.caduca.get(clave);
  if (t && t < Date.now()) { mem.kv.delete(clave); mem.caduca.delete(clave); }
  return mem.kv.get(clave);
}
function hashDe(clave) {
  let h = vivo(clave);
  if (!(h instanceof Map)) { h = new Map(); mem.kv.set(clave, h); }
  return h;
}

function ejecutarEnMemoria([cmd, ...a]) {
  switch (cmd.toUpperCase()) {
    case "GET": { const v = vivo(a[0]); return typeof v === "string" ? v : null; }
    case "SET": {
      if (a.some((x) => String(x).toUpperCase() === "NX") && vivo(a[0]) !== undefined) return null;
      mem.kv.set(a[0], String(a[1]));
      const i = a.findIndex((x) => String(x).toUpperCase() === "EX");
      if (i > -1) mem.caduca.set(a[0], Date.now() + Number(a[i + 1]) * 1000); else mem.caduca.delete(a[0]);
      return "OK";
    }
    case "DEL": { const ex = mem.kv.delete(a[0]); mem.caduca.delete(a[0]); return ex ? 1 : 0; }
    case "EXPIRE": { if (!mem.kv.has(a[0])) return 0; mem.caduca.set(a[0], Date.now() + Number(a[1]) * 1000); return 1; }
    case "INCRBY": { const n = Number(vivo(a[0]) || 0) + Number(a[1]); mem.kv.set(a[0], String(n)); return n; }
    case "HINCRBY": { const h = hashDe(a[0]); const n = Number(h.get(a[1]) || 0) + Number(a[2]); h.set(a[1], String(n)); return n; }
    case "HSET": { const h = hashDe(a[0]); let nuevos = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(a[i])) nuevos++; h.set(a[i], String(a[i + 1])); } return nuevos; }
    case "HSETNX": { const h = hashDe(a[0]); if (h.has(a[1])) return 0; h.set(a[1], String(a[2])); return 1; }
    case "HGETALL": { const h = vivo(a[0]); if (!(h instanceof Map)) return []; return [...h.entries()].flat(); }
    case "ZINCRBY": {
      let z = vivo(a[0]); if (!(z instanceof Map)) { z = new Map(); mem.kv.set(a[0], z); }
      const n = Number(z.get(a[2]) || 0) + Number(a[1]); z.set(a[2], n); return String(n);
    }
    case "ZREVRANGE": {
      const z = vivo(a[0]); if (!(z instanceof Map)) return [];
      const orden = [...z.entries()].sort((x, y) => y[1] - x[1]);
      const fin = Number(a[2]) < 0 ? orden.length + Number(a[2]) + 1 : Number(a[2]) + 1;
      const tramo = orden.slice(Number(a[1]), fin);
      return String(a[3] || "").toUpperCase() === "WITHSCORES" ? tramo.flatMap(([m, s]) => [m, String(s)]) : tramo.map(([m]) => m);
    }
    case "LPUSH": {
      let l = vivo(a[0]); if (!Array.isArray(l)) { l = []; mem.kv.set(a[0], l); }
      l.unshift(...a.slice(1).map(String).reverse()); return l.length;
    }
    case "LTRIM": { const l = vivo(a[0]); if (Array.isArray(l)) mem.kv.set(a[0], l.slice(Number(a[1]), Number(a[2]) < 0 ? l.length + Number(a[2]) + 1 : Number(a[2]) + 1)); return "OK"; }
    case "LRANGE": { const l = vivo(a[0]); if (!Array.isArray(l)) return []; return l.slice(Number(a[1]), Number(a[2]) < 0 ? l.length + Number(a[2]) + 1 : Number(a[2]) + 1); }
    default: throw new Error(`[almacén] Comando no soportado en memoria: ${cmd}`);
  }
}

// ---------- API pública ----------
export async function comando(c) {
  return usaRedis ? redis(c) : ejecutarEnMemoria(c);
}

export async function varios(comandos) {
  return usaRedis ? redisPipeline(comandos) : comandos.map(ejecutarEnMemoria);
}

export async function leerJSON(clave) {
  const v = await comando(["GET", clave]);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

export async function guardarJSON(clave, valor, segundos) {
  const c = ["SET", clave, JSON.stringify(valor)];
  if (segundos) c.push("EX", segundos);
  return comando(c);
}

// HGETALL devuelve [campo, valor, campo, valor...] → objeto
export function aObjeto(lista) {
  const o = {};
  for (let i = 0; i < (lista || []).length; i += 2) o[lista[i]] = lista[i + 1];
  return o;
}

// ZREVRANGE ... WITHSCORES → [{ miembro, puntos }]
export function aRanking(lista) {
  const r = [];
  for (let i = 0; i < (lista || []).length; i += 2) r.push({ miembro: lista[i], puntos: Number(lista[i + 1]) });
  return r;
}

// Identificador corto y no adivinable para los enlaces de los planes (10 caracteres base62)
export function nuevoId(largo = 10) {
  const alfabeto = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => alfabeto[b % 62]).join("");
}

// Ejecuta una escritura "de apoyo" sin que un fallo del almacén rompa nunca la respuesta principal
export async function sinRomper(promesa, etiqueta = "almacén") {
  try { return await promesa; } catch (e) { console.error(`[${etiqueta}]`, e?.message || e); return null; }
}
