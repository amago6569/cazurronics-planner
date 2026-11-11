// Jugadores simulados para La trucha: clavan cuando ven hundirse la boya (con su tiempo de reacción) y, en la pelea,
// miran la tensión con retraso: aprietan si va floja y sueltan si se acerca a romper. Los peores reaccionan tarde,
// aprietan de más y a veces tiran antes de que pique.
// Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, tocar, avanzar, resumen, tiempoHecho, DURACION_MS, TENSION, SEPARACION_MIN_MS } from "../../public/liga/motor-trucha.js";
import { suerteJs } from "./bots.js";

// clava: ms que tarda en clavar (media y desvío) · reaccion: ms de retraso al ver la tensión · sube/baja: a qué
// tensión suelta y a cuál vuelve a apretar · nervios: veces por minuto que tira en falso mientras espera
export const NIVELES = {
  novato: { clava: [430, 130], reaccion: 330, sube: 0.97, baja: 0.42, nervios: 5, cada: 40 },
  normal: { clava: [340, 90], reaccion: 260, sube: 0.93, baja: 0.5, nervios: 2, cada: 33 },
  bueno: { clava: [280, 60], reaccion: 210, sube: 0.9, baja: 0.56, nervios: 0.5, cada: 25 },
  experto: { clava: [240, 40], reaccion: 170, sube: 0.88, baja: 0.62, nervios: 0, cada: 20 },
  maquina: { clava: [20, 0], reaccion: 0, sube: 0.86, baja: 0.7, nervios: 0, cada: 10 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarTrucha(semilla, nivel, semillaJugador = semilla ^ 0x7ac4) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const visto = [];
  let apretado = false, clavarEn = null, picadaVista = false;
  const cambiar = (t) => {
    const tm = Math.max(Math.round(t), tiempoHecho(p), p.toques.length ? p.ultimoT + SEPARACION_MIN_MS : 0);
    if (tm > DURACION_MS) return;
    tocar(p, tm); apretado = !apretado;
  };
  for (let t = 0; t <= DURACION_MS; t += n.cada) {
    for (const e of avanzar(p, t)) {
      if (e.tipo === "pica") { clavarEn = e.t + Math.max(120, n.clava[0] + gauss(r) * n.clava[1]); picadaVista = true; }
      if (e.tipo === "sefue" || e.tipo === "clavada") { clavarEn = null; picadaVista = false; }
    }
    visto.push([t, p.tension, p.estado]);
    while (visto.length > 1 && visto[1][0] <= t - n.reaccion) visto.shift();
    if (p.estado === "espera") {
      if (apretado) cambiar(t); // suelta para poder clavar
      else if (picadaVista && clavarEn !== null && t >= clavarEn) { cambiar(t); clavarEn = null; }
      else if (!picadaVista && r() < (n.nervios / 60) * (n.cada / 1000)) cambiar(t); // tirón en falso
    } else if (p.estado === "pelea") {
      const [, tension, estado] = visto[0];
      if (estado !== "pelea") { if (!apretado) cambiar(t); continue; } // recién clavada: a recoger
      if (apretado && tension > n.sube) cambiar(t);
      else if (!apretado && tension < n.baja) cambiar(t);
    } else if (apretado) cambiar(t);
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), toques: p.toques.slice(), semilla };
}
