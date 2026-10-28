// ============ CIFRAS DE INSTAGRAM (API OFICIAL, GRATIS) ============
// Usa la "API de Instagram con inicio de sesión de Instagram": no pide página de Facebook, solo una cuenta
// profesional (creador o empresa). Cada mañana el cron guarda una foto de las cifras para comparar semanas.
// Variable en Vercel:
//   INSTAGRAM_TOKEN  token de larga duración (60 días). El cron lo renueva solo cada semana y guarda el nuevo en Redis.
import { comando, guardarJSON, leerJSON } from "./almacen";
import { hoyEnLeon } from "./estadisticas";

const API = "https://graph.instagram.com/v23.0";
const CLAVE_TOKEN = "instagram:token";
const DIAS_FOTOS = 120 * 24 * 3600;
const RENOVAR_CADA_DIAS = 7;
const MAX_PUBLICACIONES = 12;

export const instagramConfigurado = async () => Boolean(await tokenInstagram());

async function tokenInstagram() {
  const guardado = await leerJSON(CLAVE_TOKEN).catch(() => null);
  return guardado?.token || String(process.env.INSTAGRAM_TOKEN || "").trim() || null;
}

async function pedir(ruta, parametros = {}) {
  const token = await tokenInstagram();
  if (!token) throw new Error("Falta INSTAGRAM_TOKEN en Vercel");
  const url = new URL(`${API}${ruta}`);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
  // El token va en la cabecera, no en la URL (las URLs acaban en logs)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${String(datos?.error?.message || "").slice(0, 160)}`);
  return datos;
}

// Los tokens duran 60 días; renovarlo cada semana lo mantiene vivo para siempre sin tocar Vercel
export async function renovarTokenSiToca() {
  const guardado = await leerJSON(CLAVE_TOKEN).catch(() => null);
  if (guardado?.renovadoEn && Date.now() - guardado.renovadoEn < RENOVAR_CADA_DIAS * 864e5) return false;
  const token = await tokenInstagram();
  if (!token) return false;
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !datos.access_token) throw new Error(`Instagram no renovó el token: ${res.status} ${String(datos?.error?.message || "").slice(0, 160)}`);
  await guardarJSON(CLAVE_TOKEN, { token: datos.access_token, renovadoEn: Date.now() });
  return true;
}

// [{ name, values: [{ value }] , total_value: { value } }] → { reach: 123, ... }
export function leerMetricas(data) {
  const o = {};
  for (const m of data || []) {
    const v = m?.total_value?.value ?? m?.values?.[m.values.length - 1]?.value;
    if (typeof v === "number") o[m.name] = v;
  }
  return o;
}

// Cada métrica por separado: si Instagram retira una (pasa a menudo), las demás siguen llegando
async function metricas(ruta, nombres, extra = {}) {
  const res = await Promise.all(nombres.map((n) => pedir(ruta, { metric: n, ...extra }).then((d) => leerMetricas(d.data)).catch(() => ({}))));
  return Object.assign({}, ...res);
}

export async function fotoInstagram() {
  const perfil = await pedir("/me", { fields: "username,followers_count,follows_count,media_count" });
  const cuenta = await metricas("/me/insights", ["reach", "views", "accounts_engaged", "total_interactions", "profile_links_taps"], { period: "day", metric_type: "total_value" });
  const media = await pedir("/me/media", { fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count", limit: String(MAX_PUBLICACIONES) });
  const publicaciones = await Promise.all((media.data || []).map(async (p) => {
    const ins = await metricas(`/${p.id}/insights`, ["reach", "views", "saved", "shares", "total_interactions"]);
    return {
      fecha: String(p.timestamp || "").slice(0, 10),
      tipo: p.media_product_type === "REELS" ? "reel" : p.media_type === "CAROUSEL_ALBUM" ? "carrusel" : String(p.media_type || "").toLowerCase(),
      texto: String(p.caption || "").replace(/\s+/g, " ").slice(0, 80),
      enlace: p.permalink,
      likes: p.like_count ?? null,
      comentarios: p.comments_count ?? null,
      alcance: ins.reach ?? null,
      vistas: ins.views ?? null,
      guardados: ins.saved ?? null,
      compartidos: ins.shares ?? null,
    };
  }));
  return {
    fecha: hoyEnLeon(),
    usuario: perfil.username,
    seguidores: perfil.followers_count ?? null,
    siguiendo: perfil.follows_count ?? null,
    publicacionesTotal: perfil.media_count ?? null,
    ayer: { alcance: cuenta.reach ?? null, vistas: cuenta.views ?? null, cuentasQueInteractuan: cuenta.accounts_engaged ?? null, interacciones: cuenta.total_interactions ?? null, clicsEnlace: cuenta.profile_links_taps ?? null },
    publicaciones,
  };
}

export async function guardarFotoInstagram() {
  const foto = await fotoInstagram();
  await guardarJSON(`ig:foto:${foto.fecha}`, foto, DIAS_FOTOS);
  return foto;
}

// Las fotos guardadas de los últimos días (la más reciente primero), sin las que falten
export async function leerFotosInstagram(dias = 15) {
  const fechas = Array.from({ length: dias }, (_, i) => hoyEnLeon(-i));
  const res = await Promise.all(fechas.map((f) => comando(["GET", `ig:foto:${f}`]).catch(() => null)));
  return res.map((v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } }).filter(Boolean);
}
