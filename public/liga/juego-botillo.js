// La torre del botillo: lo que se ve y se toca. Si un botillo se queda o se va al suelo lo decide motor-botillo.js,
// el mismo archivo con el que el servidor repite la partida. Aquí se escucha el toque, suena y se dibuja
// (3D en escena-botillo.js; en plano, aquí mismo, para los móviles sin 3D).
import {
  crearPartida, colgando, soltar, motivoInvalido, resumen, DURACION_MS, ANCHO, CAIDA_MS, MAX_FALLOS,
} from "./motor-botillo.js";
import { crearMarco, $, conRaton, reducido } from "./marco.js";

export const ALTO_B = 0.27; // alto de un botillo en la torre (en anchos de mesa)
export const SOBRE = 1.15; // a cuánto por encima de la torre cuelga el siguiente

function medirCampo(m) {
  const hw = Math.min(m.ancho / 2 - 10, m.H * 0.32);
  m.campo = { cx: m.ancho / 2, hw, yMesa: m.arriba + m.H * 0.8 };
}

let partida = null;
let resultados = []; // lo que devuelve soltar(), con «visto» cuando ya se ha enseñado
let elev = 0, antes = 0;

const TEXTO = conRaton
  ? { pista: "Haz clic cuando el botillo esté encima de la torre.", regla: "Haz clic y la grúa lo suelta." }
  : { pista: "Toca cuando el botillo esté encima de la torre.", regla: "Toca la pantalla y la grúa lo suelta." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "botillo",
  nombre: "La torre del botillo",
  duracionMs: DURACION_MS,
  fondo: "fondos/botillo",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ toques: p.toques.slice() }),
  final: (r) => ({
    datos: [["Altura", r.altura], ["Clavados", r.clavados], ["Mejor racha", r.mejorRacha]],
    anuncio: `Fin. ${r.puntos} puntos: una torre de ${r.altura} botillos, ${r.clavados} clavados.`,
    compartir: `He hecho una torre de ${r.altura} botillos delante de Botines: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-botillo.js"),
  medir: medirCampo,
  empezar(p) { partida = p; resultados = []; elev = 0; },
  actualizar(tj) {
    for (const r of resultados) if (!r.visto && tj >= r.llega) { r.visto = true; efecto(r); }
    const ultimo = resultados.length ? resultados[resultados.length - 1].llega : 0;
    if (partida.terminada) return tj >= ultimo + 900;
    return tj >= Math.max(DURACION_MS, ultimo) + 250;
  },
  chip: () => {
    if (!partida) return null;
    const f = resultados.filter((r) => r.visto && !r.apoyado).length;
    const puntos = Array.from({ length: MAX_FALLOS }, (_, i) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${i < MAX_FALLOS - f ? "#e9b44c" : "rgba(243,234,216,.25)"}"></span>`).join("");
    return `${puntos}<span>${MAX_FALLOS - f === 1 ? "Te queda 1" : `Te quedan ${MAX_FALLOS - f}`}</span>`;
  },
  datos3d: (tj, ahora) => ({ vista: vista(tj, ahora) }),
  dibujarPlano,
  sonidos: {
    // botillo sobre botillo: blando y gordo
    golpe: (s, t, f, { tono, ruido }) => { tono({ fr: 140, a: 80, g: 0.28 * f, dur: 0.12 }); ruido({ dur: 0.05, fr: 500, g: 0.1 * f }); },
    grua: (s, t, f, { tono }) => { tono({ fr: 900, a: 600, g: 0.03, dur: 0.08, tipo: "triangle" }); },
  },
});

// ── Toque ──
$("lienzo").addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego" || !partida) return;
  e.preventDefault();
  const t = Math.round(m.tj());
  if (motivoInvalido(partida, t)) return; // no hay botillo colgando: no pasa nada
  resultados.push({ ...soltar(partida, t), visto: false });
  m.sonar("grua");
  m.pista(null);
});

function efecto(r) {
  const p = aPantalla(r.xf, (r.altura - (r.apoyado ? 1 : 0)) * ALTO_B + ALTO_B * 1.5);
  if (r.apoyado) {
    m.sonar("golpe", r.clavado ? 1.2 : 1);
    m.vibrar(r.clavado ? [10, 30, 10] : 10);
    if (r.clavado) { m.sonar("oro"); m.aviso(`¡CLAVADO! +${r.ganados}`, "oro", p.x, p.y); }
    else m.aviso(`+${r.ganados}`, "bien", p.x, p.y);
    if (r.racha === 5) m.avisoNivel("¡5 seguidos! Ahora +1 por botillo");
    if (r.altura === 10) m.avisoNivel("¡10 de altura! Ya pasas de la puerta");
    m.anunciar(`${r.clavado ? "Clavado" : "Se queda"}. ${r.altura} de altura.`);
  } else {
    m.sonar("mal"); m.vibrar(40);
    m.aviso("¡Al suelo!", "mal", p.x, p.y);
    const f = resultados.filter((x) => x.visto && !x.apoyado).length;
    m.anunciar(r.fin ? "Tercer botillo al suelo. Se acabó." : `Al suelo. Te ${MAX_FALLOS - f === 1 ? "queda 1" : `quedan ${MAX_FALLOS - f}`}.`);
  }
  const racha = r.racha >= 2 ? { texto: `${r.racha}`, sub: "SEGUIDOS" } : null;
  m.pintarPuntos(sumaVista(), r.apoyado, racha);
}
// puntos de lo que ya se ha visto caer (el motor va un poco por delante)
function sumaVista() { return resultados.filter((r) => r.visto).reduce((s, r) => s + r.ganados, 0); }

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj, ahora) {
  const torre = [], cayendo = [], caidos = [];
  let altura = 0;
  for (const r of resultados) {
    if (tj >= r.llega) {
      if (r.apoyado) { torre.push({ x: r.xf, y: altura * ALTO_B, n: r.n }); altura++; }
      else {
        const s = (tj - r.llega) / 1000;
        if (s < 1.6) {
          const lado = r.dx >= 0 ? 1 : -1;
          caidos.push({ n: r.n, x: r.x + lado * (0.25 + 1.1 * s), y: altura * ALTO_B + 0.05 - 4.9 * s * s - 0.6 * s, giro: lado * (0.6 + s * 5) });
        }
      }
    } else if (tj >= r.t) { // cayendo
      const u = (tj - r.t) / CAIDA_MS;
      const y0 = altura * ALTO_B + SOBRE;
      cayendo.push({ n: r.n, x: r.x, y: y0 - (y0 - altura * ALTO_B) * u * u, giro: 0 });
    }
  }
  // la cámara sube con la torre (despacio, como una grúa)
  const quiere = Math.max(0, altura * ALTO_B - 0.9);
  const dt = Math.min(0.1, Math.max(0, (ahora - (antes || ahora)) / 1000)); antes = ahora;
  elev += (quiere - elev) * (reducido ? 1 : 1 - Math.exp(-dt * 3));
  if (!partida || m.estado === "inicio") elev = 0;
  // el que cuelga (si no hay ninguno cayendo)
  let cuelga = null;
  if (partida && !cayendo.length && (m.estado === "juego" || m.estado === "cuenta")) {
    const c = colgando(partida, Math.max(0, tj));
    if (c) {
      const ya = Math.min(1, (tj - c.desde) / 260); // la grúa lo baja
      const c2 = colgando(partida, Math.max(c.desde, tj - 30));
      cuelga = { n: c.n, x: c.x, y: altura * ALTO_B + SOBRE + 0.5 * (1 - ya) ** 2, giro: Math.max(-0.35, Math.min(0.35, (c.x - (c2?.x ?? c.x)) * -4)) };
    }
  } else if (!partida) cuelga = { n: 0, x: 0.25 * Math.sin(ahora / 900), y: SOBRE, giro: -0.15 * Math.cos(ahora / 900) };
  return { torre, cayendo, caidos, cuelga, elev, altura };
}

// ── Dibujo en plano ──
const aPantalla = (x, y) => ({ x: m.campo.cx + x * m.campo.hw, y: m.campo.yMesa - (y - elev) * m.campo.hw });
function botillo(ctx, x, y, giro, alfa = 1) {
  const p = aPantalla(x, y + ALTO_B / 2), r = (ANCHO / 2) * m.campo.hw;
  ctx.save(); ctx.globalAlpha *= alfa; ctx.translate(p.x, p.y); ctx.rotate(giro);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#d4553a"); g.addColorStop(0.6, "#9b2a1a"); g.addColorStop(1, "#4d1009");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(20,4,2,.5)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#efe2c4"; ctx.fillRect(-r * 0.1, -r * 0.95, r * 0.2, r * 0.22); // el atado
  ctx.restore();
}
function dibujarPlano(ctx, tj, ahora) {
  const v = vista(tj, ahora);
  const { cx, hw } = m.campo;
  // mesa con mantel de cuadros
  const yM = aPantalla(0, 0).y;
  ctx.fillStyle = "#b8392e"; ctx.fillRect(0, yM, m.ancho, m.alto - yM);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  const c = 22;
  for (let y = yM; y < m.alto; y += c) for (let x = ((y - yM) / c) % 2 ? c : 0; x < m.ancho; x += 2 * c) ctx.fillRect(x, y, c, c);
  ctx.fillStyle = "#6f3a1d"; ctx.beginPath(); ctx.ellipse(cx, yM, hw * 0.3, hw * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  for (const b of v.torre) botillo(ctx, b.x, b.y, 0);
  for (const b of v.cayendo) botillo(ctx, b.x, b.y, b.giro);
  for (const b of v.caidos) botillo(ctx, b.x, b.y, b.giro, 0.9);
  if (v.cuelga) {
    const a = aPantalla(v.cuelga.x, v.cuelga.y + ALTO_B);
    ctx.strokeStyle = "rgba(30,30,30,.8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, 0); ctx.lineTo(a.x, a.y); ctx.stroke();
    botillo(ctx, v.cuelga.x, v.cuelga.y, v.cuelga.giro);
  }
}

m.arrancar();
