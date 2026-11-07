// Jugadores simulados para la Canasta en la Catedral. Sirven para dos cosas:
//  1. Ajustar la dificultad con números: qué saca alguien que empieza, alguien normal, alguien bueno y alguien muy bueno.
//  2. Saber cuál es el máximo que podría sacar una máquina perfecta, para marcar como sospechoso lo que se le acerque.
// Aquí sí se usa Math.random, seno y logaritmo: esto no es el motor, solo quien lo juega.
import {
  crearPartida, lanzar, simularVuelo, velocidadSalida, xAro, resumen, DURACION_MS, LIMITES,
} from "../../public/liga/motor-canasta.js";

// σ en las mismas unidades que el tiro: s en diezmilésimas de pantalla, a en diezmilésimas de inclinación.
// 0,018 de pantalla son unos 14 px en un móvil normal.
export const NIVELES = {
  novato: { sigmaS: 300, sigmaA: 1000, viento: 0.3, adelanto: 0.2, piensa: [1.5, 0.4] },
  normal: { sigmaS: 180, sigmaA: 600, viento: 0.6, adelanto: 0.5, piensa: [1.1, 0.3] },
  bueno: { sigmaS: 110, sigmaA: 400, viento: 0.85, adelanto: 0.8, piensa: [0.8, 0.2] },
  experto: { sigmaS: 70, sigmaA: 250, viento: 0.95, adelanto: 0.95, piensa: [0.6, 0.15] },
  maquina: { sigmaS: 0, sigmaA: 0, viento: 1, adelanto: 1, piensa: [0.25, 0] },
};

function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function suerteJs(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dirección que hace pasar el balón (sin aro ni tablero) por el centro del aro cuando baja a su altura.
// conViento / conMovimiento: 0 = no lo tiene en cuenta, 1 = lo compensa del todo.
function direccionIdeal(aro, t0, s, conViento, conMovimiento) {
  const aroSinViento = { ...aro, viento: 0 };
  const cruce = (aroUsado, a) => simularVuelo(aroUsado, t0, velocidadSalida(aroUsado, s, a), { choques: false }).cruce;
  const objetivo = (c) => (conMovimiento * c.hx + (1 - conMovimiento) * xAro(aro, t0));
  const resolver = (aroUsado) => {
    let a0 = 0, a1 = 2000;
    let c0 = cruce(aroUsado, a0), c1 = cruce(aroUsado, a1);
    if (!c0 || !c1) return 0;
    for (let i = 0; i < 4; i++) {
      const e0 = c0.x - objetivo(c0), e1 = c1.x - objetivo(c1);
      if (Math.abs(e1 - e0) < 1e-12) break;
      const a2 = a1 - (e1 * (a1 - a0)) / (e1 - e0);
      a0 = a1; c0 = c1; a1 = a2; c1 = cruce(aroUsado, a1);
      if (!c1) return a0;
    }
    return a1;
  };
  const conV = resolver(aro);
  if (conViento >= 1) return conV;
  const sinV = resolver(aroSinViento);
  return sinV + conViento * (conV - sinV);
}

// Fuerza que deja más margen: el centro de la franja más ancha de tiros que entran (con aro y tablero).
// Es lo que acaba haciendo alguien que ha jugado unas cuantas veces.
const cacheFuerza = new Map();
function fuerzaIdeal(aro, t0, a) {
  const clave = aro.amplitud ? null : `${aro.z}|${aro.x}|${aro.viento}|${Math.round(a)}`;
  if (clave && cacheFuerza.has(clave)) return cacheFuerza.get(clave);
  let mejor = 0, mejorCentro = 5600, run = 0, inicio = 0;
  for (let s = LIMITES.s[0]; s <= LIMITES.s[1]; s += 20) {
    const r = simularVuelo(aro, t0, velocidadSalida(aro, s, Math.round(a)));
    if (r.canasta) { if (run === 0) inicio = s; run++; if (run > mejor) { mejor = run; mejorCentro = (inicio + s) / 2; } } else run = 0;
  }
  const res = Math.round(mejorCentro);
  if (clave) cacheFuerza.set(clave, res);
  return res;
}

// Fuerza que hace pasar el balón por el centro del aro sin tocar nada: buscar la limpia (3 puntos), con más riesgo.
function fuerzaDirecta(aro, t0, a) {
  let lo = LIMITES.s[0], hi = LIMITES.s[1];
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    const c = simularVuelo(aro, t0, velocidadSalida(aro, m, Math.round(a)), { choques: false }).cruce;
    if (!c || c.z < aro.z) lo = m; else hi = m;
  }
  return Math.round((lo + hi) / 2);
}

// estrategia: "seguro" (tira donde más margen hay, casi siempre a tablero) o "limpia" (busca el centro del aro)
export function jugarPartida(semilla, nivel, semillaJugador = semilla ^ 0x9e3779b9, estrategia = "seguro") {
  const perfil = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const rand = suerteJs(semillaJugador);
  const partida = crearPartida(semilla);
  const tiros = [];
  let t = 0;
  for (;;) {
    const piensa = Math.max(0.25, perfil.piensa[0] + gauss(rand) * perfil.piensa[1]);
    t = Math.max(partida.listoEn, t + LIMITES.separacion) + Math.round(piensa * 1000);
    if (t > DURACION_MS) break;
    const t0 = t / 1000;
    const aro = partida.aro;
    const a0 = direccionIdeal(aro, t0, 5600, perfil.viento, perfil.adelanto);
    const s0 = estrategia === "limpia" ? fuerzaDirecta(aro, t0, a0) : fuerzaIdeal(aro, t0, a0);
    const a1 = direccionIdeal(aro, t0, s0, perfil.viento, perfil.adelanto);
    const s = Math.round(Math.min(LIMITES.s[1], Math.max(LIMITES.s[0], s0 + gauss(rand) * perfil.sigmaS)));
    const a = Math.round(Math.min(LIMITES.a[1], Math.max(LIMITES.a[0], a1 + gauss(rand) * perfil.sigmaA)));
    const tiro = { t, s, a };
    lanzar(partida, tiro);
    tiros.push(tiro);
  }
  return { ...resumen(partida), lista: tiros, semilla };
}

export function estadisticas(valores) {
  const v = [...valores].sort((x, y) => x - y);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  return { media: Math.round(media * 10) / 10, p10: q(0.1), p50: q(0.5), p90: q(0.9), max: v[v.length - 1] };
}
