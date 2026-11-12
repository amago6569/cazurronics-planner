// Bolos leoneses: lo que se ve y se toca. Qué bolos caen y cuánto vale lo decide motor-bolos.js, el mismo archivo
// con el que el servidor repite la partida. Aquí se lee el gesto del dedo, suena y se dibuja (3D en escena-bolos.js;
// en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, lanzar, avanzar, resumen, simularTiro, tiempoHecho, msDePaso, cincon,
  DURACION_MS, TIRO, CASTRO, PARADA, BOLERA, BOLA, ALTO, ALTO_MICHE, RECOGER_MS, ARMAR_MS, SEPARACION_MS,
} from "./motor-bolos.js";
import { crearMarco, $, conRaton } from "./marco.js";
import { crearCampo } from "./campo.js";

// La bolera vista desde detrás de la mano, desde arriba: el castro a 7 m y el tope del fondo a 11,5
export const D = 10;
export const campo = crearCampo({ D, lejos: BOLERA.fondo, yLejos: 0.2, yCerca: 0.95, altoHw: 0.3, anchoMax: 1.1 });
export const JUGADOR = { x: -0.6, y: -0.45 }; // dónde está el que tira, en la mano (tira con la derecha)

let partida = null;
let gesto = null; // el dedo en la pantalla: { id, puntos: [{ x, y }] }
let apunte = null; // el tiro que saldría si sueltas ahora: { x, a, c, s } y su camino
let ultimo = null; // la última bola: lo del motor y la distancia rodada paso a paso
let viejos = null; // los bolos de la tirada anterior, mientras se recogen: { bolos, hasta }
let marcas = { once: -1e9, fiesta: -1e9, tiro: -1e9, cuandoBirle: -1e9 };

const TEXTO = conRaton
  ? { pista: "Arrastra hacia el castro y suelta. Curva el gesto para que la bola tuerza.", regla: "Arrastra el ratón hacia el castro y suelta. Si curvas el gesto, la bola tuerce." }
  : { pista: "Desliza hacia el castro y suelta. Curva el gesto para que la bola tuerza.", regla: "Desliza el dedo hacia el castro y suelta. Si curvas el gesto, la bola tuerce." };
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
    datos: [["Onces", r.onces], ["Machos", r.machos], ["Bolos", r.bolos]],
    anuncio: `Se acabó. ${r.puntos} tantos: ${r.onces} onces, ${r.machos} machos y ${r.bolos} bolos.`,
    compartir: `He hecho ${r.onces} ${r.onces === 1 ? "once" : "onces"} en la bolera: ${r.puntos} tantos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-bolos.js"),
  medir: (mm) => campo.medir(mm),
  empezar(p) { partida = p; gesto = null; apunte = null; ultimo = null; viejos = null; marcas = { once: -1e9, fiesta: -1e9, tiro: -1e9, cuandoBirle: -1e9 }; },
  actualizar(tj) {
    for (const e of avanzar(partida, tj)) efecto(e, tj);
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { gesto = null; apunte = null; },
  chip: () => (partida ? `<span>Tirada ${partida.tiradas + 1} · ${partida.birle ? "a birlar" : "desde la mano"}</span>` : null),
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // la media bola rodando por la tierra
    rueda: (s, t, f, { ruido }) => ruido({ dur: 1.4 * f, fr: 240, q: 0.5, g: 0.2, tipo: "lowpass" }),
    // madera contra madera
    bolo: (s, t, f, { tono, ruido }) => { tono({ fr: 720 * f, a: 400, g: 0.16, dur: 0.07, tipo: "triangle" }); ruido({ dur: 0.05, fr: 2200, g: 0.2 }); },
    suelo: (s, t, f, { tono, ruido }) => { tono({ fr: 300 * f, a: 180, g: 0.08, dur: 0.06, tipo: "triangle" }); ruido({ dur: 0.04, fr: 900, g: 0.08 }); },
    miche: (s, t, f, { tono }) => { tono({ fr: 1250, a: 900, g: 0.14, dur: 0.09, tipo: "triangle" }); tono({ fr: 1880, g: 0.07, dur: 0.12, retraso: 0.05 }); },
    tablon: (s, t, f, { tono, ruido }) => { tono({ fr: 130, a: 70, g: 0.22, dur: 0.14 }); ruido({ dur: 0.07, fr: 500, g: 0.14 }); },
    gente: (s, t, f, { ruido }) => { ruido({ dur: 0.9, fr: 1400, q: 0.3, g: 0.12 }); ruido({ dur: 0.6, fr: 700, q: 0.4, g: 0.08, retraso: 0.15 }); },
  },
});

// ── El gesto: se desliza hacia el castro y se suelta. De ahí salen la salida, la dirección, el efecto y la fuerza ──
const tope = (v, a) => Math.max(-a, Math.min(a, v));
function leerGesto(pts) {
  if (pts.length < 2 || !partida) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, largo = Math.hypot(dx, dy);
  if (-dy < 30 || largo < 40) return null; // tiene que ir hacia delante
  // hacia dónde: lo que el dedo marca en el suelo de la bolera
  const A = campo.aCampo(a.x, Math.min(a.y, campo.c.yCerca)), B = campo.aCampo(b.x, Math.min(b.y, campo.c.yCerca - 20));
  let dir;
  if (partida.birle) {
    // al birlar: lo que se aparta del bolo del medio, visto desde donde está la bola
    const bx = -partida.birle.x, by = CASTRO.y - partida.birle.y, bl = Math.hypot(bx, by) || 1;
    const gx = B.x - A.x, gy = Math.max(0.1, B.y - A.y), gl = Math.hypot(gx, gy);
    const lado = (gx / gl) * (by / bl) - (gy / gl) * (bx / bl); // positivo: más a la derecha de lo que va al medio
    dir = tope(lado * 1.2, TIRO.aMax / 1000);
  } else dir = tope((B.x - A.x) / Math.max(0.4, B.y - A.y), TIRO.aMax / 1000);
  // el efecto: cuánto se comba el gesto respecto a la línea recta. Combado a la izquierda, la bola tuerce a la derecha
  let comba = 0;
  for (const q of pts) { const cr = (dx * (q.y - a.y) - dy * (q.x - a.x)) / largo; if (Math.abs(cr) > Math.abs(comba)) comba = cr; }
  let c = tope(-comba / largo / 0.13, 1);
  if (Math.abs(c) < 0.08) c = 0;
  const s = Math.max(0, Math.min(1, (largo - 50) / (m.H * 0.42)));
  const x = partida.birle ? 0 : tope(A.x, TIRO.xMax / 1000);
  return { x, a: dir, c, s };
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
  const q = leerGesto(gesto.puntos);
  apunte = q && listo() ? { ...q, camino: simularTiro(partida.bolos.map((b) => ({ ...b })), q, partida.lado, partida.birle) } : null;
});
function soltar(e) {
  if (!gesto || e.pointerId !== gesto.id) return;
  const tiro = e.type === "pointerup" ? leerGesto(gesto.puntos) : null;
  gesto = null; apunte = null;
  if (!tiro || !listo()) return;
  const t = Math.max(Math.round(m.tj()), tiempoHecho(partida), partida.tiros.length ? partida.ultimoT + SEPARACION_MS : 0);
  if (t > DURACION_MS) return;
  try { lanzar(partida, t, Math.round(tiro.x * 1000), Math.round(tiro.a * 1000), Math.round(tiro.c * 1000), Math.round(tiro.s * 1000)); m.pista(null); } catch { /* no vale: se ignora */ }
}
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

function efecto(e, tj) {
  if (e.tipo === "tiro") {
    const w = partida.vuelo;
    // lo rodado hasta cada paso (para que la bola gire lo que avanza)
    const rodado = [0];
    for (let k = 1; k < w.xs.length; k++) rodado.push(rodado[k - 1] + Math.hypot(w.xs[k] - w.xs[k - 1], w.ys[k] - w.ys[k - 1]));
    ultimo = { ...w, rodado, lado: partida.lado, ci: { ...partida.bolos[cincon(partida.lado)] }, mi: { ...partida.bolos[9] } };
    marcas.tiro = tj;
    m.sonar("rueda", 0.7 + 0.5 * e.s);
  } else if (e.tipo === "once") {
    marcas.once = tj;
    const p = campo.aPantalla(ultimo.mi.x, ultimo.mi.y, 0.6);
    m.aviso("¡Once!", "oro", Math.max(70, Math.min(m.ancho - 70, p.x - Math.sign(ultimo.mi.x) * 30)), p.y - 30);
    m.sonar("oro"); m.vibrar(50);
  } else if (e.tipo === "cae") {
    m.sonar(e.miche ? "miche" : "bolo", 0.85 + 0.3 * ((e.i * 7) % 5) / 5);
    setTimeout(() => m.sonar("suelo", 0.9 + 0.2 * ((e.i * 3) % 4) / 4), 260);
    if (e.miche) m.vibrar(40);
  } else if (e.tipo === "para") {
    if (e.tope) m.sonar("tablon", 1);
    const p = campo.aPantalla(Math.max(-1.6, Math.min(1.6, e.x)), Math.min(e.y, CASTRO.y + 1), 0.5);
    if (e.cinca) { m.aviso("Cinca", "mal", p.x, p.y - 20); m.anunciar("Cinca: la bola no ha entrado en el castro. No vale."); }
    else if (e.once) {
      marcas.fiesta = tj; m.sonar("gente");
      m.avisoNivel(`${e.miche ? "¡Once y macho!" : "¡Once!"} +${e.tantos}`);
    } else if (e.birle) { m.aviso(e.tantos ? `Birle +${e.tantos}` : "Birle en blanco", e.tantos ? "bien" : "mal", p.x, p.y - 20); m.anunciar(`Birle: ${e.tantos} tantos.`); }
    else if (e.birlar) { m.aviso(e.tantos ? `+${e.tantos} · ¡a birlar!` : "¡A birlar!", "bien", p.x, p.y - 20); m.anunciar(`${e.bolos} bolos. La bola ha salido de la raya de parada: se birla desde donde quedó.`); }
    else { m.aviso(e.tantos ? `+${e.tantos}` : "Blanca", e.tantos ? "bien" : "mal", p.x, p.y - 20); m.anunciar(`${e.tantos} tantos.`); }
    if (e.birlar) marcas.cuandoBirle = tj;
    m.pintarPuntos(partida.puntos, e.tantos > 0, null);
    if (partida.estado === "armando") viejos = { bolos: partida.anteriores, hasta: e.t + RECOGER_MS };
  }
}

// Dónde va la bola en el ms tj (interpolando el camino del motor)
function bolaEn(w, tj) {
  const k = Math.max(0, (tj - w.t0) / msDePaso(1)), n = w.xs.length - 1;
  const i = Math.min(n, Math.floor(k)), j = Math.min(n, i + 1), f = Math.min(1, k - i);
  const L = (arr) => arr[i] + (arr[j] - arr[i]) * f;
  return { x: L(w.xs), y: L(w.ys), hx: L(w.hxs), hy: L(w.hys), v: L(w.vs), rodado: L(w.rodado), parada: k >= n, hace: (k - n) * msDePaso(1) };
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
const castroQuieto = (lado) => {
  const bolos = [];
  for (let f = -1; f <= 1; f++) for (let c = -1; c <= 1; c++) bolos.push({ i: bolos.length, x: c * CASTRO.paso, y: CASTRO.y + f * CASTRO.paso, miche: false, cae: -1, dx: 0, dy: 1, empuje: 0, sube: 1 });
  bolos.push({ i: 9, x: lado * 1.45, y: 7.25, miche: true, cae: -1, dx: 0, dy: 1, empuje: 0, sube: 1 });
  return bolos;
};
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") {
    const bolos = castroQuieto(1);
    return { bolos, bola: { x: JUGADOR.x + 0.25, y: -0.2, ve: true, enMano: true, v: 0, hx: 0, hy: 1, rodado: 0, efecto: 0.8 }, jugador: { x: JUGADOR.x, y: JUGADOR.y, tira: -1, anda: 0 }, apunte: null, once: -1, fiesta: 0, tj: ahora, menu: true, lado: 1, ci: bolos[2], mi: bolos[9], sube: 1 };
  }
  const arma = partida.estado === "armando";
  const recogiendo = Boolean(arma && viejos && tj < viejos.hasta);
  const lista = recogiendo ? viejos.bolos : partida.bolos;
  const sube = arma && !recogiendo ? Math.max(0, Math.min(1, 1 - (partida.listoEn - tj) / ARMAR_MS)) : 1;
  const bolos = lista.map((b) => ({ i: b.i, x: b.x, y: b.y, miche: b.miche, dx: b.dx, dy: b.dy, empuje: b.empuje || 0, cae: b.pie ? -1 : tj - (b.cae ?? tj), sube: lista === partida.bolos ? sube : 1, recoge: recogiendo ? Math.max(0, 1 - (viejos.hasta - tj) / 300) : 0 }));
  // el jugador: en la mano, o andando hasta donde quedó la bola para birlar
  let jx = JUGADOR.x, jy = JUGADOR.y, anda = 0;
  if (partida.birle) {
    const k = Math.min(1, (tj - marcas.cuandoBirle) / (RECOGER_MS * 0.9));
    const bx = partida.birle.x - 0.3, by = partida.birle.y - 0.45;
    jx = JUGADOR.x + (bx - JUGADOR.x) * k; jy = JUGADOR.y + (by - JUGADOR.y) * k; anda = k < 1 ? 1 : 0;
  }
  const w = ultimo, enJuego = Boolean(w && (partida.estado === "bola" || tj < w.para + RECOGER_MS * 0.9));
  if (w && w.birle && enJuego) { jx = w.birle.x - 0.3; jy = w.birle.y - 0.45; anda = 0; }
  let bola;
  if (enJuego) bola = { ...bolaEn(w, tj), ve: true, enMano: false, efecto: w.tiro.c };
  else {
    const desde = partida.birle;
    bola = { x: desde ? desde.x : jx + 0.25, y: desde ? desde.y : jy + 0.15, ve: partida.estado === "listo" && tj >= partida.listoEn - 300, enMano: !desde, enSuelo: Boolean(desde), v: 0, hx: 0, hy: 1, rodado: 0, efecto: 0, parada: Boolean(desde) };
  }
  const ci = partida.bolos[cincon(partida.lado)], mi = partida.bolos[9];
  return {
    bolos, bola, jugador: { x: jx, y: jy, tira: w ? tj - marcas.tiro : -1, anda, birla: Boolean(partida.birle || (w && w.birle && enJuego)) },
    apunte: listo() ? apunte : null, once: w ? tj - marcas.once : -1, fiesta: tj - marcas.fiesta < 1800 ? (tj - marcas.fiesta) / 1800 : 0,
    tj, menu: false, lado: recogiendo ? w.lado : partida.lado, ci: recogiendo ? w.ci : ci, mi: recogiendo ? w.mi : mi, sube,
  };
}

// ── La guía del tiro mientras deslizas: el arranque del camino que llevaría la bola (encima de todo, en plano) ──
function dibujarEncima(ctx) {
  if (m.estado !== "juego" || !gesto) return false;
  const pts = gesto.puntos;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(243,234,216,.35)"; ctx.lineWidth = 5;
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  if (apunte && apunte.camino) {
    // solo el primer tramo: lo que tuerce al final hay que adivinarlo
    const c = apunte.camino, hasta = Math.max(8, Math.floor(c.xs.length * 0.42));
    ctx.strokeStyle = "rgba(233,180,76,.95)"; ctx.lineWidth = 3; ctx.setLineDash([2, 9]);
    ctx.beginPath();
    for (let k = 0; k < hasta && k < c.xs.length; k += 3) { const q = campo.aPantalla(c.xs[k], c.ys[k], 0.02); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    // la fuerza, en una barrita junto al dedo
    const u = pts[pts.length - 1], bx = Math.min(m.ancho - 30, u.x + 26), by = u.y - 34;
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(20,14,10,.6)"; ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, 14, 74, 7); ctx.fill();
    ctx.fillStyle = "#e9b44c"; ctx.beginPath(); ctx.roundRect(bx, by + 68 * (1 - apunte.s), 8, Math.max(4, 68 * apunte.s), 4); ctx.fill();
    ctx.font = "700 10px Archivo, sans-serif"; ctx.fillStyle = "rgba(255,248,232,.9)"; ctx.textAlign = "center"; ctx.fillText("FUERZA", bx + 4, by + 84);
  }
  ctx.restore();
  return true;
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), P = campo.aPantalla, hw = campo.c.hw;
  const poli = (pts, color) => { ctx.fillStyle = color; ctx.beginPath(); pts.forEach(([x, y], i) => { const q = P(x, y); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.fill(); };
  poli([[-8, -1], [8, -1], [8, BOLERA.fondo + 3], [-8, BOLERA.fondo + 3]], "#6f9a48");
  poli([[-BOLERA.ancho, -1], [BOLERA.ancho, -1], [BOLERA.ancho, BOLERA.fondo], [-BOLERA.ancho, BOLERA.fondo]], "#c6aa7c");
  poli([[-BOLERA.ancho, BOLERA.fondo], [BOLERA.ancho, BOLERA.fondo], [BOLERA.ancho, BOLERA.fondo + 0.2], [-BOLERA.ancho, BOLERA.fondo + 0.2]], "#6a4a2c");
  // rayas de cal: el castro, la mano, la raya de parada y la del once
  ctx.strokeStyle = "rgba(250,244,230,.85)"; ctx.lineWidth = 2;
  const linea = (pts, cerrar) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const q = P(x, y); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); if (cerrar) ctx.closePath(); ctx.stroke(); };
  const M = CASTRO.medio;
  linea([[-M, CASTRO.y - M], [M, CASTRO.y - M], [M, CASTRO.y + M], [-M, CASTRO.y + M]], true);
  linea([[-0.62, -0.62], [0.62, -0.62], [0.62, 0.62], [-0.62, 0.62]], true);
  ctx.setLineDash([6, 6]);
  const circ = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; circ.push([Math.cos(a) * PARADA, CASTRO.y + Math.sin(a) * PARADA]); }
  linea(circ);
  ctx.setLineDash([]);
  ctx.strokeStyle = v.once >= 0 && v.once < 1500 ? "#e9b44c" : "rgba(250,244,230,.85)"; ctx.lineWidth = 3;
  linea([[v.ci.x, v.ci.y], [v.mi.x, v.mi.y]]);
  const cosas = v.bolos.map((b) => ({ ...b, tipo: "bolo" }));
  if (v.bola.ve) cosas.push({ ...v.bola, tipo: "bola" });
  cosas.push({ ...v.jugador, tipo: "jugador" });
  cosas.sort((a, b) => b.y - a.y);
  for (const o of cosas) {
    if (o.tipo === "bola") {
      const q = P(o.x, o.y, BOLA), r = Math.max(3, BOLA * 1.4 * hw * q.f);
      ctx.fillStyle = "#6a3e1c"; ctx.beginPath(); ctx.arc(q.x, q.y, r, Math.PI, 0); ctx.closePath(); ctx.fill();
      continue;
    }
    if (o.tipo === "jugador") {
      const pie = P(o.x, o.y, 0), cab = P(o.x, o.y, 1.7), w = 0.11 * hw * pie.f, cin = P(o.x, o.y, 0.9);
      ctx.fillStyle = "#2a2622"; ctx.fillRect(pie.x - w * 0.7, cin.y, w * 1.4, pie.y - cin.y);
      ctx.fillStyle = "#e9e2d2"; ctx.fillRect(pie.x - w, cab.y + 8, w * 2, cin.y - cab.y - 8);
      ctx.fillStyle = "#d9a87e"; ctx.beginPath(); ctx.arc(cab.x, cab.y + 4, w * 0.6, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const alto = (o.miche ? ALTO_MICHE : ALTO) * o.sube, k = o.cae < 0 ? 0 : Math.min(1, o.cae / 380);
    const em = (o.empuje || 0) * Math.min(1, Math.max(0, o.cae) / 500);
    const bx = o.x + o.dx * em, by = o.y + o.dy * em;
    const pie = P(bx, by, 0), cab = P(bx + o.dx * alto * k * k, by + o.dy * alto * k * k, alto * (1 - k * k) + 0.04);
    ctx.globalAlpha = 1 - (o.recoge || 0);
    ctx.strokeStyle = o.miche ? "#e2c48a" : "#efdcb4"; ctx.lineWidth = Math.max(3, 0.09 * hw * pie.f); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pie.x, pie.y); ctx.lineTo(cab.x, cab.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

m.arrancar();
