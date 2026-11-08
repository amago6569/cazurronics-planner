// ============ LIGA CAZURRA: tu cuenta (para todas las páginas de la liga) ============
// Entrar con el correo (código de 6 cifras) y apodo, y las llamadas a /api/liga con la sesión.
// La sesión se guarda en este navegador (localStorage) y se renueva sola: en el mismo dispositivo no hay que volver a
// entrar. Solo se borra si tú sales o si el servidor dice que la sesión ya no vale (no por un fallo de red).
// Sin cuenta se puede jugar igual, pero de práctica: no suma en la liga.

const CLAVE = "liga-sesion";
const API = "/api/liga";

// ── Sesión guardada ──
function leer() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE) || "null"); return s && s.access && s.refresh ? s : null; } catch { return null; }
}
function guardar(s) {
  try { if (s) localStorage.setItem(CLAVE, JSON.stringify({ access: s.access, refresh: s.refresh, expira: s.expira, email: s.usuario?.email || s.email })); else localStorage.removeItem(CLAVE); }
  catch { /* sin almacenamiento: la sesión dura lo que la página */ }
  memoria = s;
}
let memoria = leer();
export function conectado() { return Boolean(memoria || leer()); }
export function correo() { return (memoria || leer())?.email || null; }
export function salir() { guardar(null); avisar(); }

// Otras partes de la página se enteran de que has entrado o salido
const oyentes = new Set();
export function alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); }
function avisar() { for (const f of oyentes) { try { f(); } catch (e) { console.error(e); } } }
addEventListener("storage", (e) => { if (e.key === CLAVE) { memoria = leer(); avisar(); } });

export class ErrorApi extends Error {
  constructor(status, mensaje, codigo) { super(mensaje); this.status = status; this.codigo = codigo; }
}

let renovando = null;
async function renovar() {
  const s = memoria || leer();
  if (!s) return null;
  renovando ||= (async () => {
    try {
      const r = await fetch(`${API}/renovar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh: s.refresh }) });
      if (r.status === 401) {
        // otra pestaña o página pudo renovarla justo antes (la clave vieja ya no vale): se usa la guardada
        const otra = leer();
        if (otra && otra.refresh !== s.refresh) { memoria = otra; return otra; }
        guardar(null); avisar(); return null;
      }
      if (!r.ok) return s; // fallo de red o del servidor: se reintenta en la siguiente llamada
      const { sesion } = await r.json();
      guardar({ ...sesion, email: sesion.usuario?.email || s.email });
      return memoria;
    } catch { return s; } finally { setTimeout(() => (renovando = null), 0); }
  })();
  return renovando;
}

async function llamar(ruta, { metodo = "GET", cuerpo, sesion = true } = {}) {
  let s = sesion ? memoria || leer() : null;
  if (s && s.expira && s.expira * 1000 - Date.now() < 60000) s = await renovar();
  const hacer = (ses) => fetch(`${API}/${ruta}`, {
    method: metodo,
    headers: { ...(cuerpo ? { "content-type": "application/json" } : {}), ...(ses ? { authorization: `Bearer ${ses.access}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    cache: "no-store",
  });
  let r;
  try { r = await hacer(s); } catch { throw new ErrorApi(0, "Sin conexión. Revisa la cobertura y vuelve a probar."); }
  if (r.status === 401 && s) { // la sesión caducó antes de tiempo: se renueva una vez
    const nueva = await renovar();
    if (nueva && nueva.access !== s.access) { try { r = await hacer(nueva); } catch { throw new ErrorApi(0, "Sin conexión. Revisa la cobertura y vuelve a probar."); } }
  }
  let j = {};
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw new ErrorApi(r.status, j.error || "Algo ha fallado. Prueba otra vez.", j.codigo);
  return j;
}

// ── Lo que usan las páginas ──
export const hoy = () => llamar("hoy");
export const ranking = (de) => llamar(`ranking?de=${de === "semana" ? "semana" : "dia"}`);
export const empezar = (juego) => llamar("empezar", { metodo: "POST", cuerpo: { juego } });
export const terminar = (partida, datos) => llamar("terminar", { metodo: "POST", cuerpo: { partida, datos } });
export const guardarPerfil = (p) => llamar("perfil", { metodo: "POST", cuerpo: p });
export async function borrarCuenta() { await llamar("borrar", { metodo: "POST", cuerpo: { confirmar: true } }); salir(); }
async function pedirCodigo(email) { return llamar("codigo", { metodo: "POST", cuerpo: { email }, sesion: false }); }
async function entrarConCodigo(email, codigo) {
  const j = await llamar("entrar", { metodo: "POST", cuerpo: { email, codigo }, sesion: false });
  guardar({ ...j.sesion, email: j.sesion.usuario?.email || email });
  avisar();
  return j;
}

// ─────────────────────────── La hoja para entrar ───────────────────────────
// Una pregunta por pantalla: correo → código → (si es nuevo) apodo y casillas.
const CSS = `
.hoja-fondo { position: fixed; inset: 0; z-index: 50; background: rgba(7,6,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center; animation: hoja-fondo 220ms ease both; }
.hoja { width: 100%; max-width: 520px; box-sizing: border-box; max-height: 100dvh; overflow-y: auto; overscroll-behavior: contain;
  background: #121017; color: var(--crema, #f3ead8); border: 1px solid rgba(243,234,216,.14); border-bottom: 0; border-radius: 26px 26px 0 0;
  padding: 22px max(20px, env(safe-area-inset-right, 0px)) max(22px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));
  font-family: var(--letra, "Archivo", sans-serif); animation: hoja-sube 360ms cubic-bezier(.23,1,.32,1) both; display: grid; gap: 14px; }
@media (min-width: 640px) { .hoja-fondo { align-items: center; } .hoja { border-radius: 26px; border-bottom: 1px solid rgba(243,234,216,.14); } }
.hoja h2 { margin: 0; font-weight: 900; font-stretch: 62%; text-transform: uppercase; font-size: 40px; line-height: .9; }
.hoja p { margin: 0; font-size: 15px; line-height: 1.4; color: #cfc6b6; }
.hoja p b { color: var(--crema, #f3ead8); }
.hoja label.campo { display: grid; gap: 6px; font-size: 13px; font-weight: 700; letter-spacing: .04em; color: #a39c90; }
.hoja input[type=email], .hoja input[type=text] { height: 54px; border-radius: 16px; border: 1px solid rgba(243,234,216,.22); background: rgba(243,234,216,.06);
  color: var(--crema, #f3ead8); font: 600 18px/1 var(--letra, sans-serif); padding: 0 16px; outline: none; width: 100%; box-sizing: border-box; }
.hoja input:focus { border-color: var(--oro, #e9b44c); }
.hoja input.codigo { font-size: 30px; letter-spacing: .35em; text-align: center; font-variant-numeric: tabular-nums; font-weight: 800; }
.hoja .casilla { display: grid; grid-template-columns: 26px 1fr; gap: 10px; align-items: start; font-size: 15px; line-height: 1.35; color: #e4dccd; cursor: pointer; }
.hoja .casilla input { width: 22px; height: 22px; margin: 1px 0 0; accent-color: #e9b44c; }
.hoja .casilla a { color: var(--oro, #e9b44c); }
.hoja .error { color: #ffb4a2; font-size: 14px; font-weight: 600; min-height: 1em; }
.hoja .error:empty { display: none; }
.hoja .fila { display: grid; gap: 10px; }
.hoja button { font-family: inherit; touch-action: manipulation; }
.hoja .principal { width: 100%; height: 56px; border: 0; border-radius: 999px; background: var(--crema, #f3ead8); color: #07060a; font-size: 17px; font-weight: 800; cursor: pointer; transition: transform 140ms ease-out, opacity 160ms ease; }
.hoja .principal:active { transform: scale(.97); }
.hoja .principal[disabled] { opacity: .55; cursor: default; }
.hoja .enlace { background: none; border: 0; color: #cfc6b6; font-size: 15px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; padding: 8px; cursor: pointer; justify-self: center; }
.hoja .cerrar { position: absolute; right: 12px; top: 12px; width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(243,234,216,.08); color: #f3ead8; font-size: 22px; cursor: pointer; }
.hoja { position: relative; }
@keyframes hoja-fondo { from { opacity: 0; } }
@keyframes hoja-sube { from { transform: translateY(40px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .hoja, .hoja-fondo { animation: none; } }
`;

function estilo() {
  if (document.getElementById("hoja-liga-css")) return;
  const s = document.createElement("style");
  s.id = "hoja-liga-css"; s.textContent = CSS;
  document.head.appendChild(s);
}

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Abre la hoja. Devuelve una promesa que se cumple con true si acaba con cuenta y perfil, o false si la cierra.
// motivo: una frase arriba («Para que cuente en la liga…»). perfilActual: para cambiar el apodo.
export function abrirEntrada({ motivo = "", perfilActual = null, soloPerfil = false } = {}) {
  estilo();
  return new Promise((resolver) => {
    const previoFoco = document.activeElement;
    const fondo = document.createElement("div");
    fondo.className = "hoja-fondo";
    fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo"><button class="cerrar" type="button" aria-label="Cerrar">×</button><div class="hoja-paso" style="display:grid;gap:14px"></div></div>`;
    document.body.appendChild(fondo);
    const paso = fondo.querySelector(".hoja-paso");
    let email = correo() || "";
    let terminado = false;

    function cerrar(ok) {
      if (terminado) return;
      terminado = true;
      removeEventListener("keydown", tecla, true);
      fondo.remove();
      try { previoFoco?.focus?.({ preventScroll: true }); } catch { /* nada */ }
      resolver(ok);
    }
    function tecla(e) {
      if (e.key === "Escape") { e.preventDefault(); cerrar(false); }
      if (e.key === "Tab") { // el foco no se escapa de la hoja
        const f = [...fondo.querySelectorAll("button, input, a[href]")].filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    addEventListener("keydown", tecla, true);
    fondo.querySelector(".cerrar").onclick = () => cerrar(false);
    fondo.addEventListener("pointerdown", (e) => { if (e.target === fondo) cerrar(false); });

    function pintar(html, alMontar) {
      paso.innerHTML = html;
      alMontar?.();
      const primero = paso.querySelector("input:not([type=checkbox])") || paso.querySelector(".principal");
      setTimeout(() => primero?.focus({ preventScroll: true }), 60);
    }
    function ocupado(boton, si, texto) { boton.disabled = si; if (texto) boton.textContent = texto; }

    function pasoCorreo(error = "") {
      pintar(`
        <h2 id="hoja-titulo">Entra en la liga</h2>
        ${motivo ? `<p>${esc(motivo)}</p>` : ""}
        <p>Te mandamos un código de 6 cifras a tu correo. Sin contraseñas.</p>
        <form class="fila" novalidate>
          <label class="campo">Tu correo<input type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required value="${esc(email)}" placeholder="nombre@correo.es"></label>
          <div class="error" role="alert">${esc(error)}</div>
          <button class="principal" type="submit">Mandarme el código</button>
        </form>`, () => {
        const f = paso.querySelector("form");
        f.onsubmit = async (e) => {
          e.preventDefault();
          const b = f.querySelector("button");
          email = f.email.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { f.querySelector(".error").textContent = "Ese correo no parece bien escrito."; return; }
          ocupado(b, true, "Mandando…");
          try { const r = await pedirCodigo(email); pasoCodigo("", r.codigoDePrueba); }
          catch (err) { ocupado(b, false, "Mandarme el código"); f.querySelector(".error").textContent = err.message; }
        };
      });
    }

    function pasoCodigo(error = "", dePrueba = "") {
      pintar(`
        <h2 id="hoja-titulo">Mira tu correo</h2>
        <p>Te hemos mandado un código a <b>${esc(email)}</b>. Si no lo ves, mira en «Spam» o «Promociones».</p>
        ${dePrueba ? `<p>(Prueba en local: el código es <b>${esc(dePrueba)}</b>)</p>` : ""}
        <form class="fila" novalidate>
          <label class="campo">Código<input class="codigo" type="text" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required></label>
          <div class="error" role="alert">${esc(error)}</div>
          <button class="principal" type="submit">Entrar</button>
        </form>
        <button class="enlace" type="button" data-otro>Cambiar el correo o pedir otro código</button>`, () => {
        const f = paso.querySelector("form");
        const campo = f.codigo;
        let mandando = false;
        const mandar = async () => {
          const cod = campo.value.replace(/\D/g, "");
          if (cod.length < 6) { f.querySelector(".error").textContent = "Escribe las 6 cifras."; return; }
          if (mandando) return;
          mandando = true;
          const b = f.querySelector("button");
          ocupado(b, true, "Entrando…");
          try {
            const j = await entrarConCodigo(email, cod);
            if (j.perfil && !soloPerfil) cerrar(true); else pasoPerfil(j.perfil);
          } catch (err) { mandando = false; ocupado(b, false, "Entrar"); campo.select(); f.querySelector(".error").textContent = err.message; }
        };
        campo.addEventListener("input", () => { campo.value = campo.value.replace(/\D/g, "").slice(0, 10); if (campo.value.length === 6) mandar(); });
        f.onsubmit = (e) => { e.preventDefault(); mandar(); };
        paso.querySelector("[data-otro]").onclick = () => pasoCorreo();
      });
    }

    function pasoPerfil(actual) {
      const nuevo = !actual;
      pintar(`
        <h2 id="hoja-titulo">${nuevo ? "Último paso" : "Tu perfil"}</h2>
        <p>${nuevo ? "Así sales en el ranking. Tu correo no lo ve nadie." : "Así sales en el ranking."}</p>
        <form class="fila" novalidate>
          <label class="campo">Apodo (3 a 16 letras)<input type="text" name="apodo" maxlength="16" autocomplete="nickname" autocapitalize="words" spellcheck="false" required value="${esc(actual?.apodo || "")}"></label>
          ${nuevo ? `<label class="casilla"><input type="checkbox" name="acepta"><span>Tengo 14 años o más y acepto las <a href="/liga/bases.html" target="_blank" rel="noopener">bases de la liga</a>.</span></label>` : ""}
          <label class="casilla"><input type="checkbox" name="novedades" ${actual?.novedades ? "checked" : ""}><span>Quiero que me escribáis cuando haya novedades de la liga (opcional).</span></label>
          <div class="error" role="alert"></div>
          <button class="principal" type="submit">${nuevo ? "Empezar a jugar" : "Guardar"}</button>
        </form>`, () => {
        const f = paso.querySelector("form");
        f.onsubmit = async (e) => {
          e.preventDefault();
          const err = f.querySelector(".error");
          if (nuevo && !f.acepta.checked) { err.textContent = "Marca la casilla de los 14 años y las bases para poder jugar."; return; }
          const b = f.querySelector("button");
          const texto = b.textContent;
          ocupado(b, true, "Guardando…");
          try {
            await guardarPerfil({ apodo: f.apodo.value, acepta: nuevo ? f.acepta.checked : undefined, novedades: f.novedades.checked });
            avisar();
            cerrar(true);
          } catch (er) { ocupado(b, false, texto); err.textContent = er.message; }
        };
      });
    }

    if (soloPerfil && conectado()) pasoPerfil(perfilActual);
    else pasoCorreo();
  });
}

// ─────────────────────────── Partidas de liga dentro de un juego ───────────────────────────
// Cada juego lo usa igual: antes de empezar pregunta si la partida cuenta, y al acabar manda lo que hizo el jugador.
//   const liga = crearLiga("canasta");
//   await liga.preparar()  → { oficial: bool, texto, quedan, … } para pintar el botón
//   const { semilla, oficial } = await liga.empezar()   (si no puede ser oficial, devuelve oficial:false y semilla null)
//   const r = await liga.terminar(datos)                 → { estado, puntos, posicionDia, … } o null si era de práctica
// Partidas que no se pudieron mandar (sin cobertura al acabar): se reintentan la próxima vez que se abre un juego.
const PENDIENTES = "liga-pendientes";
function pendientes() { try { return JSON.parse(localStorage.getItem(PENDIENTES) || "[]"); } catch { return []; } }
function guardarPendientes(l) { try { if (l.length) localStorage.setItem(PENDIENTES, JSON.stringify(l.slice(-5))); else localStorage.removeItem(PENDIENTES); } catch { /* nada */ } }
async function mandarPendientes() {
  const quedan = [];
  for (const p of pendientes()) {
    if (Date.now() - p.hora > 86400000) continue; // de hace más de un día: ya no cuenta
    try { await terminar(p.partida, p.datos); } catch (e) { if (!e.status || e.status >= 500 || e.status === 429) quedan.push(p); }
  }
  guardarPendientes(quedan);
}

export function crearLiga(juego) {
  let info = null, partida = null;
  return {
    get info() { return info; },
    async preparar() {
      if (!conectado()) { info = { oficial: false, motivo: "sin_cuenta" }; return info; }
      try {
        if (pendientes().length) await mandarPendientes();
        const h = await hoy();
        const j = h.juegos.find((x) => x.id === juego);
        if (!h.conectado) info = { oficial: false, motivo: "sin_cuenta" };
        else if (!h.perfil) info = { oficial: false, motivo: "sin_perfil" };
        else if (!h.abierta) info = { oficial: false, motivo: "cerrada" };
        else if (!j) info = { oficial: false, motivo: "no_toca" };
        else if (j.quedan <= 0) info = { oficial: false, motivo: "sin_intentos", mejor: j.mejor };
        else info = { oficial: true, quedan: j.quedan, usados: j.usados, mejor: j.mejor, apodo: h.perfil.apodo };
      } catch (e) { info = { oficial: false, motivo: "error", error: e.message }; }
      return info;
    },
    async empezar(conLiga = true) {
      partida = null;
      if (!conLiga || !info?.oficial) return { oficial: false, semilla: null };
      const r = await empezar(juego); // si falla, lanza: el juego avisa y no empieza
      partida = r.partida;
      info = { ...info, quedan: r.quedan, intento: r.intento };
      return { oficial: true, semilla: r.semilla, intento: r.intento, quedan: r.quedan };
    },
    async terminar(datos) {
      if (!partida) return null;
      const p = partida;
      partida = null;
      // si se corta la red, se reintenta un par de veces: la partida sigue «jugando» en el servidor hasta que llegue
      let ultimo;
      for (let i = 0; i < 3; i++) {
        try { const r = await terminar(p, datos); info = { ...info, quedan: r.quedan, mejor: r.mejor }; return r; }
        catch (e) { ultimo = e; if (e.status && e.status < 500 && e.status !== 429) break; await new Promise((ok) => setTimeout(ok, 1200 * (i + 1))); }
      }
      if (!ultimo?.status || ultimo.status >= 500 || ultimo.status === 429) guardarPendientes([...pendientes(), { partida: p, datos, juego, hora: Date.now() }]);
      return { estado: "error", error: ultimo?.message || "No se pudo guardar la partida." };
    },
  };
}
