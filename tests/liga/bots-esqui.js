// Jugadores simulados para la Bajada en San Isidro: ven venir las puertas con su retraso, van a por la siguiente
// (apuntando mejor o peor al centro) y se apartan de los pinos si se dan cuenta. Aquí sí hay Math.random: no es el motor.
import { crearPartida, mover, avanzar, resumen, tiempoHecho, DURACION_MS, PINO, ESQUIADOR } from "../../public/liga/motor-esqui.js";
import { suerteJs } from "./bots.js";

// ve: ms de antelación con que se fija en algo · reaccion: ms de retraso · pulso: error del dedo
// ojo: error al apuntar (en medios de puerta) · esquiva: probabilidad de ver el pino · cada: ms entre gestos
export const NIVELES = {
  novato: { ve: 700, reaccion: 330, pulso: 0.05, ojo: 0.9, esquiva: 0.55, cada: 45 },
  normal: { ve: 850, reaccion: 260, pulso: 0.035, ojo: 0.65, esquiva: 0.75, cada: 35 },
  bueno: { ve: 1000, reaccion: 210, pulso: 0.025, ojo: 0.45, esquiva: 0.88, cada: 28 },
  experto: { ve: 1150, reaccion: 170, pulso: 0.015, ojo: 0.3, esquiva: 0.96, cada: 22 },
  maquina: { ve: 1300, reaccion: 0, pulso: 0, ojo: 0, esquiva: 1, cada: 20 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarEsqui(semilla, nivel, semillaJugador = semilla ^ 0x5a1d) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const apunta = new Map(p.cosas.map((c) => [c.id, c.tipo === "puerta" ? gauss(r) * n.ojo * c.medio * 0.5 : 0]));
  const ve = new Map(p.cosas.map((c) => [c.id, r() < n.esquiva]));
  const cola = [];
  let ultimo = null, ultimoT = -1000, meta = 0;
  for (let t = 0; t <= DURACION_MS; t += n.cada) {
    avanzar(p, t);
    const delante = p.cosas.slice(p.siguiente).filter((c) => c.tc - t <= n.ve);
    const puerta = delante.find((c) => c.tipo === "puerta");
    if (puerta) meta = puerta.x + apunta.get(puerta.id);
    for (const c of delante) {
      if (c.tipo !== "pino" || !ve.get(c.id) || (puerta && c.tc > puerta.tc)) continue;
      const hueco = PINO + ESQUIADOR.medio + 0.05;
      if (Math.abs(meta - c.x) < hueco) meta = c.x + (meta >= c.x ? hueco : -hueco);
    }
    cola.push([t + n.reaccion, meta + gauss(r) * n.pulso]);
    while (cola.length > 1 && cola[1][0] <= t) cola.shift();
    if (cola[0][0] > t) continue;
    const xm = Math.round(Math.max(-1, Math.min(1, cola[0][1])) * 10000);
    const tm = Math.max(t, tiempoHecho(p), ultimoT + 8);
    if (xm !== ultimo && tm <= DURACION_MS) { mover(p, tm, xm); ultimo = xm; ultimoT = tm; }
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), movimientos: p.movimientos.slice(), semilla };
}
