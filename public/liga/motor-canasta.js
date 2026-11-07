// Motor de «Canasta en la Catedral», primer minijuego de la Liga Cazurra.
//
// Es la única fuente de verdad de la puntuación. El navegador lo usa para animar cada tiro y el servidor lo usa para
// repetir la partida entera a partir de la semilla y de los tiros que manda el jugador. Si los dos no dan lo mismo,
// la partida no vale. Por eso aquí:
//  · no hay Math.random (la suerte sale de la semilla) ni Date.now (el tiempo es el de la partida, en ms);
//  · solo se usan + − × ÷, raíz cuadrada, floor, abs, min y max, que dan el mismo resultado en todos los navegadores
//    y en Node. Nada de seno, coseno ni potencias, que pueden variar en el último decimal entre motores de JavaScript.
//  · los tiros llegan como números enteros (ms y diezmilésimas), así navegador y servidor parten de lo mismo.
//
// Unidades: metros, segundos. Ejes: x a la derecha, y hacia arriba, z hacia la catedral (lejos del jugador).

export const VERSION = 1;
export const DURACION_MS = 40000; // 40 segundos por intento
export const MAX_TIROS = 60;

// ── Física ──
const G = 9.81;
const DT = 1 / 240; // paso fijo de la simulación (s)
const VUELO_MAX = 3.5; // s; si en ese tiempo no ha entrado ni caído, cuenta como fallo
export const R_BALON = 0.12;
export const R_ARO = 0.25; // radio interior del aro: 50 cm de diámetro, algo más generoso que el reglamentario (45,7)
const R_TUBO = 0.01; // grosor del hierro del aro
export const ALTURA_ARO = 3.05;
export const ARO_TABLERO = 0.38; // del centro del aro a la cara del tablero
export const TABLERO = { ancho: 1.8, abajo: 2.9, arriba: 3.95 };
const MURO = 0.2; // la fachada está 20 cm detrás del tablero
export const SALIDA = { x: 0, y: 1.25, z: 0.3 }; // donde está el balón antes de tirar
const REB_ARO = 0.55; // cuánto rebota en el aro (0 = nada, 1 = todo)
const ROCE_ARO = 0.9;
const REB_TABLERO = 0.6;
const ESPERA_BALON = 0.35; // s desde que se decide un tiro hasta que sale el balón siguiente

// Ángulo de tiro fijo de 58°: el jugador decide la fuerza (largo del deslizamiento) y la dirección.
const COS_ANG = 0.5299192642332049;
const SIN_ANG = 0.848048096156426;
const V_BASE = 5.43; // m/s con un deslizamiento de largo 0 (así, deslizar justo hasta la canasta del principio entra)
const V_POR_PANTALLA = 5.09; // m/s más por cada pantalla de alto deslizada

// ── Cámara (también la usa el dibujo). Unidades de pantalla: 1 = alto de la pantalla. ──
export const CAMARA = { y: 1.5, z: -3.0, focal: 1.6, horizonte: 0.70 };

// ── Entradas válidas (enteros) ──
export const LIMITES = {
  s: [600, 8000], // largo del deslizamiento en diezmilésimas de pantalla (0,06 a 0,8)
  a: [-30000, 30000], // inclinación (dx/dy) en diezmilésimas (−3 a 3)
  separacion: 250, // ms mínimos entre dos tiros: más rápido no lo hace una persona
};

// ── Puntos ──
export const PUNTOS = { canasta: 2, limpia: 3 };
// racha: a partir de la 3.ª canasta seguida, +1; a partir de la 6.ª, +2
const bonoRacha = (racha) => (racha >= 6 ? 2 : racha >= 3 ? 1 : 0);

// ── Suerte reproducible: mulberry32 (enteros de 32 bits, igual en todas partes) ──
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

// ── Niveles: la canasta cambia de sitio solo cuando metes; si fallas, sigue igual para que corrijas ──
//  0-2 canastas: quieta y centrada · 3-5: cambia de sitio y de distancia · 6-9: además, viento (el cierzo)
//  10 o más: además, se mueve de lado a lado.
export function nivelDe(canastas) {
  if (canastas >= 10) return 4;
  if (canastas >= 6) return 3;
  if (canastas >= 3) return 2;
  return 1;
}

export function nuevoAro(nivel, suerte) {
  if (nivel === 1) return { z: 4.2, x: 0, viento: 0, amplitud: 0, periodo: 1, fase: 0 };
  const u1 = suerte(), u2 = suerte(), u3 = suerte(), u4 = suerte();
  const lejos = nivel === 4 ? 1.0 : 1.3;
  const aro = { z: 3.9 + u1 * lejos, x: (u2 - 0.5) * 1.1, viento: 0, amplitud: 0, periodo: 1, fase: 0 };
  if (nivel >= 3) aro.viento = (u3 - 0.5) * 3.2; // aceleración lateral, ±1,6 m/s²
  if (nivel === 4) { aro.x = (u2 - 0.5) * 0.3; aro.amplitud = 0.45; aro.periodo = 3.2; aro.fase = u4; }
  return aro;
}

// x del aro en el instante t (s de partida). Movimiento en zigzag (onda triangular): sin senos.
export function xAro(aro, t) {
  if (!aro.amplitud) return aro.x;
  const p = t / aro.periodo + aro.fase;
  const f = p - Math.floor(p);
  return aro.x + aro.amplitud * (4 * Math.abs(f - 0.5) - 1);
}

// Con qué ganancia se convierte la inclinación del dedo en dirección del balón, para que deslizar hacia la canasta
// (tal como se ve en pantalla) mande el balón hacia ella, esté cerca o lejos.
function ganancia(zAro) {
  const c = CAMARA;
  return ((c.y - SALIDA.y) / (SALIDA.z - c.z) + (ALTURA_ARO - c.y) / (zAro - c.z)) * (zAro - c.z) / (zAro - SALIDA.z);
}

// Velocidad de salida a partir del tiro {s, a} en enteros.
export function velocidadSalida(aro, s, a) {
  const v = V_BASE + V_POR_PANTALLA * (s / 10000);
  const vz = v * COS_ANG;
  return { x: (a / 10000) * ganancia(aro.z) * vz, y: v * SIN_ANG, z: vz };
}

// ── Un tiro, paso a paso. Devuelve el resultado y (si se pide) la trayectoria para dibujarla. ──
// opciones.choques = false → sin aro ni tablero (lo usan las pruebas para buscar el tiro ideal).
export function simularVuelo(aro, t0, vel, opciones = {}) {
  const conChoques = opciones.choques !== false;
  const guardar = !!opciones.trayectoria;
  const p = { x: SALIDA.x, y: SALIDA.y, z: SALIDA.z };
  const v = { x: vel.x, y: vel.y, z: vel.z };
  const tray = guardar ? [] : null;
  const eventos = guardar ? [] : null; // para los sonidos: [paso, "aro" | "tablero" | "muro"]
  let enAro = false;
  let tocoAro = false, tocoTablero = false, porAbajo = false, muro = false;
  const zTablero = aro.z + ARO_TABLERO;
  const pasos = Math.floor(VUELO_MAX / DT);
  for (let k = 1; k <= pasos; k++) {
    const t = t0 + k * DT;
    const hx = xAro(aro, t);
    const yAntes = p.y;
    v.y -= G * DT;
    v.x += aro.viento * DT;
    p.x += v.x * DT; p.y += v.y * DT; p.z += v.z * DT;

    if (conChoques) {
      // tablero (solo la cara delantera, dentro de sus bordes)
      if (v.z > 0 && p.z + R_BALON > zTablero && p.z - R_BALON < zTablero + 0.05
        && Math.abs(p.x - hx) < TABLERO.ancho / 2 && p.y > TABLERO.abajo && p.y < TABLERO.arriba) {
        p.z = zTablero - R_BALON; v.z = -v.z * REB_TABLERO; v.x *= 0.9; v.y *= 0.9; tocoTablero = true;
        if (guardar) eventos.push(k, "tablero");
      }
      // fachada de la catedral, detrás de todo: si el balón llega a la piedra, ya no puede entrar
      if (v.z > 0 && p.z + R_BALON > zTablero + MURO) { p.z = zTablero + MURO - R_BALON; v.z = -v.z * 0.4; muro = true; if (guardar) eventos.push(k, "muro"); }
      // aro: el punto del hierro más cercano al balón
      const dx = p.x - hx, dz = p.z - aro.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
      const nx = dx - ux * R_ARO, ny = p.y - ALTURA_ARO, nz = dz - uz * R_ARO;
      const dn = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const minimo = R_BALON + R_TUBO;
      if (dn < minimo && dn > 1e-9) {
        const ex = nx / dn, ey = ny / dn, ez = nz / dn;
        const empuje = minimo - dn;
        p.x += ex * empuje; p.y += ey * empuje; p.z += ez * empuje;
        const vn = v.x * ex + v.y * ey + v.z * ez;
        if (vn < 0) {
          // separa la parte que choca (normal) de la que roza (tangente)
          const tx = v.x - vn * ex, ty = v.y - vn * ey, tz = v.z - vn * ez;
          v.x = tx * ROCE_ARO - vn * REB_ARO * ex;
          v.y = ty * ROCE_ARO - vn * REB_ARO * ey;
          v.z = tz * ROCE_ARO - vn * REB_ARO * ez;
        }
        if (guardar && !enAro) eventos.push(k, "aro");
        tocoAro = true;
        enAro = true;
      } else enAro = false;
    }

    if (guardar) tray.push(p.x, p.y, p.z);

    // ¿cruza la altura del aro?
    const hdx = p.x - hx, hdz = p.z - aro.z;
    const dentro = hdx * hdx + hdz * hdz < R_ARO * R_ARO;
    if (yAntes < ALTURA_ARO && p.y >= ALTURA_ARO && dentro) porAbajo = true; // entrar por debajo no vale
    if (yAntes >= ALTURA_ARO && p.y < ALTURA_ARO) {
      if (dentro && !porAbajo && !muro && conChoques) {
        return { canasta: true, limpia: !tocoAro && !tocoTablero, tocoAro, tocoTablero, fin: t, tray, eventos };
      }
      if (!conChoques) return { canasta: false, cruce: { x: p.x, z: p.z, hx, t }, fin: t, tray };
    }
    // fallo claro: ya cae por debajo del aro, o se escapa
    if ((v.y < 0 && p.y < ALTURA_ARO - 0.7) || p.z < -1.5) {
      return { canasta: false, limpia: false, tocoAro, tocoTablero, muro, fin: t, tray, eventos };
    }
  }
  return { canasta: false, limpia: false, tocoAro, tocoTablero, muro, fin: t0 + VUELO_MAX, tray, eventos };
}

// ── La partida ──
export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  return {
    version: VERSION,
    semilla: semilla >>> 0,
    suerte,
    aro: nuevoAro(1, suerte),
    nivel: 1,
    listoEn: 0, // ms de partida a partir de los que se puede tirar
    ultimoTiro: -Infinity,
    puntos: 0, canastas: 0, tiros: 0, limpias: 0, racha: 0, mejorRacha: 0,
    terminada: false,
  };
}

// Comprueba que un tiro es posible. Devuelve el motivo si no lo es.
export function motivoInvalido(partida, tiro) {
  if (!tiro || typeof tiro !== "object") return "tiro sin datos";
  const { t, s, a } = tiro;
  if (![t, s, a].every(Number.isInteger)) return "valores que no son enteros";
  if (s < LIMITES.s[0] || s > LIMITES.s[1]) return "fuerza fuera de rango";
  if (a < LIMITES.a[0] || a > LIMITES.a[1]) return "dirección fuera de rango";
  if (t < 0 || t > DURACION_MS) return "tiro fuera de tiempo";
  if (t < partida.listoEn) return "tiro antes de tener balón";
  if (t - partida.ultimoTiro < LIMITES.separacion) return "tiros demasiado seguidos";
  if (partida.tiros >= MAX_TIROS) return "demasiados tiros";
  return null;
}

// Tira. Cambia la partida y devuelve lo que ha pasado. Lanza un error si el tiro no es posible.
export function lanzar(partida, tiro, opciones = {}) {
  const motivo = motivoInvalido(partida, tiro);
  if (motivo) throw new Error(motivo);
  const aro = partida.aro;
  const t0 = tiro.t / 1000;
  const vel = velocidadSalida(aro, tiro.s, tiro.a);
  const r = simularVuelo(aro, t0, vel, { trayectoria: opciones.trayectoria });
  partida.tiros++;
  partida.ultimoTiro = tiro.t;
  let ganados = 0;
  const nivelAntes = partida.nivel;
  if (r.canasta) {
    partida.canastas++;
    partida.racha++;
    partida.mejorRacha = Math.max(partida.mejorRacha, partida.racha);
    if (r.limpia) partida.limpias++;
    ganados = (r.limpia ? PUNTOS.limpia : PUNTOS.canasta) + bonoRacha(partida.racha);
    partida.puntos += ganados;
    partida.nivel = nivelDe(partida.canastas);
    partida.aro = nuevoAro(partida.nivel, partida.suerte);
  } else {
    partida.racha = 0;
  }
  // el balón siguiente sale cuando se decide este, redondeado al ms
  partida.listoEn = Math.ceil((r.fin + ESPERA_BALON) * 1000);
  return {
    canasta: r.canasta, limpia: !!r.limpia, tocoAro: r.tocoAro, tocoTablero: r.tocoTablero,
    ganados, racha: partida.racha, subeNivel: partida.nivel !== nivelAntes ? partida.nivel : 0,
    muro: !!r.muro, aroDelTiro: aro, t0, fin: r.fin, tray: r.tray, eventos: r.eventos, listoEn: partida.listoEn,
  };
}

export function resumen(partida) {
  const { puntos, canastas, tiros, limpias, mejorRacha } = partida;
  return { puntos, canastas, tiros, limpias, mejorRacha };
}

// Lo que hace el servidor: repetir la partida entera con la semilla y los tiros. Si un tiro no es posible,
// la partida no vale (no se queda con «los tiros buenos»: o vale entera o no vale).
export function rejugar(semilla, tiros) {
  if (!Array.isArray(tiros)) return { valida: false, motivo: "faltan los tiros" };
  if (tiros.length > MAX_TIROS) return { valida: false, motivo: "demasiados tiros" };
  const partida = crearPartida(semilla);
  for (let i = 0; i < tiros.length; i++) {
    const motivo = motivoInvalido(partida, tiros[i]);
    if (motivo) return { valida: false, motivo: `tiro ${i + 1}: ${motivo}` };
    lanzar(partida, tiros[i]);
  }
  return { valida: true, ...resumen(partida) };
}

// Proyección a pantalla (unidades: alto de pantalla; x relativa al centro). La usa el dibujo.
export const PASO = DT;
export function proyectar(x, y, z) {
  const c = CAMARA;
  const prof = z - c.z;
  return { x: (c.focal * x) / prof, y: c.horizonte - (c.focal * (y - c.y)) / prof, escala: c.focal / prof };
}
