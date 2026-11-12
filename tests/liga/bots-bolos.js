// Jugadores simulados para los Bolos leoneses: miran el castro, piensan el mejor tiro que saben ver (los buenos prueban
// más efectos) y lo sueltan con el pulso que tienen. Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, lanzar, avanzar, resumen, simularTiro, tiempoHecho, DURACION_MS, PUNTOS, TIRO } from "../../public/liga/motor-bolos.js";
import { suerteJs } from "./bots.js";

// piensa: [media, desvío] ms entre bola y bola · pulso: error en dirección (m por m), en salida (m), en efecto y en
// fuerza · efectos: qué efectos sabe tirar
export const NIVELES = {
  novato: { piensa: [1500, 400], pulso: [0.075, 0.16, 0.4, 0.25], efectos: [0] },
  normal: { piensa: [1100, 300], pulso: [0.045, 0.1, 0.28, 0.18], efectos: [-0.5, 0, 0.5] },
  bueno: { piensa: [800, 200], pulso: [0.028, 0.06, 0.18, 0.12], efectos: [-0.8, -0.4, 0, 0.4, 0.8] },
  experto: { piensa: [600, 150], pulso: [0.016, 0.035, 0.1, 0.08], efectos: [-1, -0.7, -0.35, 0, 0.35, 0.7, 1] },
  maquina: { piensa: [120, 0], pulso: [0, 0, 0, 0], efectos: [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function valor(bolos, tiro) {
  const copia = bolos.map((b) => ({ ...b }));
  const r = simularTiro(copia, tiro);
  let v = 0, bolosCaidos = 0;
  for (const g of r.golpes) { v += g.i === 9 ? PUNTOS.miche : g.i === 4 ? PUNTOS.medio : PUNTOS.bolo; if (g.i !== 9) bolosCaidos++; }
  if (bolosCaidos && !copia.some((b) => b.pie && !b.miche)) v += PUNTOS.pleno;
  return v;
}
function mejorTiro(bolos, efectos, fino) {
  let mejor = null, vm = -1;
  const pasoA = fino ? 0.02 : 0.04, pasoX = fino ? 0.175 : 0.35;
  for (const c of efectos) for (const s of fino ? [0.55, 0.8, 1] : [0.8]) for (let x = -0.7; x <= 0.701; x += pasoX) for (let a = -0.42; a <= 0.4201; a += pasoA) {
    const v = valor(bolos, { x, a, c, s });
    if (v > vm) { vm = v; mejor = { x, a, c, s }; }
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
    const q = mejorTiro(p.bolos, n.efectos, n === NIVELES.maquina || n === NIVELES.experto);
    const tm = Math.max(t, tiempoHecho(p), p.tiros.length ? p.ultimoT + 400 : 0);
    if (tm > DURACION_MS) break;
    lanzar(p, tm,
      tope((q.x + gauss(r) * n.pulso[1]) * 1000, TIRO.xMax), tope((q.a + gauss(r) * n.pulso[0]) * 1000, TIRO.aMax),
      tope((q.c + gauss(r) * n.pulso[2]) * 1000, TIRO.cMax), Math.max(0, Math.min(1000, Math.round((q.s + gauss(r) * n.pulso[3]) * 1000))));
    tiraEn = null;
    avanzar(p, tm);
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), tiros: p.tiros.slice(), semilla };
}
