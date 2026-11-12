// Jugadores simulados para la Lucha leonesa: ven la maña, tardan lo suyo en reaccionar y a veces se equivocan de lado
// o pican en el amago. Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, deslizar, avanzar, resumen, tiempoHecho, DURACION_MS, SEPARACION_MIN_MS } from "../../public/liga/motor-lucha.js";
import { suerteJs } from "./bots.js";

// reaccion: [media, desvío] ms · yerra: probabilidad de equivocarse de lado · pica: de caer en un amago ·
// nervios: gestos en falso por minuto
export const NIVELES = {
  novato: { reaccion: [640, 170], yerra: 0.16, pica: 0.7, nervios: 4 },
  normal: { reaccion: [520, 120], yerra: 0.08, pica: 0.45, nervios: 1.5 },
  bueno: { reaccion: [440, 90], yerra: 0.04, pica: 0.25, nervios: 0.5 },
  experto: { reaccion: [370, 60], yerra: 0.015, pica: 0.1, nervios: 0 },
  maquina: { reaccion: [9, 0], yerra: 0, pica: 0, nervios: 0 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarLucha(semilla, nivel, semillaJugador = semilla ^ 0x1c9a) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  let plan = null; // { t, d } el gesto que va a hacer
  const hacer = (t, d) => {
    const tm = Math.max(Math.round(t), tiempoHecho(p), p.gestos.length ? p.ultimoT + SEPARACION_MIN_MS : 0);
    if (tm <= DURACION_MS) deslizar(p, tm, d);
  };
  for (let t = 0; t <= DURACION_MS; t += 8) {
    for (const e of avanzar(p, t)) {
      if (e.tipo === "amago") {
        // el que pica, tira hacia el amago; el que no, espera a la de verdad
        if (r() < n.pica) plan = { t: e.t + Math.max(120, n.reaccion[0] * 0.75 + gauss(r) * n.reaccion[1]), d: e.d };
        else plan = null;
      } else if (e.tipo === "mana") {
        if (plan && e.trasAmago && plan.t <= e.t + 40) continue; // ya había picado: el gesto sale igual
        const d = r() < n.yerra ? (e.d + 1 + Math.floor(r() * 3)) % 4 : e.d;
        plan = { t: e.t + Math.max(8, n.reaccion[0] + gauss(r) * n.reaccion[1] + (e.trasAmago ? 60 : 0)), d };
      } else if (e.tipo === "suelo" || e.tipo === "caida" || e.tipo === "contra") plan = null;
    }
    if (plan && t >= plan.t) { hacer(t, plan.d); plan = null; }
    else if (!plan && p.estado === "guardia" && r() < (n.nervios / 60) * 0.008) hacer(t, Math.floor(r() * 4));
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), gestos: p.gestos.slice(), semilla };
}
