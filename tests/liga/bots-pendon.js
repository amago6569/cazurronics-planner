// Jugadores simulados para El Pendón: miran cómo se inclina el palo (con su retraso) y llevan el dedo hacia ese lado,
// sin pasarse y volviendo poco a poco al medio, como quien sujeta una escoba en la palma.
// Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, mover, avanzar, resumen, tiempoHecho, DURACION_MS, ACOPLE, LIMITE_X } from "../../public/liga/motor-pendon.js";
import { suerteJs } from "./bots.js";

// reaccion: ms de retraso al ver el palo · kp, kd, kx, kv: cuánto acelera el dedo por inclinación, giro, posición y
// velocidad · pulso: temblor del dedo · cada: ms entre gesto y gesto
const MANO = { kp: 12, kd: 5, kx: 0.5, kv: 2 };
export const NIVELES = {
  novato: { ...MANO, reaccion: 230, pulso: 0.022, cada: 40 },
  normal: { ...MANO, reaccion: 180, pulso: 0.016, cada: 33 },
  bueno: { ...MANO, reaccion: 145, pulso: 0.012, cada: 25 },
  experto: { ...MANO, reaccion: 110, pulso: 0.008, cada: 20 },
  maquina: { ...MANO, reaccion: 0, pulso: 0, cada: 20 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarPendon(semilla, nivel, semillaJugador = semilla ^ 0x9e11) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const visto = []; // [t, angulo, giro]
  let xf = 0, vf = 0, ultimo = null, ultimoT = -1000;
  const dt = n.cada / 1000;
  for (let t = 0; t <= DURACION_MS; t += n.cada) {
    avanzar(p, t);
    visto.push([t, p.angulo, p.giro]);
    while (visto.length > 1 && visto[1][0] <= t - n.reaccion) visto.shift();
    const [, a, g] = visto[0];
    if (t < p.levantaHasta) { vf = 0; xf *= 0.9; } // mientras lo levantan, vuelve al medio
    else {
      const quiere = (n.kp * a + n.kd * g + n.kx * xf + n.kv * vf) / ACOPLE;
      vf += quiere * dt;
      xf += vf * dt + gauss(r) * n.pulso;
      if (xf > LIMITE_X || xf < -LIMITE_X) { xf = Math.max(-LIMITE_X, Math.min(LIMITE_X, xf)); vf = 0; }
    }
    const xm = Math.round(xf * 10000);
    const tm = Math.max(t, tiempoHecho(p), ultimoT + 8);
    if (xm !== ultimo && tm <= DURACION_MS) { mover(p, tm, xm); ultimo = xm; ultimoT = tm; }
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), movimientos: p.movimientos.slice(), semilla };
}
