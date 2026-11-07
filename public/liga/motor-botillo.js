// ============ LA TORRE DEL BOTILLO: el motor ============
// Una grúa balancea un botillo de lado a lado. Tocas la pantalla y lo suelta: cae recto sobre la torre.
// Si cae bien apoyado, se queda y la torre crece; si cae demasiado de lado, se va al suelo. Tres al suelo y se acaba.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil para jugar y el servidor para repetir la partida con la
// misma semilla y los mismos toques. Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Unidades: x en anchos de mesa (0 = centro del plato). Tiempo en ms de partida.

export const VERSION = 1;
export const DURACION_MS = 45000;
export const ANCHO = 0.36; // ancho de un botillo
export const AGARRE = 0.15; // si cae a más de esto del de abajo, se va al suelo
export const CLAVADO = 0.03; // a menos de esto, «¡clavado!»: se queda justo encima y vale más
export const CAIDA_MS = 320; // lo que tarda en caer
export const ESPERA_MS = 380; // desde que se apoya hasta que la grúa trae el siguiente
export const MAX_FALLOS = 3;
export const PUNTOS = { apoyado: 2, clavado: 4, racha: 1 }; // +1 por botillo desde 5 seguidos sin fallo

function crearSuerte(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// onda en triángulo, de -1 a 1 (sin senos)
export function triangulo(z) { const f = z - Math.floor(z); return 4 * Math.abs(f - 0.5) - 1; }

// cómo se balancea el botillo número n (decidido con la semilla)
function vaiven(suerte, n) {
  const P = Math.round((n < 30 ? 1500 - 28 * n : 660) * (0.9 + 0.2 * suerte()));
  const A = n < 20 ? 0.5 + 0.022 * n : 0.94;
  return { P, A, f: suerte() };
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte,
    n: 0, aparece: 700, colgado: vaiven(suerte, 0),
    torre: [], // x de cada botillo apoyado (de abajo arriba)
    toques: [], ultimoT: -1,
    puntos: 0, racha: 0, mejorRacha: 0, apoyados: 0, clavados: 0, fallos: 0, terminada: false,
  };
  return p;
}

const xArriba = (p) => (p.torre.length ? p.torre[p.torre.length - 1] : 0);

// dónde está el botillo que cuelga en el ms t (o null si no hay ninguno colgando)
export function colgando(p, t) {
  if (p.terminada || t < p.aparece) return null;
  const c = p.colgado;
  return { n: p.n, x: c.A * triangulo((t - p.aparece) / c.P + c.f), desde: p.aparece };
}

export function motivoInvalido(p, t) {
  if (!Number.isInteger(t)) return "toque que no es un número entero";
  if (p.terminada) return "toque con la partida acabada";
  if (t > DURACION_MS) return "toque fuera de tiempo";
  if (t <= p.ultimoT) return "toques desordenados";
  if (t < p.aparece) return "toque sin botillo colgando";
  return null;
}

// Suelta el botillo en el ms t. Devuelve qué pasa (se decide ya, aunque se vea al caer).
export function soltar(p, t) {
  const motivo = motivoInvalido(p, t);
  if (motivo) throw new Error(motivo);
  p.toques.push(t); p.ultimoT = t;
  const x = colgando(p, t).x;
  const abajo = xArriba(p);
  const dx = x - abajo;
  const n = p.n;
  let res;
  if (dx <= AGARRE && dx >= -AGARRE) {
    const clavado = dx <= CLAVADO && dx >= -CLAVADO;
    const xf = clavado ? abajo : x;
    p.torre.push(xf);
    p.racha++; p.mejorRacha = p.racha > p.mejorRacha ? p.racha : p.mejorRacha;
    const ganados = (clavado ? PUNTOS.clavado : PUNTOS.apoyado) + (p.racha >= 5 ? PUNTOS.racha : 0);
    p.puntos += ganados; p.apoyados++; if (clavado) p.clavados++;
    res = { n, t, x, xf, dx, apoyado: true, clavado, ganados, racha: p.racha, altura: p.torre.length };
  } else {
    p.racha = 0; p.fallos++;
    res = { n, t, x, xf: x, dx, apoyado: false, clavado: false, ganados: 0, racha: 0, altura: p.torre.length };
  }
  res.llega = t + CAIDA_MS;
  p.n++;
  p.aparece = t + CAIDA_MS + ESPERA_MS;
  p.colgado = vaiven(p.suerte, p.n);
  if (p.fallos >= MAX_FALLOS) p.terminada = true;
  res.fin = p.terminada;
  return res;
}

// ¿se ha acabado en el ms t? (por tiempo o por fallos)
export function acabada(p, t) { return p.terminada || t >= DURACION_MS; }

export function resumen(p) {
  const { puntos, apoyados, clavados, fallos, mejorRacha } = p;
  return { puntos, apoyados, clavados, fallos, mejorRacha, altura: p.torre.length };
}

export const MAX_TOQUES = 120;
export function rejugar(semilla, toques) {
  if (!Array.isArray(toques)) return { valida: false, motivo: "faltan los toques" };
  if (toques.length > MAX_TOQUES) return { valida: false, motivo: "demasiados toques" };
  const p = crearPartida(semilla);
  for (let i = 0; i < toques.length; i++) {
    const motivo = motivoInvalido(p, toques[i]);
    if (motivo) return { valida: false, motivo: `toque ${i + 1}: ${motivo}` };
    soltar(p, toques[i]);
  }
  return { valida: true, ...resumen(p) };
}
