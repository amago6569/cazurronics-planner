// Jugadores simulados para La Vidriera: ven la serie, la recuerdan (o no) y la tocan a su ritmo.
import { crearPartida, tocar, avanzar, resumen, DURACION_MS, PANELES } from "../../public/liga/motor-vidriera.js";
import { suerteJs } from "./bots.js";

// memoria: largo que recuerdan casi siempre · olvido: probabilidad de fallar cada luz de más · base: fallo aunque sea corta
// dedo: ms entre toque y toque (media, variación) · arranque: ms hasta el primer toque
export const NIVELES = {
  novato: { memoria: 4, olvido: 0.3, base: 0.03, dedo: [520, 160], arranque: 700 },
  normal: { memoria: 5, olvido: 0.25, base: 0.02, dedo: [420, 120], arranque: 500 },
  bueno: { memoria: 6, olvido: 0.2, base: 0.012, dedo: [340, 90], arranque: 380 },
  experto: { memoria: 8, olvido: 0.16, base: 0.006, dedo: [270, 60], arranque: 280 },
  maquina: { memoria: 99, olvido: 0, base: 0, dedo: [150, 0], arranque: 150 },
};

export function jugarVidriera(semilla, nivel, semillaJugador = semilla ^ 0x51d3) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const toques = [];
  let ronda = -1, t = 0;
  for (let vueltas = 0; vueltas < 2000; vueltas++) {
    if (p.ronda !== ronda) { ronda = p.ronda; t = p.abre + Math.round(n.arranque * (0.7 + 0.6 * r())); }
    else t += Math.max(60, Math.round(n.dedo[0] + (r() * 2 - 1) * n.dedo[1]));
    t = Math.max(t, p.ultimoT + 1);
    if (t > DURACION_MS) break;
    const fallo = n.base + (p.largo > n.memoria ? n.olvido * (p.largo - n.memoria) / p.largo : 0);
    const correcta = p.serie[p.hechos];
    const panel = r() < fallo ? (correcta + 1 + Math.floor(r() * (PANELES - 1))) % PANELES : correcta;
    const { r: res } = tocar(p, t, panel);
    if (res) toques.push(t, panel);
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), toques, semilla };
}
