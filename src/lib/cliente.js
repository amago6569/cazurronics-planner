// Utilidades SOLO del navegador: identificador anónimo, analítica y planes recientes.
// Todo con try/catch: en modo incógnito o con el almacenamiento bloqueado, la web sigue funcionando.

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Identificador anónimo de esta persona (para votos y valoraciones, sin cuentas ni datos personales)
export function idVotante() {
  let id = leer("cz-votante", null);
  if (!id) {
    id = `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    escribir("cz-votante", id);
  }
  return id;
}

// Analítica propia: no bloquea nada y no espera respuesta
export function baliza(tipo, extra = {}) {
  try {
    const cuerpo = JSON.stringify({ tipo, ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/evento", cuerpo);
    else fetch("/api/evento", { method: "POST", body: cuerpo, keepalive: true });
  } catch {}
}

// Una visita por sesión; "vuelve" si ya había entrado otro día. Recoge utm_source o ?ref= de la campaña.
export function registrarVisita() {
  try {
    if (sessionStorage.getItem("cz-visita")) return;
    sessionStorage.setItem("cz-visita", "1");
  } catch {}
  const params = new URLSearchParams(window.location.search);
  const fuente = params.get("utm_source") || params.get("ref") || (document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "directo");
  baliza("visita", { fuente });
  const hoy = new Date().toISOString().slice(0, 10);
  const ultima = leer("cz-ultima-visita", null);
  if (ultima && ultima !== hoy) baliza("vuelve");
  escribir("cz-ultima-visita", hoy);
}

// ---------- Planes recientes (para "¿Fuiste? ¿Qué tal?") ----------
export function recordarPlan(planId, fecha, itinerario) {
  if (!planId) return;
  const lista = leer("cz-planes", []).filter((p) => p.id !== planId);
  lista.unshift({ id: planId, fecha, paradas: itinerario.map((p) => ({ titulo: p.titulo, hora: p.hora, foto: p.fotoOficial })), valorado: false });
  escribir("cz-planes", lista.slice(0, 10));
}

export function actualizarParadaRecordada(planId, indice, parada) {
  const lista = leer("cz-planes", []);
  const p = lista.find((x) => x.id === planId);
  if (!p || !p.paradas[indice]) return;
  p.paradas[indice] = { titulo: parada.titulo, hora: parada.hora, foto: parada.fotoOficial };
  escribir("cz-planes", lista);
}

// El plan más reciente cuya fecha ya pasó y que aún no se ha valorado
export function planPendienteDeValorar() {
  const hoy = new Date().toISOString().slice(0, 10);
  return leer("cz-planes", []).find((p) => !p.valorado && p.fecha && p.fecha < hoy) || null;
}

export function marcarValorado(planId) {
  const lista = leer("cz-planes", []);
  const p = lista.find((x) => x.id === planId);
  if (p) { p.valorado = true; escribir("cz-planes", lista); }
}

export function urlPlan(planId) {
  return `${window.location.origin}/plan/${planId}`;
}

// Compartir con la hoja nativa del móvil; en ordenador, copia el enlace
export async function compartirPlan(planId, texto = "Mira el plan que me ha montado Cazurronics 🦁") {
  const url = urlPlan(planId);
  baliza("compartir");
  try {
    if (navigator.share) { await navigator.share({ title: "Mi plan en León", text: texto, url }); return "compartido"; }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelado";
  }
  try { await navigator.clipboard.writeText(url); return "copiado"; } catch { return "error"; }
}
