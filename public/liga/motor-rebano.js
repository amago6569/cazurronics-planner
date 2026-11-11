// ============ TRASHUMANCIA: el motor ============
// Un prado de la montaña de Riaño. Llevas al mastín con el dedo y las ovejas se apartan de él: hay que ponerse detrás
// del rebaño y arrimarlo, sin prisa, a la portilla del corral que hay al fondo. Si el perro se les echa encima
// corriendo, se espantan y se desperdigan. Cuando entra el rebaño entero llega otro, más grande y más arisco.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos movimientos del dedo). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: solo sumas,
// productos, divisiones y raíces cuadradas, que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Unidades: el prado va de x = -1 a 1 (de lado a lado) y de y = 0 (cerca) a y = PARED (la pared del corral, al fondo).
// El corral queda detrás de la pared y se entra por la portilla, en el centro. El tiempo, en ms de partida.

export const VERSION = 1;
export const DURACION_MS = 50000;
export const PASOS_POR_SEGUNDO = 120;
const DT = 1 / PASOS_POR_SEGUNDO;

export const LADO = 0.95; // hasta dónde llegan las ovejas a los lados
export const CERCA = 0.1; // y por delante
export const PARED = 2.6; // y de la pared del corral
export const PORTILLA = 0.21; // media anchura del hueco
export const CORRAL = { medio: 0.56, fondo: 3.12 }; // el corral: de -medio a medio, de PARED a fondo
export const OVEJA = 0.055; // radio de una oveja
export const PERRO = { seguir: 14, velocidad: 2.3, aceleracion: 22, yMax: PARED - 0.09, xMax: 1.02 };
export const MIEDO = 0.62; // a esta distancia del perro empiezan a apartarse
export const SUSTO = { distancia: 0.3, velocidad: 1.1, dura: 1100 }; // perro encima y corriendo: se espantan
export const ANDAR = { pasto: 0.07, huye: 1.05, susto: 1.5, corral: 0.5 };
export const PUNTOS = { oveja: 10, negra: 20, fila: 3, rebano: 25, rapido: 2 };
export const SIN_PRISA_S = 16; // cada segundo que tardes menos que esto en encerrar un rebaño entero, PUNTOS.rapido más
export const FILA_MS = 1300; // dos ovejas que entran así de seguidas van «en fila»
export const ENTRA_MS = 1100; // lo que tarda un rebaño nuevo en entrar al prado
export const EMPIEZA_MS = 300;
export const MAX_MOVIMIENTOS = 1700; // como mucho uno cada 30 ms
export const SEPARACION_MIN_MS = 8;

// Cada rebaño: cuántas ovejas, cuántas negras y lo ariscas que son (1 = mansas)
export function rebanoDe(ronda) {
  if (ronda <= 0) return { ovejas: 5, negras: 0, nervio: 1 };
  if (ronda === 1) return { ovejas: 6, negras: 1, nervio: 1.08 };
  if (ronda === 2) return { ovejas: 7, negras: 1, nervio: 1.16 };
  return { ovejas: 8, negras: 2, nervio: 1.24 };
}

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

// Los sitios del corral donde se van quedando las que entran (de atrás hacia delante)
export function sitioCorral(n) {
  const fila = Math.floor(n / 4) % 3, col = n % 4;
  return { x: -0.36 + col * 0.24 + (fila % 2 ? 0.07 : 0), y: CORRAL.fondo - 0.1 - fila * 0.13 };
}

// Un rebaño nuevo: sale de uno o dos corrillos repartidos por el prado, lejos del corral, y entra andando desde fuera.
function soltarRebano(p, t) {
  const s = p.suerte, r = rebanoDe(p.ronda);
  const corrillos = r.ovejas >= 7 ? 2 : s() < 0.5 ? 2 : 1;
  const centros = [];
  const izquierda = s() < 0.5 ? -1 : 1;
  for (let c = 0; c < corrillos; c++) {
    const lado = corrillos === 1 ? (s() * 2 - 1) * 0.55 : (c ? -izquierda : izquierda) * (0.3 + 0.35 * s());
    centros.push({ x: lado, y: 0.55 + s() * 0.85 });
  }
  p.ovejas = [];
  for (let i = 0; i < r.ovejas; i++) {
    const c = centros[i % corrillos];
    let x = c.x + (s() * 2 - 1) * 0.2, y = c.y + (s() * 2 - 1) * 0.2;
    if (x > LADO - 0.05) x = LADO - 0.05; else if (x < -LADO + 0.05) x = -LADO + 0.05;
    // de dónde viene: del lado más cercano (o de abajo)
    const porAbajo = s() < 0.35;
    const x0 = porAbajo ? x + (s() * 2 - 1) * 0.1 : x > 0 ? 1.25 + s() * 0.1 : -1.25 - s() * 0.1;
    const y0 = porAbajo ? -0.3 - s() * 0.1 : y + (s() * 2 - 1) * 0.15;
    p.ovejas.push({
      id: p.nacidas++, negra: i < r.negras, x: x0, y: y0, vx: 0, vy: 0,
      x0, y0, x1: x, y1: y, llega: t + ENTRA_MS + Math.floor(s() * 300),
      estado: "entra", // entra → libre → dentro
      wx: 0, wy: 0, cambia: 0, sustoHasta: 0, sx: 0, sy: 0, sitio: null, miedo: 0,
    });
  }
  p.nervio = r.nervio;
  p.quedan = r.ovejas;
  p.rebanoDesde = t;
}

export function crearPartida(semilla) {
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, ronda: 0, nacidas: 0, ovejas: [], guardadas: 0, nervio: 1, quedan: 0,
    perro: { x: 0, y: 0.25, vx: 0, vy: 0, ox: 0, oy: 0.25 }, rebanoDesde: 0, dentroRonda: 0,
    movimientos: [], leidos: 0, ultimoT: 0, siguienteRebano: 0, ultimaEntrada: -1e9, fila: 0,
    puntos: 0, dentro: 0, negras: 0, rebanos: 0, sustos: 0, mejorFila: 0,
  };
  soltarRebano(p, 0);
  return p;
}

export function motivoMovimientoInvalido(p, t, x, y) {
  if (!Number.isInteger(t) || !Number.isInteger(x) || !Number.isInteger(y)) return "valores que no son enteros";
  if (x < -PERRO.xMax * 10000 || x > PERRO.xMax * 10000 || y < 0 || y > PERRO.yMax * 10000) return "posición fuera del prado";
  if (t < 0 || t > DURACION_MS) return "movimiento fuera de tiempo";
  const n = p.movimientos.length;
  if (n >= MAX_MOVIMIENTOS * 3) return "demasiados movimientos";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS) return "movimientos demasiado seguidos";
  return null;
}

export function mover(p, t, x, y) {
  const motivo = motivoMovimientoInvalido(p, t, x, y);
  if (motivo) throw new Error(motivo);
  p.movimientos.push(t, x, y);
  p.ultimoT = t;
}

// Tiempo (ms) que ya está decidido: los movimientos nuevos tienen que llevar este tiempo o más.
export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

const tope = (v, a, b) => (v < a ? a : v > b ? b : v);

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado:
// { tipo: "dentro" | "rebano" | "llega" | "susto", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  const perro = p.perro;
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    const m = p.movimientos;
    while (p.leidos < m.length && m[p.leidos] <= t) {
      perro.ox = tope(m[p.leidos + 1] / 10000, -PERRO.xMax, PERRO.xMax);
      perro.oy = tope(m[p.leidos + 2] / 10000, 0, PERRO.yMax);
      p.leidos += 3;
    }
    // ── el mastín va hacia el dedo, con su velocidad y su arrancada ──
    if (t >= EMPIEZA_MS) {
      let qx = (perro.ox - perro.x) * PERRO.seguir, qy = (perro.oy - perro.y) * PERRO.seguir;
      const q = Math.sqrt(qx * qx + qy * qy);
      if (q > PERRO.velocidad) { qx = (qx * PERRO.velocidad) / q; qy = (qy * PERRO.velocidad) / q; }
      let ax = qx - perro.vx, ay = qy - perro.vy;
      const a = Math.sqrt(ax * ax + ay * ay), am = PERRO.aceleracion * DT;
      if (a > am) { ax = (ax * am) / a; ay = (ay * am) / a; }
      perro.vx += ax; perro.vy += ay;
      perro.x = tope(perro.x + perro.vx * DT, -PERRO.xMax, PERRO.xMax);
      perro.y = tope(perro.y + perro.vy * DT, 0, PERRO.yMax);
    }
    const vPerro = Math.sqrt(perro.vx * perro.vx + perro.vy * perro.vy);

    // ── rebaño nuevo ──
    if (p.siguienteRebano && t >= p.siguienteRebano) {
      p.siguienteRebano = 0;
      p.guardadas += p.ovejas.length;
      p.ronda++;
      soltarRebano(p, t);
      pasado.push({ tipo: "llega", t, ronda: p.ronda, ovejas: p.ovejas.length });
    }

    const O = p.ovejas, n = O.length;
    // el centro de las que siguen sueltas (para que se arrimen unas a otras cuando hay peligro)
    for (let i = 0; i < n; i++) {
      const o = O[i];
      if (o.estado === "entra") {
        // entran andando desde fuera, en línea recta, hasta su sitio
        const k = 1 - (o.llega - t) / (ENTRA_MS + 300);
        const u = k < 0 ? 0 : k > 1 ? 1 : k, e = u * (2 - u);
        const nx = o.x0 + (o.x1 - o.x0) * e, ny = o.y0 + (o.y1 - o.y0) * e;
        o.vx = (nx - o.x) / DT; o.vy = (ny - o.y) / DT;
        o.x = nx; o.y = ny;
        if (t >= o.llega) { o.estado = "libre"; o.vx = 0; o.vy = 0; }
        continue;
      }
      if (o.estado === "dentro") {
        // ya en el corral: va a su sitio y se queda
        const dx = o.sitio.x - o.x, dy = o.sitio.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.01) {
          const v = d * 4 < ANDAR.corral ? d * 4 : ANDAR.corral;
          o.vx = (dx / d) * v; o.vy = (dy / d) * v;
          o.x += o.vx * DT; o.y += o.vy * DT;
        } else { o.vx = 0; o.vy = 0; }
        continue;
      }
      // ── suelta: se aparta del perro, se arrima a las demás, no se pisa con ellas y, si está tranquila, pasta ──
      const px = o.x - perro.x, py = o.y - perro.y, dp = Math.sqrt(px * px + py * py) + 1e-6;
      const radio = MIEDO * (o.negra ? 0.85 : 1) * (p.nervio > 1.2 ? 1.08 : 1);
      const miedo = dp < radio ? 1 - dp / radio : 0;
      o.miedo = miedo;
      // susto: el perro encima y corriendo
      if (t >= o.sustoHasta && dp < SUSTO.distancia && vPerro > SUSTO.velocidad / p.nervio) {
        o.sustoHasta = t + SUSTO.dura;
        const s = p.suerte;
        // sale hacia donde no está el perro, pero torcida: por eso se desperdigan
        const tx = -py / dp, ty = px / dp, giro = (s() * 2 - 1) * 0.9;
        o.sx = px / dp + tx * giro; o.sy = py / dp + ty * giro;
        const l = Math.sqrt(o.sx * o.sx + o.sy * o.sy); o.sx /= l; o.sy /= l;
        p.sustos++;
        pasado.push({ tipo: "susto", t, id: o.id });
      }
      let qx = 0, qy = 0, velocidad;
      if (t < o.sustoHasta) {
        qx = o.sx; qy = o.sy; velocidad = ANDAR.susto;
        // aun asustada, no se mete entre las patas del perro
        if (miedo > 0) { qx += (px / dp) * miedo; qy += (py / dp) * miedo; }
      } else if (miedo > 0) {
        qx = px / dp; qy = py / dp;
        // se arriman al centro de las que tienen cerca (las negras, menos)
        let cx = 0, cy = 0, c = 0;
        for (let j = 0; j < n; j++) {
          const b = O[j];
          if (j === i || b.estado !== "libre") continue;
          const dx = b.x - o.x, dy = b.y - o.y;
          if (dx * dx + dy * dy < 0.81) { cx += dx; cy += dy; c++; }
        }
        if (c) {
          const l = Math.sqrt(cx * cx + cy * cy) + 1e-6, junta = (o.negra ? 0.25 : 0.7) / p.nervio;
          qx += (cx / l) * junta; qy += (cy / l) * junta;
        }
        velocidad = ANDAR.pasto + (ANDAR.huye * p.nervio - ANDAR.pasto) * (miedo * (2 - miedo));
      } else {
        // pastando: un paseo corto, que cambia cada poco (la negra se va más lejos)
        if (t >= o.cambia) {
          const s = p.suerte;
          o.cambia = t + 900 + Math.floor(s() * 1900);
          if (s() < (o.negra ? 0.75 : 0.5)) { o.wx = s() * 2 - 1; o.wy = s() * 2 - 1; } else { o.wx = 0; o.wy = 0; }
        }
        qx = o.wx; qy = o.wy;
        velocidad = ANDAR.pasto * (o.negra ? 2.2 : 1) * p.nervio;
      }
      // no pisarse (siempre)
      for (let j = 0; j < n; j++) {
        const b = O[j];
        if (j === i || b.estado !== "libre") continue;
        const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.0196 && d2 > 1e-9) { const d = Math.sqrt(d2), f = (0.14 - d) / 0.14; qx += (dx / d) * f * 2.2; qy += (dy / d) * f * 2.2; }
      }
      const q = Math.sqrt(qx * qx + qy * qy);
      let vx = 0, vy = 0;
      if (q > 0.05) { const k = q > 1 ? 1 / q : 1; vx = qx * k * velocidad; vy = qy * k * velocidad; }
      // el cuerpo no cambia de golpe: tarda un poco en arrancar y en girar
      const suave = miedo > 0 || t < o.sustoHasta ? 9 * DT : 3 * DT;
      o.vx += (vx - o.vx) * suave; o.vy += (vy - o.vy) * suave;
      const yAntes = o.y;
      o.x += o.vx * DT; o.y += o.vy * DT;
      // los bordes del prado
      if (o.x > LADO) { o.x = LADO; if (o.vx > 0) o.vx = 0; } else if (o.x < -LADO) { o.x = -LADO; if (o.vx < 0) o.vx = 0; }
      if (o.y < CERCA) { o.y = CERCA; if (o.vy < 0) o.vy = 0; }
      // la pared del corral y la portilla
      if (o.y > PARED - OVEJA) {
        const hueco = PORTILLA - OVEJA * 0.6;
        if (o.x < hueco && o.x > -hueco) {
          if (o.y > PARED + 0.05) {
            // ¡dentro!
            o.estado = "dentro";
            o.sitio = sitioCorral(p.dentroRonda);
            p.dentroRonda++;
            p.dentro++; p.quedan--;
            if (o.negra) p.negras++;
            p.fila = t - p.ultimaEntrada <= FILA_MS ? p.fila + 1 : 0;
            p.ultimaEntrada = t;
            if (p.fila > p.mejorFila) p.mejorFila = p.fila;
            const extra = PUNTOS.fila * (p.fila > 4 ? 4 : p.fila);
            const ganados = (o.negra ? PUNTOS.negra : PUNTOS.oveja) + extra;
            p.puntos += ganados;
            pasado.push({ tipo: "dentro", t, id: o.id, negra: o.negra, ganados, fila: p.fila, x: o.x });
            if (p.quedan === 0) {
              const sobran = SIN_PRISA_S - Math.ceil((t - p.rebanoDesde) / 1000);
              const rapido = sobran > 0 ? sobran * PUNTOS.rapido : 0;
              p.puntos += PUNTOS.rebano + rapido;
              p.rebanos++;
              p.dentroRonda = 0;
              p.siguienteRebano = t + 900;
              pasado.push({ tipo: "rebano", t, ronda: p.ronda, ganados: PUNTOS.rebano + rapido, rapido, segundos: Math.ceil((t - p.rebanoDesde) / 1000) });
            }
          }
        } else if (yAntes <= PARED - OVEJA) {
          o.y = PARED - OVEJA; if (o.vy > 0) o.vy = 0; // contra la pared
        } else {
          o.x = o.x > 0 ? hueco : -hueco; // ya en el hueco: los postes
        }
      }
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, dentro, negras, rebanos, sustos } = p;
  return { puntos, ovejas: dentro, negras, rebanos, sustos, fila: p.mejorFila + (p.dentro ? 1 : 0) };
}

export function rejugar(semilla, movimientos) {
  if (!Array.isArray(movimientos)) return { valida: false, motivo: "faltan los movimientos" };
  if (movimientos.length % 3 || movimientos.length > MAX_MOVIMIENTOS * 3) return { valida: false, motivo: "movimientos mal formados" };
  const p = crearPartida(semilla);
  for (let i = 0; i < movimientos.length; i += 3) {
    const motivo = motivoMovimientoInvalido(p, movimientos[i], movimientos[i + 1], movimientos[i + 2]);
    if (motivo) return { valida: false, motivo: `movimiento ${i / 3 + 1}: ${motivo}` };
    p.movimientos.push(movimientos[i], movimientos[i + 1], movimientos[i + 2]);
    p.ultimoT = movimientos[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
