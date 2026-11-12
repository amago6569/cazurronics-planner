// ============ LUCHA LEONESA: el motor ============
// Un corro de aluches en un prado de la montaña. Los dos luchadores van agarrados al cinto. El rival intenta una maña
// (te carga a un lado, te levanta o te mete la zancadilla) y se le ve venir un instante antes: hay que contrarla
// deslizando el dedo hacia donde marca. Tres contras seguidas y lo tumbas tú. Si te equivocas o llegas tarde, al suelo.
// Con el tiempo las mañas van más rápidas y el rival amaga: hace que va a un lado y cambia.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos gestos). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Lo que manda el jugador: [t, d, t, d, …] = en el ms t desliza hacia d (0 izquierda, 1 derecha, 2 arriba, 3 abajo).

export const VERSION = 1;
export const DURACION_MS = 45000;
export const PASOS_POR_SEGUNDO = 120;

export const MANAS = ["izquierda", "derecha", "arriba", "abajo"];
export const VENTANA = { primera: 1050, minima: 560, baja: 26 }; // ms para contrar: cada maña, un poco menos
export const AMAGO = { desde: 5, maxima: 0.34, dura: 270 }; // a partir de la sexta maña puede amagar
export const ENTRE = { minimo: 420, azar: 520 }; // ms de guardia entre maña y maña
export const PAUSA = { caida: 1500, alSuelo: 1450, enFalso: 380 }; // lo que se tarda en volver a agarrarse
export const PUNTOS = { contra: 5, rapida: 3, caida: 15, limpio: 2 };
export const PARA_CAIDA = 3; // contras seguidas para tumbarlo
export const RAPIDA = 0.45; // contrar en menos de esta parte de la ventana: premio
export const MAX_GESTOS = 220;
export const SEPARACION_MIN_MS = 70;
export const EMPIEZA_MS = 700;

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

// La maña siguiente del rival: cuándo empieza, hacia dónde, si amaga antes y cuánto deja para contrar
function nuevaMana(p, desde) {
  const s = p.suerte, n = p.manas;
  const empieza = desde + ENTRE.minimo + Math.floor(s() * ENTRE.azar);
  let d = Math.floor(s() * 4);
  if (d === p.ultima && s() < 0.6) d = (d + 1 + Math.floor(s() * 3)) % 4; // que no repita demasiado
  const ventana = Math.max(VENTANA.minima, VENTANA.primera - VENTANA.baja * n);
  const pAmago = n < AMAGO.desde ? 0 : Math.min(AMAGO.maxima, 0.06 * (n - AMAGO.desde + 1));
  const amaga = s() < pAmago;
  const falso = amaga ? (d + 1 + Math.floor(s() * 3)) % 4 : -1;
  const real = empieza + (amaga ? AMAGO.dura : 0);
  p.mana = { n, empieza, falso, real, d, ventana, acaba: real + ventana };
  p.ultima = d;
  p.manas++;
}

export function crearPartida(semilla) {
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, gestos: [], leidos: 0, ultimoT: 0,
    estado: "guardia", // guardia → maña → (caída | al suelo) → guardia…
    mana: null, manas: 0, ultima: -1, vuelve: 0, bloqueo: 0, avisada: false, cambiada: false,
    puntos: 0, contras: 0, caidas: 0, suelos: 0, seguidas: 0, mejorRacha: 0, sinFallo: 0, rapidas: 0, limpias: 0,
  };
  nuevaMana(p, EMPIEZA_MS - ENTRE.minimo);
  return p;
}

export function motivoGestoInvalido(p, t, d) {
  if (!Number.isInteger(t) || !Number.isInteger(d)) return "valores que no son enteros";
  if (t < 0 || t > DURACION_MS) return "gesto fuera de tiempo";
  if (d < 0 || d > 3) return "gesto desconocido";
  const n = p.gestos.length;
  if (n >= MAX_GESTOS * 2) return "demasiados gestos";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS) return "gestos demasiado seguidos";
  return null;
}

export function deslizar(p, t, d) {
  const motivo = motivoGestoInvalido(p, t, d);
  if (motivo) throw new Error(motivo);
  p.gestos.push(t, d);
  p.ultimoT = t;
}

export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

function alSuelo(p, t, motivo, pasado) {
  p.suelos++; p.seguidas = 0; p.sinFallo = 0; p.limpias = 0;
  pasado.push({ tipo: "suelo", t, motivo, d: p.mana.d });
  p.estado = "suelo"; p.vuelve = t + PAUSA.alSuelo;
}

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado:
// { tipo: "amago" | "mana" | "contra" | "caida" | "suelo" | "falso" | "guardia", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    let gesto = -1;
    while (p.leidos < p.gestos.length && p.gestos[p.leidos] <= t) { gesto = p.gestos[p.leidos + 1]; p.leidos += 2; }
    if (p.estado === "suelo" || p.estado === "caida") {
      if (t >= p.vuelve) { p.estado = "guardia"; nuevaMana(p, t); p.avisada = false; p.cambiada = false; pasado.push({ tipo: "guardia", t }); }
      continue;
    }
    const m = p.mana;
    if (t < m.empieza) {
      // en guardia: tirar sin venir a cuento te descoloca un momento
      if (gesto >= 0 && t >= p.bloqueo) {
        p.bloqueo = t + PAUSA.enFalso; p.seguidas = 0;
        m.empieza += 160; m.real += 160; m.acaba += 160;
        pasado.push({ tipo: "falso", t });
      }
      continue;
    }
    if (!p.avisada) {
      p.avisada = true; p.estado = "mana";
      pasado.push(m.falso >= 0 ? { tipo: "amago", t, d: m.falso } : { tipo: "mana", t, d: m.d, ventana: m.ventana });
    }
    if (m.falso >= 0 && !p.cambiada && t >= m.real) { p.cambiada = true; pasado.push({ tipo: "mana", t, d: m.d, ventana: m.ventana, trasAmago: true }); }
    if (gesto >= 0) {
      if (t < m.real) { alSuelo(p, t, "amago", pasado); continue; } // picó en el amago
      if (gesto !== m.d) { alSuelo(p, t, "lado", pasado); continue; }
      // ¡contra!
      const tardo = t - m.real, rapida = tardo <= m.ventana * RAPIDA;
      p.contras++; p.seguidas++; p.sinFallo++;
      if (rapida) p.rapidas++;
      if (p.sinFallo > p.mejorRacha) p.mejorRacha = p.sinFallo;
      let ganados = PUNTOS.contra + (rapida ? PUNTOS.rapida : 0);
      if (p.seguidas >= PARA_CAIDA) {
        const limpio = Math.min(10, PUNTOS.limpio * p.limpias); // caídas seguidas sin ir tú al suelo
        p.limpias++;
        ganados += PUNTOS.caida + limpio;
        p.puntos += ganados; p.caidas++; p.seguidas = 0;
        pasado.push({ tipo: "caida", t, d: m.d, ganados, tardo, rapida, caidas: p.caidas });
        p.estado = "caida"; p.vuelve = t + PAUSA.caida;
      } else {
        p.puntos += ganados;
        pasado.push({ tipo: "contra", t, d: m.d, ganados, tardo, rapida, seguidas: p.seguidas });
        p.estado = "guardia"; nuevaMana(p, t); p.avisada = false; p.cambiada = false;
      }
      continue;
    }
    if (t >= m.acaba) alSuelo(p, t, "tarde", pasado);
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, contras, caidas, suelos, mejorRacha, rapidas } = p;
  return { puntos, contras, caidas, suelos, mejorRacha, rapidas };
}

export function rejugar(semilla, gestos) {
  if (!Array.isArray(gestos)) return { valida: false, motivo: "faltan los gestos" };
  if (gestos.length % 2 || gestos.length > MAX_GESTOS * 2) return { valida: false, motivo: "gestos mal formados" };
  const p = crearPartida(semilla);
  for (let i = 0; i < gestos.length; i += 2) {
    const motivo = motivoGestoInvalido(p, gestos[i], gestos[i + 1]);
    if (motivo) return { valida: false, motivo: `gesto ${i / 2 + 1}: ${motivo}` };
    p.gestos.push(gestos[i], gestos[i + 1]);
    p.ultimoT = gestos[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
