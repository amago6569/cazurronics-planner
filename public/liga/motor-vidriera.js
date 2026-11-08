// ============ LA VIDRIERA: el motor ============
// El rosetón de la Catedral tiene 8 vidrieras. Se encienden unas cuantas, una detrás de otra; luego hay que tocarlas
// en el mismo orden. Si aciertas la serie entera, la siguiente es una más larga y va más deprisa. Si fallas (o tardas
// demasiado), se apaga y viene otra serie una más corta.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos toques). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Tiempo en ms de partida. Vidrieras numeradas de 0 a 7, en el sentido de las agujas del reloj desde arriba.

export const VERSION = 1;
export const DURACION_MS = 50000;
export const PANELES = 8;
export const EMPIEZA_MS = 500;
export const LARGO_INICIAL = 3;
export const ABRE_MS = 150; // tras la última luz, lo que tarda en dejarte tocar
export const ESPERA_MS = 3500; // si pasa esto sin tocar, la serie se da por fallada
export const PAUSA_BIEN = 700;
export const PAUSA_MAL = 1100;
export const RACHA_DESDE = 3; // desde la 3.ª serie seguida bien hecha, +1 por cada toque

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

// ms entre luz y luz en una serie de largo L: cuanto más larga, más deprisa
export function paso(L) { const v = 600 - 30 * (L - LARGO_INICIAL); return v < 330 ? 330 : v; }

// una serie nueva: nunca dos veces seguidas la misma vidriera
function serie(suerte, L) {
  const s = [];
  let antes = -1;
  for (let i = 0; i < L; i++) {
    let n = Math.floor(suerte() * (antes < 0 ? PANELES : PANELES - 1));
    if (antes >= 0 && n >= antes) n++;
    s.push(n); antes = n;
  }
  return s;
}

function nuevaRonda(p, desde, L) {
  p.ronda++;
  p.largo = L;
  p.serie = serie(p.suerte, L);
  p.desde = desde;
  p.abre = desde + L * paso(L) + ABRE_MS;
  p.hechos = 0;
  p.limite = p.abre + ESPERA_MS;
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte,
    ronda: -1, largo: 0, serie: [], desde: 0, abre: 0, hechos: 0, limite: 0,
    toques: [], ultimoT: -1, historia: [],
    puntos: 0, racha: 0, mejorRacha: 0, series: 0, fallos: 0, mejorSerie: 0, aciertos: 0,
  };
  nuevaRonda(p, EMPIEZA_MS, LARGO_INICIAL);
  return p;
}

// qué vidriera está encendida en el ms t mientras se enseña la serie (−1 si ninguna)
export function encendida(p, t) {
  if (t < p.desde || t >= p.abre - ABRE_MS) return -1;
  const ps = paso(p.largo), i = Math.floor((t - p.desde) / ps);
  return t - p.desde - i * ps < ps * 0.68 ? p.serie[i] : -1;
}
export const puedeTocar = (p, t) => t >= p.abre && t <= DURACION_MS;

function fallar(p, t, motivo, panel) {
  p.racha = 0; p.fallos++;
  const r = { t, bien: false, motivo, panel, esperado: p.serie[p.hechos], ronda: p.ronda, largo: p.largo, ganados: 0, racha: 0 };
  p.historia.push(r);
  nuevaRonda(p, t + PAUSA_MAL, p.largo > LARGO_INICIAL ? p.largo - 1 : LARGO_INICIAL);
  return r;
}

// Da por falladas las series en las que se ha dejado de tocar hasta el ms t. Devuelve las que ha fallado.
export function avanzar(p, t) {
  const hechos = [];
  const fin = t < DURACION_MS ? t : DURACION_MS;
  while (p.limite <= fin) hechos.push(fallar(p, p.limite, "tarde", -1));
  return hechos;
}

export function motivoInvalido(p, t, panel) {
  if (!Number.isInteger(t)) return "toque que no es un número entero";
  if (!Number.isInteger(panel) || panel < 0 || panel >= PANELES) return "vidriera que no existe";
  if (t > DURACION_MS) return "toque fuera de tiempo";
  if (t <= p.ultimoT) return "toques desordenados";
  return null;
}

// Toque en la vidriera «panel» en el ms t. Devuelve { solas, r } (r null si aún se estaba enseñando la serie).
export function tocar(p, t, panel) {
  const motivo = motivoInvalido(p, t, panel);
  if (motivo) throw new Error(motivo);
  const solas = avanzar(p, t);
  p.ultimoT = t;
  if (t < p.abre) return { solas, r: null }; // aún se enseña la serie: no cuenta (y no se guarda)
  p.toques.push(t, panel);
  if (panel !== p.serie[p.hechos]) return { solas, r: fallar(p, t, "otra", panel) };
  p.hechos++; p.aciertos++;
  let ganados = 1 + (p.racha >= RACHA_DESDE ? 1 : 0);
  const completa = p.hechos === p.largo;
  if (completa) {
    ganados += p.largo;
    p.racha++; if (p.racha > p.mejorRacha) p.mejorRacha = p.racha;
    p.series++; if (p.largo > p.mejorSerie) p.mejorSerie = p.largo;
  }
  p.puntos += ganados;
  const r = { t, bien: true, completa, panel, ronda: p.ronda, largo: p.largo, hechos: p.hechos, ganados, racha: p.racha };
  p.historia.push(r);
  if (completa) nuevaRonda(p, t + PAUSA_BIEN, p.largo + 1);
  else p.limite = t + ESPERA_MS;
  return { solas, r };
}

export function resumen(p) {
  const { puntos, series, fallos, mejorSerie, mejorRacha, aciertos } = p;
  return { puntos, series, fallos, mejorSerie, mejorRacha, aciertos };
}

export const MAX_TOQUES = 400;
// toques = [t, vidriera, t, vidriera, …]
export function rejugar(semilla, toques) {
  if (!Array.isArray(toques) || toques.length % 2) return { valida: false, motivo: "faltan los toques" };
  if (toques.length / 2 > MAX_TOQUES) return { valida: false, motivo: "demasiados toques" };
  const p = crearPartida(semilla);
  for (let i = 0; i < toques.length; i += 2) {
    const t = toques[i], panel = toques[i + 1];
    const motivo = motivoInvalido(p, t, panel);
    if (motivo) return { valida: false, motivo: `toque ${i / 2 + 1}: ${motivo}` };
    if (tocar(p, t, panel).r === null) return { valida: false, motivo: `toque ${i / 2 + 1}: antes de acabar la serie` };
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
