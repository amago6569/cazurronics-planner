// La Justa del Paso Honroso: lo que se ve y se toca. Dónde da la lanza y cuánto vale lo decide motor-justa.js, el
// mismo archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-justa.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, escudoEn, avanceEn, tiempoHecho,
  DURACION_MS, SEPARACION_MIN_MS, ESCUDO, VUELTA_MS,
} from "./motor-justa.js";
import { crearMarco, $, conRaton } from "./marco.js";
import { crearCampo } from "./campo.js";

const CADA_MS = 33;
// El palenque visto desde detrás de tu caballo. La tela (la valla del medio) va por x = 0; tú cabalgas a su derecha y
// el rival viene por la izquierda. La punta de tu lanza cruza por encima de la tela.
export const D = 6;
export const campo = crearCampo({ D, lejos: 1e5, yLejos: 0.17, yCerca: 0.72, altoHw: 0.31, corre: 0.3 });
export const TELA_X = -0.32; // por dónde va la tela
export const Y_CHOQUE = 1; // a qué distancia de la cámara se cruzan lanza y escudo
export const RECORRIDO = 11; // desde dónde sale el rival
export const YO = { x: 0.26, y: -1.5 }; // tu caballo
export const ALTO_LANZA = 0.98; // altura de la punta y del escudo
// De lo que dice el motor (0 pegado a la tela … 1 abierto) a metros de lado
export const ABRE = 0.8; // metros de lado entre lo más pegado a la tela y lo más abierto
export const aLado = (v) => TELA_X - 0.14 - ABRE * v;
export const PALETAS = [
  { tela: 0x1f4f8f, ribete: 0xe9c46a, escudo: "#1f4f8f", banda: "#f1e3c0" },
  { tela: 0x1f6b3a, ribete: 0xf1e3c0, escudo: "#1f6b3a", banda: "#e9c46a" },
  { tela: 0x1c1a1a, ribete: 0xd9a940, escudo: "#1c1a1a", banda: "#d9a940" },
  { tela: 0xd8d2c4, ribete: 0x9c1c24, escudo: "#efe9dc", banda: "#9c1c24" },
  { tela: 0xc9871f, ribete: 0x1c1a1a, escudo: "#d99a2b", banda: "#1c1a1a" },
  { tela: 0x5b2a86, ribete: 0xe9c46a, escudo: "#5b2a86", banda: "#e9c46a" },
];

let partida = null;
let ultimoEnvio = -1e9, yMandada = null, yPendiente = null;
let choque = null; // el último: { t, zona, escudo, rival, punta }
let distancia = 0, antes = 0, velocidad = 0;

const TEXTO = conRaton
  ? { pista: "Mueve el ratón a los lados: lleva la punta de la lanza al escudo.", regla: "Mueve el ratón y la punta de la lanza le sigue." }
  : { pista: "Arrastra el dedo a los lados: lleva la punta de la lanza al escudo.", regla: "Arrastra el dedo a los lados y la punta de la lanza le sigue." };
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
  medir: (mm) => campo.medir(mm),
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

// ── Dedo (o ratón): la punta se mueve de lado lo mismo que el dedo, desde donde estaba ──
let arrastrando = null, ancla = null;
function querer(clientX) {
  if (m.estado !== "juego" || !partida) return;
  const f = D / (D + Y_CHOQUE), porV = -1 / (campo.c.hw * f * ABRE); // píxeles → lo que entiende el motor
  if (!ancla) ancla = { px: clientX, y: yMandada === null ? 0.5 : yMandada / 10000 };
  let y = ancla.y + (clientX - ancla.px) * porV;
  if (y > 1 || y < 0) { y = Math.max(0, Math.min(1, y)); ancla = { px: clientX, y }; }
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
  querer(e.clientX);
  m.pista(null);
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (e.pointerId === arrastrando || e.pointerType === "mouse") { querer(e.clientX); if (e.pointerType === "mouse" && Math.abs(e.movementX) > 2) m.pista(null); }
});
const soltar = (e) => { if (e.pointerId === arrastrando) { arrastrando = null; ancla = null; } };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function efecto(e) {
  if (e.tipo === "sale") { if (e.n > 0) m.sonar("clarin"); return; }
  if (e.tipo !== "choque") return;
  choque = { t: e.t, zona: e.zona, escudo: e.escudo, punta: e.punta, rival: partida.chocado.rival };
  const p = campo.aPantalla(aLado(e.punta), Y_CHOQUE, ALTO_LANZA);
  if (e.zona === "fallo") {
    m.sonar("aire");
    m.aviso(NOMBRE.fallo, "mal", p.x, p.y - 30);
    m.anunciar("Al aire.");
    m.pintarPuntos(partida.puntos, false, null);
  } else {
    m.sonar(e.zona === "centro" ? "astilla" : "chapa", e.zona === "medio" ? 1 : 0.8);
    if (e.zona === "centro") { m.sonar("oro"); m.vibrar(70); } else m.vibrar(25);
    m.aviso(`${NOMBRE[e.zona]} +${e.ganados}`, e.zona === "centro" ? "oro" : "bien", p.x, p.y - 30);
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
    return { punta: 0.45 + 0.1 * Math.sin(s * 0.7), escudo: 0.5 + 0.18 * Math.sin(s * 1.1), yRival: Y_CHOQUE + 3 + (1 - u) * 9, rival: Math.floor(s / 7) % PALETAS.length, distancia, brio: 0.45, choque: null, hayRival: u < 0.97, tj: s * 1000, menu: true, lanzaRota: false };
  }
  const c = partida.carrera, enCarrera = partida.estado === "carrera";
  // lo rápido que vamos: al galope en la carrera, al trote dando la vuelta
  const quiere = enCarrera ? (RECORRIDO / (c.dura / 1000)) * 0.5 : 1.6;
  velocidad += (quiere - velocidad) * Math.min(1, dt * 3.5); distancia += velocidad * dt;
  if (m.estado === "juego" && enCarrera) { cascos -= dt * velocidad; if (cascos <= 0) { cascos = 1.15; m.sonar("cascos", 0.5 + velocidad * 0.12); } }
  let yRival = 1e9, escudo = 0.5, rival = 0, hayRival = false;
  if (enCarrera) {
    hayRival = true; rival = c.rival; escudo = escudoEn(partida, Math.max(0, tj));
    yRival = Y_CHOQUE + (1 - avanceEn(partida, tj)) * RECORRIDO;
  } else if (choque && tj < choque.t + VUELTA_MS + 400) {
    // después del choque sigue de largo y se sale por abajo
    hayRival = true; rival = choque.rival; escudo = choque.escudo;
    yRival = Y_CHOQUE - ((tj - choque.t) / 1000) * (RECORRIDO / (partida.chocado ? 2.6 : 3));
  }
  const reciente = choque && tj < choque.t + VUELTA_MS ? { ...choque, hace: tj - choque.t } : null;
  return {
    punta: partida.punta, escudo, yRival, rival, distancia, brio: Math.min(1, velocidad / 2.2), hayRival, tj,
    choque: reciente, lanzaRota: Boolean(reciente && reciente.zona === "centro"), menu: false,
    aviso: enCarrera ? avanceEn(partida, tj) : 0,
  };
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), P = campo.aPantalla, hw = campo.c.hw;
  // la hierba y las dos calles de arena
  const lejos = P(0, 60).y;
  ctx.fillStyle = "#5f8a3c"; ctx.fillRect(0, lejos, m.ancho, m.alto - lejos);
  for (const [x0, x1] of [[TELA_X - 1.3, TELA_X - 0.08], [TELA_X + 0.08, TELA_X + 1.2]]) {
    const a = P(x0, -4), b = P(x1, -4), c = P(x1, 60), d = P(x0, 60);
    ctx.fillStyle = "#c9b383"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
  }
  // rayas que corren (para notar la velocidad)
  ctx.strokeStyle = "rgba(90,70,40,.35)"; ctx.lineWidth = 2;
  for (let k = 0; k < 14; k++) {
    const y = ((k * 1.5 - (v.distancia % 1.5)) + 21) % 21 - 1, a = P(TELA_X - 1.3, y), b = P(TELA_X + 1.2, y);
    ctx.globalAlpha = Math.min(1, a.f * 1.2) * 0.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // el rival (detrás de la tela si está lejos)
  const dibRival = () => {
    if (!v.hayRival || v.yRival < -3) return;
    const xs = aLado(v.escudo), cuerpo = P(xs - 0.17, v.yRival, 0), arriba = P(xs - 0.17, v.yRival, 1.45), e = P(xs, v.yRival, ALTO_LANZA);
    const pal = PALETAS[v.rival], w = 0.24 * hw * cuerpo.f;
    ctx.fillStyle = `#${pal.tela.toString(16).padStart(6, "0")}`; ctx.fillRect(cuerpo.x - w, P(xs - 0.17, v.yRival, 0.85).y, w * 2, cuerpo.y - P(xs - 0.17, v.yRival, 0.85).y);
    ctx.fillStyle = "#8d9299"; ctx.fillRect(cuerpo.x - w * 0.55, arriba.y, w * 1.1, P(xs - 0.17, v.yRival, 0.85).y - arriba.y);
    const r = ESCUDO.borde * ABRE * hw * e.f;
    ctx.fillStyle = pal.escudo; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.banda; ctx.beginPath(); ctx.arc(e.x, e.y, r * (ESCUDO.medio / ESCUDO.borde), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b3121e"; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(2, r * (ESCUDO.centro / ESCUDO.borde)), 0, Math.PI * 2); ctx.fill();
  };
  const tela = () => {
    const a = P(TELA_X, -3, 0), b = P(TELA_X, 60, 0), a2 = P(TELA_X, -3, 0.62), b2 = P(TELA_X, 60, 0.62);
    ctx.fillStyle = "#b3121e"; ctx.beginPath(); ctx.moveTo(a.x - 3, a.y); ctx.lineTo(a2.x - 3, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x + 3, a.y); ctx.fill();
    ctx.strokeStyle = "#f1e3c0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  };
  dibRival(); tela();
  // tú, de espaldas, y la lanza
  const yo = P(YO.x, YO.y, 0), cabeza = P(YO.x, YO.y, 1.5), w = 0.26 * hw * yo.f;
  ctx.fillStyle = "#9c1c24"; ctx.fillRect(yo.x - w, P(YO.x, YO.y, 0.9).y, w * 2, yo.y - P(YO.x, YO.y, 0.9).y);
  ctx.fillStyle = "#aeb4bb"; ctx.fillRect(yo.x - w * 0.55, cabeza.y, w * 1.1, P(YO.x, YO.y, 0.9).y - cabeza.y);
  const mano = P(YO.x + 0.14, YO.y + 0.1, 1.05), punta = P(aLado(v.punta), Y_CHOQUE, ALTO_LANZA);
  ctx.strokeStyle = "#e6d3a3"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(mano.x, mano.y);
  if (v.lanzaRota) ctx.lineTo(mano.x + (punta.x - mano.x) * 0.45, mano.y + (punta.y - mano.y) * 0.45); else ctx.lineTo(punta.x, punta.y);
  ctx.stroke();
  if (!v.lanzaRota) { ctx.fillStyle = "#f4f1ea"; ctx.beginPath(); ctx.arc(punta.x, punta.y, 5, 0, Math.PI * 2); ctx.fill(); }
}

m.arrancar();
