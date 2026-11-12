// Bolos leoneses: lo que se ve y se toca. Qué bolos caen y cuánto valen lo decide motor-bolos.js, el mismo archivo
// con el que el servidor repite la partida. Aquí se lee el gesto del dedo, suena y se dibuja (3D en escena-bolos.js;
// en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, lanzar, avanzar, resumen, xBola, tiempoHecho,
  DURACION_MS, LARGO, ANCHO, TIRO, BOLA, BOLO, ALTO, RECOGER_MS,
} from "./motor-bolos.js";
import { crearMarco, $, conRaton } from "./marco.js";
import { crearCampo } from "./campo.js";

// La bolera vista desde la raya de tiro, desde arriba y atrás
export const D = 10;
export const campo = crearCampo({ D, lejos: LARGO, yLejos: 0.3, yCerca: 0.9, altoHw: 0.3, anchoMax: 1.02 });
export const CAE_MS = 260; // lo que tarda un bolo en tumbarse (solo se ve)

let partida = null;
let gesto = null; // el dedo en la pantalla: { id, puntos: [{ x, y }] }
let apunte = null; // el tiro que saldría si sueltas ahora: { x, a, c, s } (metros)
let ultimoTiro = null; // { t0, v, tiro, desvios, fin } para dibujar la bola
let viejos = null; // los bolos de la tirada anterior, mientras se arma la nueva: { bolos, hasta }
let fiesta = 0; // ms de partida del último pleno

const TEXTO = conRaton
  ? { pista: "Pulsa, arrastra hacia delante y suelta. Curva el gesto para darle efecto.", regla: "Arrastra el ratón hacia delante y suelta. Si curvas el gesto, la bola tuerce." }
  : { pista: "Desliza el dedo hacia delante y suelta. Curva el gesto para darle efecto.", regla: "Desliza el dedo hacia delante para tirar. Si curvas el gesto, la bola tuerce." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "bolos",
  nombre: "Bolos leoneses",
  duracionMs: DURACION_MS,
  fondo: "fondos/valle",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ tiros: p.tiros.slice() }),
  final: (r) => ({
    datos: [["Bolos", r.bolos], ["Miches", r.miches], ["Plenos", r.plenos]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.bolos} bolos, ${r.miches} miches y ${r.plenos} plenos.`,
    compartir: `He tirado ${r.bolos} bolos y ${r.miches} ${r.miches === 1 ? "miche" : "miches"} en la bolera: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-bolos.js"),
  medir: (mm) => campo.medir(mm),
  empezar(p) { partida = p; gesto = null; apunte = null; ultimoTiro = null; viejos = null; fiesta = -1e9; },
  actualizar(tj) {
    for (const e of avanzar(partida, tj)) efecto(e, tj);
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { gesto = null; apunte = null; },
  chip: () => (partida ? `<span>Tirada ${partida.tiradas + 1} · bola ${Math.min(2, partida.bolas + (partida.estado === "bola" ? 0 : 1))} de 2</span>` : null),
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // la bola rodando por la tierra
    rueda: (s, t, f, { ruido }) => ruido({ dur: 0.9 * f, fr: 260, q: 0.5, g: 0.22, tipo: "lowpass" }),
    // madera contra madera
    bolo: (s, t, f, { tono, ruido }) => { tono({ fr: 760 * f, a: 420, g: 0.16, dur: 0.07, tipo: "triangle" }); ruido({ dur: 0.05, fr: 2200, g: 0.2 }); },
    miche: (s, t, f, { tono }) => { tono({ fr: 1250, a: 900, g: 0.14, dur: 0.09, tipo: "triangle" }); tono({ fr: 1880, g: 0.07, dur: 0.12, retraso: 0.05 }); },
    tablon: (s, t, f, { tono, ruido }) => { tono({ fr: 130, a: 70, g: 0.22, dur: 0.14 }); ruido({ dur: 0.07, fr: 500, g: 0.14 }); },
  },
});

// ── El gesto: se desliza hacia delante y se suelta. De ahí salen la salida, la dirección, el efecto y la fuerza ──
function leerGesto(pts) {
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = a.y - b.y, largo = Math.hypot(dx, dy);
  if (dy < 28 || largo < 36) return null; // tiene que ir hacia delante
  // dónde sale y hacia dónde va, en metros de bolera (lo que el dedo marca en el suelo)
  const A = campo.aCampo(a.x, Math.min(a.y, campo.c.yCerca)), B = campo.aCampo(b.x, Math.min(b.y, campo.c.yCerca - 20));
  const x = Math.max(-TIRO.xMax / 1000, Math.min(TIRO.xMax / 1000, A.x));
  const avance = Math.max(0.4, B.y - Math.max(0, A.y));
  const dir = Math.max(-TIRO.aMax / 1000, Math.min(TIRO.aMax / 1000, (B.x - A.x) / avance));
  // el efecto: cuánto se comba el gesto respecto a la línea recta (hacia la derecha, positivo)
  let comba = 0;
  for (const q of pts) { const d = ((q.x - a.x) * dy + (q.y - a.y) * dx) / largo; if (Math.abs(d) > Math.abs(comba)) comba = d; }
  const c = Math.max(-1, Math.min(1, (-comba / largo) / 0.16));
  const s = Math.max(0, Math.min(1, (largo - 60) / (m.H * 0.3)));
  return { x, a: dir, c: Math.abs(c) < 0.08 ? 0 : c, s };
}
const lienzo = $("lienzo");
const listo = () => m.estado === "juego" && partida && partida.estado === "listo" && m.tj() >= partida.listoEn;
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego") return;
  gesto = { id: e.pointerId, puntos: [{ x: e.clientX, y: e.clientY }] };
  lienzo.setPointerCapture(e.pointerId);
  apunte = null;
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (!gesto || e.pointerId !== gesto.id) return;
  const u = gesto.puntos[gesto.puntos.length - 1];
  if (Math.hypot(e.clientX - u.x, e.clientY - u.y) < 4) return;
  if (gesto.puntos.length < 200) gesto.puntos.push({ x: e.clientX, y: e.clientY });
  apunte = leerGesto(gesto.puntos);
});
function soltar(e) {
  if (!gesto || e.pointerId !== gesto.id) return;
  const tiro = e.type === "pointerup" ? leerGesto(gesto.puntos) : null;
  gesto = null; apunte = null;
  if (!tiro || !listo()) return;
  const t = Math.max(Math.round(m.tj()), tiempoHecho(partida), partida.tiros.length ? partida.ultimoT + 400 : 0);
  if (t > DURACION_MS) return;
  try { lanzar(partida, t, Math.round(tiro.x * 1000), Math.round(tiro.a * 1000), Math.round(tiro.c * 1000), Math.round(tiro.s * 1000)); m.pista(null); } catch { /* no vale: se ignora */ }
}
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function efecto(e, tj) {
  if (e.tipo === "tiro") {
    ultimoTiro = { ...partida.vuelo };
    m.sonar("rueda", 0.6 + 0.6 * (1 - e.s));
  } else if (e.tipo === "cae") {
    m.sonar(e.miche ? "miche" : "bolo", 0.85 + 0.3 * ((e.i * 7) % 5) / 5);
    const p = campo.aPantalla(e.x, e.y, ALTO);
    m.aviso(`+${e.ganados}`, e.miche ? "oro" : "bien", p.x, p.y - 8);
    if (e.miche) { m.vibrar(40); m.anunciar("¡Miche!"); }
    m.pintarPuntos(partida.puntos, true, null);
  } else if (e.tipo === "pleno") {
    fiesta = tj;
    m.sonar("oro"); m.vibrar(90);
    m.avisoNivel(e.deUna ? `¡Los nueve de una! +${e.ganados}` : `¡Pleno! +${e.ganados}`);
    m.pintarPuntos(partida.puntos, true, null);
  } else if (e.tipo === "para") {
    if (!e.fuera) m.sonar("tablon", 1);
    if (!e.caidos) { const p = campo.aPantalla(0, LARGO * 0.75, 0.3); m.aviso(e.fuera ? "¡Fuera!" : "Blanca", "mal", p.x, p.y); m.anunciar(e.fuera ? "Fuera." : "Blanca: ningún bolo."); }
    else m.anunciar(`${e.caidos} ${e.caidos === 1 ? "bolo" : "bolos"}.`);
    if (partida.estado === "armando") viejos = { bolos: partida.anteriores, hasta: e.t + RECOGER_MS };
  }
}

// Dónde está la bola de un tiro a la altura y (con lo que la han apartado los bolos)
function xDe(w, y) {
  let d = 0;
  for (const k of w.desvios) if (k.y <= y) d = k.d;
  return xBola({ ...w.tiro, desvio: d }, y);
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") {
    // en el menú: el castro armado y una bola que cruza de vez en cuando sin llegar
    const bolos = [];
    for (let f = 0; f < 3; f++) for (let c = -1; c <= 1; c++) bolos.push({ i: bolos.length, x: c * 0.34, y: 4.3 + f * 0.34, miche: false, caido: 0, dx: 0, dy: 1, sube: 1 });
    bolos.push({ i: 9, x: 0.8, y: 5.15, miche: true, caido: 0, dx: 0, dy: 1, sube: 1 });
    return { bolos, bola: { x: -0.3, y: 0.25, giro: 0, ve: true, enMano: true }, apunte: null, fiesta: 0, tj: ahora, menu: true };
  }
  const arma = partida.estado === "armando";
  const lista = arma && viejos && tj < viejos.hasta ? viejos.bolos : partida.bolos;
  const sube = arma && !(viejos && tj < viejos.hasta) ? Math.max(0, Math.min(1, 1 - (partida.listoEn - tj) / 420)) : 1;
  const bolos = lista.map((b) => ({ i: b.i, x: b.x, y: b.y, miche: b.miche, dx: b.dx, dy: b.dy, caido: b.pie ? 0 : Math.min(1, (tj - (b.cae ?? tj)) / CAE_MS), sube: lista === partida.bolos ? sube : 1 }));
  let bola = { x: apunte ? apunte.x : 0, y: 0.25, giro: 0, ve: partida.estado === "listo" && tj >= partida.listoEn - 250, enMano: true };
  const w = ultimoTiro;
  if (w && (partida.estado === "bola" || tj < w.para + RECOGER_MS * 0.8)) {
    const y = Math.min(w.fin, 0.25 + ((tj - w.t0) / 1000) * w.v);
    bola = { x: xDe(w, y), y, giro: y / BOLA, ve: true, enMano: false, parada: tj >= w.para, efecto: w.tiro.c };
  }
  return { bolos, bola, apunte: listo() ? apunte : null, fiesta: tj - fiesta < 1600 ? (tj - fiesta) / 1600 : 0, tj, menu: false, lado: partida.lado, cx: partida.cx };
}

// ── La guía del tiro mientras deslizas: solo el arranque del camino (encima de todo, en plano) ──
function dibujarEncima(ctx) {
  if (m.estado !== "juego" || !gesto) return false;
  const pts = gesto.puntos;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // el rastro del dedo
  ctx.strokeStyle = "rgba(243,234,216,.35)"; ctx.lineWidth = 5;
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  if (apunte && listo()) {
    const hasta = 1.6 + 1.2 * apunte.s;
    ctx.strokeStyle = "rgba(233,180,76,.9)"; ctx.lineWidth = 3; ctx.setLineDash([2, 9]);
    ctx.beginPath();
    for (let y = 0.25; y <= hasta; y += 0.1) { const q = campo.aPantalla(xBola(apunte, y), y, 0.02); y === 0.25 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); }
    ctx.stroke();
  }
  ctx.restore();
  return true;
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), P = campo.aPantalla, hw = campo.c.hw;
  const cuad = (x0, y0, x1, y1, color) => { const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill(); };
  cuad(-4, -1, 4, LARGO + 2.5, "#6f9a48");
  cuad(-ANCHO, -1, ANCHO, LARGO, "#c2a678");
  cuad(-ANCHO, LARGO, ANCHO, LARGO + 0.12, "#6a4a2c");
  cuad(-ANCHO, 0.02, ANCHO, 0.07, "#f1e3c0");
  const cosas = v.bolos.map((b) => ({ ...b, tipo: "bolo" }));
  if (v.bola.ve) cosas.push({ ...v.bola, tipo: "bola" });
  cosas.sort((a, b) => b.y - a.y);
  for (const o of cosas) {
    if (o.tipo === "bola") {
      const q = P(o.x, o.y, BOLA), r = BOLA * hw * q.f;
      ctx.fillStyle = "#5a3418"; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(q.x - r * 0.3, q.y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const alto = (o.miche ? ALTO * 0.6 : ALTO) * o.sube, k = o.caido;
    const pie = P(o.x, o.y, 0), cab = P(o.x + o.dx * alto * k, o.y + o.dy * alto * k, alto * (1 - k) + BOLO * k);
    ctx.strokeStyle = o.miche ? "#e9b44c" : o.i === 4 ? "#b3121e" : "#f1e3c0"; ctx.lineWidth = Math.max(3, BOLO * 2 * hw * pie.f); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pie.x, pie.y); ctx.lineTo(cab.x, cab.y); ctx.stroke();
  }
}

m.arrancar();
