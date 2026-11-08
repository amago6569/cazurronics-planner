// Tapeo en el Húmedo: lo que se ve y se toca. Qué cae, dónde y qué se coge lo decide motor-tapas.js, el mismo
// archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en escena-tapas.js;
// en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, mover, avanzar, resumen, xEn, alturaEn, tiempoHecho, multiplicador,
  DURACION_MS, CAZUELA, LIMITE_X, SEPARACION_MIN_MS,
} from "./motor-tapas.js";
import { crearMarco, $, conRaton, reducido } from "./marco.js";

const CADA_MS = 20; // como mucho un movimiento cada 20 ms (50 por segundo): la partida entera cabe en ~25 KB
export const BORDE_CAZUELA = 0.19; // alto de la cazuela (por debajo del borde, en anchos de barra)

// ── El campo: dónde cae todo en la pantalla. Lo usan el dibujo plano y el 3D (que coincide al píxel en el plano
// de la cazuela), y el dedo: x = -1 … 1 de la barra va de cx - hw a cx + hw. ──
function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 6, m.H * 0.3);
  const yBorde = m.arriba + m.H * 0.78, yArriba = m.arriba + m.H * 0.15;
  m.campo = { cx: m.ancho / 2, hw, yBorde, yArriba, caida: (yBorde - yArriba) / hw };
}
const aPantalla = (m, x, y) => ({ x: m.campo.cx + x * m.campo.hw, y: m.campo.yBorde - y * m.campo.hw });

let partida = null;
let ultimoEnvio = -1e9, xMandada = null, xPendiente = null;
let decididas = []; // cosas ya decididas, para animar su final (caer en la cazuela o al suelo)
let avisoBalcones = false;
let rachaPrevia = 0; // racha justo antes de lo último que llegó (para saber si se ha perdido una buena)

const TEXTO = conRaton
  ? { pista: "Mueve el ratón de lado a lado. ¡Que no caiga nada!", regla: "Mueve el ratón y la cazuela le sigue." }
  : { pista: "Arrastra el dedo de lado a lado. ¡Que no caiga nada!", regla: "Arrastra el dedo y la cazuela le sigue." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "tapas",
  nombre: "Tapeo en el Húmedo",
  duracionMs: DURACION_MS,
  fondo: "fondos/humedo",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ movimientos: p.movimientos.slice() }),
  final: (r) => ({
    datos: [["Tapas", r.cogidas], ["Mejor racha", r.mejorRacha], ["Servilletas", r.servilletas]],
    anuncio: `Se acabó el tiempo. ${r.puntos} puntos: ${r.cogidas} tapas cogidas y ${r.servilletas} servilletas.`,
    compartir: `He cogido ${r.cogidas} tapas en el Húmedo: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-tapas.js"),
  medir: medirCampo,
  empezar(p) {
    partida = p;
    ultimoEnvio = -1e9; xMandada = null; xPendiente = null; decididas = []; avisoBalcones = false; rachaPrevia = 0;
  },
  actualizar(tj) {
    if (xPendiente !== null && tj - ultimoEnvio >= CADA_MS) enviar(tj);
    for (const c of avanzar(partida, tj)) efecto(c);
    if (!avisoBalcones && tj >= 8000) { avisoBalcones = true; m.avisoNivel("¡Ahora las tiran desde los balcones!"); }
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { arrastrando = null; },
  datos3d: (tj) => ({ partida, decididas, cazuela: cazuelaVisible() }),
  dibujarPlano,
  sonidos: {
    // la tapa cae en el barro: un «toc» que sube con el multiplicador
    bien: (s, t, f, { tono }) => { tono({ fr: 300 * f, a: 220 * f, g: 0.18, dur: 0.09, tipo: "triangle" }); tono({ fr: 900 * f, g: 0.04, dur: 0.05 }); },
    papel: (s, t, f, { ruido }) => { ruido({ dur: 0.18, fr: 3500, q: 0.5, g: 0.22 }); },
    suelo: (s, t, f, { tono, ruido }) => { tono({ fr: 120, a: 60, g: 0.12, dur: 0.12 }); ruido({ dur: 0.06, fr: 600, g: 0.08 }); },
  },
});

// ── Dedo (o ratón) ──
let arrastrando = null;
function aBarra(clientX) { return Math.max(-LIMITE_X, Math.min(LIMITE_X, (clientX - m.campo.cx) / m.campo.hw)); }
function querer(clientX) {
  if (m.estado !== "juego") return;
  xPendiente = aBarra(clientX);
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

// ── Lo que pasa cuando algo llega a la cazuela ──
const NOMBRE = { croqueta: "Croqueta", morcilla: "Morcilla", chorizo: "Chorizo", cecina: "Cecina" };
function efecto(c) {
  const antes = rachaPrevia; rachaPrevia = c.res.racha;
  decididas.push(c);
  if (decididas.length > 40) decididas.splice(0, decididas.length - 40);
  const r = c.res;
  const p = aPantalla(m, partida.cazuela, 0.5);
  const mult = multiplicador(r.racha);
  if (c.tipo === "servilleta") {
    if (r.cogida) {
      m.sonar("papel"); m.sonar("mal"); m.vibrar(30);
      m.aviso(r.ganados ? `${r.ganados} servilleta` : "¡Servilleta!", "mal", p.x, p.y);
      m.anunciar(`Servilleta. ${partida.puntos} puntos.`);
    }
  } else if (r.cogida) {
    if (c.tipo === "dorado") {
      m.sonar("oro"); m.vibrar([12, 40, 12]);
      m.aviso(`+${r.ganados} BOTILLO DE ORO`, "oro", p.x, p.y - 20);
      m.anunciar(`Botillo de oro. ${partida.puntos} puntos.`);
    } else {
      m.sonar("bien", mult === 3 ? 1.5 : mult === 2 ? 1.25 : 1);
      m.vibrar(8);
    }
    if (r.racha === 5) { m.aviso("¡×2!", "oro", m.campo.cx, p.y - 70); m.anunciar("Racha de 5: puntos dobles."); }
    if (r.racha === 15) { m.aviso("¡×3!", "oro", m.campo.cx, p.y - 70); m.anunciar("Racha de 15: puntos triples."); }
  } else {
    m.sonar("suelo");
    if (antes >= 5) { m.aviso("¡Al suelo!", "mal", aPantalla(m, xEn(c, c.tc), 0).x, p.y); m.anunciar(`Se te ha caído una ${NOMBRE[c.clase] || "tapa"}. Racha perdida.`); }
  }
  pintar(r.cogida && c.tipo !== "servilleta");
}
function pintar(sube) {
  const mult = multiplicador(partida.racha);
  const racha = mult > 1 ? { texto: `×${mult}`, sub: mult === 3 ? "TRIPLES" : "DOBLES" }
    : partida.racha >= 2 ? { texto: `${partida.racha}`, sub: "SEGUIDAS" } : null;
  m.pintarPuntos(partida.puntos, sube, racha);
}

// La cazuela se ve donde está en el motor (que va a su velocidad máxima detrás del dedo)
function cazuelaVisible() { return partida ? partida.cazuela : 0; }

// ── Dibujo en plano (móviles sin 3D) ──
const COLOR = { croqueta: ["#e3a24f", "#a8641f"], morcilla: ["#5a2522", "#2a0f0e"], chorizo: ["#c8432c", "#7d1d12"], cecina: ["#9b2f2a", "#5c1512"], dorado: ["#ffe28a", "#c8901c"], servilleta: ["#fbf8f1", "#d9d3c4"] };
function dibujarCosa(ctx, c, x, y, r, giro, alfa = 1) {
  const [claro, oscuro] = COLOR[c.clase];
  ctx.save(); ctx.globalAlpha *= alfa; ctx.translate(x, y); ctx.rotate(giro);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, claro); g.addColorStop(1, oscuro);
  ctx.fillStyle = g; ctx.strokeStyle = "rgba(7,6,10,.45)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (c.clase === "croqueta") ctx.roundRect(-r * 1.2, -r * 0.62, r * 2.4, r * 1.24, r * 0.62);
  else if (c.clase === "cecina") { ctx.moveTo(-r * 1.2, -r * 0.5); ctx.quadraticCurveTo(0, -r * 0.9, r * 1.2, -r * 0.4); ctx.lineTo(r * 1.1, r * 0.55); ctx.quadraticCurveTo(0, r * 0.2, -r * 1.15, r * 0.6); ctx.closePath(); }
  else if (c.clase === "servilleta") { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = r * (0.85 + 0.25 * ((i * 7) % 3) / 2); ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  else if (c.clase === "dorado") ctx.ellipse(0, 0, r * 1.05, r * 0.9, 0, 0, Math.PI * 2);
  else ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  if (c.clase === "chorizo" || c.clase === "morcilla") { // puntitos de grasa o arroz
    ctx.fillStyle = c.clase === "chorizo" ? "rgba(255,230,210,.6)" : "rgba(240,230,210,.45)";
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.4) * r * 0.55, Math.sin(i * 2.4) * r * 0.55, r * 0.09, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function dibujarCazuela(ctx, x) {
  const p = aPantalla(m, x, 0), hw = m.campo.hw;
  const ra = 0.168 * hw, rb = 0.11 * hw, h = BORDE_CAZUELA * hw;
  ctx.save();
  const g = ctx.createLinearGradient(p.x - ra, 0, p.x + ra, 0);
  g.addColorStop(0, "#6e3016"); g.addColorStop(0.35, "#b9622f"); g.addColorStop(1, "#5a2410");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(p.x - ra, p.y); ctx.lineTo(p.x + ra, p.y); ctx.lineTo(p.x + rb, p.y + h); ctx.lineTo(p.x - rb, p.y + h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(p.x, p.y, ra, ra * 0.28, 0, 0, Math.PI * 2); ctx.fillStyle = "#3d1a0c"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = "#c97a45"; ctx.stroke();
  ctx.restore();
}
function dibujarPlano(ctx, tj) {
  const { hw, yBorde } = m.campo;
  // la barra de madera
  const yBarra = yBorde + BORDE_CAZUELA * hw;
  const g = ctx.createLinearGradient(0, yBarra - 10, 0, m.alto);
  g.addColorStop(0, "#7a4a25"); g.addColorStop(0.08, "#4b2a14"); g.addColorStop(1, "#1d0f07");
  ctx.fillStyle = g; ctx.fillRect(0, yBarra - 10, m.ancho, m.alto - yBarra + 10);
  ctx.fillStyle = "rgba(255,210,150,.18)"; ctx.fillRect(0, yBarra - 10, m.ancho, 3);
  if (!partida) { dibujarCazuela(ctx, 0); return; }
  const caida = m.campo.caida;
  // lo que cae
  for (let i = partida.siguiente; i < partida.cosas.length; i++) {
    const c = partida.cosas[i];
    if (c.t0 > tj) break;
    const u = (tj - c.t0) / c.T;
    const p = aPantalla(m, xEn(c, tj), alturaEn(u) * caida);
    dibujarCosa(ctx, c, p.x, p.y, (c.r + 0.012) * hw * 1.4, (tj - c.t0) / 400 * (c.id % 2 ? 1 : -1), Math.min(1, u * 6));
  }
  // lo que ya llegó: a la cazuela (se hunde) o al suelo (sigue cayendo y se desvanece)
  for (const c of decididas) {
    const s = (tj - c.tc) / 1000;
    if (s < 0 || s > 0.6) continue;
    const x = c.res.cogida ? partida.cazuela : xEn(c, c.tc);
    const y = c.res.cogida ? -s * 0.5 : -(s * 1.3 + 4.9 * s * s);
    const p = aPantalla(m, x, Math.max(y, -BORDE_CAZUELA - 0.3));
    dibujarCosa(ctx, c, p.x, p.y, (c.r + 0.012) * hw * 1.4, s * 3, c.res.cogida ? Math.max(0, 1 - s * 6) : Math.max(0, 1 - s / 0.6));
  }
  dibujarCazuela(ctx, partida.cazuela);
}

m.arrancar();
if (reducido) document.documentElement.classList.add("reducido");
