// Jugadores simulados para la Justa: siguen el escudo del rival con el dedo. Lo ven con retraso, les tiembla el pulso
// y los peores no adelantan hacia dónde va. Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, mover, avanzar, resumen, tiempoHecho, escudoEn, galopeEn, DURACION_MS, SEPARACION_MIN_MS } from "../../public/liga/motor-justa.js";
import { suerteJs } from "./bots.js";

// reaccion: ms de retraso al ver · pulso: temblor · adelanta: cuánto prevé el movimiento (0 nada, 1 todo) ·
// galope: cuánto compensa el bote de su caballo · cada: ms entre gesto y gesto
export const NIVELES = {
  novato: { reaccion: 330, pulso: 0.045, adelanta: 0.15, galope: 0, cada: 50 },
  normal: { reaccion: 250, pulso: 0.028, adelanta: 0.35, galope: 0, cada: 40 },
  bueno: { reaccion: 200, pulso: 0.017, adelanta: 0.65, galope: 0.3, cada: 33 },
  experto: { reaccion: 160, pulso: 0.011, adelanta: 0.85, galope: 0.6, cada: 33 },
  maquina: { reaccion: 0, pulso: 0, adelanta: 1, galope: 1, cada: 33 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarJusta(semilla, nivel, semillaJugador = semilla ^ 0x3b1f) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  let dedo = 0.5, ultimoT = -1000, uy = null, tiemblo = 0;
  for (let t = 0; t <= DURACION_MS; t += n.cada) {
    avanzar(p, t);
    if (p.estado === "carrera") {
      const visto = escudoEn(p, t - n.reaccion), ahora = escudoEn(p, t);
      // prever: lo que tarda la lanza en llegar (~80 ms) más su propio retraso
      const futuro = escudoEn(p, t + 90);
      let quiere = visto + (futuro - visto) * n.adelanta - galopeEn(p, t + 60) * n.galope;
      if (n.adelanta === 1) quiere = futuro - galopeEn(p, t + 60) + (futuro - ahora) * 0.2;
      tiemblo += (gauss(r) * n.pulso - tiemblo) * 0.35;
      dedo += (quiere + tiemblo - dedo) * Math.min(1, n.cada / 90);
    }
    const y = Math.round(Math.max(0, Math.min(1, dedo)) * 10000);
    const tm = Math.max(t, tiempoHecho(p), ultimoT + SEPARACION_MIN_MS);
    if (y !== uy && tm <= DURACION_MS) { mover(p, tm, y); uy = y; ultimoT = tm; }
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), movimientos: p.movimientos.slice(), semilla };
}
