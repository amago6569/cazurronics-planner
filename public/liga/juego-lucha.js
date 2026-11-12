// Lucha leonesa: lo que se ve y se toca. Qué maña entra, cuánto tiempo hay y quién cae lo decide motor-lucha.js, el
// mismo archivo con el que el servidor repite la partida. Aquí se lee el gesto del dedo, suena y se dibuja (3D en
// escena-lucha.js; en plano, aquí mismo, para los móviles sin 3D).
import { crearPartida, deslizar, avanzar, resumen, tiempoHecho, DURACION_MS, SEPARACION_MIN_MS, PARA_CAIDA, PAUSA } from "./motor-lucha.js";
import { crearMarco, $, conRaton } from "./marco.js";

const UMBRAL_PX = 26; // lo que hay que mover el dedo para que cuente como gesto
const FLECHA = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // izquierda, derecha, arriba, abajo (en la pantalla)
const NOMBRE = ["a la izquierda", "a la derecha", "arriba", "abajo"];

let partida = null;
let ultimo = null; // lo último que ha pasado: { tipo, t, d }
let gesto = null; // { t, d } el último gesto del jugador (para pintarlo)

const TEXTO = conRaton
  ? { pista: "Cuando salga la flecha dorada, arrastra el ratón hacia donde marca.", regla: "Cuando te entre una maña, arrastra el ratón hacia donde marca la flecha." }
  : { pista: "Cuando salga la flecha dorada, desliza el dedo hacia donde marca.", regla: "Cuando te entre una maña, desliza el dedo hacia donde marca la flecha." };
$("regla-gesto").textContent = TEXTO.regla;

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 8, m.H * 0.25);
  m.campo = { cx: m.ancho / 2, hw, yBase: m.arriba + m.H * 0.8 };
}
const aPantalla = (x, y) => ({ x: m.campo.cx + x * m.campo.hw, y: m.campo.yBase - y * m.campo.hw });

const m = crearMarco({
  id: "lucha",
  nombre: "Lucha leonesa",
  duracionMs: DURACION_MS,
  fondo: "fondos/montes",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ gestos: p.gestos.slice() }),
  final: (r) => ({
    datos: [["Caídas", r.caidas], ["Contras", r.contras], ["Al suelo", r.suelos]],
    anuncio: `Se acabó. ${r.puntos} puntos: has tumbado al rival ${r.caidas} veces y has ido al suelo ${r.suelos}.`,
    compartir: `He tumbado ${r.caidas} veces al rival en el corro de aluches: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-lucha.js"),
  medir: medirCampo,
  empezar(p) { partida = p; ultimo = null; gesto = null; toque = null; },
  actualizar(tj) {
    for (const e of avanzar(partida, tj)) efecto(e);
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { toque = null; },
  chip: () => (partida ? `<span>${"●".repeat(partida.seguidas)}${"○".repeat(PARA_CAIDA - partida.seguidas)} para tumbarlo</span>` : null),
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // el agarrón al cinto: cuero
    agarre: (s, t, f, { ruido }) => ruido({ dur: 0.09, fr: 1100, q: 1.2, g: 0.22 }),
    aviso: (s, t, f, { tono }) => tono({ fr: 660 * f, a: 880 * f, g: 0.07, dur: 0.09, tipo: "triangle" }),
    amago: (s, t, f, { tono }) => tono({ fr: 330, a: 300, g: 0.05, dur: 0.1, tipo: "triangle" }),
    costalada: (s, t, f, { tono, ruido }) => { tono({ fr: 120, a: 48, g: 0.4, dur: 0.25 }); ruido({ dur: 0.2, fr: 420, g: 0.25, tipo: "lowpass" }); },
    corro: (s, t, f, { ruido, tono }) => { ruido({ dur: 0.9, fr: 1500, q: 0.4, g: 0.12 * f }); [523, 659, 784].forEach((fr, i) => tono({ fr, g: 0.05, dur: 0.18, retraso: i * 0.08, tipo: "triangle" })); },
  },
});

// ── El gesto: en cuanto el dedo se mueve lo bastante hacia un lado, cuenta (no hace falta soltar) ──
let toque = null;
const lienzo = $("lienzo");
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego") return;
  toque = { id: e.pointerId, x: e.clientX, y: e.clientY, hecho: false };
  lienzo.setPointerCapture(e.pointerId);
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (!toque || e.pointerId !== toque.id || toque.hecho || m.estado !== "juego") return;
  const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
  if (Math.abs(dx) < UMBRAL_PX && Math.abs(dy) < UMBRAL_PX) return;
  toque.hecho = true;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : dy < 0 ? 2 : 3;
  const t = Math.max(Math.round(m.tj()), tiempoHecho(partida), partida.gestos.length ? partida.ultimoT + SEPARACION_MIN_MS : 0);
  if (t > DURACION_MS) return;
  try { deslizar(partida, t, d); gesto = { t, d }; m.pista(null); } catch { /* demasiados: se ignora */ }
});
const soltar = (e) => { if (toque && e.pointerId === toque.id) toque = null; };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function efecto(e) {
  if (e.tipo !== "guardia") ultimo = e;
  const p = aPantalla(0, 1.15);
  if (e.tipo === "mana") { m.sonar("aviso", e.trasAmago ? 1.15 : 1); m.anunciar(`Maña: ${NOMBRE[e.d]}.`); }
  else if (e.tipo === "amago") m.sonar("amago");
  else if (e.tipo === "contra") {
    m.sonar("agarre"); m.sonar("bien", 1 + 0.12 * e.seguidas); m.vibrar(20);
    m.aviso(`${e.rapida ? "¡Rápida! " : "¡Contra! "}+${e.ganados}`, "bien", p.x, p.y);
    m.pintarPuntos(partida.puntos, true, null);
  } else if (e.tipo === "caida") {
    m.sonar("costalada"); m.sonar("corro", 1); m.sonar("oro"); m.vibrar(90);
    m.avisoNivel(`¡Caída entera! +${e.ganados}`);
    m.pintarPuntos(partida.puntos, true, { texto: `${e.caidas}`, sub: e.caidas === 1 ? "CAÍDA" : "CAÍDAS" });
  } else if (e.tipo === "suelo") {
    m.sonar("costalada"); m.sonar("mal"); m.vibrar(60);
    m.aviso(e.motivo === "tarde" ? "¡Tarde!" : e.motivo === "amago" ? "¡Era amago!" : "¡Al revés!", "mal", p.x, p.y);
    m.anunciar("Al suelo.");
    m.pintarPuntos(partida.puntos, false, null);
  } else if (e.tipo === "falso") { m.sonar("amago"); m.aviso("En falso", "mal", p.x, p.y); }
  else if (e.tipo === "guardia") m.sonar("agarre");
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") return { estado: "guardia", mana: null, ultimo: null, hace: 1e9, tj: ahora, menu: true, seguidas: 0 };
  const mn = partida.mana;
  let mana = null;
  if (partida.estado === "mana" || (partida.estado === "guardia" && tj >= mn.empieza)) {
    const amago = mn.falso >= 0 && tj < mn.real;
    mana = { d: amago ? mn.falso : mn.d, amago, queda: amago ? 1 : Math.max(0, (mn.acaba - tj) / mn.ventana), desde: tj - (amago ? mn.empieza : mn.real) };
  }
  return {
    estado: partida.estado, mana, ultimo, hace: ultimo ? tj - ultimo.t : 1e9, tj, menu: false, seguidas: partida.seguidas,
    gesto: gesto && tj - gesto.t < 260 ? { d: gesto.d, hace: tj - gesto.t } : null,
    pausa: partida.estado === "suelo" ? PAUSA.alSuelo : PAUSA.caida,
  };
}

// ── La flecha de la maña (encima de todo, en plano): gris si es amago, dorada con su cuenta atrás si va de verdad ──
function flecha(ctx, x, y, d, r, color, grosor) {
  const [fx, fy] = FLECHA[d];
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(fy, fx));
  ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0); ctx.moveTo(r * 0.1, -r * 0.42); ctx.lineTo(r * 0.55, 0); ctx.lineTo(r * 0.1, r * 0.42); ctx.stroke();
  ctx.restore();
}
function dibujarEncima(ctx, tj, ahora) {
  if (m.estado !== "juego" || !partida) return false;
  const v = vista(tj, ahora);
  if (!v.mana) return true;
  const c = aPantalla(0, 2.05), r = Math.min(62, m.campo.hw * 0.3);
  const entra = Math.min(1, v.mana.desde / 90), s = 0.7 + 0.3 * entra;
  ctx.save();
  ctx.globalAlpha = entra;
  ctx.fillStyle = "rgba(10,8,12,.62)"; ctx.beginPath(); ctx.arc(c.x, c.y, r * s, 0, Math.PI * 2); ctx.fill();
  if (v.mana.amago) {
    ctx.setLineDash([6, 8]); ctx.strokeStyle = "rgba(200,200,205,.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    flecha(ctx, c.x, c.y, v.mana.d, r * s, "rgba(200,200,205,.75)", 7);
  } else {
    // el aro se va gastando: es el tiempo que queda
    ctx.strokeStyle = v.mana.queda < 0.3 ? "#e2452f" : "#e9b44c"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(c.x, c.y, r * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.mana.queda); ctx.stroke();
    flecha(ctx, c.x, c.y, v.mana.d, r * s, "#f6d27a", 10);
  }
  ctx.restore();
  return true;
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { hw, yBase } = m.campo;
  ctx.fillStyle = "rgba(70,110,50,.8)"; ctx.fillRect(0, yBase - 0.05 * hw, m.ancho, m.alto - yBase + 0.05 * hw);
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(m.campo.cx, yBase + 0.1 * hw, 1.5 * hw, 0.22 * hw, 0, 0, Math.PI * 2); ctx.stroke();
  // dos monigotes: el tuyo (rojo) a la izquierda. Se inclinan con la maña y uno acaba en el suelo
  const caido = v.estado === "caida" ? 1 : v.estado === "suelo" ? -1 : 0;
  const k = caido ? Math.min(1, v.hace / 350) : 0;
  const lado = v.mana ? (v.mana.d === 0 ? -1 : v.mana.d === 1 ? 1 : 0) * (v.mana.amago ? 0.5 : 1) : 0;
  const sube = v.mana ? (v.mana.d === 2 ? 0.12 : v.mana.d === 3 ? -0.1 : 0) : 0;
  const monigote = (x, color, tumba, dir) => {
    ctx.save();
    ctx.translate(m.campo.cx + (x + lado * 0.12) * hw, yBase - sube * hw * (dir > 0 ? 1 : 0.3));
    ctx.rotate(tumba * dir * -1.45 + lado * 0.12 + dir * 0.2);
    ctx.fillStyle = "#d9a87e"; ctx.fillRect(-0.09 * hw, -1.05 * hw, 0.18 * hw, 0.55 * hw);
    ctx.fillStyle = color; ctx.fillRect(-0.1 * hw, -0.55 * hw, 0.2 * hw, 0.22 * hw);
    ctx.fillStyle = "#d9a87e"; ctx.fillRect(-0.08 * hw, -0.33 * hw, 0.07 * hw, 0.33 * hw); ctx.fillRect(0.01 * hw, -0.33 * hw, 0.07 * hw, 0.33 * hw);
    ctx.beginPath(); ctx.arc(0, -1.18 * hw, 0.11 * hw, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  monigote(-0.27, "#b3121e", caido < 0 ? k : 0, 1);
  monigote(0.27, "#1f6b3a", caido > 0 ? k : 0, -1);
  ctx.strokeStyle = "#d9a87e"; ctx.lineWidth = 0.07 * hw; ctx.lineCap = "round";
  if (!caido) { ctx.beginPath(); ctx.moveTo(m.campo.cx - 0.2 * hw, yBase - 0.92 * hw); ctx.lineTo(m.campo.cx + 0.2 * hw, yBase - 0.6 * hw); ctx.moveTo(m.campo.cx + 0.2 * hw, yBase - 0.92 * hw); ctx.lineTo(m.campo.cx - 0.2 * hw, yBase - 0.6 * hw); ctx.stroke(); }
}

m.arrancar();
