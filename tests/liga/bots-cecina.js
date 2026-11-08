// Jugadores simulados para La loncha de cecina: miran el borde acercarse a la raya y tocan con su error de tiempo.
import { crearPartida, cortar, avanzar, resumen, DURACION_MS, BLOQUEO_MS } from "../../public/liga/motor-cecina.js";
import { suerteJs } from "./bots.js";

// error: desviación del toque (ms) · despiste: probabilidad de llegar tarde (300-700 ms) · lento: ms de más tras cada corte
export const NIVELES = {
  novato: { error: 75, despiste: 0.12, lento: 250 },
  normal: { error: 52, despiste: 0.07, lento: 150 },
  bueno: { error: 36, despiste: 0.04, lento: 90 },
  experto: { error: 24, despiste: 0.02, lento: 40 },
  maquina: { error: 0, despiste: 0, lento: 0 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarCecina(semilla, nivel, semillaJugador = semilla ^ 0x7a11) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const toques = [];
  for (let vueltas = 0; vueltas < 400; vueltas++) {
    const justo = p.desde + 1000 / p.v; // cuando el borde está en la raya
    let t = Math.round(justo + gauss(r) * n.error + (r() < n.despiste ? 300 + 400 * r() : 0));
    t = Math.max(t, p.desde + 1 + n.lento, (toques.at(-1) ?? 0) + 1);
    if (t > DURACION_MS) break;
    const { loncha } = cortar(p, t);
    if (loncha) toques.push(t);
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), toques, semilla };
}
void BLOQUEO_MS;
