// La Justa del Paso Honroso: lo que se ve y se toca. Dónde da la lanza y cuánto vale lo decide motor-justa.js, el
// mismo archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-justa.js; en plano, aquí mismo, para los móviles sin 3D).
//
// Se ve desde tu caballo: tu lanza sale por abajo a la derecha y cruza la tela; el rival viene de frente por el otro
// lado. Lo que cuenta es la ALTURA: subes o bajas la punta con el dedo y el escudo del rival sube y baja. El choque es
// siempre en el mismo sitio (el plano de delante, z = 0), que se ve en la pantalla tal cual: lo que ves alineado en
// ese momento es lo que puntúa. Un anillo marca a qué altura va el escudo para que se pueda apuntar desde lejos.
import {
  crearPartida, mover, avanzar, resumen, escudoEn, avanceEn, tiempoHecho,
  DURACION_MS, SEPARACION_MIN_MS, ESCUDO, VUELTA_MS,
} from "./motor-justa.js";
import { crearMarco, $, conRaton } from "./marco.js";

const CADA_MS = 33;
// Medidas del palenque (metros). La cámara va a la altura de tus ojos, sobre tu caballo, mirando al frente (−z).
export const D = 3.6; // de la cámara al plano del choque
export const OJO = 2.5; // altura de la cámara
export const TELA_X = -0.3; // la tela (la valla del medio)
export const PUNTA_X = -0.5; // por dónde cruza tu punta (y el centro del escudo del rival)
export const RIVAL_X = PUNTA_X - 0.5; // el caballo del rival
export const ALTO0 = 0.95, RANGO = 1.45; // altura de la punta y del escudo: ALTO0 + RANGO · (lo que dice el motor)
export const alto = (v) => ALTO0 + RANGO * v;
export const RADIO = ESCUDO.borde * RANGO; // el escudo: todo lo que cuenta como golpe
export const RECORRIDO = 24; // desde dónde sale el rival
export const PARON_MS = 130; // en el choque todo se para un instante (solo se ve)
export const PALETAS = [
  { tela: 0x1f4f8f, ribete: 0xe9c46a, escudo: "#1f4f8f", banda: "#f1e3c0" },
  { tela: 0x1f6b3a, ribete: 0xf1e3c0, escudo: "#1f6b3a", banda: "#e9c46a" },
  { tela: 0x1c1a1a, ribete: 0xd9a940, escudo: "#1c1a1a", banda: "#d9a940" },
  { tela: 0xd8d2c4, ribete: 0x9c1c24, escudo: "#efe9dc", banda: "#9c1c24" },
  { tela: 0xc9871f, ribete: 0x1c1a1a, escudo: "#d99a2b", banda: "#1c1a1a" },
  { tela: 0x5b2a86, ribete: 0xe9c46a, escudo: "#5b2a86", banda: "#e9c46a" },
];

// Proyección: un punto (x, alto, z) a la pantalla. En z = 0 es lineal: (cx + k·x, yPlano − k·alto).
export const plano = { cx: 0, yPlano: 0, k: 100, D, yc: OJO };
export function aPantalla(x, h, z = 0) {
  const f = D / (D - z);
  const yOjo = plano.yPlano - plano.k * OJO;
  return { x: plano.cx + plano.k * x * f, y: yOjo + plano.k * (OJO - h) * f, f };
}

let partida = null;
let ultimoEnvio = -1e9, yMandada = null, yPendiente = null;
let choque = null; // el último: { t, zona, escudo, rival, punta }
let distancia = 0, antes = 0, velocidad = 0;

const TEXTO = conRaton
  ? { pista: "Mueve el ratón arriba y abajo: pon la punta de la lanza en el anillo del escudo.", regla: "Mueve el ratón arriba y abajo y la punta de la lanza le sigue." }
  : { pista: "Arrastra el dedo arriba y abajo: pon la punta de la lanza en el anillo del escudo.", regla: "Arrastra el dedo arriba y abajo y la punta de la lanza le sigue." };
$("regla-gesto").textContent = TEXTO.regla;

const NOMBRE = { centro: "¡Lanza rota!", medio: "¡Buen golpe!", borde: "De refilón", fallo: "Al aire" };

const m = crearMarco({
  id: "justa",
  nombre: "La Justa del Paso Honroso",
  duracionMs: DURACION_MS,
  fondo: "fondos/vega",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ movimientos: p.movimientos.slice() }),
  final: (r) => ({
    datos: [["Lanzas rotas", r.centros], ["Golpes", `${r.golpes}/${r.carreras}`], ["Seguidos", r.mejorRacha]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.golpes} golpes en ${r.carreras} carreras, ${r.centros} en el centro.`,
    compartir: `He roto ${r.centros} ${r.centros === 1 ? "lanza" : "lanzas"} en el Paso Honroso: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-justa.js"),
  medir(mm) {
    // la punta cruza un poco a la izquierda del centro; el suelo del choque, abajo
    plano.k = Math.min(mm.H * 0.275, mm.ancho * 0.6);
    plano.cx = mm.ancho * (mm.ancho > mm.H ? 0.47 : 0.41) - plano.k * PUNTA_X;
    plano.yPlano = mm.arriba + mm.H * 0.93;
  },
  empezar(p) { partida = p; ultimoEnvio = -1e9; yMandada = null; yPendiente = null; choque = null; ancla = null; },
  actualizar(tj) {
    if (yPendiente !== null && tj - ultimoEnvio >= CADA_MS) enviar(tj);
    for (const e of avanzar(partida, tj)) efecto(e);
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { arrastrando = null; },
  chip: () => (partida && partida.carrera ? `<span>Carrera ${Math.min(partida.carreras + (partida.estado === "carrera" ? 1 : 0), 99)}</span>` : null),
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // cascos: dos golpes sordos
    cascos: (s, t, f, { tono }) => { for (const r of [0, 0.09]) tono({ fr: 95, a: 55, g: 0.12 * f, dur: 0.07, retraso: r }); },
    // lanza que se astilla contra el escudo
    astilla: (s, t, f, { tono, ruido }) => { ruido({ dur: 0.22, fr: 2600, q: 0.5, g: 0.5 }); ruido({ dur: 0.1, fr: 700, g: 0.4 }); tono({ fr: 240, a: 80, g: 0.3, dur: 0.16, tipo: "triangle" }); },
    chapa: (s, t, f, { tono, ruido }) => { tono({ fr: 620 * f, a: 400, g: 0.14, dur: 0.16, tipo: "square" }); ruido({ dur: 0.07, fr: 3000, g: 0.2 }); },
    aire: (s, t, f, { ruido }) => ruido({ dur: 0.3, fr: 900, q: 0.4, g: 0.16 }),
    clarin: (s, t, f, { tono }) => { [392, 523, 659].forEach((fr, i) => tono({ fr, g: 0.05, dur: 0.16, retraso: i * 0.11, tipo: "sawtooth" })); },
  },
});

// ── Dedo (o ratón): la punta sube y baja lo mismo que el dedo, desde donde estaba ──
let arrastrando = null, ancla = null;
function querer(clientY) {
  if (m.estado !== "juego" || !partida) return;
  const porV = 1 / (plano.k * RANGO); // píxeles → lo que entiende el motor
  if (!ancla) ancla = { py: clientY, y: yMandada === null ? partida.objetivo : yMandada / 10000 };
  let y = ancla.y + (ancla.py - clientY) * porV;
  if (y > 1 || y < 0) { y = Math.max(0, Math.min(1, y)); ancla = { py: clientY, y }; }
  yPendiente = y;
  const tj = m.tj();
  if (tj - ultimoEnvio >= CADA_MS) enviar(tj);
}
function enviar(tj) {
  const y = Math.round(yPendiente * 10000);
  yPendiente = null;
  if (y === yMandada) return;
  const t = Math.max(Math.round(tj), tiempoHecho(partida), partida.movimientos.length ? partida.ultimoT + SEPARACION_MIN_MS : 0);
  if (t > DURACION_MS) return;
  try { mover(partida, t, y); yMandada = y; ultimoEnvio = tj; } catch { /* demasiados: se ignora */ }
}
const lienzo = $("lienzo");
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego") return;
  arrastrando = e.pointerId;
  lienzo.setPointerCapture(e.pointerId);
  ancla = null;
  querer(e.clientY);
  m.pista(null);
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (e.pointerId === arrastrando || e.pointerType === "mouse") { querer(e.clientY); if (e.pointerType === "mouse" && Math.abs(e.movementY) > 2) m.pista(null); }
});
const soltar = (e) => { if (e.pointerId === arrastrando) { arrastrando = null; ancla = null; } };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function efecto(e) {
  if (e.tipo === "sale") { if (e.n > 0) m.sonar("clarin"); return; }
  if (e.tipo !== "choque") return;
  choque = { t: e.t, zona: e.zona, escudo: e.escudo, punta: e.punta, rival: partida.chocado.rival };
  const p = aPantalla(PUNTA_X, alto(e.escudo) + RADIO, 0);
  if (e.zona === "fallo") {
    m.sonar("aire");
    m.aviso(NOMBRE.fallo, "mal", p.x, p.y - 34);
    m.anunciar("Al aire.");
    m.pintarPuntos(partida.puntos, false, null);
  } else {
    m.sonar(e.zona === "centro" ? "astilla" : "chapa", e.zona === "medio" ? 1 : 0.8);
    if (e.zona === "centro") { m.sonar("oro"); m.vibrar(70); } else m.vibrar(25);
    m.aviso(`${NOMBRE[e.zona]} +${e.ganados}`, e.zona === "centro" ? "oro" : "bien", p.x, p.y - 34);
    m.anunciar(`${NOMBRE[e.zona]} ${e.ganados} puntos.`);
    m.pintarPuntos(partida.puntos, true, e.racha >= 2 ? { texto: `×${e.racha}`, sub: "SEGUIDOS" } : null);
  }
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
let cascos = 0;
export function vista(tj, ahora) {
  const dt = Math.min(0.1, Math.max(0, (ahora - (antes || ahora)) / 1000)); antes = ahora;
  if (!partida || m.estado === "inicio") {
    // en el menú: al paso, con la lanza en alto, y un rival que viene de lejos sin llegar
    velocidad += (1.1 - velocidad) * Math.min(1, dt * 2); distancia += velocidad * dt;
    const s = ahora / 1000, u = (s % 7) / 7;
    return { punta: 0.62 + 0.06 * Math.sin(s * 0.7), escudo: 0.5 + 0.18 * Math.sin(s * 1.1), yRival: 6 + (1 - u) * 22, rival: Math.floor(s / 7) % PALETAS.length, distancia, brio: 0.45, choque: null, hayRival: u < 0.97, tj: s * 1000, menu: true, lanzaRota: false, guia: 0 };
  }
  const c = partida.carrera, enCarrera = partida.estado === "carrera";
  // lo rápido que vamos: al galope en la carrera, al trote dando la vuelta
  const quiere = enCarrera ? 0.35 * RECORRIDO / (c.dura / 1000) : 1.6;
  velocidad += (quiere - velocidad) * Math.min(1, dt * 3.5); distancia += velocidad * dt;
  if (m.estado === "juego" && enCarrera) { cascos -= dt * velocidad; if (cascos <= 0) { cascos = 1.9; m.sonar("cascos", 0.5 + velocidad * 0.08); } }
  let yRival = 1e9, escudo = 0.5, rival = 0, hayRival = false, guia = 0;
  const hace = choque ? tj - choque.t : 1e9;
  if (enCarrera) {
    hayRival = true; rival = c.rival; escudo = escudoEn(partida, Math.max(0, tj));
    const a = avanceEn(partida, tj);
    yRival = (1 - a) * RECORRIDO;
    guia = Math.max(0, Math.min(1, (a - 0.12) / 0.3));
  } else if (choque && hace < VUELTA_MS + 400) {
    // después del choque (y de un paroncito) sigue de largo y pasa a tu izquierda
    hayRival = true; rival = choque.rival; escudo = choque.escudo;
    yRival = -Math.max(0, hace - PARON_MS) / 1000 * (RECORRIDO / 3.4);
  }
  const reciente = choque && hace < VUELTA_MS ? { ...choque, hace } : null;
  return {
    punta: partida.punta, escudo, yRival, rival, distancia, brio: Math.min(1, velocidad / 2.2), hayRival, tj,
    choque: reciente, lanzaRota: Boolean(reciente && reciente.zona === "centro"), menu: false, guia,
  };
}

// ── Encima de todo, en plano: el anillo que dice a qué altura va el escudo, y tu punta ──
function anillo(ctx, x, y, r, alfa, centro) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,248,232,.95)";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(255,248,232,.75)";
  ctx.beginPath(); ctx.arc(x, y, r * (ESCUDO.medio / ESCUDO.borde), 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = centro; ctx.beginPath(); ctx.arc(x, y, r * (ESCUDO.centro / ESCUDO.borde), 0, Math.PI * 2); ctx.fill();
  // marcas a los lados, para leer la altura de un vistazo
  ctx.strokeStyle = "rgba(255,248,232,.95)";
  ctx.beginPath(); ctx.moveTo(x - r - 14, y); ctx.lineTo(x - r - 4, y); ctx.moveTo(x + r + 4, y); ctx.lineTo(x + r + 14, y); ctx.stroke();
  ctx.restore();
}
function dibujarEncima(ctx, tj, ahora) {
  if (m.estado !== "juego" || !partida) return false;
  const v = vista(tj, ahora);
  const r = RADIO * plano.k;
  let pinta = false;
  if (v.guia > 0 && !v.choque) {
    const q = aPantalla(PUNTA_X, alto(v.escudo), 0);
    anillo(ctx, q.x, q.y, r, 0.25 + 0.6 * v.guia, "rgba(233,180,76,.9)");
    pinta = true;
  }
  if (v.choque && v.choque.hace < 900) {
    // dónde ha dado: el anillo se queda quieto en el escudo y un punto marca la punta
    const q = aPantalla(PUNTA_X, alto(v.choque.escudo), 0), y = aPantalla(PUNTA_X, alto(v.choque.punta), 0).y;
    const alfa = v.choque.hace < 600 ? 1 : 1 - (v.choque.hace - 600) / 300;
    anillo(ctx, q.x, q.y, r, 0.9 * alfa, "rgba(233,180,76,.95)");
    ctx.save(); ctx.globalAlpha = alfa;
    ctx.fillStyle = v.choque.zona === "fallo" ? "#e2574c" : "#fff8e8";
    ctx.strokeStyle = "rgba(20,14,10,.8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(q.x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    pinta = true;
  }
  if (!v.choque) {
    // la punta: una cruz pequeña donde está
    const p = aPantalla(PUNTA_X, alto(v.punta), 0);
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(p.x - 9, p.y); ctx.lineTo(p.x - 3.5, p.y); ctx.moveTo(p.x + 3.5, p.y); ctx.lineTo(p.x + 9, p.y); ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x, p.y - 3.5); ctx.moveTo(p.x, p.y + 3.5); ctx.lineTo(p.x, p.y + 9); ctx.stroke();
    ctx.restore();
    pinta = true;
  }
  return pinta;
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), P = aPantalla, k = plano.k;
  const horizonte = P(0, OJO, -1e5).y;
  ctx.fillStyle = "#6f9a48"; ctx.fillRect(0, horizonte, m.ancho, m.alto - horizonte);
  // las dos calles de arena
  const calle = (x0, x1) => { const a = P(x0, 0, D - 0.4), b = P(x1, 0, D - 0.4), c = P(x1, 0, -80), d = P(x0, 0, -80); ctx.fillStyle = "#c9b383"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill(); };
  calle(TELA_X - 1.4, TELA_X - 0.06); calle(TELA_X + 0.06, TELA_X + 1.3);
  // rayas que corren (para notar la velocidad)
  ctx.strokeStyle = "rgba(90,70,40,.3)"; ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const z = -(((i * 2 - (v.distancia % 2)) + 32) % 32) + 2, a = P(TELA_X - 1.4, 0, z), b = P(TELA_X + 1.3, 0, z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // el rival (lejos, detrás de la tela)
  const rival = () => {
    if (!v.hayRival) return;
    const z = -v.yRival;
    if (z > D - 0.5) return;
    const pal = PALETAS[v.rival], col = `#${pal.tela.toString(16).padStart(6, "0")}`;
    const pie = P(RIVAL_X, 0, z), lomo = P(RIVAL_X, 1.45, z), cabeza = P(RIVAL_X, 2.5, z), w = 0.32 * k * pie.f;
    ctx.fillStyle = col; ctx.fillRect(pie.x - w, lomo.y, w * 2, pie.y - lomo.y);
    ctx.fillStyle = "#8d9299"; ctx.fillRect(pie.x - w * 0.5, cabeza.y, w, lomo.y - cabeza.y);
    const e = P(PUNTA_X, alto(v.escudo), z), r = RADIO * k * e.f;
    ctx.fillStyle = pal.escudo; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.banda; ctx.beginPath(); ctx.arc(e.x, e.y, r * (ESCUDO.medio / ESCUDO.borde), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9b44c"; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(2, r * (ESCUDO.centro / ESCUDO.borde)), 0, Math.PI * 2); ctx.fill();
  };
  const tela = () => {
    const a = P(TELA_X, 0, D - 0.3), b = P(TELA_X, 0, -80), a2 = P(TELA_X, 0.95, D - 0.3), b2 = P(TELA_X, 0.95, -80);
    ctx.fillStyle = "#a3182a"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b.x, b.y); ctx.fill();
    ctx.strokeStyle = "#e9c46a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  };
  if (v.yRival > 0) { rival(); tela(); } else { tela(); rival(); }
  // la cabeza de tu caballo y tu lanza
  const cab = P(0.25, 1.95, D - 1.1), r = 0.16 * k * cab.f;
  ctx.fillStyle = "#5a3a22"; ctx.beginPath(); ctx.ellipse(cab.x, cab.y + r, r * 0.8, r * 1.6, 0, 0, Math.PI * 2); ctx.fill();
  const mano = { x: m.ancho * 1.05, y: m.alto * 1.02 }, punta = P(PUNTA_X, alto(v.punta), 0);
  ctx.strokeStyle = "#e6d3a3"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(mano.x, mano.y);
  if (v.lanzaRota) ctx.lineTo(mano.x + (punta.x - mano.x) * 0.45, mano.y + (punta.y - mano.y) * 0.45); else ctx.lineTo(punta.x, punta.y);
  ctx.stroke();
}

m.arrancar();
