// Jugadores simulados para los Bolos leoneses: miran el castro y el miche, piensan el mejor tiro que saben ver (los
// buenos conocen el efecto y buscan el once; el novato tira recto a por bolos) y lo sueltan con el pulso que tienen.
// Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, lanzar, avanzar, resumen, simularTiro, tantosDe, tiempoHecho, DURACION_MS, TIRO, SEPARACION_MS } from "../../public/liga/motor-bolos.js";
import { suerteJs } from "./bots.js";

// piensa: [media, desvío] ms antes de tirar · pulso: error en dirección (m por m), en efecto y en fuerza ·
// efectos: qué efectos sabe tirar · fino: si afina la búsqueda
export const NIVELES = {
  novato: { piensa: [1500, 400], pulso: [0.035, 0.25, 0.1], efectos: [0], fino: false },
  normal: { piensa: [1100, 300], pulso: [0.022, 0.18, 0.07], efectos: [-0.6, 0, 0.6], fino: false },
  bueno: { piensa: [800, 200], pulso: [0.014, 0.11, 0.045], efectos: [-1, -0.75, -0.5, 0, 0.5, 0.75, 1], fino: false },
  experto: { piensa: [600, 150], pulso: [0.008, 0.06, 0.025], efectos: [-1, -0.875, -0.75, -0.625, -0.5, 0, 0.5, 0.625, 0.75, 0.875, 1], fino: true },
  maquina: { piensa: [150, 0], pulso: [0, 0, 0], efectos: [-1, -0.875, -0.75, -0.625, -0.5, -0.25, 0, 0.25, 0.5, 0.625, 0.75, 0.875, 1], fino: true },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function mejorTiro(p, n) {
  let mejor = null, vm = -1;
  const pasoA = n.fino ? 0.025 : 0.05, pasoS = n.fino ? 0.05 : 0.1;
  const xs = p.birle ? [0] : [-0.4, 0];
  for (const c of n.efectos) for (let s = 0.1; s <= 1.001; s += pasoS) for (let a = -0.25; a <= 0.2501; a += pasoA) for (const x of xs) {
    const tiro = { x, a, c, s };
    const r = simularTiro(p.bolos.map((b) => ({ ...b })), tiro, p.lado, p.birle);
    const v = tantosDe(r, Boolean(p.birle)).tantos + (r.enParada || p.birle ? 0 : 0.5); // a igualdad, deja birle
    if (v > vm) { vm = v; mejor = tiro; }
  }
  return mejor;
}

export function jugarBolos(semilla, nivel, semillaJugador = semilla ^ 0x2be7) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const tope = (v, m) => Math.max(-m, Math.min(m, Math.round(v)));
  let tiraEn = null;
  for (let t = 0; t <= DURACION_MS; t += 10) {
    avanzar(p, t);
    if (p.estado !== "listo" || t < p.listoEn) { tiraEn = null; continue; }
    if (tiraEn === null) tiraEn = t + Math.max(100, n.piensa[0] + gauss(r) * n.piensa[1]);
    if (t < tiraEn) continue;
    const q = mejorTiro(p, n);
    const tm = Math.max(t, tiempoHecho(p), p.tiros.length ? p.ultimoT + SEPARACION_MS : 0);
    if (tm > DURACION_MS) break;
    lanzar(p, tm,
      tope(q.x * 1000, TIRO.xMax), tope((q.a + gauss(r) * n.pulso[0]) * 1000, TIRO.aMax),
      tope((q.c + gauss(r) * n.pulso[1]) * 1000, TIRO.cMax), Math.max(0, Math.min(1000, Math.round((q.s + gauss(r) * n.pulso[2]) * 1000))));
    tiraEn = null;
    avanzar(p, tm);
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), tiros: p.tiros.slice(), semilla };
}
