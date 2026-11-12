// Los maragatos del reloj: lo que se ve y se toca. Qué toque vale y cuánto lo decide motor-maragatos.js, el mismo
// archivo con el que el servidor repite la partida. Aquí se escuchan los toques, suena y se dibuja (3D en
// escena-maragatos.js; las marcas que bajan van siempre en plano, encima, para que se lean bien).
import {
  crearPartida, tocar, avanzar, resumen, tiempoHecho, compasEn, multiplicador,
  DURACION_MS, SEPARACION_MIN_MS, VIAJE_MS, MARGEN, FIN_MS,
} from "./motor-maragatos.js";
import { crearMarco, $, conRaton } from "./marco.js";

// Medidas en anchos de media pantalla. Los carriles por donde bajan las marcas y el aro donde hay que tocarlas.
export const CARRIL = 0.78, ARO_Y = 0.52, DESDE_Y = 3.1, RADIO = 0.115;
const NOTA = { clavada: "¡Clavada!", buena: "Buena", justa: "Justa" };

let partida = null;
let golpes = [-1e9, -1e9]; // cuándo dio el último mazazo cada uno
let campanada = { t: -1e9, lado: 0, fuerza: 0 };
let destellos = []; // { t, lado, nota }
let compasVisto = -1, tramoVisto = 0;

const TEXTO = conRaton
  ? { pista: "Pulsa a la izquierda o a la derecha cuando la marca llegue al aro.", regla: "Pulsa la izquierda o la derecha de la pantalla cuando la marca llegue al aro." }
  : { pista: "Toca a la izquierda o a la derecha cuando la marca llegue al aro.", regla: "Toca la izquierda o la derecha de la pantalla cuando la marca llegue al aro." };
$("regla-gesto").textContent = TEXTO.regla;

function medirCampo(m) {
  const hw = Math.min((m.ancho / 2 - 6) / 0.93, m.H * 0.25);
  m.campo = { cx: m.ancho / 2, hw, yBase: m.arriba + m.H * 0.9 };
}
const aPantalla = (x, y) => ({ x: m.campo.cx + x * m.campo.hw, y: m.campo.yBase - y * m.campo.hw });

const m = crearMarco({
  id: "maragatos",
  nombre: "Los maragatos del reloj",
  duracionMs: DURACION_MS,
  fondo: "fondos/tarde",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ toques: p.toques.slice() }),
  final: (r) => ({
    datos: [["Clavadas", r.clavadas], ["Campanadas", `${r.tocadas}/${r.notas}`], ["Seguidas", r.mejorRacha]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.tocadas} campanadas de ${r.notas}, ${r.clavadas} clavadas.`,
    compartir: `He dado ${r.tocadas} campanadas con los maragatos del reloj de Astorga, ${r.mejorRacha} seguidas: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-maragatos.js"),
  medir: medirCampo,
  empezar(p) { partida = p; golpes = [-1e9, -1e9]; campanada = { t: -1e9, lado: 0, fuerza: 0 }; destellos = []; compasVisto = -1; tramoVisto = 0; },
  actualizar(tj) {
    for (const e of avanzar(partida, tj)) efecto(e);
    // el compás: un tic por golpe (más fuerte el primero de cada cuatro)
    const c = compasEn(tj + 20);
    if (c && c.t !== compasVisto) {
      compasVisto = c.t; m.sonar("tic", c.n % 4 === 0 ? 1.6 : 1);
      if (c.tramo !== tramoVisto) { tramoVisto = c.tramo; m.avisoNivel(c.tramo === 1 ? "¡Más vivo!" : "¡A rebato!"); }
    }
    return tj >= Math.max(FIN_MS + 900, DURACION_MS - 200);
  },
  chip: () => {
    if (!partida) return null;
    const por = multiplicador(partida.racha);
    return por > 1 ? `<span>Puntos ×${por}</span>` : null;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  dibujarEncima,
  sonidos: {
    // campanada: el tono y sus parciales, que se apagan despacio
    campana: (s, t, f, { tono }) => {
      const fr = f > 1 ? 587 : 440, g = 0.11;
      tono({ fr, g, dur: 0.9, tipo: "sine" }); tono({ fr: fr * 2.0, g: g * 0.5, dur: 0.6 }); tono({ fr: fr * 2.76, g: g * 0.32, dur: 0.4 }); tono({ fr: fr * 0.5, g: g * 0.5, dur: 1.1 }); tono({ fr: fr * 5.4, g: g * 0.12, dur: 0.12, tipo: "triangle" });
    },
    // mazazo flojo (nota «justa») y en falso
    sordo: (s, t, f, { tono, ruido }) => { tono({ fr: 220, a: 180, g: 0.09, dur: 0.18, tipo: "triangle" }); ruido({ dur: 0.05, fr: 1800, g: 0.1 }); },
    tic: (s, t, f, { tono }) => tono({ fr: f > 1.2 ? 1320 : 990, g: 0.035 * f, dur: 0.035, tipo: "square" }),
  },
});

// ── Toques: mitad izquierda, el maragato; mitad derecha, la maragata. Valen varios dedos a la vez ──
const lienzo = $("lienzo");
lienzo.addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego" || !partida) return;
  e.preventDefault();
  const lado = e.clientX < m.ancho / 2 ? 0 : 1;
  const n = partida.toques.length;
  let t = Math.max(Math.round(m.tj()), tiempoHecho(partida), n ? partida.ultimoT : 0);
  if (n && partida.toques[n - 1] === lado && t < partida.ultimoT + SEPARACION_MIN_MS) t = partida.ultimoT + SEPARACION_MIN_MS;
  if (t > DURACION_MS) return;
  try { tocar(partida, t, lado); golpes[lado] = t; m.pista(null); } catch { /* demasiados: se ignora */ }
});

function efecto(e) {
  if (e.tipo === "nota") {
    campanada = { t: e.t, lado: e.lado, fuerza: e.nota === "clavada" ? 1 : e.nota === "buena" ? 0.7 : 0.4 };
    destellos.push({ t: e.t, lado: e.lado, nota: e.nota });
    if (destellos.length > 8) destellos.shift();
    m.sonar(e.nota === "justa" ? "sordo" : "campana", e.lado ? 2 : 1);
    if (e.nota === "clavada") m.vibrar(12);
    const p = aPantalla(e.lado ? 0.48 : -0.48, ARO_Y + 0.3);
    m.aviso(`${NOTA[e.nota]} +${e.ganados}`, e.nota === "clavada" ? "oro" : "bien", p.x, p.y);
    m.pintarPuntos(partida.puntos, true, e.racha >= 5 ? { texto: `${e.racha}`, sub: "SEGUIDAS" } : null);
  } else if (e.tipo === "perdida") {
    destellos.push({ t: e.t, lado: e.lado, nota: "perdida" });
    m.pintarPuntos(partida.puntos, false, null);
  } else if (e.tipo === "falso") {
    m.sonar("sordo");
    const p = aPantalla(e.lado ? 0.48 : -0.48, ARO_Y + 0.3);
    m.aviso("En falso −2", "mal", p.x, p.y);
    m.pintarPuntos(partida.puntos, false, null);
  }
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  if (!partida || m.estado === "inicio") {
    // en el menú dan la hora despacio, uno y otro
    const s = ahora, n = Math.floor(s / 1400);
    const g = [n % 2 === 0 ? n * 1400 : (n - 1) * 1400, n % 2 === 1 ? n * 1400 : (n - 1) * 1400];
    return { tj: s, golpes: g, campanada: { t: n * 1400, lado: n % 2, fuerza: 0.6 }, avance: (s / 60000) % 1, menu: true, pulso: 0 };
  }
  const c = compasEn(tj);
  return { tj, golpes, campanada, avance: Math.min(1, tj / DURACION_MS), menu: false, pulso: c ? 1 - Math.min(1, (tj - c.t) / (c.golpe * 0.5)) : 0 };
}

// ── Los carriles, los aros y las marcas que bajan (encima de todo, en plano) ──
function dibujarEncima(ctx, tj) {
  if (m.estado !== "juego" || !partida) return false;
  const hw = m.campo.hw, r = RADIO * hw;
  const c = compasEn(tj), late = c ? 1 - Math.min(1, (tj - c.t) / 180) : 0;
  ctx.save();
  for (const lado of [0, 1]) {
    const x = aPantalla(lado ? CARRIL : -CARRIL, 0).x, y0 = aPantalla(0, DESDE_Y).y, y1 = aPantalla(0, ARO_Y).y;
    // el carril
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(10,8,12,0)"); g.addColorStop(0.5, "rgba(10,8,12,.28)"); g.addColorStop(1, "rgba(10,8,12,.5)");
    ctx.fillStyle = g; ctx.fillRect(x - r * 1.15, y0, r * 2.3, y1 - y0 + r * 1.4);
    // el aro (late con el compás)
    ctx.lineWidth = 4 + 2 * late; ctx.strokeStyle = `rgba(246,226,170,${0.75 + 0.25 * late})`;
    ctx.beginPath(); ctx.arc(x, y1, r * (1.08 + 0.04 * late), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(10,8,12,.45)"; ctx.beginPath(); ctx.arc(x, y1, r, 0, Math.PI * 2); ctx.fill();
  }
  // destellos de lo que se acaba de tocar
  for (const d of destellos) {
    const k = (tj - d.t) / 320;
    if (k < 0 || k > 1) continue;
    const p = aPantalla(d.lado ? CARRIL : -CARRIL, ARO_Y);
    if (d.nota === "perdida") { ctx.strokeStyle = `rgba(226,69,47,${0.8 * (1 - k)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.08, 0, Math.PI * 2); ctx.stroke(); continue; }
    ctx.strokeStyle = d.nota === "clavada" ? `rgba(255,214,110,${1 - k})` : `rgba(243,234,216,${0.8 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.1 + 1.1 * k), 0, Math.PI * 2); ctx.stroke();
  }
  // las marcas
  const N = partida.notas;
  for (let i = partida.primera; i < N.length; i++) {
    const n = N[i];
    if (n.t - tj > VIAJE_MS) break;
    if (n.estado !== "viene") continue;
    const u = 1 - (n.t - tj) / VIAJE_MS; // 0 arriba … 1 en el aro (y sigue un poco)
    const p = aPantalla(n.lado ? CARRIL : -CARRIL, DESDE_Y + (ARO_Y - DESDE_Y) * u);
    const pasada = tj > n.t + MARGEN.buena;
    ctx.globalAlpha = Math.min(1, u * 5) * (pasada ? 0.4 : 1);
    const gr = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    gr.addColorStop(0, n.doble ? "#fff3c4" : "#ffe9a8"); gr.addColorStop(0.55, n.doble ? "#f08a3c" : "#e9b44c"); gr.addColorStop(1, n.doble ? "#a8431a" : "#9a6a1c");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(40,24,6,.7)"; ctx.lineWidth = 2; ctx.stroke();
    // el badajo dibujado dentro: una campanita
    ctx.fillStyle = "rgba(60,36,8,.75)";
    ctx.beginPath(); ctx.moveTo(p.x - r * 0.42, p.y + r * 0.3); ctx.quadraticCurveTo(p.x - r * 0.36, p.y - r * 0.5, p.x, p.y - r * 0.5); ctx.quadraticCurveTo(p.x + r * 0.36, p.y - r * 0.5, p.x + r * 0.42, p.y + r * 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y + r * 0.42, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // las dos a la vez: una barra que las une
  for (let i = partida.primera; i < N.length - 1; i++) {
    const n = N[i];
    if (n.t - tj > VIAJE_MS) break;
    if (!n.doble || n.lado !== 0 || n.estado !== "viene" || N[i + 1].estado !== "viene") continue;
    const u = 1 - (n.t - tj) / VIAJE_MS, a = aPantalla(-CARRIL, DESDE_Y + (ARO_Y - DESDE_Y) * u), b = aPantalla(CARRIL, 0);
    ctx.strokeStyle = `rgba(240,138,60,${0.55 * Math.min(1, u * 5)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x + r, a.y); ctx.lineTo(b.x - r, a.y); ctx.stroke();
  }
  ctx.restore();
  return true;
}

// ── Dibujo en plano: la espadaña, la campana y los dos maragatos, en siluetas ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), hw = m.campo.hw, P = aPantalla;
  const caja = (x0, y0, x1, y1, color) => { const a = P(x0, y1), b = P(x1, y0); ctx.fillStyle = color; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); };
  caja(-3, -1, 3, 1.0, "#bfae8f"); caja(-3, 0.96, 3, 1.08, "#8f8068");
  const reloj = P(0, 0.42);
  ctx.fillStyle = "#f4efe2"; ctx.beginPath(); ctx.arc(reloj.x, reloj.y, 0.3 * hw, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#2a2420"; ctx.lineWidth = 4; ctx.stroke();
  const ang = v.avance * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(reloj.x, reloj.y); ctx.lineTo(reloj.x + Math.cos(ang) * 0.25 * hw, reloj.y + Math.sin(ang) * 0.25 * hw); ctx.stroke();
  // la campana (se mece al darle)
  const dc = (tj - v.campanada.t) / 1000, mece = dc >= 0 && dc < 1.2 ? 0.22 * v.campanada.fuerza * Math.sin(dc * 14) * Math.exp(-dc * 3) * (v.campanada.lado ? -1 : 1) : 0;
  const eje = P(0, 2.0);
  ctx.save(); ctx.translate(eje.x, eje.y); ctx.rotate(mece);
  ctx.fillStyle = "#b08a3c"; ctx.beginPath(); ctx.moveTo(-0.26 * hw, 0.5 * hw); ctx.quadraticCurveTo(-0.2 * hw, 0.02 * hw, 0, 0.02 * hw); ctx.quadraticCurveTo(0.2 * hw, 0.02 * hw, 0.26 * hw, 0.5 * hw); ctx.closePath(); ctx.fill();
  ctx.restore();
  for (const lado of [0, 1]) {
    const s = lado ? 1 : -1, x = P(s * 0.5, 0).x, pie = P(0, 1.08).y;
    const dg = tj - v.golpes[lado], pega = dg >= 0 && dg < 220 ? Math.sin((dg / 220) * Math.PI) : 0;
    ctx.fillStyle = lado ? "#8f1d24" : "#1c1a18"; ctx.fillRect(x - 0.09 * hw, pie - 0.5 * hw, 0.18 * hw, 0.5 * hw);
    ctx.fillStyle = "#d9a87e"; ctx.beginPath(); ctx.arc(x, pie - 0.58 * hw, 0.07 * hw, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#6a4426"; ctx.lineWidth = 0.035 * hw; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - s * 0.06 * hw, pie - 0.42 * hw); ctx.lineTo(x - s * (0.12 + 0.14 * pega) * hw, pie - (0.62 - 0.2 * pega) * hw); ctx.stroke();
  }
}

m.arrancar();
