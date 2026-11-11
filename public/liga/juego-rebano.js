// Trashumancia: lo que se ve y se toca. Por dónde va cada oveja y cuándo entra al corral lo decide motor-rebano.js, el
// mismo archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-rebano.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, tiempoHecho, rebanoDe,
  DURACION_MS, SEPARACION_MIN_MS, PERRO, PARED, PORTILLA, CORRAL, OVEJA, LADO,
} from "./motor-rebano.js";
import { crearMarco, $, conRaton } from "./marco.js";

const CADA_MS = 33; // como mucho un movimiento cada 33 ms (30 por segundo): la partida entera cabe en ~30 KB
export const D = 7; // a cuánto está la cámara del borde de cerca del prado (lo usa también la escena 3D)
export const PRADO_HASTA = 3.62; // donde se acaba el prado, detrás del corral

// ── El prado en la pantalla: se ve desde arriba y desde atrás, lo de lejos más pequeño. La misma cuenta sirve para
// el dibujo plano, para el 3D (que coincide al píxel) y para saber qué punto del prado toca el dedo. ──
function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 / 1.07, m.H * 0.3);
  const yCerca = m.arriba + m.H * 0.93, yPared = m.arriba + m.H * 0.44;
  const r = D / (D + PARED);
  const ojo = (yPared - r * yCerca) / (1 - r); // la línea del horizonte (queda por encima de la pantalla)
  m.campo = { cx: m.ancho / 2, hw, yCerca, ojo, yc: (yCerca - ojo) / hw };
}
// del prado (x, y, alto) a la pantalla
export function aPantalla(x, y, alto = 0) {
  const { cx, hw, yCerca, ojo } = m.campo, f = D / (D + y);
  return { x: cx + hw * x * f, y: ojo + (yCerca - ojo) * f - hw * alto * f, f };
}
// de la pantalla al prado
function aPrado(px, py) {
  const { cx, hw, yCerca, ojo } = m.campo;
  const f = Math.max(0.2, (py - ojo) / (yCerca - ojo));
  return { x: (px - cx) / (hw * f), y: D / f - D };
}

let partida = null, demo = null;
let ultimoEnvio = -1e9, mandado = null, pendiente = null;
let dedo = null; // dónde quiere el jugador al perro (para pintar la marca)
let ladridoEn = -1e9, cencerroEn = 0;
const recientes = []; // lo último que ha pasado, para que la escena lo anime: { tipo, t, id, x }

const TEXTO = conRaton
  ? { pista: "Lleva al mastín con el ratón. Ponte detrás de las ovejas y arrímalas al corral.", regla: "Mueve el ratón y el mastín va detrás." }
  : { pista: "Lleva al mastín con el dedo. Ponte detrás de las ovejas y arrímalas al corral.", regla: "Arrastra el dedo y el mastín va hacia él." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "rebano",
  nombre: "Trashumancia",
  duracionMs: DURACION_MS,
  fondo: "fondos/riano",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ movimientos: p.movimientos.slice() }),
  final: (r) => ({
    datos: [["Ovejas", r.ovejas], ["Rebaños", r.rebanos], ["Sustos", r.sustos]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.ovejas} ovejas en el corral y ${r.rebanos} rebaños enteros.`,
    compartir: `He encerrado ${r.ovejas} ovejas con el mastín en la montaña de Riaño: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-rebano.js"),
  medir: medirCampo,
  empezar(p) {
    partida = p; ultimoEnvio = -1e9; mandado = null; pendiente = null; dedo = null; recientes.length = 0;
    ladridoEn = -1e9; cencerroEn = 0;
  },
  actualizar(tj) {
    if (pendiente && tj - ultimoEnvio >= CADA_MS) enviar(tj);
    for (const e of avanzar(partida, tj)) efecto(e, tj);
    // el cencerro de la que guía, cuando el rebaño anda
    if (tj >= cencerroEn) {
      const anda = partida.ovejas.some((o) => o.estado === "libre" && o.vx * o.vx + o.vy * o.vy > 0.04);
      cencerroEn = tj + (anda ? 260 + ((tj * 7) % 190) : 1400);
      if (anda) m.sonar("cencerro", 0.6);
    }
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { arrastrando = null; dedo = null; },
  chip: () => {
    if (!partida) return null;
    const total = partida.ovejas.length, dentro = total - partida.quedan;
    return `<span>Rebaño ${partida.ronda + 1} · ${dentro}/${total} dentro</span>`;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // balido: un tono áspero que tiembla
    bee: (s, t, f, { audio }) => {
      const o = audio.createOscillator(), g = audio.createGain(), tiembla = audio.createOscillator(), tg = audio.createGain(), filtro = audio.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(430 * f, t); o.frequency.linearRampToValueAtTime(360 * f, t + 0.42);
      tiembla.frequency.value = 9; tg.gain.value = 26; tiembla.connect(tg); tg.connect(o.frequency);
      filtro.type = "bandpass"; filtro.frequency.value = 1100; filtro.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(filtro); filtro.connect(g); g.connect(s);
      o.start(t); tiembla.start(t); o.stop(t + 0.5); tiembla.stop(t + 0.5);
    },
    // ladrido del mastín: grave y seco, dos veces
    guau: (s, t, f, { tono, ruido }) => {
      for (const r of [0, 0.19]) { tono({ fr: 190, a: 95, g: 0.2, dur: 0.11, tipo: "sawtooth", retraso: r }); }
      ruido({ dur: 0.1, fr: 500, q: 0.7, g: 0.2 });
    },
    cencerro: (s, t, f, { tono }) => { tono({ fr: 1180, g: 0.035 * f, dur: 0.16, tipo: "square" }); tono({ fr: 1770, g: 0.02 * f, dur: 0.1, tipo: "triangle" }); },
    // el silbido del pastor
    silbo: (s, t, f, { audio }) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2500, t + 0.16); o.frequency.linearRampToValueAtTime(1900, t + 0.34);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.03); g.gain.setValueAtTime(0.07, t + 0.28); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(s); o.start(t); o.stop(t + 0.4);
    },
  },
});

// ── Dedo (o ratón): el mastín va hacia el dedo. En el móvil, un poco por encima, para que el dedo no lo tape. ──
let arrastrando = null;
function querer(e) {
  if (m.estado !== "juego" || !partida) return;
  const sube = e.pointerType === "mouse" ? 0 : Math.min(46, m.campo.hw * 0.24);
  const p = aPrado(e.clientX, e.clientY - sube);
  pendiente = { x: Math.max(-PERRO.xMax, Math.min(PERRO.xMax, p.x)), y: Math.max(0, Math.min(PERRO.yMax, p.y)) };
  dedo = pendiente;
  const tj = m.tj();
  if (tj - ultimoEnvio >= CADA_MS) enviar(tj);
}
function enviar(tj) {
  const x = Math.round(pendiente.x * 10000), y = Math.round(pendiente.y * 10000);
  pendiente = null;
  if (mandado && x === mandado.x && y === mandado.y) return;
  const t = Math.max(Math.round(tj), tiempoHecho(partida), partida.movimientos.length ? partida.ultimoT + SEPARACION_MIN_MS : 0);
  if (t > DURACION_MS) return;
  try { mover(partida, t, x, y); mandado = { x, y }; ultimoEnvio = tj; } catch { /* demasiados: se ignora */ }
}
const lienzo = $("lienzo");
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego") return;
  arrastrando = e.pointerId;
  lienzo.setPointerCapture(e.pointerId);
  querer(e);
  m.pista(null);
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (e.pointerId === arrastrando || e.pointerType === "mouse") { querer(e); if (e.pointerType === "mouse" && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) m.pista(null); }
});
const soltar = (e) => { if (e.pointerId === arrastrando) arrastrando = null; };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function marcador() {
  const total = partida.ovejas.length, dentro = total - partida.quedan;
  m.pintarPuntos(partida.puntos, true, dentro ? { texto: `${dentro}/${total}`, sub: "DENTRO" } : null);
}
function efecto(e, tj) {
  recientes.push(e);
  if (recientes.length > 24) recientes.shift();
  if (e.tipo === "dentro") {
    const p = aPantalla(e.x, PARED - 0.1, 0.25);
    m.sonar(e.negra ? "oro" : "bien", 1 + Math.min(0.5, e.fila * 0.12));
    m.sonar("bee", e.negra ? 0.8 : 1 + (e.id % 3) * 0.08);
    m.aviso(e.fila > 0 ? `¡En fila! +${e.ganados}` : `+${e.ganados}`, e.negra || e.fila > 0 ? "oro" : "bien", p.x, p.y);
    m.vibrar(8);
    m.anunciar(e.negra ? "La oveja negra, dentro." : "Una oveja dentro.");
    marcador();
  } else if (e.tipo === "rebano") {
    m.sonar("oro"); m.vibrar([20, 40, 20]);
    m.avisoNivel(e.rapido ? `¡Rebaño entero! +${e.ganados} (en ${e.segundos}″)` : `¡Rebaño entero! +${e.ganados}`);
    marcador();
  } else if (e.tipo === "llega") {
    m.sonar("silbo");
    const r = rebanoDe(e.ronda);
    if (r.negras && e.ronda === 1) setTimeout(() => m.avisoNivel("Ojo a la oveja negra: va a su aire y vale doble"), 500);
    m.pintarPuntos(partida.puntos, false, null);
  } else if (e.tipo === "susto") {
    if (tj - ladridoEn > 900) {
      ladridoEn = tj;
      const o = partida.ovejas.find((x) => x.id === e.id), p = aPantalla(o.x, o.y, 0.3);
      m.sonar("guau"); m.sonar("bee", 1.25); m.vibrar(30);
      m.aviso("¡Se espantan!", "mal", p.x, p.y);
      m.anunciar("Las has espantado. Acércate más despacio.");
    }
  }
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  let p = partida, t = tj;
  if (!p || m.estado === "inicio") {
    // en el menú: un rebaño pastando a su aire y el mastín echado
    t = ahora % 40000;
    if (!demo || t < demo.t) demo = { p: crearPartida(1188), t: 0 };
    avanzar(demo.p, t); demo.t = t;
    p = demo.p;
  }
  return {
    tj: t, jugando: m.estado === "juego", demo: p !== partida,
    perro: p.perro, ovejas: p.ovejas, guardadas: p.guardadas, ronda: p.ronda,
    dedo: m.estado === "juego" ? dedo : null,
    recientes,
  };
}

// ── La marca de adónde va el perro (encima de todo, en plano) ──
function dibujarEncima(ctx, tj) {
  if (m.estado !== "juego" || !dedo || !partida) return false;
  const dx = dedo.x - partida.perro.x, dy = dedo.y - partida.perro.y;
  if (dx * dx + dy * dy < 0.004) return false;
  const p = aPantalla(dedo.x, dedo.y), r = 13 * p.f * (m.campo.hw / 180);
  ctx.save();
  ctx.strokeStyle = "rgba(243,234,216,.75)"; ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); ctx.lineDashOffset = -tj / 40;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  return true;
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), hw = m.campo.hw;
  const P = (x, y, h) => aPantalla(x, y, h);
  // el prado
  const a = P(-1.5, 0), b = P(1.5, 0), c = P(1.5, PRADO_HASTA), d = P(-1.5, PRADO_HASTA);
  const g = ctx.createLinearGradient(0, c.y, 0, a.y);
  g.addColorStop(0, "#5f8a3c"); g.addColorStop(1, "#7fa64a");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(a.x, m.alto); ctx.lineTo(b.x, m.alto); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(a.x, a.y); ctx.closePath(); ctx.fill();
  // el corral: suelo de tierra y paredes de piedra
  const muro = (x0, y0, x1, y1) => {
    const p0 = P(x0, y0), p1 = P(x1, y1), q1 = P(x1, y1, 0.16), q0 = P(x0, y0, 0.16);
    ctx.fillStyle = "#8f8a80"; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q0.x, q0.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5e5a52"; ctx.lineWidth = 1.5; ctx.stroke();
  };
  const t0 = P(-CORRAL.medio, PARED), t1 = P(CORRAL.medio, PARED), t2 = P(CORRAL.medio, CORRAL.fondo), t3 = P(-CORRAL.medio, CORRAL.fondo);
  ctx.fillStyle = "#8a7353"; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.closePath(); ctx.fill();
  muro(-CORRAL.medio, CORRAL.fondo, CORRAL.medio, CORRAL.fondo);
  muro(-CORRAL.medio, PARED, -CORRAL.medio, CORRAL.fondo); muro(CORRAL.medio, PARED, CORRAL.medio, CORRAL.fondo);
  // ovejas y perro, de lejos a cerca
  const cosas = v.ovejas.map((o) => ({ y: o.y, o }));
  cosas.push({ y: v.perro.y, perro: v.perro });
  cosas.push({ y: PARED, pared: true });
  cosas.sort((p, q) => q.y - p.y);
  for (const k of cosas) {
    if (k.pared) { muro(-CORRAL.medio, PARED, -PORTILLA, PARED); muro(PORTILLA, PARED, CORRAL.medio, PARED); continue; }
    if (k.perro) {
      const p = P(k.perro.x, k.perro.y), s = hw * p.f;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.09 * s, 0.045 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c79a5b"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.07 * s, 0.085 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7a5a34"; ctx.beginPath(); ctx.arc(p.x + Math.sign(k.perro.vx || 1) * 0.07 * s, p.y - 0.12 * s, 0.04 * s, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const o = k.o, p = P(o.x, o.y), s = hw * p.f;
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, OVEJA * 1.2 * s, OVEJA * 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.negra ? "#3a2f2a" : "#f1ead9"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.06 * s, OVEJA * 1.25 * s, OVEJA * 0.95 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.negra ? "#1c1614" : "#4a3d33"; ctx.beginPath(); ctx.arc(p.x + (o.vx >= 0 ? 1 : -1) * OVEJA * 1.1 * s, p.y - 0.085 * s, OVEJA * 0.42 * s, 0, Math.PI * 2); ctx.fill();
  }
  void LADO;
}

m.arrancar();
