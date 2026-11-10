// ============ LIGA CAZURRA: la contraseña de mientras ============
// Regla de Alejandro (8-11-2026): la liga va a la web de verdad, pero con contraseña para que solo entre él hasta que
// todo esté en su sitio. La contraseña la eligió él (10-11-2026). En el código solo va su huella (SHA-256), no la
// contraseña. Si quiere otra, basta con cambiar HUELLA_CLAVE (o poner LIGA_CLAVE en Vercel, que manda sobre ella).
// Para abrirla a todo el mundo: pon LIGA_CON_CLAVE = false (o LIGA_ABIERTA=1 en Vercel) y vuelve a publicar.
export const LIGA_CON_CLAVE = true;
export const COOKIE_PASE = "liga_pase";
export const HUELLA_CLAVE = "35db7c15e3a998afae7090e846496594cda548516d3083ee4d3a95410df072cd";

async function sha256(texto) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(texto))));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}
// ¿Es la contraseña de la liga?
export async function claveBuena(clave, env = process.env) {
  if (env.LIGA_CLAVE) return iguales(clave, env.LIGA_CLAVE);
  return iguales(await sha256(String(clave || "").trim().toLowerCase()), HUELLA_CLAVE);
}
// Con qué se firma la cookie: la contraseña y un secreto del servidor (así no se puede fabricar leyendo el código)
export const secretoPase = (env = process.env) => `${env.LIGA_CLAVE || HUELLA_CLAVE}:${env.PANEL_CLAVE || env.SUPABASE_SECRET_KEY || "local"}`;

export function ligaConClave(env = process.env) {
  if (!LIGA_CON_CLAVE || env.LIGA_ABIERTA === "1") return false;
  // en local (sin secreto del servidor) se deja pasar; en Vercel, cerrada
  return Boolean(env.PANEL_CLAVE || env.SUPABASE_SECRET_KEY || env.VERCEL_ENV === "production");
}

// Lo que se guarda en la cookie: una firma (no la contraseña). Si cambia la contraseña, hay que volver a entrar.
export async function firmaPase(clave) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(clave)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("liga-cazurra-pase-v1")));
  return Array.from(f, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function iguales(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function tienePase(cookie, env = process.env) {
  if (!ligaConClave(env)) return true;
  if (!cookie) return false;
  return iguales(cookie, await firmaPase(secretoPase(env)));
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// La pantalla de la contraseña (oscura, como la liga)
export function paginaClave(volver = "/liga", error = "") {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>La Liga Cazurra</title>
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#07060a;color:#f3ead8;font-family:system-ui,-apple-system,sans-serif}
form{width:min(360px,calc(100% - 32px));display:grid;gap:14px}
h1{margin:0;font-size:40px;line-height:.95;font-weight:900;text-transform:uppercase;letter-spacing:-.01em}
p{margin:0;color:#cfc6b6;font-size:15px;line-height:1.4}
input{height:54px;border-radius:16px;border:1px solid rgba(243,234,216,.22);background:rgba(243,234,216,.06);color:#f3ead8;font-size:18px;padding:0 16px;outline:none}
input:focus{border-color:#e9b44c}
button{height:56px;border:0;border-radius:999px;background:#f3ead8;color:#07060a;font-size:17px;font-weight:800;cursor:pointer}
.error{color:#ffb4a2;font-weight:600;font-size:14px}
</style></head><body>
<form method="post" action="/api/liga-pase">
<h1>La Liga<br>Cazurra</h1>
<p>Todavía en pruebas. Escribe la contraseña para entrar.</p>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
<input type="password" name="clave" autocomplete="current-password" required autofocus aria-label="Contraseña">
<input type="hidden" name="volver" value="${esc(volver)}">
<button type="submit">Entrar</button>
</form></body></html>`;
}

// Solo se vuelve a una página de la liga (nunca a otra web)
export function destinoSeguro(volver) {
  const v = String(volver || "");
  return /^\/liga(\/[\w.\-/?=&%]*)?$/.test(v) && !v.includes("//") ? v : "/liga";
}
