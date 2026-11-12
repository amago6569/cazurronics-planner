// Jugadores simulados para Los maragatos: tocan cada marca con su error de compás; a veces se saltan una o se
// confunden de lado. Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, tocar, avanzar, resumen, DURACION_MS, SEPARACION_MIN_MS } from "../../public/liga/motor-maragatos.js";
import { suerteJs } from "./bots.js";

// compas: desvío (ms) al tocar · salta: probabilidad de no tocar una marca · lado: de equivocarse de lado ·
// apretado: desvío extra cuando la marca anterior está a menos de 300 ms
export const NIVELES = {
  novato: { compas: 85, salta: 0.14, lado: 0.07, apretado: 45 },
  normal: { compas: 58, salta: 0.06, lado: 0.03, apretado: 28 },
  bueno: { compas: 40, salta: 0.02, lado: 0.01, apretado: 16 },
  experto: { compas: 27, salta: 0.005, lado: 0.003, apretado: 9 },
  maquina: { compas: 0, salta: 0, lado: 0, apretado: 0 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarMaragatos(semilla, nivel, semillaJugador = semilla ^ 0x66d3) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const plan = [];
  let antes = -1e9;
  for (const nota of p.notas) {
    const junto = nota.t - antes < 300 && nota.t !== antes;
    antes = nota.t;
    if (r() < n.salta) continue;
    const lado = r() < n.lado ? 1 - nota.lado : nota.lado;
    plan.push({ t: Math.round(nota.t + gauss(r) * (n.compas + (junto ? n.apretado : 0))), lado });
  }
  plan.sort((a, b) => a.t - b.t);
  let ultimo = -1e9, ultimoLado = -1;
  for (const g of plan) {
    let t = Math.max(0, g.t, ultimo);
    if (g.lado === ultimoLado && t < ultimo + SEPARACION_MIN_MS) t = ultimo + SEPARACION_MIN_MS;
    if (t > DURACION_MS) break;
    tocar(p, t, g.lado); ultimo = t; ultimoLado = g.lado;
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), toques: p.toques.slice(), semilla };
}
