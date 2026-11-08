// La Vidriera: lo que se ve y se toca. Qué serie sale y si aciertas lo decide motor-vidriera.js, el mismo archivo con
// el que el servidor repite la partida. Aquí se escucha el toque, suena y se dibuja (3D en escena-vidriera.js; en
// plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, tocar, avanzar, encendida, paso, resumen, DURACION_MS, PANELES, ABRE_MS,
} from "./motor-vidriera.js";
import { crearMarco, $, conRaton, reducido } from "./marco.js";

// Colores de las 8 vidrieras (de arriba, en el sentido del reloj). Bien distintos para poder recordarlos.
export const COLORES = ["#d0262e", "#f0b62e", "#2fa45a", "#2d62d6", "#9444c0", "#ec7a26", "#25aeb8", "#e0558a"];
// Una nota por vidriera (pentatónica: suenan bien en cualquier orden)
const NOTAS = [523, 587, 659, 784, 880, 1047, 1175, 1319];

// Contorno de la vidriera i (unidades: radio del rosetón = 1; y hacia arriba). Lo usan el plano y el 3D.
// Entre vidriera y vidriera queda una barra de piedra del mismo ancho de arriba abajo.
export const R_DENTRO = 0.3, R_HOMBRO = 0.7, R_PUNTA = 0.95, BARRA = 0.05;
export function contorno(i, pasos = 10) {
  const a = (i * 2 * Math.PI) / PANELES, w = (r) => Math.PI / PANELES - BARRA / 2 / r;
  const p = (r, ang) => [r * Math.sin(ang), r * Math.cos(ang)];
  const pts = [];
  for (let j = 0; j <= pasos; j++) pts.push(p(R_DENTRO, a + w(R_DENTRO) * (1 - (2 * j) / pasos))); // dentro, de der. a izq.
  for (let j = 0; j <= pasos; j++) { const r = R_DENTRO + ((R_HOMBRO - R_DENTRO) * j) / pasos; pts.push(p(r, a - w(r))); }
  // arco apuntado (ojival): dos arcos de círculo que se juntan en la punta, aplastados para que quepan
  const W = w(R_HOMBRO) * R_HOMBRO, f = (R_PUNTA - R_HOMBRO) / (Math.sqrt(3) * W);
  for (let j = 1; j <= pasos * 2; j++) {
    const u = j / (pasos * 2), lado = u <= 0.5 ? -1 : 1, th = (Math.PI / 3) * (u <= 0.5 ? u * 2 : 2 - u * 2);
    const x = lado * (2 * W * Math.cos(th) - W), r = R_HOMBRO + 2 * W * Math.sin(th) * f;
    pts.push(p(r, a + x / r));
  }
  for (let j = 1; j < pasos; j++) { const r = R_HOMBRO - ((R_HOMBRO - R_DENTRO) * j) / pasos; pts.push(p(r, a + w(r))); }
  return pts;
}

function medirCampo(m) {
  const R = Math.min(m.ancho * 0.38, m.H * 0.27);
  m.campo = { cx: m.ancho / 2, cy: m.arriba + m.H * 0.5, R };
}

let partida = null;
let mostradas = new Set(); // luces de la serie que ya han sonado
let toquesVistos = []; // { panel, t, bien, esperado }

const TEXTO = conRaton
  ? { pista: "Mira el orden en que se encienden y haz clic en ellas igual.", regla: "Luego haz clic en las vidrieras en el mismo orden." }
  : { pista: "Mira el orden en que se encienden y tócalas igual.", regla: "Luego tócalas en el mismo orden." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "vidriera",
  nombre: "La Vidriera",
  duracionMs: DURACION_MS,
  fondo: "fondos/vidriera",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ toques: p.toques.slice() }),
  final: (r) => ({
    datos: [["Series", r.series], ["La más larga", r.mejorSerie], ["Fallos", r.fallos]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.series} series, la más larga de ${r.mejorSerie}.`,
    compartir: `He repetido una serie de ${r.mejorSerie} vidrieras del rosetón de la Catedral de León: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-vidriera.js"),
  medir: medirCampo,
  empezar(p) { partida = p; mostradas = new Set(); toquesVistos = []; },
  actualizar(tj) {
    for (const r of avanzar(partida, tj)) efecto(r);
    const luz = encendida(partida, tj);
    if (luz >= 0) {
      const clave = `${partida.ronda}-${Math.floor((tj - partida.desde) / paso(partida.largo))}`;
      if (!mostradas.has(clave)) { mostradas.add(clave); m.sonar("nota", luz); }
    }
    if (tj >= partida.abre && !mostradas.has(`turno-${partida.ronda}`)) {
      mostradas.add(`turno-${partida.ronda}`);
      if (partida.ronda < 2) m.pista(conRaton ? "Ahora tú: haz clic en el mismo orden." : "Ahora tú: tócalas en el mismo orden.");
    }
    return tj >= DURACION_MS + 300;
  },
  chip: (tj) => {
    if (!partida) return null;
    if (tj < partida.abre) return `<span>Mira · serie de ${partida.largo}</span>`;
    const pt = Array.from({ length: partida.largo }, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i < partida.hechos ? "#e9b44c" : "rgba(243,234,216,.25)"}"></span>`).join("");
    return `${pt}<span>Tu turno</span>`;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  sonidos: {
    nota: (s, t, f, { tono }) => {
      const fr = NOTAS[f] || 660;
      tono({ fr, g: 0.11, dur: 0.42, tipo: "triangle" });
      tono({ fr: fr * 2, g: 0.025, dur: 0.3 });
    },
  },
});

// ── Toque: la vidriera es la del ángulo desde el centro del rosetón ──
export function panelEn(x, y) {
  const { cx, cy, R } = m.campo;
  const dx = x - cx, dy = cy - y, d = Math.hypot(dx, dy);
  if (d < R * 0.18 || d > R * 1.6) return -1;
  let ang = Math.atan2(dx, dy); if (ang < 0) ang += 2 * Math.PI;
  return Math.floor((ang + Math.PI / PANELES) / ((2 * Math.PI) / PANELES)) % PANELES;
}
$("lienzo").addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego" || !partida) return;
  e.preventDefault();
  const t = Math.round(m.tj());
  if (t > DURACION_MS || t <= partida.ultimoT || t < partida.abre) return; // mientras se enseña la serie, no cuenta
  const panel = panelEn(e.clientX, e.clientY);
  if (panel < 0) return;
  const { solas, r } = tocar(partida, t, panel);
  for (const x of solas) efecto(x);
  if (r) efecto(r);
});

function efecto(r) {
  toquesVistos.push(r);
  if (toquesVistos.length > 30) toquesVistos.shift();
  const { cx, cy, R } = m.campo;
  const px = cx, py = cy - R * 1.35;
  if (r.bien) {
    m.sonar("nota", r.panel);
    m.vibrar(6);
    if (r.completa) {
      setTimeout(() => m.sonar(r.largo >= 6 ? "oro" : "bien", 1.2), 120);
      m.aviso(`¡Serie de ${r.largo}! +${r.ganados}`, r.largo >= 6 ? "oro" : "bien", px, py);
      m.anunciar(`Bien: serie de ${r.largo}. Ahora una de ${r.largo + 1}.`);
      if (r.racha === 3) m.avisoNivel("¡3 series seguidas! Ahora +1 por toque");
      m.pista(null);
    }
  } else {
    m.sonar("mal"); m.vibrar(40);
    m.aviso(r.motivo === "tarde" ? "¡Tarde!" : "¡Esa no!", "mal", px, py);
    m.anunciar(r.motivo === "tarde" ? "Se acabó el tiempo de esa serie." : "Esa no era. Viene otra serie.");
  }
  const racha = partida.racha >= 2 ? { texto: `${partida.racha}`, sub: "SERIES" } : null;
  m.pintarPuntos(partida.puntos, r.bien, racha);
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
// brillo[i] entre 0 y 1; mal[i] = la que tocaste mal; ojo[i] = la que tocaba (parpadea)
export function vista(tj, ahora) {
  const brillo = new Array(PANELES).fill(0), mal = new Array(PANELES).fill(0), ojo = new Array(PANELES).fill(0);
  let fase = "menu";
  if (!partida || m.estado === "inicio") {
    // en el menú, una luz da vueltas despacio
    const u = ahora / 700;
    for (let i = 0; i < PANELES; i++) { const d = ((u - i) % PANELES + PANELES) % PANELES; brillo[i] = reducido ? 0.2 : Math.max(0, 1 - d / 2.2) * 0.8; }
  } else {
    fase = tj < partida.abre ? "mira" : "toca";
    if (fase === "mira" && tj >= partida.desde) {
      const ps = paso(partida.largo), i = Math.floor((tj - partida.desde) / ps), dentro = tj - partida.desde - i * ps;
      if (i < partida.largo) brillo[partida.serie[i]] = Math.max(0, Math.min(1, dentro / 50, (ps * 0.68 - dentro) / 70 + 0.15));
    }
    for (const r of toquesVistos) {
      const s = tj - r.t;
      if (s < 0) continue;
      if (r.bien && s < 300) brillo[r.panel] = Math.max(brillo[r.panel], 1 - s / 300);
      if (!r.bien && s < 900) {
        if (r.panel >= 0) mal[r.panel] = Math.max(mal[r.panel], 1 - s / 900);
        if (r.esperado >= 0) ojo[r.esperado] = Math.max(ojo[r.esperado], (Math.floor(s / 150) % 2 ? 0.25 : 0.9) * (1 - s / 900));
      }
    }
  }
  const ultima = toquesVistos.length ? toquesVistos[toquesVistos.length - 1] : null;
  return { brillo, mal, ojo, fase, tj, completa: ultima?.completa ? ultima.t : -1e9, abre: partida ? partida.abre - ABRE_MS : 0 };
}

// ── Dibujo en plano ──
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora), { cx, cy, R } = m.campo;
  const aP = ([x, y]) => [cx + x * R, cy - y * R];
  // piedra
  ctx.fillStyle = "#d9cdb6"; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a8997e"; ctx.lineWidth = R * 0.04; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < PANELES; i++) {
    const pts = contorno(i, 6).map(aP);
    ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const b = Math.max(v.brillo[i], v.ojo[i]);
    ctx.save();
    ctx.fillStyle = "#1a1420"; ctx.fill();
    ctx.globalAlpha = 0.35 + 0.65 * b;
    ctx.fillStyle = v.mal[i] > 0 ? "#3a0d0d" : COLORES[i];
    if (b > 0.05) { ctx.shadowColor = COLORES[i]; ctx.shadowBlur = R * 0.3 * b; }
    ctx.fill();
    ctx.restore();
  }
  // el centro
  ctx.fillStyle = "#bfae90"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3070"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2); ctx.fill();
}

m.arrancar();
