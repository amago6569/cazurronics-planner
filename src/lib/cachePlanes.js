// ============ CACHÉ DE PLANES REPETIDOS ============
// Regla de Alejandro (24-11-2026): el mismo pedido (mismo texto, fecha, presupuesto, radio y punto del mapa, a ~1 km)
// no vuelve a pagar IA: se sirve el plan ya montado, con su mismo enlace para compartir. 0 € y respuesta al instante.
// Dura 6 h si el plan es para otro día y 30 min si es para hoy (lo que ya ha pasado sale del plan). Un plan sin IA
// solo 10 min: en cuanto la IA vuelva, el siguiente sale con IA.
import { createHash } from "node:crypto";
import { guardarJSON, leerJSON } from "./almacen";

const sinTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const hoyEnLeon = (ahora = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(ahora);

// Cada versión publicada tiene su caché: un arreglo de los planes se ve al momento, no 6 h después (25-11-2026)
const version = () => String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);

export function claveCachePlan({ fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon }) {
  const texto = sinTildes(apetece).replace(/[^a-z0-9ñ]+/g, " ").trim();
  const base = [version(), fecha, texto, Number(presupuestoMin) || 0, Number(presupuestoMax) || 0, Math.round(Number(radio) || 0), Number(lat).toFixed(2), Number(lon).toFixed(2)].join("|");
  return `plan:cache:${createHash("sha256").update(base).digest("base64url").slice(0, 22)}`;
}

export function segundosEnCache({ fecha, sinIA = false }, ahora = new Date()) {
  if (sinIA) return 10 * 60;
  return fecha === hoyEnLeon(ahora) ? 30 * 60 : 6 * 3600;
}

export async function leerPlanEnCache(peticion) {
  const guardado = await leerJSON(claveCachePlan(peticion));
  return guardado && Array.isArray(guardado.plan) && guardado.plan.length ? guardado : null;
}

export async function guardarPlanEnCache(peticion, respuesta, { sinIA = false } = {}) {
  await guardarJSON(claveCachePlan(peticion), respuesta, segundosEnCache({ fecha: peticion.fecha, sinIA }));
}
