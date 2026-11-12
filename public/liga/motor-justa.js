// ============ LA JUSTA DEL PASO HONROSO: el motor ============
// Hospital de Órbigo, 1434: don Suero de Quiñones y sus caballeros defienden el puente durante un mes y rompen lanzas
// con todo el que quiera cruzarlo. Aquí vas a caballo, el rival viene de frente y hay que llevar la punta de la lanza
// al centro de su escudo en el momento del choque. El escudo sube y baja con el galope, el tuyo también, y cada
// carrera va más deprisa.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos movimientos del dedo). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: solo sumas,
// productos y divisiones, que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Lo que manda el jugador: [t, y, t, y, …] = en el ms t quiere la punta de la lanza a la altura y (×10000).
// Unidades: alturas de 0 (abajo) a 1 (arriba); el escudo se mueve entre 0,2 y 0,8.

export const VERSION = 1;
export const DURACION_MS = 45000;
export const PASOS_POR_SEGUNDO = 120;
const DT = 1 / PASOS_POR_SEGUNDO;

export const ESCUDO = { centro: 0.03, medio: 0.07, borde: 0.115 }; // a qué distancia del centro cuenta cada golpe
export const PUNTOS = { centro: 30, medio: 15, borde: 5, racha: 3, rachaMax: 12 };
export const LANZA = { seguir: 13, empieza: 0.04 }; // lo rápido que la punta va al dedo
export const CARRERA = { primera: 3900, baja: 190, minima: 2300 }; // ms que dura cada carrera
export const VUELTA_MS = 950; // tras el choque: dar la vuelta al final de la tela
export const EMPIEZA_MS = 400;
export const MAX_MOVIMIENTOS = 1500;
export const SEPARACION_MIN_MS = 8;

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

// Una onda suave de −1 a 1 hecha con parábolas (x en vueltas): se parece al seno y da lo mismo en todas partes
export function onda(x) {
  const f = x - Math.floor(x);
  if (f < 0.5) return 16 * f * (0.5 - f);
  return -16 * (f - 0.5) * (1 - f);
}

const tope = (v, a, b) => (v < a ? a : v > b ? b : v);

// La carrera número n (0, 1, 2…): cuánto dura y cómo se mueve el escudo del rival
function nuevaCarrera(p, t) {
  const s = p.suerte, n = p.carreras;
  const dura = Math.max(CARRERA.minima, CARRERA.primera - CARRERA.baja * n);
  const k = n > 8 ? 1 : n / 8; // 0 la primera … 1 de la novena en adelante
  p.carrera = {
    n, empieza: t, choca: t + dura, dura,
    base: s() < 0.5 ? 0.24 + 0.14 * s() : 0.62 + 0.14 * s(), // alto o bajo, nunca en medio: no vale dejar la lanza quieta
    amp: 0.06 + 0.1 * k + 0.03 * s(), periodo: 1750 - 600 * k + Math.floor(s() * 200), fase: s(),
    amp2: 0.012 + 0.04 * k, periodo2: 520 + Math.floor(s() * 160), fase2: s(),
    galope: 0.012 + 0.022 * k, // lo que te mueve la punta tu propio caballo
    rival: Math.floor(s() * 6), // colores del rival (solo se ve)
  };
  p.estado = "carrera";
}

// Altura del centro del escudo del rival en el ms t
export function escudoEn(p, t) {
  const c = p.carrera;
  if (!c) return 0.5;
  const y = c.base + c.amp * onda((t - c.empieza) / c.periodo + c.fase) + c.amp2 * onda((t - c.empieza) / c.periodo2 + c.fase2);
  return tope(y, 0.16, 0.86);
}
// Lo que el galope mueve tu lanza en el ms t
export function galopeEn(p, t) {
  const c = p.carrera;
  return c ? c.galope * onda(t / 290) : 0;
}
// Por dónde va la carrera: 0 al salir, 1 en el choque
export function avanceEn(p, t) {
  const c = p.carrera;
  if (!c) return 0;
  return tope((t - c.empieza) / c.dura, 0, 1);
}

export function crearPartida(semilla) {
  return {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, movimientos: [], leidos: 0, ultimoT: 0,
    objetivo: LANZA.empieza, lanza: LANZA.empieza, punta: LANZA.empieza,
    estado: "espera", vuelve: EMPIEZA_MS, carrera: null, carreras: 0,
    puntos: 0, centros: 0, golpes: 0, fallos: 0, racha: 0, mejorRacha: 0,
  };
}

export function motivoMovimientoInvalido(p, t, y) {
  if (!Number.isInteger(t) || !Number.isInteger(y)) return "valores que no son enteros";
  if (t < 0 || t > DURACION_MS) return "movimiento fuera de tiempo";
  if (y < 0 || y > 10000) return "altura fuera de sitio";
  const n = p.movimientos.length;
  if (n >= MAX_MOVIMIENTOS * 2) return "demasiados movimientos";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS) return "movimientos demasiado seguidos";
  return null;
}

export function mover(p, t, y) {
  const motivo = motivoMovimientoInvalido(p, t, y);
  if (motivo) throw new Error(motivo);
  p.movimientos.push(t, y);
  p.ultimoT = t;
}

// Tiempo (ms) que ya está decidido: los movimientos nuevos tienen que llevar este tiempo o más.
export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado: { tipo: "sale" | "choque", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    const m = p.movimientos;
    while (p.leidos < m.length && m[p.leidos] <= t) { p.objetivo = tope(m[p.leidos + 1] / 10000, 0, 1); p.leidos += 2; }
    p.lanza += (p.objetivo - p.lanza) * LANZA.seguir * DT;
    if (p.estado === "espera") {
      p.punta = p.lanza;
      // la última carrera tiene que caber entera
      if (t >= p.vuelve && t + Math.max(CARRERA.minima, CARRERA.primera - CARRERA.baja * p.carreras) <= DURACION_MS) {
        nuevaCarrera(p, t);
        pasado.push({ tipo: "sale", t, n: p.carrera.n, dura: p.carrera.dura });
      }
      continue;
    }
    p.punta = tope(p.lanza + galopeEn(p, t), 0, 1);
    const c = p.carrera;
    if (t >= c.choca) {
      const escudo = escudoEn(p, t), dif = p.punta - escudo, d = dif < 0 ? -dif : dif;
      const zona = d <= ESCUDO.centro ? "centro" : d <= ESCUDO.medio ? "medio" : d <= ESCUDO.borde ? "borde" : "fallo";
      let ganados = 0;
      if (zona === "fallo") { p.fallos++; p.racha = 0; }
      else {
        const extra = Math.min(PUNTOS.rachaMax, PUNTOS.racha * p.racha);
        ganados = PUNTOS[zona] + extra;
        p.racha++; p.golpes++;
        if (zona === "centro") p.centros++;
        if (p.racha > p.mejorRacha) p.mejorRacha = p.racha;
      }
      p.puntos += ganados;
      p.carreras++;
      pasado.push({ tipo: "choque", t, zona, ganados, dif, escudo, punta: p.punta, racha: p.racha, n: c.n });
      p.estado = "espera"; p.vuelve = t + VUELTA_MS; p.chocado = { t, zona, escudo, rival: c.rival, n: c.n };
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, centros, golpes, fallos, mejorRacha, carreras } = p;
  return { puntos, centros, golpes, fallos, mejorRacha, carreras };
}

export function rejugar(semilla, movimientos) {
  if (!Array.isArray(movimientos)) return { valida: false, motivo: "faltan los movimientos" };
  if (movimientos.length % 2 || movimientos.length > MAX_MOVIMIENTOS * 2) return { valida: false, motivo: "movimientos mal formados" };
  const p = crearPartida(semilla);
  for (let i = 0; i < movimientos.length; i += 2) {
    const motivo = motivoMovimientoInvalido(p, movimientos[i], movimientos[i + 1]);
    if (motivo) return { valida: false, motivo: `movimiento ${i / 2 + 1}: ${motivo}` };
    p.movimientos.push(movimientos[i], movimientos[i + 1]);
    p.ultimoT = movimientos[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
