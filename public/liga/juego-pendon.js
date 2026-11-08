// El Pendón: lo que se ve y se toca. Cómo se inclina el palo y cuándo se cae lo decide motor-pendon.js, el mismo
// archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-pendon.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, vientoEn, tiempoHecho,
  DURACION_MS, LIMITE_X, SEPARACION_MIN_MS, CAE, PLOMO, LEVANTAR_MS, RACHA_MS,
} from "./motor-pendon.js";
import { crearMarco, $, conRaton } from "./marco.js";

const CADA_MS = 20; // como mucho un movimiento cada 20 ms
// Medidas de un pendón leonés de verdad (en anchos de media pantalla): una vara de unos 6 m que el pendonero apoya
// en la cuja (el cinto de cuero) a la altura de la cintura; arriba, el travesaño y la tela larga, que acaba en farpas.
export const CUJA = 0.42; // altura de la cuja (donde gira el palo)
export const LARGO = 2.55; // la vara, de la cuja a la punta
export const TELA = { ancho: 0.62, alto: 1.75, desde: 0.14 }; // la tela cuelga del travesaño, a «desde» de la punta

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 8, m.H * 0.245);
  m.campo = { cx: m.ancho / 2, hw, yBase: m.arriba + m.H * 0.92 };
}
const aPantalla = (x, y) => ({ x: m.campo.cx + (x - camara) * m.campo.hw, y: m.campo.yBase - y * m.campo.hw });

let partida = null;
let ultimoEnvio = -1e9, xMandada = null, xPendiente = null;
let caida = null; // { t, lado } la última vez que se cayó
let avisoDiez = false, rachaViento = 0;
let camara = 0, camaraAntes = 0; // la plaza es ancha: la cámara sigue al pendonero

const TEXTO = conRaton
  ? { pista: "Mueve el ratón hacia donde se inclina para que no se caiga.", regla: "Mueve el ratón y la base del palo le sigue." }
  : { pista: "Arrastra el dedo hacia donde se inclina para que no se caiga.", regla: "Arrastra el dedo y la base del palo le sigue." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "pendon",
  nombre: "El Pendón",
  duracionMs: DURACION_MS,
  fondo: "fondos/pendon",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ movimientos: p.movimientos.slice() }),
  final: (r) => ({
    datos: [["De pie", `${r.dePie}″`], ["Más seguido", `${r.mejorAguante}″`], ["Caídas", r.caidas]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.dePie} segundos de pie y ${r.caidas} caídas.`,
    compartir: `He aguantado el pendón ${r.mejorAguante} segundos seguidos delante de San Marcos: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-pendon.js"),
  medir: medirCampo,
  empezar(p) {
    partida = p; camara = 0; ultimoEnvio = -1e9; xMandada = null; xPendiente = null; caida = null; avisoDiez = false; rachaViento = 0;
    ancla = null;
  },
  actualizar(tj) {
    if (xPendiente !== null && tj - ultimoEnvio >= CADA_MS) enviar(tj);
    for (const e of avanzar(partida, tj)) efecto(e);
    // golpe de viento: se oye
    const w = Math.abs(vientoEn(partida, tj));
    if (w > 0.5 && !rachaViento) { rachaViento = 1; m.sonar("soplo", 1.2); } else if (w < 0.35) rachaViento = 0;
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { arrastrando = null; },
  chip: (tj) => {
    if (!partida) return null;
    const w = vientoEn(partida, tj), n = Math.min(3, Math.round(Math.abs(w) / 0.2));
    if (!n) return `<span>Sin viento</span>`;
    return `<span>Viento ${(w > 0 ? "→" : "←").repeat(n)}</span>`;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  sonidos: {
    cae: (s, t, f, { tono, ruido }) => { tono({ fr: 110, a: 55, g: 0.3, dur: 0.25 }); ruido({ dur: 0.18, fr: 700, g: 0.18 }); },
    tic: (s, t, f, { tono }) => { tono({ fr: 1500, g: 0.025, dur: 0.04, tipo: "triangle" }); },
  },
});

// ── Dedo (o ratón): la base se mueve lo mismo que el dedo, desde donde estaba (no salta al tocar) ──
let arrastrando = null, ancla = null;
function querer(clientX) {
  if (m.estado !== "juego" || !partida) return;
  if (!ancla) ancla = { px: clientX, x: xMandada === null ? partida.objetivo : xMandada / 10000 };
  let x = ancla.x + (clientX - ancla.px) / m.campo.hw;
  if (x > LIMITE_X || x < -LIMITE_X) { x = Math.max(-LIMITE_X, Math.min(LIMITE_X, x)); ancla = { px: clientX, x }; } // (la plaza no se acaba en la práctica)
  xPendiente = x;
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
  const punta = aPantalla(partida.x, CUJA + LARGO * 0.6);
  if (e.tipo === "cae") {
    caida = { t: e.t, lado: e.lado };
    m.sonar("cae"); m.vibrar(60);
    m.aviso("¡Al suelo!", "mal", punta.x, punta.y);
    m.anunciar(`Se ha caído. Aguantaste ${Math.floor(e.aguante / 1000)} segundos.`);
    avisoDiez = false;
    m.pintarPuntos(partida.puntos, false, null);
  } else if (e.tipo === "arriba") {
    m.anunciar("Otra vez de pie.");
  } else if (e.tipo === "puntos") {
    if (e.plomo) m.sonar("tic");
    if (!avisoDiez && e.aguante >= RACHA_MS) { avisoDiez = true; m.avisoNivel("¡10 segundos de pie! Ahora +1 extra"); }
    const s = Math.floor(e.aguante / 1000);
    m.pintarPuntos(partida.puntos, false, s >= 3 ? { texto: `${s}″`, sub: "DE PIE" } : null);
  }
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") {
    // en el menú, se balancea solo, tranquilo
    const s = ahora / 1000;
    camara = 0;
    return { x: 0, camara: 0, angulo: 0.06 * Math.sin(s * 1.3) + 0.03 * Math.sin(s * 2.1), viento: 0.25 * Math.sin(s * 0.4), plomo: false, tj: s * 1000, aguante: 0 };
  }
  let angulo = partida.angulo;
  if (caida && tj < caida.t + LEVANTAR_MS) {
    const s = tj - caida.t;
    if (s < 380) { const u = s / 380; angulo = caida.lado * (CAE + (1.45 - CAE) * u * u); } // se va al suelo
    else if (s < 600) angulo = caida.lado * 1.45; // en el suelo
    else { const u = (s - 600) / (LEVANTAR_MS - 600); angulo = caida.lado * 1.45 * (1 - u) * (1 - u) * (1 + 2 * u); } // lo levantan
  }
  const levantando = caida && tj < caida.t + LEVANTAR_MS;
  // la cámara va detrás del pendonero, sin dejar que se salga de la pantalla
  const dt = Math.min(0.1, Math.max(0, (ahora - (camaraAntes || ahora)) / 1000)); camaraAntes = ahora;
  camara += (partida.x - camara) * (1 - Math.exp(-dt * 1.6));
  camara = Math.max(partida.x - 0.55, Math.min(partida.x + 0.55, camara));
  return {
    x: partida.x, camara, angulo, viento: vientoEn(partida, Math.max(0, tj)), tj,
    plomo: !levantando && Math.abs(partida.angulo) < PLOMO,
    aguante: levantando ? 0 : tj - partida.dePieDesde,
  };
}

// ── Dibujo en plano ──
const RAYAS = ["#a3122a", "#5b1f6e", "#a3122a", "#e2b546", "#a3122a", "#5b1f6e", "#a3122a"];
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { hw, yBase } = m.campo;
  // el suelo de la plaza (las losas corren con la cámara)
  ctx.fillStyle = "rgba(60,48,40,.55)"; ctx.fillRect(0, yBase, m.ancho, m.alto - yBase);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  for (let k = -12; k <= 12; k++) { const x = m.campo.cx + (k * 0.5 - (v.camara % 0.5)) * hw; ctx.fillRect(x, yBase, 2, m.alto - yBase); }
  const suelo = aPantalla(v.x, 0), b = aPantalla(v.x, CUJA);
  // el pendonero (silueta)
  ctx.fillStyle = "#1c1612"; ctx.fillRect(suelo.x - 10, b.y, 7, suelo.y - b.y); ctx.fillRect(suelo.x + 3, b.y, 7, suelo.y - b.y);
  ctx.fillStyle = "#efe9de"; ctx.fillRect(suelo.x - 12, b.y - 0.26 * hw, 24, 0.26 * hw);
  ctx.fillStyle = "#b3121e"; ctx.fillRect(suelo.x - 12, b.y - 6, 24, 8);
  ctx.fillStyle = "#e0b48c"; ctx.beginPath(); ctx.arc(suelo.x, b.y - 0.32 * hw, 0.055 * hw, 0, Math.PI * 2); ctx.fill();
  // la línea de plomo (dorada) cuando va derecho
  if (v.plomo) { ctx.strokeStyle = "rgba(233,180,76,.5)"; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - LARGO * hw); ctx.stroke(); ctx.setLineDash([]); }
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(v.angulo);
  ctx.fillStyle = "#6a4426"; ctx.fillRect(-3, -LARGO * hw, 6, LARGO * hw + 8);
  // travesaño, tela larga a franjas que acaba en dos farpas, y los cordones
  const yT = -(LARGO - TELA.desde) * hw, an = TELA.ancho * hw, al = TELA.alto * hw;
  ctx.fillStyle = "#4a2e18"; ctx.fillRect(-an / 2 - 6, yT - 3, an + 12, 5);
  ctx.save(); ctx.translate(0, yT); ctx.rotate(-v.angulo * 0.75 - v.viento * 0.18);
  const n = RAYAS.length, ond = (u) => Math.sin(ahora / 300 + u * 5) * 4 * (0.3 + Math.abs(v.viento));
  for (let i = 0; i < n; i++) {
    const x0 = -an / 2 + (i * an) / n, x1 = x0 + an / n, fondo = (x) => al * (0.78 + 0.22 * Math.abs((x / (an / 2))));
    ctx.fillStyle = RAYAS[i];
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineTo(x1 + ond(i + 1), fondo(x1)); ctx.lineTo(x0 + ond(i), fondo(x0)); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "#d9b25a"; ctx.lineWidth = 2;
  for (const l of [-1, 1]) { ctx.beginPath(); ctx.moveTo(l * an / 2, 0); ctx.quadraticCurveTo(l * (an / 2 + 14), al * 0.4, l * (an / 2 + 8), al * 0.75); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = "#d9b25a"; ctx.fillRect(-2, -LARGO * hw - 22, 4, 22); ctx.fillRect(-9, -LARGO * hw - 16, 18, 4);
  ctx.restore();
}

m.arrancar();
