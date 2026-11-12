// ============ BOLOS LEONESES: el motor ============
// Una bolera de pueblo: nueve bolos en cuadro (el castro) y, a un lado, el miche, el pequeño. La bola leonesa es media
// esfera y no va recta: se tira con efecto para que entre torcida y se lleve más bolos y el miche. Cada tirada son dos
// bolas; después se vuelve a armar el castro, cada vez en un sitio.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos tiros). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: sumas, productos,
// divisiones y raíces cuadradas, que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Lo que manda el jugador: [t, x, a, c, s, …] = en el ms t suelta la bola desde x (milésimas de metro), con dirección
// a (milésimas: lo que se va de lado por cada metro), efecto c (−1000 a 1000) y fuerza s (0 a 1000).
// Unidades: metros. x de lado (0 el centro), y hacia el fondo (0 la raya de tiro).

export const VERSION = 1;
export const DURACION_MS = 50000;
export const PASOS_POR_SEGUNDO = 120;

export const LARGO = 6; // de la raya al tablón del fondo
export const ANCHO = 1.15; // media anchura de la bolera
export const CASTRO = { y: 4.3, paso: 0.34 }; // la fila de delante y la separación entre bolos
export const MICHE = { lado: 0.8, y: 5.15 }; // el miche: a un lado y más al fondo
export const BOLA = 0.12, BOLO = 0.055, ALTO = 0.4; // radios y alto de un bolo
export const TIRO = { xMax: 700, aMax: 420, cMax: 1000, sMax: 1000 };
export const EFECTO = 1.25; // metros que tuerce al fondo una bola floja con todo el efecto
export const VELOCIDAD = { minima: 2.6, mas: 3.6 }; // m/s: la más floja y lo que suma la fuerza
export const PUNTOS = { bolo: 2, medio: 4, miche: 6, pleno: 12, plenoDeUna: 20 };
export const RECOGER_MS = 650; // de que la bola para a poder tirar otra
export const ARMAR_MS = 500; // armar el castro
export const MAX_TIROS = 40;
export const EMPIEZA_MS = 300;
const PASO_Y = 0.02;

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

// Arma el castro: nueve bolos (0–8, por filas de delante atrás; el 4 es el del medio) y el miche (9)
function armar(p) {
  const s = p.suerte, n = p.tiradas;
  const cx = (s() - 0.5) * (n < 2 ? 0.5 : 0.95);
  const lado = s() < 0.5 ? -1 : 1;
  const bolos = [];
  for (let f = 0; f < 3; f++) for (let c = -1; c <= 1; c++) bolos.push({ i: bolos.length, x: cx + c * CASTRO.paso, y: CASTRO.y + f * CASTRO.paso, pie: true, dx: 0, dy: 0, miche: false });
  bolos.push({ i: 9, x: cx + lado * MICHE.lado, y: MICHE.y, pie: true, dx: 0, dy: 0, miche: true });
  p.bolos = bolos; p.cx = cx; p.lado = lado; p.bolas = 0; p.caidosTirada = 0;
}

// Por dónde va la bola a la altura y
export function xBola(tiro, y) {
  const k = y / LARGO;
  return tiro.x + tiro.a * y + tiro.c * EFECTO * (1.3 - 0.6 * tiro.s) * k * k + (tiro.desvio || 0);
}
export const velocidad = (s) => VELOCIDAD.minima + VELOCIDAD.mas * s;

// Tira un bolo y mira si, al caer, se lleva a otros (el que cae se tumba «largo» metros hacia dx, dy)
function tumbar(bolos, b, dx, dy, largo, y, golpes, hondo) {
  b.pie = false; b.dx = dx; b.dy = dy;
  golpes.push({ y, i: b.i, dx, dy, hondo });
  if (largo < 0.12) return;
  for (const o of bolos) {
    if (!o.pie) continue;
    // distancia de «o» al bolo tumbado (un segmento desde su pie)
    const ex = o.x - b.x, ey = o.y - b.y;
    let u = ex * dx + ey * dy;
    if (u < 0) u = 0; else if (u > largo) u = largo;
    const qx = ex - dx * u, qy = ey - dy * u, d2 = qx * qx + qy * qy;
    const toca = BOLO + 0.045;
    if (d2 > toca * toca) continue;
    // sale hacia donde le empujan: mezcla de la caída y de por dónde le dan
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    let nx = dx + (ex / l) * 0.8, ny = dy + (ey / l) * 0.8;
    const nl = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nl; ny /= nl;
    tumbar(bolos, o, nx, ny, largo * 0.78, y + 0.05 * (hondo + 1), golpes, hondo + 1);
  }
}

// El tiro entero, sin tocar la partida: qué bolos caen y cuándo (por la altura «y» a la que va la bola)
// bolos: [{ i, x, y, pie, miche }] (se modifica: pásale una copia si no quieres) · tiro: { x, a, c, s } en metros
export function simularTiro(bolos, tiro) {
  const golpes = [], desvios = []; // desvios: lo que los bolos han apartado la bola, y desde qué altura
  let energia = 0.42 + tiro.s, desvio = 0, fin = LARGO - 0.15, fuera = false;
  const t = { ...tiro, desvio: 0 };
  for (let y = 0.3; y <= LARGO - 0.15; y += PASO_Y) {
    t.desvio = desvio;
    const x = xBola(t, y);
    if (x > ANCHO || x < -ANCHO) { fin = y; fuera = true; break; }
    let paro = false;
    for (const b of bolos) {
      if (!b.pie) continue;
      const ex = b.x - x, ey = b.y - y, d2 = ex * ex + ey * ey, toca = BOLA + BOLO;
      if (d2 > toca * toca) continue;
      // hacia dónde lleva la bola (la tangente de su camino) y hacia dónde queda el bolo
      const x2 = xBola(t, y + PASO_Y), tx = x2 - x, tl = Math.sqrt(tx * tx + PASO_Y * PASO_Y);
      const l = Math.sqrt(d2) || 1;
      let nx = ex / l + (tx / tl) * 0.9, ny = ey / l + (PASO_Y / tl) * 0.9;
      const nl = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nl; ny /= nl;
      tumbar(bolos, b, nx, ny, ALTO * (0.62 + 0.38 * tiro.s) * (b.miche ? 0.6 : 1), y, golpes, 0);
      energia -= b.miche ? 0.1 : 0.2;
      desvio += ex > 0 ? -0.03 : 0.03; // el bolo aparta un poco la bola
      desvios.push({ y, d: desvio });
      if (energia <= 0) { paro = true; break; }
    }
    if (paro) { fin = y + 0.1; break; }
  }
  return { golpes, desvios, fin, fuera };
}

export function crearPartida(semilla) {
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, tiros: [], leidos: 0, ultimoT: 0,
    estado: "armando", listoEn: EMPIEZA_MS, // armando → listo → bola → (listo | armando)…
    bolos: [], cx: 0, lado: 1, bolas: 0, tiradas: 0, caidosTirada: 0,
    vuelo: null, iGolpe: 0,
    puntos: 0, derribados: 0, miches: 0, plenos: 0, lanzadas: 0, blancas: 0,
  };
  armar(p);
  return p;
}

export function motivoTiroInvalido(p, t, x, a, c, s) {
  if (![t, x, a, c, s].every(Number.isInteger)) return "valores que no son enteros";
  if (t < 0 || t > DURACION_MS) return "tiro fuera de tiempo";
  if (x < -TIRO.xMax || x > TIRO.xMax || a < -TIRO.aMax || a > TIRO.aMax || c < -TIRO.cMax || c > TIRO.cMax || s < 0 || s > TIRO.sMax) return "tiro imposible";
  const n = p.tiros.length;
  if (n >= MAX_TIROS * 5) return "demasiados tiros";
  if (n && t < p.ultimoT + 400) return "tiros demasiado seguidos";
  return null;
}

export function lanzar(p, t, x, a, c, s) {
  const motivo = motivoTiroInvalido(p, t, x, a, c, s);
  if (motivo) throw new Error(motivo);
  p.tiros.push(t, x, a, c, s);
  p.ultimoT = t;
}

export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado:
// { tipo: "armado" | "tiro" | "cae" | "para" | "pleno", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    let tiro = null;
    while (p.leidos < p.tiros.length && p.tiros[p.leidos] <= t) {
      const i = p.leidos;
      tiro = { x: p.tiros[i + 1] / 1000, a: p.tiros[i + 2] / 1000, c: p.tiros[i + 3] / 1000, s: p.tiros[i + 4] / 1000 };
      p.leidos += 5;
    }
    if (p.estado === "armando") {
      if (t >= p.listoEn) { p.estado = "listo"; pasado.push({ tipo: "armado", t, tirada: p.tiradas, cx: p.cx, lado: p.lado }); }
      continue;
    }
    if (p.estado === "listo") {
      if (t < p.listoEn || !tiro) continue; // (un tiro que llega antes de tiempo se pierde: el móvil no lo deja)
      const v = velocidad(tiro.s);
      const r = simularTiro(p.bolos.map((b) => ({ ...b })), tiro);
      p.vuelo = { t0: t, v, tiro, golpes: r.golpes, desvios: r.desvios, fin: r.fin, fuera: r.fuera, para: t + (r.fin / v) * 1000, caidos: 0, miche: false };
      p.iGolpe = 0; p.estado = "bola"; p.bolas++; p.lanzadas++;
      pasado.push({ tipo: "tiro", t, ...tiro, v, bola: p.bolas });
      continue;
    }
    // ── la bola va rodando: los bolos caen cuando llega a ellos ──
    const w = p.vuelo;
    while (p.iGolpe < w.golpes.length && w.t0 + (w.golpes[p.iGolpe].y / w.v) * 1000 <= t) {
      const g = w.golpes[p.iGolpe++], b = p.bolos[g.i];
      b.pie = false; b.dx = g.dx; b.dy = g.dy; b.cae = t;
      const ganados = b.miche ? PUNTOS.miche : g.i === 4 ? PUNTOS.medio : PUNTOS.bolo;
      p.puntos += ganados; w.caidos++;
      if (b.miche) { p.miches++; w.miche = true; } else { p.derribados++; p.caidosTirada++; }
      pasado.push({ tipo: "cae", t, i: g.i, miche: b.miche, ganados, dx: g.dx, dy: g.dy, hondo: g.hondo, x: b.x, y: b.y });
      if (!b.miche && p.caidosTirada === 9) {
        const deUna = p.bolas === 1, extra = deUna ? PUNTOS.plenoDeUna : PUNTOS.pleno;
        p.puntos += extra; p.plenos++;
        pasado.push({ tipo: "pleno", t, ganados: extra, deUna });
      }
    }
    if (t >= w.para) {
      if (!w.caidos) p.blancas++;
      pasado.push({ tipo: "para", t, caidos: w.caidos, miche: w.miche, fuera: w.fuera, bola: p.bolas });
      const quedan = p.bolos.some((b) => b.pie && !b.miche);
      if (p.bolas >= 2 || !quedan) {
        p.tiradas++; p.anteriores = p.bolos; armar(p);
        p.estado = "armando"; p.listoEn = t + RECOGER_MS + ARMAR_MS;
      } else { p.estado = "listo"; p.listoEn = t + RECOGER_MS; }
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, derribados, miches, plenos, lanzadas, blancas } = p;
  return { puntos, bolos: derribados, miches, plenos, bolas: lanzadas, blancas };
}

export function rejugar(semilla, tiros) {
  if (!Array.isArray(tiros)) return { valida: false, motivo: "faltan los tiros" };
  if (tiros.length % 5 || tiros.length > MAX_TIROS * 5) return { valida: false, motivo: "tiros mal formados" };
  const p = crearPartida(semilla);
  for (let i = 0; i < tiros.length; i += 5) {
    const motivo = motivoTiroInvalido(p, tiros[i], tiros[i + 1], tiros[i + 2], tiros[i + 3], tiros[i + 4]);
    if (motivo) return { valida: false, motivo: `tiro ${i / 5 + 1}: ${motivo}` };
    p.tiros.push(tiros[i], tiros[i + 1], tiros[i + 2], tiros[i + 3], tiros[i + 4]);
    p.ultimoT = tiros[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
