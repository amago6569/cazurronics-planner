// Jugadores simulados para La torre del botillo: esperan a que el botillo pase por encima de la torre y tocan,
// con su error de tiempo. Aquí sí hay Math.random: no es el motor.
import { crearPartida, colgando, soltar, acabada, resumen, DURACION_MS } from "../../public/liga/motor-botillo.js";
import { suerteJs } from "./bots.js";

// espera: ms mínimos antes de decidirse · error: desviación del toque (ms) · prisa: cuántas pasadas deja ir como mucho
export const NIVELES = {
  novato: { espera: 500, error: 85, pasadas: 1 },
  normal: { espera: 400, error: 60, pasadas: 1 },
  bueno: { espera: 350, error: 42, pasadas: 1 },
  experto: { espera: 300, error: 28, pasadas: 0 },
  maquina: { espera: 0, error: 0, pasadas: 0 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarBotillo(semilla, nivel, semillaJugador = semilla ^ 0x2b1c) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const toques = [];
  while (!acabada(p, p.aparece)) {
    const desde = p.aparece + n.espera;
    const arriba = p.torre.length ? p.torre[p.torre.length - 1] : 0;
    // las veces que pasa por encima de la torre
    const cruces = [];
    let antes = colgando(p, desde).x - arriba;
    for (let t = desde + 1; t < desde + 6000 && cruces.length < 3; t++) {
      const d = colgando(p, t).x - arriba;
      if ((d >= 0) !== (antes >= 0)) cruces.push(t);
      antes = d;
    }
    const elegido = cruces[Math.min(cruces.length - 1, Math.floor(r() * (n.pasadas + 1)))] ?? desde;
    let t = Math.round(elegido + gauss(r) * n.error);
    t = Math.max(t, p.aparece, (toques.at(-1) ?? -1) + 1);
    if (t > DURACION_MS) break;
    soltar(p, t); toques.push(t);
  }
  return { ...resumen(p), toques, semilla };
}
