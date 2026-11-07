// Jugadores simulados para Tapeo en el Húmedo: sirven para ajustar la dificultad y saber qué puntos son creíbles.
// Ven caer las cosas con su tiempo de reacción, van a por la tapa que llega antes (si llegan), esquivan las servilletas
// cuando se dan cuenta y mueven el dedo con su pulso. Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, mover, avanzar, resumen, xEn, tiempoHecho, CAZUELA, DURACION_MS, RADIO } from "../../public/liga/motor-tapas.js";
import { suerteJs } from "./bots.js";

export const NIVELES = {
  // reaccion: ms hasta fijarse en algo que aparece · mano: ms desde que decide hasta que mueve el dedo
  // atencion: cuántas cosas que caen sigue a la vez · pulso: error al poner el dedo (anchos de barra)
  novato: { reaccion: 450, mano: 260, atencion: 1, pulso: 0.11, esquiva: 0.35, ve: 0.6, cada: 50, ojo: 0.45 },
  normal: { reaccion: 360, mano: 200, atencion: 2, pulso: 0.075, esquiva: 0.6, ve: 0.8, cada: 40, ojo: 0.3 },
  bueno: { reaccion: 290, mano: 160, atencion: 2, pulso: 0.05, esquiva: 0.85, ve: 0.92, cada: 33, ojo: 0.18 },
  experto: { reaccion: 230, mano: 130, atencion: 3, pulso: 0.032, esquiva: 0.95, ve: 0.98, cada: 33, ojo: 0.1 },
  maquina: { reaccion: 0, mano: 0, atencion: 9, pulso: 0, esquiva: 1, ve: 1, cada: 16, ojo: 0 },
};

function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarTapas(semilla, nivel, semillaJugador = semilla ^ 0x51ed27) {
  const p = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const partida = crearPartida(semilla);
  let objetivo = 0, ultimoMandado = 0, ultimoT = -1000;
  const cola = [];
  // cada cosa: ¿la ve venir a tiempo? (los despistes)
  const despiste = new Map(partida.cosas.map((c) => [c.id, r() > p.ve]));
  // calcular a ojo dónde cae algo que viene en diagonal: el error es mayor cuanto más le falta
  const fallo = new Map(partida.cosas.map((c) => [c.id, gauss(r) * p.ojo]));
  const dondeCae = (c, t) => xEn(c, c.tc) + (c.vx ? fallo.get(c.id) * Math.abs(c.vx) * (c.tc - t) / 1000 : 0);
  for (let t = 0; t <= DURACION_MS; t += p.cada) {
    avanzar(partida, t);
    const vistas = partida.cosas.slice(partida.siguiente).filter((c) => c.tc > t && t >= c.t0 + p.reaccion + (despiste.get(c.id) ? 500 : 0));
    const buenas = vistas.filter((c) => c.tipo !== "servilleta").slice(0, p.atencion);
    const alcanzable = buenas.find((c) => Math.abs(dondeCae(c, t) - partida.cazuela) <= CAZUELA.velocidad * (c.tc - t) / 1000 + CAZUELA.medio);
    let meta = alcanzable ? dondeCae(alcanzable, t) : buenas.length ? dondeCae(buenas[0], t) : objetivo;
    // servilletas a punto de caer cerca de donde voy: me aparto (si me doy cuenta)
    for (const s of vistas.filter((c) => c.tipo === "servilleta" && c.tc - t < 600)) {
      if (r() > p.esquiva) continue;
      const xs = xEn(s, s.tc);
      const hueco = CAZUELA.medio + RADIO.servilleta * 0.6 + 0.04;
      if (Math.abs(xs - meta) < hueco && (!alcanzable || alcanzable.tc - s.tc > -150)) meta = xs + (meta >= xs ? hueco : -hueco);
    }
    // lo que decide ahora lo hace el dedo un poco después
    cola.push([t + p.mano, Math.max(-1, Math.min(1, meta + gauss(r) * p.pulso))]);
    while (cola.length > 1 && cola[1][0] <= t) cola.shift();
    if (cola[0][0] > t) continue;
    objetivo = cola[0][1];
    const x = Math.round(objetivo * 10000);
    const tm = Math.max(t, tiempoHecho(partida), ultimoT + 8);
    if (Math.abs(x - ultimoMandado) >= 15 && tm <= DURACION_MS) { mover(partida, tm, x); ultimoMandado = x; ultimoT = tm; }
  }
  avanzar(partida, DURACION_MS);
  return { ...resumen(partida), movimientos: partida.movimientos.slice(), semilla };
}
