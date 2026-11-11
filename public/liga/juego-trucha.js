// La trucha: lo que se ve y se toca. Cuándo pica, cuánto tira y si se rompe el sedal lo decide motor-trucha.js, el
// mismo archivo con el que el servidor repite la partida. Aquí se escucha el dedo, suena y se dibuja (3D en
// escena-trucha.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, tocar, avanzar, resumen, tiempoHecho,
  DURACION_MS, SEPARACION_MIN_MS, TENSION, AGUANTE, CLAVAR_MS, SEDAL,
} from "./motor-trucha.js";
import { crearMarco, $, conRaton, reducido } from "./marco.js";

export const D = 3.2, YC = 1.6; // la cámara: a esta distancia de la orilla y a esta altura (lo usa la escena 3D)
export const zDe = (metros) => -(0.3 + metros * 0.5); // de metros de sedal a fondo de la escena
const LANCE_M = 7.5; // a cuántos metros cae la mosca

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2, m.H * 0.3);
  const yAgua = m.arriba + m.H * 0.86;
  m.campo = { cx: m.ancho / 2, hw, yAgua, ojo: yAgua - hw * YC };
}
// de la escena (x, alto, fondo) a la pantalla
export function aPantalla(x, y, z) {
  const { cx, hw, yAgua, ojo } = m.campo, f = D / (D - z);
  return { x: cx + hw * x * f, y: ojo + (yAgua - ojo) * f - hw * y * f, f };
}

let partida = null;
let apretado = false, apretadoDesde = 0;
let boya = null; // { x, t0 } dónde cayó la mosca en este lance
let amagoEn = -1e9, picaEn = -1e9, clavadaEn = -1e9, arreonEn = -1e9, saltoEn = -1e9, falsoEn = -1e9;
let sacada = null, perdida = null; // lo último que salió o se escapó: { t, cm, x, z } / { t, tipo, x, z }
let clicEn = 0, rioEn = 0, chirridoEn = 0, avisoSuelta = 0, avisoRecoge = 0, primeraPelea = true;
const recientes = [];
export const enlace = { punta: null, boya: null }; // la escena 3D deja aquí dónde quedan en la pantalla la punta de la caña y la boya

const TEXTO = conRaton
  ? { pista: "Cuando se hunda la boya, haz clic para clavar.", regla: "Mantén pulsado para recoger sedal. Suelta para dar sedal." }
  : { pista: "Cuando se hunda la boya, toca para clavar.", regla: "Mantén el dedo para recoger sedal. Levántalo para dar sedal." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "trucha",
  nombre: "La trucha",
  duracionMs: DURACION_MS,
  fondo: "fondos/valle",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ toques: p.toques.slice() }),
  final: (r) => ({
    datos: [["Truchas", r.truchas], ["La mayor", r.mayor ? `${r.mayor} cm` : "—"], ["Perdidas", r.perdidas]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.truchas} truchas${r.mayor ? `, la mayor de ${r.mayor} centímetros` : ""}.`,
    compartir: r.mayor ? `He sacado ${r.truchas} truchas a la leonesa, la mayor de ${r.mayor} cm: ${r.puntos} puntos. ¿Me superas?` : `He ido de pesca a la leonesa: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-trucha.js"),
  medir: medirCampo,
  empezar(p) {
    partida = p; apretado = false; boya = null; sacada = null; perdida = null; recientes.length = 0;
    amagoEn = picaEn = clavadaEn = arreonEn = saltoEn = falsoEn = -1e9;
    clicEn = 0; rioEn = 0; chirridoEn = 0; avisoSuelta = 0; avisoRecoge = 0; primeraPelea = true;
  },
  actualizar(tj) {
    for (const e of avanzar(partida, tj)) efecto(e, tj);
    // el río, de fondo
    if (tj >= rioEn) { rioEn = tj + 1700; m.sonar("rio"); }
    if (partida.estado === "pelea") {
      // el carrete: clic, clic, clic mientras recoges (más deprisa cuanto mejor va)
      if (partida.apretado && tj >= clicEn) { clicEn = tj + 62; m.sonar("clic", 0.8 + partida.tension * 0.5); }
      // el sedal canta cuando está a punto de romper
      if (partida.tension > TENSION.bien[1] && tj >= chirridoEn) { chirridoEn = tj + 110; m.sonar("canta", partida.tension); if (partida.tension > TENSION.rompe) m.vibrar(12); }
      // pistas la primera vez
      if (primeraPelea) {
        if (partida.tension > 0.93 && partida.apretado && tj > avisoSuelta) { avisoSuelta = tj + 1500; m.pista(conRaton ? "¡Suelta! Que se rompe." : "¡Levanta el dedo! Que se rompe."); }
        else if (partida.tension < 0.3 && !partida.apretado && tj > avisoRecoge) { avisoRecoge = tj + 1500; m.pista(conRaton ? "Mantén pulsado para recoger." : "Mantén el dedo para recoger."); }
      }
    }
    return tj >= DURACION_MS + 200;
  },
  alTerminar() { apretado = false; },
  chip: () => {
    if (!partida) return null;
    if (partida.estado === "pelea") return `<span>Trucha a ${Math.max(0, partida.distancia).toFixed(1).replace(".", ",")} m</span>`;
    return partida.sacadas ? `<span>${partida.sacadas} ${partida.sacadas === 1 ? "trucha" : "truchas"} · la mayor, ${partida.mayor} cm</span>` : `<span>Mosca en el agua</span>`;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora), enlace }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    rio: (s, t, f, { audio }) => { // agua corriendo: ruido suave que entra y sale sin escalón
      const dur = 2.3, buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate), d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b + (Math.random() * 2 - 1) * 0.02; }
      const src = audio.createBufferSource(); src.buffer = buf;
      const fl = audio.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 900; fl.Q.value = 0.4;
      const g = audio.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 0.5); g.gain.setValueAtTime(0.11, t + dur - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(s); src.start(t);
    },
    clic: (s, t, f, { tono }) => { tono({ fr: 2100 * f, g: 0.022, dur: 0.018, tipo: "square" }); },
    canta: (s, t, f, { tono }) => { tono({ fr: 1500 + 900 * f, a: 1700 + 1000 * f, g: 0.02 + 0.02 * Math.max(0, f - 0.9), dur: 0.09, tipo: "sawtooth" }); },
    chof: (s, t, f, { ruido, tono }) => { ruido({ dur: 0.32 * f, fr: 1700, q: 0.5, g: 0.22 * f }); tono({ fr: 260, a: 110, g: 0.1 * f, dur: 0.16 }); },
    gota: (s, t, f, { tono }) => { tono({ fr: 620, a: 980, g: 0.05, dur: 0.07 }); },
    rota: (s, t, f, { ruido, tono }) => { ruido({ dur: 0.07, fr: 5200, q: 2, g: 0.35 }); tono({ fr: 900, a: 140, g: 0.14, dur: 0.3, tipo: "triangle" }); },
    lance: (s, t, f, { ruido }) => { ruido({ dur: 0.3, fr: 3200, q: 1.5, g: 0.07 }); },
  },
});

// ── Dedo (o ratón): apretar y soltar ──
function cambiar(aprieta) {
  if (m.estado !== "juego" || !partida || aprieta === apretado) return;
  const tj = m.tj();
  const t = Math.max(Math.round(tj), tiempoHecho(partida), partida.toques.length ? partida.ultimoT + SEPARACION_MIN_MS : 0);
  if (t > DURACION_MS) return;
  try { tocar(partida, t); apretado = aprieta; apretadoDesde = tj; } catch { /* demasiados: se ignora */ }
}
const lienzo = $("lienzo");
let dedoPuesto = null;
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego" || dedoPuesto !== null) return;
  dedoPuesto = e.pointerId;
  lienzo.setPointerCapture(e.pointerId);
  cambiar(true);
  e.preventDefault();
});
const soltar = (e) => { if (e.pointerId === dedoPuesto) { dedoPuesto = null; cambiar(false); } };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);
lienzo.addEventListener("contextmenu", (e) => e.preventDefault());

const dondeBoya = () => (boya ? aPantalla(boya.x, 0.1, zDe(LANCE_M)) : { x: m.campo.cx, y: m.campo.yAgua - 100 });
function efecto(e, tj) {
  recientes.push(e);
  if (recientes.length > 24) recientes.shift();
  if (e.tipo === "lance") {
    boya = { x: (((e.t * 7 + partida.semilla) % 1000) / 1000 - 0.5) * 0.7, t0: e.t };
    m.sonar("lance");
    setTimeout(() => m.sonar("gota"), 420);
    if (!partida.sacadas && !partida.rotas && !partida.sueltas) m.pista(TEXTO.pista);
  } else if (e.tipo === "amago") { amagoEn = e.t; m.sonar("gota"); }
  else if (e.tipo === "pica") { picaEn = e.t; m.sonar("chof", 0.8); m.vibrar(35); m.anunciar("¡Pica!"); }
  else if (e.tipo === "falso") {
    falsoEn = e.t; const p = dondeBoya();
    m.sonar("mal"); m.aviso("¡Antes de tiempo!", "mal", p.x, p.y - 30);
    m.anunciar("Has tirado antes de que picara.");
  } else if (e.tipo === "sefue") {
    const p = dondeBoya();
    m.sonar("mal"); m.aviso("Se fue", "mal", p.x, p.y - 30); m.anunciar("No has clavado a tiempo.");
  } else if (e.tipo === "clavada") {
    clavadaEn = e.t; const p = dondeBoya();
    m.sonar(e.perfecta ? "oro" : "bien"); m.vibrar(e.perfecta ? [15, 30, 15] : 15);
    m.aviso(e.perfecta ? `¡Clavada! +${e.ganados}` : "¡Clavada!", e.perfecta ? "oro" : "bien", p.x, p.y - 40);
    m.pista(primeraPelea ? TEXTO.regla : null);
    m.pintarPuntos(partida.puntos, e.perfecta, null);
    m.anunciar("Clavada. Mantén pulsado para recoger y suelta cuando tire.");
  } else if (e.tipo === "arreon") {
    arreonEn = e.t; m.sonar("chof", 0.55);
    if ((e.t * 13 + partida.semilla) % 5 < 2) saltoEn = e.t + 120; // algunas saltan
  } else if (e.tipo === "rota" || e.tipo === "suelta") {
    const v = pezAhora(tj), p = aPantalla(v.x, 0.2, v.z);
    perdida = { t: e.t, tipo: e.tipo, x: v.x, z: v.z };
    m.sonar(e.tipo === "rota" ? "rota" : "mal"); m.vibrar(e.tipo === "rota" ? [40, 30, 60] : 40);
    m.aviso(e.tipo === "rota" ? "¡Sedal roto!" : "¡Se soltó!", "mal", p.x, Math.min(p.y, m.campo.yAgua - 120));
    m.anunciar(e.tipo === "rota" ? "Se ha roto el sedal. Suelta cuando tire fuerte." : "Se ha soltado. No dejes el sedal flojo.");
    primeraPelea = false; m.pista(null);
  } else if (e.tipo === "trucha") {
    sacada = { t: e.t, cm: e.cm, limpia: e.limpia };
    m.sonar("oro"); m.sonar("chof", 1); m.vibrar([20, 40, 20]);
    m.aviso(`${e.cm} cm · +${e.ganados}`, "oro", m.campo.cx, m.arriba + m.H * 0.4);
    if (e.limpia) setTimeout(() => m.avisoNivel(`Sin un apuro: +5`), 250);
    m.pintarPuntos(partida.puntos, true, { texto: `${partida.sacadas}`, sub: partida.sacadas === 1 ? "TRUCHA" : "TRUCHAS" });
    m.anunciar(`Trucha de ${e.cm} centímetros.`);
    primeraPelea = false; m.pista(null);
  }
}

// Dónde anda la trucha clavada (de lado va y viene a su aire: es solo lo que se ve)
function pezAhora(tj) {
  const s = (tj - clavadaEn) / 1000, x0 = boya ? boya.x : 0;
  const lado = 0.5 * Math.sin(s * 1.3 + x0 * 9) + 0.18 * Math.sin(s * 2.9 + 1);
  const cerca = Math.min(1, Math.max(0.25, partida.distancia / 5));
  return { x: x0 * Math.max(0, 1 - s) + lado * cerca * Math.min(1, s), z: zDe(Math.max(0, partida.distancia)) };
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  const s = ahora / 1000;
  if (!partida || m.estado === "inicio") {
    // en el menú: la boya en el agua, tranquila
    return { tj: s * 1000, s, estado: "espera", menu: true, boya: { x: 0.2, z: zDe(LANCE_M), hunde: 0, vuelo: 1 }, tension: 0.25, apretado: false, recientes: [] };
  }
  const p = partida, t = Math.max(0, tj);
  const v = { tj: t, s, estado: p.estado, tension: p.tension, apretado: p.apretado, recientes, sobre: p.sobre / AGUANTE.rompe, bajo: p.bajo / AGUANTE.flojo, distancia: p.distancia };
  if (m.estado === "fin") v.estado = "pausa";
  if (v.estado === "espera" && boya) {
    const vuelo = Math.min(1, (t - boya.t0) / 420); // la mosca vuela hasta el agua
    let hunde = 0;
    const da = t - amagoEn, dp = t - picaEn, df = t - falsoEn;
    if (da >= 0 && da < 380) hunde = 0.35 * Math.sin((da / 380) * Math.PI);
    if (p.picada && dp >= 0) hunde = Math.min(1, dp / 90) * (1 - 0.15 * Math.sin(dp / 40));
    if (df >= 0 && df < 300) hunde = -0.5 * Math.sin((df / 300) * Math.PI); // el tirón en falso la saca un poco
    v.boya = { x: boya.x, z: zDe(LANCE_M), hunde, vuelo, pica: p.picada ? Math.min(1, dp / CLAVAR_MS) : 0 };
  } else if (v.estado === "pelea") {
    const z = pezAhora(t), ds = t - saltoEn;
    v.pez = { ...z, cm: p.trucha.cm, tira: p.tira, salto: ds >= 0 && ds < 620 ? ds / 620 : -1, arreon: t - arreonEn < 500, aguante: p.aguante };
    v.boya = { x: z.x, z: z.z, hunde: 0.6, vuelo: 1 };
  }
  if (sacada && t - sacada.t < 1050) v.sacada = { ...sacada, k: (t - sacada.t) / 1050 };
  if (perdida && t - perdida.t < 900) v.perdida = { ...perdida, k: (t - perdida.t) / 900 };
  return v;
}

// ── Encima de todo, en plano: el sedal y el medidor de tensión ──
const ZONAS = [[0, TENSION.flojo, "#6f8fb0"], [TENSION.flojo, TENSION.bien[0], "#c9c18a"], [TENSION.bien[0], TENSION.bien[1], "#5fbf6e"], [TENSION.bien[1], TENSION.rompe, "#e9a13c"], [TENSION.rompe, 1.15, "#d8433a"]];
const HASTA = 1.15;
function dibujarEncima(ctx, tj, ahora) {
  if (m.estado !== "juego" && m.estado !== "cuenta") return false;
  const v = vista(tj, ahora);
  // el sedal: de la punta de la caña a la boya, más recto cuanto más tenso
  const punta = m.modo === "3d" && enlace.punta ? enlace.punta : puntaPlana(v);
  const fin = m.modo === "3d" ? enlace.boya : v.sacada || !v.boya ? null : aPantalla(v.boya.x, 0.02, v.boya.z);
  if (punta && fin && (v.estado !== "pausa" || v.sacada)) {
    const comba = v.sacada ? 2 : v.estado === "pelea" ? Math.max(0, 1 - v.tension / 0.5) * 46 + 4 : 30 + 6 * Math.sin(v.s * 1.7);
    ctx.save();
    ctx.strokeStyle = v.estado === "pelea" && v.tension > TENSION.rompe ? "rgba(255,170,150,.95)" : "rgba(250,248,235,.8)";
    ctx.lineWidth = 1.2; ctx.lineCap = "round";
    const tiembla = v.estado === "pelea" && v.tension > TENSION.bien[1] && !reducido ? Math.sin(ahora / 14) * 1.6 * (v.tension - TENSION.bien[1]) * 6 : 0;
    ctx.beginPath(); ctx.moveTo(punta.x, punta.y);
    ctx.quadraticCurveTo((punta.x + fin.x) / 2 + tiembla, (punta.y + fin.y) / 2 + comba, fin.x, fin.y);
    ctx.stroke();
    ctx.restore();
  }
  if (m.estado !== "juego") return true;
  // el medidor
  const ancho = Math.min(m.ancho - 36, 400), x0 = (m.ancho - ancho) / 2, y0 = m.arriba + m.H * 0.925, alto = 14;
  const enPelea = v.estado === "pelea";
  ctx.save();
  ctx.globalAlpha = enPelea ? 1 : 0.35;
  const sacude = enPelea && v.tension > TENSION.rompe && !reducido ? Math.sin(ahora / 11) * 2.5 : 0;
  ctx.translate(sacude, 0);
  // fondo
  ctx.fillStyle = "rgba(7,6,10,.55)"; redondo(ctx, x0 - 5, y0 - 5, ancho + 10, alto + 10, 12); ctx.fill();
  ctx.save(); redondo(ctx, x0, y0, ancho, alto, 7); ctx.clip();
  for (const [a, b, color] of ZONAS) { ctx.fillStyle = color; ctx.fillRect(x0 + (a / HASTA) * ancho, y0, ((b - a) / HASTA) * ancho + 1, alto); }
  ctx.restore();
  // rótulos
  ctx.font = `800 11px Archivo, sans-serif`; ctx.textBaseline = "bottom"; ctx.fillStyle = "rgba(243,234,216,.85)";
  ctx.textAlign = "left"; ctx.fillText("FLOJO", x0, y0 - 9);
  ctx.textAlign = "center"; ctx.fillText("AHÍ", x0 + ((TENSION.bien[0] + TENSION.bien[1]) / 2 / HASTA) * ancho, y0 - 9);
  ctx.textAlign = "right"; ctx.fillText("SE ROMPE", x0 + ancho, y0 - 9);
  // la aguja
  if (enPelea) {
    const x = x0 + (Math.min(HASTA, Math.max(0, v.tension)) / HASTA) * ancho;
    ctx.fillStyle = "#f3ead8"; ctx.strokeStyle = "rgba(7,6,10,.8)"; ctx.lineWidth = 2;
    redondo(ctx, x - 4, y0 - 6, 8, alto + 12, 4); ctx.fill(); ctx.stroke();
    // cuánto le queda antes de perderla: un aro que se llena
    const apuro = Math.max(v.sobre, v.bajo);
    if (apuro > 0.02) {
      ctx.strokeStyle = v.sobre > v.bajo ? "#ff6a5c" : "#9fc0e6"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(x, y0 + alto / 2, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, apuro)); ctx.stroke();
    }
  }
  ctx.restore();
  // «¡PICA!»: bien grande, lo que dura la ocasión
  if (v.estado === "espera" && v.boya?.pica > 0 && v.boya.pica < 1) {
    const p = aPantalla(v.boya.x, 0.1, v.boya.z);
    ctx.save();
    ctx.font = `900 ${Math.round(46 + 6 * Math.sin(ahora / 50))}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillStyle = "#e9b44c"; ctx.shadowColor = "rgba(7,6,10,.8)"; ctx.shadowBlur = 12;
    ctx.fillText("¡PICA!", p.x, p.y - 34);
    ctx.restore();
  }
  void apretadoDesde; void SEDAL;
  return true;
}
function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── Dibujo en plano ──
function puntaPlana(v) {
  const dobla = v.estado === "pelea" ? Math.min(1.1, v.tension) : 0.1;
  return { x: m.campo.cx + m.campo.hw * (0.2 - 0.12 * dobla), y: m.arriba + m.H * (0.4 + 0.14 * dobla) };
}
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { ojo, hw } = m.campo;
  // el río
  const g = ctx.createLinearGradient(0, ojo, 0, m.alto);
  g.addColorStop(0, "rgba(70,130,125,.9)"); g.addColorStop(1, "#1f5a55");
  ctx.fillStyle = g; ctx.fillRect(0, ojo, m.ancho, m.alto - ojo);
  // las orillas
  ctx.fillStyle = "#4f7a34";
  for (const l of [-1, 1]) { const a = aPantalla(l * 1.9, 0, 0.5), b = aPantalla(l * 2.3, 0, -30); ctx.beginPath(); ctx.moveTo(a.x, m.alto); ctx.lineTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(l < 0 ? 0 : m.ancho, b.y); ctx.lineTo(l < 0 ? 0 : m.ancho, m.alto); ctx.closePath(); ctx.fill(); }
  // brillos que bajan
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { const z = -(((i * 1.7 + v.s * 1.2) % 14)), x = ((i * 37) % 30) / 10 - 1.5, p = aPantalla(x, 0, z); ctx.beginPath(); ctx.moveTo(p.x - 14 * p.f, p.y); ctx.lineTo(p.x + 14 * p.f, p.y); ctx.stroke(); }
  // la trucha clavada (su sombra) o la boya
  if (v.pez) {
    const p = aPantalla(v.pez.x, 0, v.pez.z), l = (v.pez.cm / 100) * hw * p.f * 1.6;
    ctx.fillStyle = "rgba(20,40,35,.6)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, l * 0.5, l * 0.16, Math.sin(v.s * 6) * 0.2, 0, Math.PI * 2); ctx.fill();
    if (v.pez.arreon) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, l * 0.8, l * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  if (v.boya && v.estado === "espera") {
    const p = aPantalla(v.boya.x, 0, v.boya.z), r = 7 * p.f * (hw / 180) + 3;
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (2 + v.boya.hunde * 2), r * (0.8 + v.boya.hunde), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#e23b2e"; ctx.beginPath(); ctx.arc(p.x, p.y - r * (0.6 - v.boya.hunde * 1.2), r, 0, Math.PI * 2); ctx.fill();
  }
  // la caña
  const punta = puntaPlana(v);
  ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(m.campo.cx + hw * 0.75, m.alto + 10); ctx.quadraticCurveTo(m.campo.cx + hw * 0.5, m.arriba + m.H * 0.6, punta.x, punta.y); ctx.stroke();
  // la que sale
  if (v.sacada) {
    const y = m.arriba + m.H * (0.62 - 0.14 * Math.sin(Math.min(1, v.sacada.k * 2) * Math.PI / 2)), l = (v.sacada.cm / 100) * hw * 1.9;
    ctx.save(); ctx.translate(m.campo.cx, y); ctx.rotate(Math.sin(v.s * 18) * 0.12);
    ctx.fillStyle = "#b08a3a"; ctx.beginPath(); ctx.ellipse(0, 0, l * 0.5, l * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-l * 0.45, 0); ctx.lineTo(-l * 0.62, -l * 0.12); ctx.lineTo(-l * 0.62, l * 0.12); ctx.fill();
    ctx.restore();
  }
}

m.arrancar();
