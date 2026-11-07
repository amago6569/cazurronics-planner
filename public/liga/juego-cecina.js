// La loncha de cecina: lo que se ve y se toca. El grosor de cada loncha y sus puntos los decide motor-cecina.js,
// el mismo archivo con el que el servidor repite la partida. Aquí se escucha el toque, suena y se dibuja
// (3D en escena-cecina.js; en plano, aquí mismo, para los móviles sin 3D).
import { crearPartida, cortar, avanzar, grosorEn, resumen, DURACION_MS, MAXIMO } from "./motor-cecina.js";
import { crearMarco, $, conRaton } from "./marco.js";

export const GROSOR = 0.1; // lo que mide en pantalla una loncha buena (en unidades del campo)

function medirCampo(m) {
  const k = Math.min(m.ancho / 1.8, m.H * 0.28);
  m.campo = { cx: m.ancho / 2, k, yCorte: m.arriba + m.H * 0.64 };
}

let partida = null;
let lonchas = []; // las cortadas, con el ms en que se cortaron (para animarlas)

const TEXTO = conRaton
  ? { pista: "Haz clic cuando el borde llegue a la raya dorada.", regla: "Haz clic para cortar." }
  : { pista: "Toca cuando el borde llegue a la raya dorada.", regla: "Toca la pantalla para cortar." };
$("regla-gesto").textContent = TEXTO.regla;

const m = crearMarco({
  id: "cecina",
  nombre: "La loncha de cecina",
  duracionMs: DURACION_MS,
  fondo: "fondos/cecina",
  textoPista: () => TEXTO.pista,
  crearPartida,
  resumen,
  datosLiga: (p) => ({ toques: p.toques.slice() }),
  final: (r) => ({
    datos: [["De papel", r.papel], ["Finas", r.finas], ["Mejor racha", r.mejorRacha]],
    anuncio: `Se acabó. ${r.puntos} puntos: ${r.lonchas} lonchas, ${r.papel} de papel.`,
    compartir: `He cortado ${r.papel} lonchas de cecina finas como el papel: ${r.puntos} puntos. ¿Me superas?`,
  }),
  cargar3d: () => import("./escena-cecina.js"),
  medir: medirCampo,
  empezar(p) { partida = p; lonchas = []; },
  actualizar(tj) {
    for (const l of avanzar(partida, tj)) efecto(l);
    return tj >= DURACION_MS + 350;
  },
  datos3d: (tj) => ({ vista: vista(tj) }),
  dibujarPlano,
  sonidos: {
    corte: (s, t, f, { ruido, tono }) => { ruido({ dur: 0.12, fr: 5200, q: 1.4, g: 0.25 }); tono({ fr: 1800, a: 1200, g: 0.03, dur: 0.1, tipo: "sawtooth" }); },
  },
});

$("lienzo").addEventListener("pointerdown", (e) => {
  if (m.estado !== "juego" || !partida) return;
  e.preventDefault();
  const t = Math.round(m.tj());
  if (t > DURACION_MS || t <= partida.ultimoT) return;
  const { solas, loncha } = cortar(partida, t);
  for (const l of solas) efecto(l);
  if (loncha) efecto(loncha);
  m.pista(null);
});

const TEXTO_NOTA = { papel: "¡De papel!", fina: "Fina", vale: "Vale", gorda: "Muy gorda", rota: "Se rompe" };
function efecto(l) {
  lonchas.push(l);
  if (lonchas.length > 60) lonchas.shift();
  m.sonar("corte");
  const p = { x: m.campo.cx, y: m.campo.yCorte - m.campo.k * 1.1 };
  if (l.sola) { m.sonar("mal"); m.aviso("¡Se te pasó!", "mal", p.x, p.y); m.anunciar("Se te pasó: loncha gorda."); }
  else if (l.ganados) {
    if (l.nota === "papel") m.sonar("oro"); else m.sonar("bien", 1 + l.ganados * 0.1);
    m.aviso(`${TEXTO_NOTA[l.nota]} +${l.ganados}`, l.nota === "papel" ? "oro" : "bien", p.x, p.y);
    m.vibrar(l.nota === "papel" ? [8, 30, 8] : 8);
  } else { m.sonar("mal"); m.aviso(TEXTO_NOTA[l.nota], "mal", p.x, p.y); }
  if (l.racha === 3) m.avisoNivel("¡3 finas seguidas! Ahora +1 por loncha");
  const racha = l.racha >= 2 ? { texto: `${l.racha}`, sub: "SEGUIDAS" } : null;
  m.pintarPuntos(partida.puntos, l.ganados > 0, racha);
}

// ── Lo que se ve en el instante tj (lo mismo para el plano y el 3D) ──
export function vista(tj) {
  const borde = partida && m.estado !== "inicio" ? Math.min(MAXIMO, grosorEn(partida, Math.max(0, tj))) : 0.55;
  return { borde, lonchas, tj, ultimoCorte: lonchas.length ? lonchas[lonchas.length - 1].t : -1e9 };
}

// ── Dibujo en plano: de lado, la pieza llega por la izquierda y la cuchilla es la raya vertical ──
function dibujarPlano(ctx, tj) {
  const v = vista(tj), { cx, k, yCorte } = m.campo;
  const x0 = cx - k * 0.2; // la cuchilla
  const alto = k * 0.36;
  ctx.fillStyle = "#c9ccd0"; ctx.fillRect(0, yCorte, m.ancho, k * 0.06); // la bandeja
  // la raya dorada
  ctx.fillStyle = "#e9b44c"; ctx.fillRect(x0 + GROSOR * k - 1.5, yCorte - alto - 16, 3, alto + 22);
  // la pieza
  const xb = x0 + v.borde * GROSOR * k;
  const g = ctx.createLinearGradient(0, yCorte - alto, 0, yCorte);
  g.addColorStop(0, "#6b2a1c"); g.addColorStop(0.2, "#8e1f1a"); g.addColorStop(1, "#4d0f0b");
  ctx.fillStyle = g; ctx.fillRect(0, yCorte - alto, xb, alto);
  ctx.fillStyle = "rgba(240,220,200,.6)"; ctx.fillRect(0, yCorte - alto, xb, 4);
  // la cuchilla
  const brillo = Math.max(0, 1 - (tj - v.ultimoCorte) / 260);
  ctx.fillStyle = `rgba(220,226,232,${0.75 + 0.25 * brillo})`;
  ctx.fillRect(x0 - 3, yCorte - alto - 30 + 18 * brillo, 6, alto + 30);
  // lonchas cortadas, amontonadas a la derecha
  lonchas.slice(-8).forEach((l, i) => {
    const s = Math.min(1, (tj - l.t) / 300);
    ctx.fillStyle = l.nota === "papel" ? "#a3241c" : l.nota === "gorda" || l.sola ? "#5a120e" : "#8e1f1a";
    ctx.fillRect(cx + k * 0.25 + i * 6, yCorte - 6 - i * 3 - (1 - s) * alto, k * 0.5, Math.max(2, l.grosor * 6));
  });
}

m.arrancar();
