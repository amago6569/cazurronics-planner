// Bajada en San Isidro: lo que se ve y se toca. Dónde está cada puerta y cada pino, y si pasas o chocas, lo decide
// motor-esqui.js, el mismo archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se
// dibuja (3D en escena-esqui.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, tiempoHecho, recorrido, multiplicador,
  DURACION_MS, LIMITE_X, SEPARACION_MIN_MS, CAIDA_MS, ESQUIADOR,
} from "./motor-esqui.js";
import { crearMarco, $, conRaton } from "./marco.js";

const CADA_MS = 20;
export const VE_HASTA = 22; // a cuánta distancia se empiezan a ver las cosas
export const LEJOS = 3.2; // perspectiva del dibujo plano

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 6, m.H * 0.34);
  m.campo = { cx: m.ancho / 2, hw, ySki: m.arriba + m.H * 0.8, yHorizonte: m.arriba + m.H * 0.3 };
}

let partida = null;
let ultimoEnvio = -1e9, xMandada = null, xPendiente = null;
let decididas = [];
let xAntes = 0, vx = 0, tAntes = 0;

const TEXTO = conRaton
  ? { pista: "Mueve el ratón para pasar entre los palos de cada puerta.", regla: "Mueve el ratón y el esquiador le sigue." }
  : { pista: "Arrastra el dedo para pasar entre los palos de cada puerta.", regla: "Arrastra el dedo y el esquiador le sigue." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "esqui",
  nombre: "Bajada en San Isidro",
  duracionMs: DURACION_MS,
  fondo: "fondos/montes",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ movimientos: p.movimientos.slice() }),
  final: (r) => ({
    datos: [["Puertas", `${r.puertas}/${r.total}`], ["Por el centro", r.centros], ["Pinos", r.choques]],
    anuncio: `Abajo. ${r.puntos} puntos: ${r.puertas} puertas de ${r.total} y ${r.choques} choques.`,
    compartir: `He bajado San Isidro pasando ${r.puertas} puertas de eslalon: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-esqui.js"),
  medir: medirCampo,
  empezar(p) { partida = p; ultimoEnvio = -1e9; xMandada = null; xPendiente = null; decididas = []; xAntes = 0; vx = 0; tAntes = 0; },
  actualizar(tj) {
    if (xPendiente !== null && tj - ultimoEnvio >= CADA_MS) enviar(tj);
    for (const c of avanzar(partida, tj)) efecto(c);
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { arrastrando = null; },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  sonidos: {
    puerta: (s, t, f, { tono }) => { tono({ fr: 660 * f, a: 990 * f, g: 0.07, dur: 0.1, tipo: "triangle" }); },
    pino: (s, t, f, { tono, ruido }) => { ruido({ dur: 0.35, fr: 900, q: 0.4, g: 0.3 }); tono({ fr: 140, a: 60, g: 0.2, dur: 0.25 }); },
    nieve: (s, t, f, { ruido }) => { ruido({ dur: 0.22, fr: 4200, q: 0.5, g: 0.06 * f }); },
  },
});

// ── Dedo (o ratón): el esquiador va hacia donde está el dedo ──
let arrastrando = null;
function aPista(clientX) { return Math.max(-LIMITE_X, Math.min(LIMITE_X, (clientX - m.campo.cx) / m.campo.hw)); }
function querer(clientX) {
  if (m.estado !== "juego") return;
  xPendiente = aPista(clientX);
  const tj = m.tj();
  if (tj - ultimoEnvio >= CADA_MS) enviar(tj);
}
function enviar(tj) {
  const x = Math.round(xPendiente * 10000);
  xPendiente = null;
  if (x === xMandada) return;
  const t = Math.max(Math.round(tj), tiempoHecho(partida), partida.movimientos.length ? partida.ultimoT + SEPARACION_MIN_MS : 0);
  if (t > DURACION_MS) return;
  try { mover(partida, t, x); xMandada = x; ultimoEnvio = tj; } catch { /* demasiados: se ignora */ }
}
const lienzo = $("lienzo");
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego") return;
  arrastrando = e.pointerId;
  lienzo.setPointerCapture(e.pointerId);
  querer(e.clientX);
  m.pista(null);
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (e.pointerId === arrastrando || e.pointerType === "mouse") { querer(e.clientX); if (e.pointerType === "mouse") m.pista(null); }
});
const soltar = (e) => { if (e.pointerId === arrastrando) arrastrando = null; };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

let multAntes = 1;
function efecto(c) {
  decididas.push(c);
  if (decididas.length > 30) decididas.shift();
  const r = c.res;
  const e = aPantalla(partida.x, 0), p = { x: e.x, y: e.y - m.campo.hw * 0.55 };
  if (c.tipo === "puerta") {
    if (r.bien) {
      m.sonar("puerta", 1 + Math.min(0.5, r.racha * 0.03));
      m.aviso(r.centro ? `¡Centro! +${r.ganados}` : `+${r.ganados}`, r.centro ? "oro" : "bien", p.x, p.y);
      m.vibrar(6);
    } else { m.sonar("mal"); m.aviso("Puerta fallada", "mal", p.x, p.y); m.anunciar("Puerta fallada."); }
  } else if (!r.bien) {
    m.sonar("pino"); m.vibrar([30, 40, 30]);
    m.aviso(`¡Al pino! ${r.ganados}`, "mal", p.x, p.y);
    m.anunciar("Te has caído contra un pino.");
  }
  const mult = multiplicador(partida.racha);
  if (mult > multAntes) m.avisoNivel(mult === 2 ? "¡5 seguidas! Puntos dobles" : "¡12 seguidas! Puntos triples");
  multAntes = mult;
  m.pintarPuntos(partida.puntos, r.ganados > 0, mult > 1 ? { texto: `×${mult}`, sub: mult === 2 ? "DOBLES" : "TRIPLES" } : null);
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
// cosas: { tipo, x, dist, medio, color, res, n } con dist = lo que le falta al esquiador para llegar (negativo: ya pasó)
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") {
    const s = ahora / 1000;
    return { x: 0.35 * Math.sin(s * 0.9), vx: 0.35 * 0.9 * Math.cos(s * 0.9), recorrido: s * 4, cosas: [], caido: 0, tj: s * 1000 };
  }
  const t = Math.max(0, tj);
  const yo = recorrido(t);
  const cosas = [];
  for (let i = Math.max(0, partida.siguiente - 4); i < partida.cosas.length; i++) {
    const c = partida.cosas[i], dist = recorrido(c.tc) - yo;
    if (dist > VE_HASTA) break;
    if (dist < -3) continue;
    cosas.push({ tipo: c.tipo, x: c.x, dist, medio: c.medio, color: c.color, res: c.res, n: c.id });
  }
  // velocidad de lado (para inclinar al esquiador)
  const dt = Math.max(1, ahora - tAntes) / 1000;
  if (ahora !== tAntes) { vx += ((partida.x - xAntes) / dt - vx) * Math.min(1, dt * 10); xAntes = partida.x; tAntes = ahora; }
  const caido = t < partida.quietoHasta ? (partida.quietoHasta - t) / CAIDA_MS : 0;
  return { x: partida.x, vx, recorrido: yo, cosas, caido, tj: t };
}

// ── Dibujo en plano: perspectiva hecha a mano ──
export function aPantalla(x, dist) {
  const { cx, hw, ySki, yHorizonte } = m.campo, f = LEJOS / (LEJOS + Math.max(-2.5, dist));
  return { x: cx + x * hw * f, y: yHorizonte + (ySki - yHorizonte) * f, f };
}
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { yHorizonte, hw } = m.campo;
  // nieve
  const g = ctx.createLinearGradient(0, yHorizonte, 0, m.alto);
  g.addColorStop(0, "rgba(235,240,248,.85)"); g.addColorStop(1, "#f6f8fc");
  ctx.fillStyle = g; ctx.fillRect(0, yHorizonte, m.ancho, m.alto - yHorizonte);
  // marcas en la nieve que pasan (para ver que se baja)
  ctx.fillStyle = "rgba(160,175,200,.35)";
  for (let i = 0; i < 12; i++) { const d = ((i * 2 - v.recorrido) % 24 + 24) % 24 - 2; const a = aPantalla(-1.1, d), b = aPantalla(1.1, d); ctx.fillRect(a.x, a.y, 4 * a.f, 2); ctx.fillRect(b.x, b.y, 4 * b.f, 2); }
  for (const c of [...v.cosas].sort((a, b) => b.dist - a.dist)) {
    if (c.tipo === "pino") {
      const p = aPantalla(c.x, c.dist), s = p.f * hw;
      ctx.fillStyle = "#4a3020"; ctx.fillRect(p.x - 0.02 * s, p.y - 0.12 * s, 0.04 * s, 0.12 * s);
      ctx.fillStyle = "#1f4a32";
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(p.x, p.y - (0.55 - k * 0.12) * s); ctx.lineTo(p.x - (0.12 + k * 0.03) * s, p.y - (0.12 + k * 0.1) * s); ctx.lineTo(p.x + (0.12 + k * 0.03) * s, p.y - (0.12 + k * 0.1) * s); ctx.fill(); }
    } else {
      for (const lado of [-1, 1]) {
        const p = aPantalla(c.x + lado * c.medio, c.dist), s = p.f * hw;
        ctx.fillStyle = "#333"; ctx.fillRect(p.x - 1.5, p.y - 0.4 * s, 3, 0.4 * s);
      }
      const a = aPantalla(c.x - c.medio, c.dist), b = aPantalla(c.x + c.medio, c.dist), s = a.f * hw;
      ctx.fillStyle = c.res ? (c.res.bien ? "rgba(80,190,110,.85)" : "rgba(120,120,120,.6)") : c.color ? "#2d62d6" : "#d0262e";
      ctx.fillRect(a.x, a.y - 0.4 * s, b.x - a.x, 0.12 * s);
    }
  }
  // el esquiador
  const p = aPantalla(v.x, 0), s = hw;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(v.caido ? 1.2 * v.caido : Math.max(-0.4, Math.min(0.4, v.vx * 0.18)));
  ctx.fillStyle = "#222"; ctx.fillRect(-0.06 * s, -0.01 * s, 0.04 * s, 0.02 * s); ctx.fillRect(0.02 * s, -0.01 * s, 0.04 * s, 0.02 * s);
  ctx.fillStyle = "#1d2f5a"; ctx.fillRect(-0.04 * s, -0.12 * s, 0.08 * s, 0.11 * s);
  ctx.fillStyle = "#c8262c"; ctx.fillRect(-0.05 * s, -0.24 * s, 0.1 * s, 0.13 * s);
  ctx.fillStyle = "#f0f0f0"; ctx.beginPath(); ctx.arc(0, -0.28 * s, 0.04 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  void ESQUIADOR;
}

m.arrancar();
