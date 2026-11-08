// ============ BAJADA EN SAN ISIDRO: el motor ============
// Bajas una pista de eslalon en la estación de San Isidro. Vas solo hacia abajo, cada vez más deprisa; tú llevas
// el esquiador de lado a lado con el dedo. Hay que pasar entre los dos palos de cada puerta y no chocar con los
// pinos. Las puertas son cada vez más estrechas y llegan más seguidas.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos movimientos del dedo). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Unidades: x de la pista entre -1 y 1; tiempo en ms de partida. Cada cosa (puerta o pino) se decide en el ms en
// que el esquiador llega a su altura («tc»).

export const VERSION = 1;
export const DURACION_MS = 45000;
export const PASOS_POR_SEGUNDO = 240;
const DT = 1 / PASOS_POR_SEGUNDO;

export const LIMITE_X = 0.85;
export const ESQUIADOR = { medio: 0.05, velocidad: 2.4 }; // media anchura y velocidad de lado máxima
export const PINO = 0.09; // radio de un pino
export const CAIDA_MS = 900; // tras chocar, ese rato sin poder girar
export const MAX_MOVIMIENTOS = 2700;
export const SEPARACION_MIN_MS = 8;
export const PUNTOS = { puerta: 2, centro: 1, pino: -3 };

export function multiplicador(racha) { return racha >= 12 ? 3 : racha >= 5 ? 2 : 1; }

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

// Velocidad de bajada (solo para dibujar a qué distancia está cada cosa): sube con el tiempo
export function velocidadBajada(t) { return 5 + (4 * t) / DURACION_MS; }
// Metros (unidades) recorridos hasta el ms t: integral de la velocidad
export function recorrido(t) { const s = t / 1000; return 5 * s + (2 * s * s * 1000) / DURACION_MS; }

// ── La pista entera, decidida al empezar con la semilla ──
// Cada puerta se puede alcanzar desde la anterior a la velocidad del esquiador (con margen), y ningún pino está en
// el pasillo entre dos puertas seguidas.
function generar(suerte) {
  const cosas = [];
  let t = 1600, x = 0, lado = suerte() < 0.5 ? -1 : 1, id = 0, color = 0;
  while (t < DURACION_MS - 200) {
    const k = t / DURACION_MS;
    const gap = Math.round((1100 - 600 * k) * (0.85 + 0.3 * suerte()));
    const alcance = ESQUIADOR.velocidad * 0.62 * (gap / 1000);
    let salto = (0.25 + 0.5 * suerte()) * (0.6 + 0.4 * k) * 1.6;
    if (salto > alcance) salto = alcance;
    let nx = x + lado * salto;
    if (nx > 0.68 || nx < -0.68) { lado = -lado; nx = x + lado * salto; }
    if (nx > 0.68) nx = 0.68; else if (nx < -0.68) nx = -0.68;
    const tc = t + gap;
    if (tc > DURACION_MS) break;
    // un pino entre las dos puertas, fuera del pasillo que va de una a otra (así cualquier camino derecho lo evita)
    if (t > 4000 && suerte() < 0.4 + 0.4 * k) {
      const tp = Math.round(t + gap * (0.3 + 0.4 * suerte()));
      const libre = ESQUIADOR.medio + PINO + 0.06;
      const iz = (x < nx ? x : nx) - libre, de = (x < nx ? nx : x) + libre;
      const hueco = (iz + 0.88) + (0.88 - de); // sitio a los lados del pasillo
      if (hueco > 0.05) {
        const u = suerte() * hueco;
        const xp = u < iz + 0.88 ? -0.88 + u : de + (u - (iz + 0.88));
        cosas.push({ id: id++, tipo: "pino", tc: tp, x: xp });
      }
    }
    const medio = 0.2 - 0.1 * k; // media anchura de la puerta
    cosas.push({ id: id++, tipo: "puerta", tc, x: nx, medio, color: color++ % 2 });
    x = nx; lado = -lado; t = tc;
  }
  cosas.sort((a, b) => a.tc - b.tc || a.id - b.id);
  return cosas;
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  return {
    version: VERSION, semilla: semilla >>> 0,
    cosas: generar(suerte), siguiente: 0,
    paso: 0, x: 0, objetivo: 0, quietoHasta: 0,
    movimientos: [], leidos: 0, ultimoT: 0,
    puntos: 0, racha: 0, mejorRacha: 0, puertas: 0, fallos: 0, choques: 0, centros: 0,
  };
}

export function motivoMovimientoInvalido(p, t, x) {
  if (!Number.isInteger(t) || !Number.isInteger(x)) return "valores que no son enteros";
  if (x < -10000 || x > 10000) return "posición fuera de la pista";
  if (t < 0 || t > DURACION_MS) return "movimiento fuera de tiempo";
  const n = p.movimientos.length;
  if (n >= MAX_MOVIMIENTOS * 2) return "demasiados movimientos";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS) return "movimientos demasiado seguidos";
  return null;
}

export function mover(p, t, x) {
  const motivo = motivoMovimientoInvalido(p, t, x);
  if (motivo) throw new Error(motivo);
  p.movimientos.push(t, x);
  p.ultimoT = t;
}

export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza hasta el ms «hasta». Devuelve las cosas decididas en este trozo (con su resultado en «res»).
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const decididas = [];
  const v = ESQUIADOR.velocidad * DT;
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    const m = p.movimientos;
    while (p.leidos < m.length && m[p.leidos] <= t) {
      const x = m[p.leidos + 1] / 10000;
      p.objetivo = x > LIMITE_X ? LIMITE_X : x < -LIMITE_X ? -LIMITE_X : x;
      p.leidos += 2;
    }
    if (t >= p.quietoHasta) {
      const d = p.objetivo - p.x;
      p.x = d <= v && d >= -v ? p.objetivo : p.x + (d > 0 ? v : -v);
    }
    while (p.siguiente < p.cosas.length && p.cosas[p.siguiente].tc <= t) {
      const c = p.cosas[p.siguiente++];
      const dx = p.x - c.x;
      let ganados = 0, bien = false, centro = false;
      if (c.tipo === "puerta") {
        bien = dx <= c.medio - ESQUIADOR.medio && dx >= -(c.medio - ESQUIADOR.medio);
        if (bien) {
          centro = dx <= c.medio * 0.25 && dx >= -c.medio * 0.25;
          p.racha++; if (p.racha > p.mejorRacha) p.mejorRacha = p.racha;
          ganados = (PUNTOS.puerta + (centro ? PUNTOS.centro : 0)) * multiplicador(p.racha);
          p.puertas++; if (centro) p.centros++;
        } else { p.racha = 0; p.fallos++; }
      } else {
        const toca = dx < PINO + ESQUIADOR.medio && dx > -(PINO + ESQUIADOR.medio);
        if (toca) {
          ganados = p.puntos + PUNTOS.pino < 0 ? -p.puntos : PUNTOS.pino;
          p.racha = 0; p.choques++;
          p.quietoHasta = t + CAIDA_MS;
        }
        bien = !toca;
      }
      p.puntos += ganados;
      c.res = { bien, centro, dx, ganados, racha: p.racha };
      decididas.push(c);
    }
  }
  return decididas;
}

export function resumen(p) {
  const { puntos, puertas, fallos, choques, centros, mejorRacha } = p;
  return { puntos, puertas, fallos, choques, centros, mejorRacha, total: p.cosas.filter((c) => c.tipo === "puerta").length };
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
