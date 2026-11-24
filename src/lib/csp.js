// ============ AVISOS DE LA LISTA DE SITIOS PERMITIDOS (CSP) ============
// La CSP va en modo «solo avisar» (next.config.mjs). Antes nadie veía esos avisos: se quedaban en la consola de cada móvil.
// Ahora el navegador los manda a /api/csp y se cuentan por día, sitio bloqueado y tipo, para activarla de verdad con
// datos: cuando pase una semana sin avisos de sitios que la web usa de verdad. Solo Redis, 0 € en Google.
import { aObjeto, varios } from "./almacen";
import { hoyEnLeon } from "./estadisticas";

const limpio = (t, max = 60) => String(t || "").replace(/[^\w.:\-/*@]/g, "").slice(0, max);

// De un aviso (formato report-uri o Reporting API) saca «tipo|sitio»: img-src|ejemplo.com, script-src|inline…
export function claveAviso(r) {
  if (!r || typeof r !== "object") return null;
  const tipo = limpio(r["effective-directive"] || r.effectiveDirective || String(r["violated-directive"] || r.violatedDirective || "").split(" ")[0], 30);
  const bloqueado = String(r["blocked-uri"] || r.blockedURL || "");
  let sitio = bloqueado;
  try { sitio = new URL(bloqueado).host || bloqueado; } catch {}
  sitio = limpio(sitio) || "?";
  return tipo ? `${tipo}|${sitio}` : null;
}

// El cuerpo que manda el navegador → lista de claves (como mucho 10 por envío)
export function clavesDeInforme(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch { return []; }
  const informes = Array.isArray(datos) ? datos.filter((x) => !x?.type || x.type === "csp-violation").map((x) => x?.body) : [datos?.["csp-report"]];
  return informes.map(claveAviso).filter(Boolean).slice(0, 10);
}

export async function apuntarAvisosCSP(claves) {
  if (!claves.length) return;
  const clave = `csp:${hoyEnLeon()}`;
  await varios([...claves.map((c) => ["HINCRBY", clave, c, 1]), ["EXPIRE", clave, 30 * 24 * 3600]]);
}

// Lo de los últimos 7 días, el más repetido primero
export async function leerAvisosCSP(dias = 7) {
  const fechas = Array.from({ length: dias }, (_, i) => hoyEnLeon(-i));
  const res = await varios(fechas.map((f) => ["HGETALL", `csp:${f}`]));
  const total = {};
  for (const r of res) for (const [k, v] of Object.entries(aObjeto(r))) total[k] = (total[k] || 0) + (Number(v) || 0);
  return Object.entries(total).map(([k, n]) => { const [tipo, sitio] = k.split("|"); return { tipo, sitio, n }; }).sort((a, b) => b.n - a.n).slice(0, 20);
}

