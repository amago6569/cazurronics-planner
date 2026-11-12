// ============ BOLOS LEONESES: el motor ============
// El bolo leonés de verdad (reglamento de la Federación de Castilla y León, simplificado):
// - El castro: nueve bolos altos y finos en cuadro, de tres en tres, a 55 cm. A un lado, el miche (el pequeño).
// - Se tira desde la mano (a unos 7 m) una media bola de encina. Por ser media esfera no va recta: tuerce hacia su
//   lado plano, y más cuanto más despacio va. Ahí está la gracia: hacerla entrar en el castro y que «abra» hacia el miche.
// - Si la bola no entra en el castro, es CINCA: no vale nada.
// - Si entra y sale por el lado del miche cruzando la RAYA DEL ONCE (la que va del cincón, el bolo de delante de ese
//   lado, al miche) sin pasarse de la tercera fila, o tira el miche, es ONCE: 16 tantos si la bola queda dentro de la
//   raya de parada (un círculo de 2,25 m alrededor del bolo del medio) y 14 si queda fuera; cada bolo más, uno más.
// - Tirar el miche es MACHO: 4 tantos más.
// - Si no hay once, vale un tanto cada bolo; y si la bola ha quedado fuera de la raya de parada, se BIRLA: se tira
//   otra vez desde donde paró, contra los bolos que queden (cada bolo, un tanto; el miche, 4, si cae con algún bolo).
// Después se vuelve a armar el castro, con el miche a un lado u otro.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos tiros). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: sumas, productos,
// divisiones y raíces cuadradas, que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Lo que manda el jugador: [t, x, a, c, s, …] = en el ms t suelta la bola desde x (milésimas de metro, solo en la
// mano), con dirección a (milésimas: lo que se va de lado por cada metro), efecto c (−1000 a 1000) y fuerza s (0 a 1000).
// Unidades: metros. x de lado (0 el centro de la mano), y hacia el castro (0 la mano).

export const VERSION = 2;
export const DURACION_MS = 50000;
export const PASOS_POR_SEGUNDO = 120;
const DT = 1 / PASOS_POR_SEGUNDO;

export const CASTRO = { y: 7, paso: 0.55, medio: 0.7 }; // y del bolo del medio, separación y medio lado del cuadro
export const PARADA = 2.25; // radio de la raya de parada
export const MICHE = { x: 1.45, y: 7.25 }; // dónde va el miche (a un lado u otro, con algo de juego)
export const BOLERA = { ancho: 4.5, fondo: 11.5 }; // media anchura y el tope del fondo
export const BOLA = 0.075, BOLO = 0.045, ALTO = 0.55, ALTO_MICHE = 0.3; // radios y altos
export const TIRO = { xMax: 600, aMax: 250, cMax: 1000, sMax: 1000 };
export const VELOCIDAD = { minima: 4, mas: 3.6 }; // m/s al soltar: la más floja y lo que suma la fuerza
export const ROCE = 2.2; // m/s² que pierde rodando por la tierra
export const CURVA = 4.2; // cuánto tuerce la media bola (rad/s con todo el efecto, más cuanto más despacio)
export const PUNTOS = { bolo: 1, onceDentro: 16, onceFuera: 14, macho: 4 };
export const RECOGER_MS = 700; // de que la bola para a poder tirar otra
export const ARMAR_MS = 600; // armar el castro
export const MAX_TIROS = 60;
export const SEPARACION_MS = 400;
export const EMPIEZA_MS = 300;
const MAX_PASOS = PASOS_POR_SEGUNDO * 8;

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

// Arma el castro: nueve bolos (0–8, por filas de delante atrás y de izquierda a derecha; el 4 es el del medio) y el
// miche (9). «lado»: +1 el miche a la derecha (se juega «sobre el pulgar»), −1 a la izquierda («a la mano»).
function armar(p) {
  const s = p.suerte;
  const lado = s() < 0.5 ? -1 : 1;
  const bolos = [];
  for (let f = -1; f <= 1; f++) for (let c = -1; c <= 1; c++) bolos.push({ i: bolos.length, x: c * CASTRO.paso, y: CASTRO.y + f * CASTRO.paso, pie: true, dx: 0, dy: 0, miche: false });
  const mx = lado * (MICHE.x + (s() - 0.5) * 0.3), my = MICHE.y + (s() - 0.5) * 0.3;
  bolos.push({ i: 9, x: mx, y: my, pie: true, dx: 0, dy: 0, miche: true });
  p.bolos = bolos; p.lado = lado; p.birle = null;
}
export const cincon = (lado) => (lado > 0 ? 2 : 0); // el bolo de delante del lado del miche

// Un bolo que cae se tumba «largo» metros hacia (dx, dy) y se lleva a los que pille (los de al lado, a 55 cm, caen si
// van en esa dirección: los bolos leoneses son altos y caen unos sobre otros)
function tumbar(bolos, b, dx, dy, largo, k, golpes, hondo, empuje) {
  b.pie = false; b.dx = dx; b.dy = dy;
  golpes.push({ k, i: b.i, dx, dy, hondo, empuje });
  if (largo < 0.15) return;
  for (const o of bolos) {
    if (!o.pie) continue;
    const ex = o.x - b.x, ey = o.y - b.y;
    let u = ex * dx + ey * dy;
    if (u < 0) u = 0; else if (u > largo) u = largo;
    const qx = ex - dx * u, qy = ey - dy * u, d2 = qx * qx + qy * qy, toca = BOLO + 0.05;
    if (d2 > toca * toca) continue;
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    let nx = dx + (ex / l) * 0.7, ny = dy + (ey / l) * 0.7;
    const nl = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nl; ny /= nl;
    tumbar(bolos, o, nx, ny, (o.miche ? ALTO_MICHE : ALTO) * 0.92, k + 10 + hondo * 3, golpes, hondo + 1, 0.04);
  }
}

// ¿Cruza el segmento A–B al ir de P a Q, saliendo del lado del castro? (sin trigonometría: signos de productos cruzados)
function cruza(ax, ay, bx, by, px, py, qx, qy) {
  const lado = (x, y) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s1 = lado(px, py), s2 = lado(qx, qy), castro = lado(0, CASTRO.y);
  if ((s1 > 0) === (s2 > 0) || s1 === 0 || (s1 > 0) !== (castro > 0)) return false;
  const l3 = (qx - px) * (ay - py) - (qy - py) * (ax - px), l4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
  return (l3 > 0) !== (l4 > 0);
}

// El tiro entero, sin tocar la partida. bolos: [{ i, x, y, pie, miche }] (SE MODIFICA: pásale una copia si no quieres)
// tiro: { x, a, c, s } en metros (y efecto y fuerza de −1 a 1 / 0 a 1) · desde: null (desde la mano) o { x, y } (birle)
// Devuelve el camino de la bola paso a paso (xs, ys, vs, hxs, hys), los bolos que caen y en qué paso, y cómo ha sido.
export function simularTiro(bolos, tiro, lado, desde = null) {
  const xs = [], ys = [], vs = [], hxs = [], hys = [], golpes = [];
  let x, y, hx, hy;
  if (desde) {
    // birle: hacia el bolo del medio, torcido lo que diga «a»
    x = desde.x; y = desde.y;
    let dx = -x, dy = CASTRO.y - y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    hx = dx + tiro.a * dy; hy = dy - tiro.a * dx;
  } else { x = tiro.x; y = 0.2; hx = tiro.a; hy = 1; }
  let hl = Math.sqrt(hx * hx + hy * hy); hx /= hl; hy /= hl;
  let v = VELOCIDAD.minima + VELOCIDAD.mas * tiro.s;
  const ci = bolos[cincon(lado)], mi = bolos[9];
  const ax = ci.x, ay = ci.y, bx = mi.x, by = mi.y; // la raya del once (antes de que nada se mueva)
  let entra = -1, once = -1, pasaFila = false, micheAntes = false, tope = false, fuera = false;
  for (let k = 0; k < MAX_PASOS; k++) {
    xs.push(x); ys.push(y); vs.push(v); hxs.push(hx); hys.push(hy);
    if (v <= 0.05) break;
    // la media bola tuerce hacia su cara plana: poco al principio, mucho al final
    const giro = (tiro.c * CURVA * DT) / (v + 0.9);
    const nhx = hx + giro * hy, nhy = hy - giro * hx;
    hl = Math.sqrt(nhx * nhx + nhy * nhy); hx = nhx / hl; hy = nhy / hl;
    const px = x, py = y;
    x += hx * v * DT; y += hy * v * DT;
    v -= ROCE * DT;
    // ¿entra en el castro? (con más de media bola dentro)
    const dentro = x > -CASTRO.medio && x < CASTRO.medio && y > CASTRO.y - CASTRO.medio && y < CASTRO.y + CASTRO.medio;
    if (dentro && entra < 0) entra = k;
    if (entra >= 0 && y > CASTRO.y + CASTRO.paso + BOLA) pasaFila = true;
    if (entra >= 0 && once < 0 && !pasaFila && !desde && cruza(ax, ay, bx, by, px, py, x, y)) once = k;
    // choques con los bolos que siguen de pie
    for (const b of bolos) {
      if (!b.pie) continue;
      const ex = b.x - x, ey = b.y - y, d2 = ex * ex + ey * ey, toca = BOLA + (b.miche ? BOLO * 0.8 : BOLO);
      if (d2 > toca * toca) continue;
      const l = Math.sqrt(d2) || 1;
      let nx = (ex / l) * 0.7 + hx * 0.9, ny = (ey / l) * 0.7 + hy * 0.9;
      const nl = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nl; ny /= nl;
      if (b.miche && entra < 0) micheAntes = true;
      tumbar(bolos, b, nx, ny, b.miche ? ALTO_MICHE : ALTO, k, golpes, 0, 0.12 + 0.05 * v);
      v *= b.miche ? 0.9 : 0.8;
      // el bolo aparta un poco la bola
      hx -= (ex / l) * 0.16; hy -= (ey / l) * 0.16;
      hl = Math.sqrt(hx * hx + hy * hy); hx /= hl; hy /= hl;
    }
    if (y >= BOLERA.fondo - BOLA) { y = BOLERA.fondo - BOLA; tope = true; xs.push(x); ys.push(y); vs.push(0); hxs.push(hx); hys.push(hy); break; }
    if (x > BOLERA.ancho || x < -BOLERA.ancho || y < -0.6) { fuera = true; xs.push(x); ys.push(y); vs.push(0); hxs.push(hx); hys.push(hy); break; }
  }
  golpes.sort((g1, g2) => g1.k - g2.k);
  const n = xs.length, fx = xs[n - 1], fy = ys[n - 1];
  const ddx = fx, ddy = fy - CASTRO.y;
  const enParada = ddx * ddx + ddy * ddy <= PARADA * PARADA;
  const valida = desde ? true : entra >= 0 && !micheAntes;
  const miche = golpes.some((g) => g.i === 9);
  return { xs, ys, vs, hxs, hys, golpes, pasos: n, entra, once: valida && !desde && (once >= 0 || miche) ? Math.max(0, once) : -1, valida, enParada, tope, fuera, fin: { x: fx, y: fy } };
}

// Cuántos tantos vale una bola (la de mano, o el birle)
export function tantosDe(r, birle) {
  const bolos = r.golpes.filter((g) => g.i !== 9).length, miche = r.golpes.some((g) => g.i === 9);
  if (birle) return { tantos: bolos + (miche && bolos ? PUNTOS.macho : 0), bolos, miche: miche && bolos > 0, once: false, cinca: false };
  if (!r.valida) return { tantos: 0, bolos: 0, miche: false, once: false, cinca: true };
  if (r.once >= 0) {
    const base = r.enParada ? PUNTOS.onceDentro : PUNTOS.onceFuera;
    return { tantos: base + (bolos > 1 ? bolos - 1 : 0) + (miche ? PUNTOS.macho : 0), bolos, miche, once: true, cinca: false };
  }
  return { tantos: bolos * PUNTOS.bolo, bolos, miche: false, once: false, cinca: false };
}

export function crearPartida(semilla) {
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, tiros: [], leidos: 0, ultimoT: 0,
    estado: "armando", listoEn: EMPIEZA_MS, // armando → listo → bola → (listo para birlar | armando)…
    bolos: [], lado: 1, birle: null, tiradas: 0,
    vuelo: null, iGolpe: 0,
    puntos: 0, derribados: 0, onces: 0, machos: 0, cincas: 0, birles: 0, lanzadas: 0,
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
  if (n && t < p.ultimoT + SEPARACION_MS) return "tiros demasiado seguidos";
  return null;
}

export function lanzar(p, t, x, a, c, s) {
  const motivo = motivoTiroInvalido(p, t, x, a, c, s);
  if (motivo) throw new Error(motivo);
  p.tiros.push(t, x, a, c, s);
  p.ultimoT = t;
}

export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }
export const msDePaso = (k) => (k * 1000) / PASOS_POR_SEGUNDO;

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado:
// { tipo: "armado" | "tiro" | "entra" | "once" | "cae" | "para", t, … }
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
      if (t >= p.listoEn) { p.estado = "listo"; pasado.push({ tipo: "armado", t, tirada: p.tiradas, lado: p.lado }); }
      continue;
    }
    if (p.estado === "listo") {
      if (t < p.listoEn || !tiro) continue; // (un tiro que llega antes de tiempo se pierde: el móvil no lo deja)
      const birle = p.birle;
      const r = simularTiro(p.bolos.map((b) => ({ ...b })), tiro, p.lado, birle);
      p.vuelo = { t0: t, tiro, birle, ...r, para: t + msDePaso(r.pasos - 1), marcado: { entra: false, once: false } };
      p.iGolpe = 0; p.estado = "bola"; p.lanzadas++;
      pasado.push({ tipo: "tiro", t, ...tiro, birle: Boolean(birle) });
      continue;
    }
    // ── la bola va rodando: los bolos caen cuando llega a ellos ──
    const w = p.vuelo;
    if (!w.marcado.entra && w.entra >= 0 && w.t0 + msDePaso(w.entra) <= t) { w.marcado.entra = true; pasado.push({ tipo: "entra", t }); }
    if (!w.marcado.once && w.once >= 0 && w.t0 + msDePaso(w.once) <= t) { w.marcado.once = true; pasado.push({ tipo: "once", t }); }
    while (p.iGolpe < w.golpes.length && w.t0 + msDePaso(w.golpes[p.iGolpe].k) <= t) {
      const g = w.golpes[p.iGolpe++], b = p.bolos[g.i];
      b.pie = false; b.dx = g.dx; b.dy = g.dy; b.cae = t; b.empuje = g.empuje;
      pasado.push({ tipo: "cae", t, i: g.i, miche: b.miche, dx: g.dx, dy: g.dy, hondo: g.hondo, x: b.x, y: b.y, empuje: g.empuje });
    }
    if (t >= w.para && p.iGolpe >= w.golpes.length) {
      const r = tantosDe(w, Boolean(w.birle));
      p.puntos += r.tantos; p.derribados += r.bolos;
      if (r.once) p.onces++;
      if (r.miche) p.machos++;
      if (r.cinca) p.cincas++;
      if (w.birle) p.birles++;
      const quedan = p.bolos.some((b) => b.pie && !b.miche);
      const birlar = !w.birle && !r.cinca && !r.once && !w.enParada && !w.fuera && quedan;
      pasado.push({ tipo: "para", t, ...r, birle: Boolean(w.birle), birlar, enParada: w.enParada, tope: w.tope, fuera: w.fuera, x: w.fin.x, y: w.fin.y });
      if (birlar) { p.birle = { x: w.fin.x, y: w.fin.y }; p.estado = "listo"; p.listoEn = t + RECOGER_MS; }
      else {
        p.tiradas++; p.anteriores = p.bolos; armar(p);
        p.estado = "armando"; p.listoEn = t + RECOGER_MS + ARMAR_MS;
      }
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, derribados, onces, machos, cincas, birles, lanzadas, tiradas } = p;
  return { puntos, bolos: derribados, onces, machos, cincas, birles, bolas: lanzadas, tiradas };
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
