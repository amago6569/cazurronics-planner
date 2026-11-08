// ============ LA LONCHA DE CECINA: el motor ============
// La pieza de cecina avanza hacia la cuchilla de la cortadora. Tocas y corta: lo que ha pasado de la cuchilla es la
// loncha. Hay que cortar cuando el borde llega a la raya: ni gorda ni tan fina que se rompa. Cada loncha va a otra
// velocidad, y cada vez más deprisa. Si no cortas, la máquina corta sola una loncha gorda que no vale.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos toques). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Unidades: grosor en «lonchas buenas» (1 = justo la raya). Tiempo en ms de partida.

export const VERSION = 1;
export const DURACION_MS = 40000;
export const BLOQUEO_MS = 260; // lo que tarda la cuchilla en bajar y volver: mientras, la pieza no avanza
export const EMPIEZA_MS = 600;
export const MAXIMO = 2.6; // si llega a esto sin cortar, la máquina corta sola (loncha gorda: 0 puntos)
export const NOTAS = [
  { hasta: 0.04, puntos: 4, nombre: "papel" },
  { hasta: 0.1, puntos: 2, nombre: "fina" },
  { hasta: 0.2, puntos: 1, nombre: "vale" },
];
export const RACHA_DESDE = 3; // desde la 3.ª fina (o papel) seguida, +1 por loncha

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

// velocidad de la loncha k (lonchas buenas por segundo): sube con k y cambia de una a otra
function velocidad(suerte, k) {
  const base = k < 40 ? 1.5 + 0.055 * k : 3.7;
  return base * (0.75 + 0.5 * suerte());
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  return {
    version: VERSION, semilla: semilla >>> 0, suerte,
    k: 0, desde: EMPIEZA_MS, v: velocidad(suerte, 0),
    lonchas: [], toques: [], ultimoT: -1,
    puntos: 0, racha: 0, mejorRacha: 0, papel: 0, finas: 0, malas: 0,
  };
}

// cuánto ha pasado de la cuchilla en el ms t (en lonchas buenas)
export function grosorEn(p, t) { return t <= p.desde ? 0 : ((t - p.desde) * p.v) / 1000; }
// ms en que la máquina corta sola la loncha actual
export function corteSolo(p) { return p.desde + Math.ceil((MAXIMO * 1000) / p.v); }

function nota(g) {
  const d = g >= 1 ? g - 1 : 1 - g;
  for (const n of NOTAS) if (d <= n.hasta) return n;
  return null;
}

function cortarEn(p, t, sola) {
  const g = sola ? MAXIMO : grosorEn(p, t);
  const n = sola ? null : nota(g);
  let ganados = 0;
  if (n && n.puntos >= 2) { p.racha++; if (p.racha > p.mejorRacha) p.mejorRacha = p.racha; } else p.racha = 0;
  if (n) ganados = n.puntos + (p.racha >= RACHA_DESDE ? 1 : 0);
  p.puntos += ganados;
  if (n?.nombre === "papel") p.papel++;
  if (n && n.puntos >= 2) p.finas++;
  if (!n) p.malas++;
  const l = { k: p.k, t, grosor: g, sola, nota: n ? n.nombre : g > 1 ? "gorda" : "rota", ganados, racha: p.racha, v: p.v };
  p.lonchas.push(l);
  p.k++;
  p.desde = t + BLOQUEO_MS;
  p.v = velocidad(p.suerte, p.k);
  return l;
}

// Corta sola las lonchas que se han pasado hasta el ms t. Devuelve las que ha cortado.
export function avanzar(p, t) {
  const hechas = [];
  const fin = t < DURACION_MS ? t : DURACION_MS;
  while (corteSolo(p) <= fin) hechas.push(cortarEn(p, corteSolo(p), true));
  return hechas;
}

export function motivoInvalido(p, t) {
  if (!Number.isInteger(t)) return "toque que no es un número entero";
  if (t > DURACION_MS) return "toque fuera de tiempo";
  if (t <= p.ultimoT) return "toques desordenados";
  return null;
}

// Toque en el ms t: corta (si la cuchilla está arriba). Devuelve { solas, loncha } (loncha null si no podía cortar).
export function cortar(p, t) {
  const motivo = motivoInvalido(p, t);
  if (motivo) throw new Error(motivo);
  const solas = avanzar(p, t);
  p.ultimoT = t;
  if (t <= p.desde) return { solas, loncha: null }; // la cuchilla aún vuelve: no corta (el toque no se guarda)
  p.toques.push(t);
  return { solas, loncha: cortarEn(p, t, false) };
}

export function resumen(p) {
  const { puntos, papel, finas, malas, mejorRacha } = p;
  return { puntos, papel, finas, malas, mejorRacha, lonchas: p.lonchas.length };
}

export const MAX_TOQUES = 200;
export function rejugar(semilla, toques) {
  if (!Array.isArray(toques)) return { valida: false, motivo: "faltan los toques" };
  if (toques.length > MAX_TOQUES) return { valida: false, motivo: "demasiados toques" };
  const p = crearPartida(semilla);
  for (let i = 0; i < toques.length; i++) {
    const motivo = motivoInvalido(p, toques[i]);
    if (motivo) return { valida: false, motivo: `toque ${i + 1}: ${motivo}` };
    if (cortar(p, toques[i]).loncha === null) return { valida: false, motivo: `toque ${i + 1}: con la cuchilla bajada` };
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
