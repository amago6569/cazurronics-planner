// El Pendón: lo que se ve y se toca. Cómo se inclina el palo y cuándo se cae lo decide motor-pendon.js, el mismo
// archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-pendon.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, vientoEn, tiempoHecho,
  DURACION_MS, LIMITE_X, SEPARACION_MIN_MS, CAE, PLOMO, LEVANTAR_MS, RACHA_MS,
} from "./motor-pendon.js";
import { crearMarco, $, conRaton } from "./marco.js";

const CADA_MS = 20; // como mucho un movimiento cada 20 ms
export const LARGO = 1.9; // el palo, en anchos de media plaza (lo que va de x = 0 a x = 1)
export const TELA = { ancho: 0.72, alto: 1.12, desde: 0.18 }; // la tela cuelga del travesaño, a «desde» de la punta

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 8, m.H * 0.3);
  m.campo = { cx: m.ancho / 2, hw, yBase: m.arriba + m.H * 0.87 };
}
const aPantalla = (x, y) => ({ x: m.campo.cx + x * m.campo.hw, y: m.campo.yBase - y * m.campo.hw });

let partida = null;
let ultimoEnvio = -1e9, xMandada = null, xPendiente = null;
let caida = null; // { t, lado } la última vez que se cayó
let avisoDiez = false, rachaViento = 0;

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
    partida = p; ultimoEnvio = -1e9; xMandada = null; xPendiente = null; caida = null; avisoDiez = false; rachaViento = 0;
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
  if (x > LIMITE_X || x < -LIMITE_X) { x = Math.max(-LIMITE_X, Math.min(LIMITE_X, x)); ancla = { px: clientX, x }; } // contra la pared: sin holgura al volver
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
  const punta = aPantalla(partida.x, LARGO * 0.75);
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
    return { x: 0, angulo: 0.06 * Math.sin(s * 1.3) + 0.03 * Math.sin(s * 2.1), viento: 0.25 * Math.sin(s * 0.4), plomo: false, tj: s * 1000, aguante: 0 };
  }
  let angulo = partida.angulo;
  if (caida && tj < caida.t + LEVANTAR_MS) {
    const s = tj - caida.t;
    if (s < 380) { const u = s / 380; angulo = caida.lado * (CAE + (1.45 - CAE) * u * u); } // se va al suelo
    else if (s < 600) angulo = caida.lado * 1.45; // en el suelo
    else { const u = (s - 600) / (LEVANTAR_MS - 600); angulo = caida.lado * 1.45 * (1 - u) * (1 - u) * (1 + 2 * u); } // lo levantan
  }
  const levantando = caida && tj < caida.t + LEVANTAR_MS;
  return {
    x: partida.x, angulo, viento: vientoEn(partida, Math.max(0, tj)), tj,
    plomo: !levantando && Math.abs(partida.angulo) < PLOMO,
    aguante: levantando ? 0 : tj - partida.dePieDesde,
  };
}

// ── Dibujo en plano ──
const RAYAS = ["#a3122a", "#5b1f6e"];
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { hw, yBase } = m.campo;
  // el suelo de la plaza
  ctx.fillStyle = "rgba(60,48,40,.55)"; ctx.fillRect(0, yBase, m.ancho, m.alto - yBase);
  const b = aPantalla(v.x, 0);
  // la línea de plomo (dorada) cuando va derecho
  if (v.plomo) { ctx.strokeStyle = "rgba(233,180,76,.5)"; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - LARGO * hw); ctx.stroke(); ctx.setLineDash([]); }
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(v.angulo);
  // el palo
  ctx.fillStyle = "#6a4426"; ctx.fillRect(-3, -LARGO * hw, 6, LARGO * hw);
  // travesaño y tela (a rayas, con las puntas abajo)
  const yT = -(LARGO - TELA.desde) * hw, an = TELA.ancho * hw, al = TELA.alto * hw;
  ctx.fillStyle = "#4a2e18"; ctx.fillRect(-an / 2 - 4, yT - 3, an + 8, 5);
  ctx.save(); ctx.translate(0, yT); ctx.rotate(-v.angulo * 0.7 + v.viento * 0.25);
  const n = 6;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = RAYAS[i % 2];
    const x0 = -an / 2 + (i * an) / n, ond = Math.sin(ahora / 260 + i) * 3 * (0.3 + Math.abs(v.viento));
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + an / n, 0);
    ctx.lineTo(x0 + an / n + ond, al * (i % 3 === 2 ? 0.86 : 1)); ctx.lineTo(x0 + ond, al * (i % 3 === 0 ? 0.86 : 1)); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // la cruz de arriba
  ctx.fillStyle = "#d9b25a"; ctx.fillRect(-2, -LARGO * hw - 18, 4, 18); ctx.fillRect(-8, -LARGO * hw - 13, 16, 4);
  ctx.restore();
  // las manos (la base)
  ctx.fillStyle = "#2b1d14"; ctx.beginPath(); ctx.ellipse(b.x, b.y, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
}

m.arrancar();
