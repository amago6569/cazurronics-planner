// ============ EL PENDÓN: el motor ============
// Llevas un pendón leonés de pie, con el palo apoyado abajo. Mueves la base de lado a lado con el dedo para que no
// se caiga, como quien sujeta una escoba en la palma. Sopla el viento a rachas, y cada vez más. Cuanto más derecho
// y más tiempo aguantes, más puntos. Si se cae, se pierde un rato en levantarlo.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos movimientos del dedo). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: el palo se
// mueve con la fórmula del péndulo invertido «de ángulos pequeños», que solo usa sumas y productos.
//
// Unidades: x de la base en anchos de media pantalla (entre -LIMITE_X y LIMITE_X); ángulo en radianes (positivo = se inclina a la derecha);
// tiempo en ms de partida.

export const VERSION = 2; // 2: sin paredes a los lados (la plaza sigue al pendonero) y base más rápida
export const DURACION_MS = 45000;
export const PASOS_POR_SEGUNDO = 240;
const DT = 1 / PASOS_POR_SEGUNDO;

export const LIMITE_X = 6; // la plaza es ancha: la cámara sigue al pendonero, no hay pared que te impida salvarlo
export const BASE = { seguir: 16, velocidad: 5, aceleracion: 50 }; // cómo sigue la base al dedo
export const CAE = 0.6; // pasado este ángulo, se cae
export const PLOMO = 0.1; // por debajo, «a plomo» (cuenta doble)
export const LEVANTAR_MS = 1500;
export const AIRE = 1.8; // lo que frena la tela del pendón al moverse
export const ACOPLE = 3; // cuánto endereza el palo mover la base (más = hace falta mover menos)
export const EMPIEZA_MS = 400;
export const CADA_MS = 250; // cada cuánto se suman puntos
export const RACHA_MS = 10000; // desde 10 s seguidos sin caerse, +1 cada vez
export const MAX_MOVIMIENTOS = 2700; // como mucho 60 por segundo
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

// Lo pesado que es (cuánto tira el palo hacia donde se inclina): sube a lo largo de la partida
export function gravedad(t) { return 1.8 + (2.0 * t) / DURACION_MS; }

// Viento de toda la partida: puntos cada 0,9-2,2 s y en medio, en línea recta. Cada vez más fuerte.
function generarViento(suerte) {
  const nudos = [[0, 0]];
  let t = 1200;
  while (t < DURACION_MS + 2500) {
    const k = t / DURACION_MS, fuerza = 0.15 + 0.35 * (k > 1 ? 1 : k);
    const racha = t > 6000 && suerte() < 0.18; // de vez en cuando, un golpe de viento
    const v = (suerte() * 2 - 1) * fuerza * (racha ? 1.3 : 1);
    nudos.push([t, v]);
    t += Math.round(racha ? 700 + 400 * suerte() : 900 + 1300 * suerte());
  }
  return nudos;
}
export function vientoEn(p, t) {
  const n = p.viento;
  while (p.iv + 1 < n.length - 1 && n[p.iv + 1][0] <= t) p.iv++;
  while (p.iv > 0 && n[p.iv][0] > t) p.iv--;
  const [t0, v0] = n[p.iv], [t1, v1] = n[p.iv + 1];
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  return {
    version: VERSION, semilla: semilla >>> 0,
    viento: generarViento(suerte), iv: 0,
    paso: 0, x: 0, v: 0, a: 0, angulo: 0, giro: 0, objetivo: 0,
    levantaHasta: 0, dePieDesde: EMPIEZA_MS, siguienteCuenta: EMPIEZA_MS + CADA_MS,
    movimientos: [], leidos: 0, ultimoT: 0,
    puntos: 0, caidas: 0, plomo: 0, mejorAguante: 0, segundos: 0,
  };
}

export function motivoMovimientoInvalido(p, t, x) {
  if (!Number.isInteger(t) || !Number.isInteger(x)) return "valores que no son enteros";
  if (x < -LIMITE_X * 10000 || x > LIMITE_X * 10000) return "posición fuera de la plaza";
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

// Tiempo (ms) que ya está decidido: los movimientos nuevos tienen que llevar este tiempo o más.
export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado: { tipo: "cae" | "arriba" | "puntos", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
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
    // la base va hacia el dedo, con su velocidad y su aceleración máximas
    let vq = (p.objetivo - p.x) * BASE.seguir;
    if (vq > BASE.velocidad) vq = BASE.velocidad; else if (vq < -BASE.velocidad) vq = -BASE.velocidad;
    let dv = vq - p.v; const dvm = BASE.aceleracion * DT;
    if (dv > dvm) dv = dvm; else if (dv < -dvm) dv = -dvm;
    p.v += dv;
    p.x += p.v * DT;
    if (p.x > LIMITE_X) { p.x = LIMITE_X; dv -= p.v; p.v = 0; } else if (p.x < -LIMITE_X) { p.x = -LIMITE_X; dv -= p.v; p.v = 0; }
    p.a = dv / DT;
    if (t < p.levantaHasta || t < EMPIEZA_MS) continue; // levantándolo (o aún no ha empezado): el palo, quieto
    if (p.levantaHasta && p.dePieDesde < p.levantaHasta) { p.dePieDesde = p.levantaHasta; pasado.push({ tipo: "arriba", t }); }
    // el palo: lo tira la gravedad hacia donde se inclina, lo endereza mover la base hacia ese lado, y sopla el viento
    const acel = gravedad(t) * p.angulo - ACOPLE * p.a + vientoEn(p, t) - AIRE * p.giro;
    p.giro += acel * DT;
    p.angulo += p.giro * DT;
    if (p.angulo >= CAE || p.angulo <= -CAE) {
      const aguante = t - p.dePieDesde;
      if (aguante > p.mejorAguante) p.mejorAguante = aguante;
      pasado.push({ tipo: "cae", t, lado: p.angulo > 0 ? 1 : -1, aguante });
      p.caidas++;
      p.angulo = 0; p.giro = 0;
      p.levantaHasta = t + LEVANTAR_MS;
      p.siguienteCuenta = p.levantaHasta + CADA_MS;
      continue;
    }
    if (t >= p.siguienteCuenta) {
      p.siguienteCuenta += CADA_MS;
      const aguante = t - p.dePieDesde;
      const plomo = p.angulo < PLOMO && p.angulo > -PLOMO;
      const ganados = 1 + (plomo ? 1 : 0) + (aguante >= RACHA_MS ? 1 : 0);
      p.puntos += ganados;
      if (plomo) p.plomo++;
      p.segundos++;
      if (aguante > p.mejorAguante) p.mejorAguante = aguante;
      pasado.push({ tipo: "puntos", t, ganados, plomo, aguante });
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, caidas, plomo, mejorAguante } = p;
  return { puntos, caidas, plomo, mejorAguante: Math.floor(mejorAguante / 1000), dePie: Math.floor((p.segundos * CADA_MS) / 1000) };
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
