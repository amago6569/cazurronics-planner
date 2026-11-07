// ============ TAPEO EN EL HÚMEDO: el motor ============
// Caen tapas desde los balcones del Húmedo y las recoges con la cazuela, deslizando el dedo de lado a lado.
// Las servilletas de papel (las del suelo de los bares) restan. De vez en cuando cae un botillo de oro.
//
// Este archivo decide TODO lo que cuenta: dónde y cuándo cae cada cosa, por dónde va la cazuela y qué se coge.
// Lo usan el móvil para jugar y el servidor para repetir la partida con la misma semilla y los mismos movimientos
// del dedo. Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: solo sumas, productos y divisiones,
// que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Unidades: x de la barra entre -1 y 1 (la cazuela no pasa de ±LIMITE_X); y de caída entre 1 (arriba, donde
// aparece) y 0 (el borde de la cazuela). El tiempo, en ms de partida.

export const VERSION = 1;
export const DURACION_MS = 40000;
export const PASOS_POR_SEGUNDO = 240;
const DT = 1 / PASOS_POR_SEGUNDO;

export const CAZUELA = { medio: 0.12, velocidad: 3.6 }; // media anchura y velocidad máxima (anchos de barra por segundo)
export const LIMITE_X = 0.84;
export const CAIDA_X = 0.8; // las cosas caen entre -0,8 y 0,8
export const RADIO = { tapa: 0.07, dorado: 0.08, servilleta: 0.09 };
export const TAPAS = ["croqueta", "morcilla", "chorizo", "cecina"];
export const PUNTOS = { tapa: 1, dorado: 5, servilleta: -3 };
export const MAX_MOVIMIENTOS = 2400; // como mucho 60 por segundo
export const SEPARACION_MIN_MS = 8;

// multiplicador por racha (tapas seguidas sin que se te caiga ninguna)
export function multiplicador(racha) { return racha >= 15 ? 3 : racha >= 5 ? 2 : 1; }

// ── Suerte reproducible: mulberry32 ──
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

// Altura de caída (1 → 0) según la fracción u del tiempo de caída: empieza despacio y acelera, como algo que cae.
export function alturaEn(u) { return 1 - (0.35 * u + 0.65 * u * u); }

// Vaivén de las servilletas: onda en triángulo (sin senos). Devuelve -1…1.
function triangulo(z) { const f = z - Math.floor(z); return 4 * Math.abs(f - 0.5) - 1; }

// Dónde está una cosa (x) en el ms t
export function xEn(c, t) {
  const x = c.x0 + (c.vx * (t - c.t0)) / 1000; // las que se tiran desde un balcón vienen en diagonal
  if (!c.vaiven) return x;
  return x + c.vaiven.a * triangulo((t - c.t0) / c.vaiven.p + c.vaiven.f);
}

// ── Lo que cae en toda la partida, decidido al empezar con la semilla ──
// Reglas para que sea justo: cada tapa se puede alcanzar desde la anterior a la velocidad de la cazuela (con margen),
// y una servilleta nunca cae justo encima de una tapa que llega a la vez.
function generar(suerte) {
  const cosas = [];
  const buenas = []; // { tc, x } de tapas y dorados
  let t = 700;
  let id = 0;
  while (t < DURACION_MS) {
    const k = t / DURACION_MS; // 0 → 1 a lo largo de la partida
    const gap = (720 - 470 * k) * (0.75 + 0.5 * suerte());
    const T = Math.round((1800 - 950 * k) * (0.92 + 0.16 * suerte()));
    const t0 = Math.round(t);
    const tc = t0 + T;
    const rTipo = suerte();
    const pServ = 0.07 + 0.16 * k, pOro = t > 8000 ? 0.025 : 0;
    const tipo = rTipo < pServ ? "servilleta" : rTipo < pServ + pOro ? "dorado" : "tapa";
    const clase = tipo === "tapa" ? TAPAS[Math.floor(suerte() * TAPAS.length)] : tipo;
    if (tc <= DURACION_MS) {
      if (tipo === "servilleta") {
        const a = 0.05 + 0.09 * suerte(), p = 650 + Math.round(500 * suerte()), f = suerte();
        let x = 0, ok = false;
        for (let i = 0; i < 8 && !ok; i++) {
          x = -CAIDA_X + 2 * CAIDA_X * suerte();
          const c = { t0, vx: 0, vaiven: { a, p, f }, x0: x };
          const xc = xEn(c, tc);
          ok = xc > -0.95 && xc < 0.95
            && buenas.every((b) => Math.abs(b.tc - tc) > 380 || Math.abs(b.x - xc) > CAZUELA.medio + RADIO.servilleta + RADIO.tapa + 0.08);
        }
        if (ok) cosas.push({ id: id++, tipo, clase, t0, T, tc, x0: x, vx: 0, vaiven: { a, p, f }, r: RADIO.servilleta });
      } else {
        // la más cercana en el tiempo de las ya decididas: desde ahí se tiene que poder llegar
        let x = -CAIDA_X + 2 * CAIDA_X * suerte();
        const cerca = buenas.filter((b) => Math.abs(b.tc - tc) < 1600);
        for (let i = 0; i < 8; i++) {
          const ok = cerca.every((b) => Math.abs(b.x - x) <= CAZUELA.velocidad * 0.7 * (Math.abs(b.tc - tc) / 1000) + 2 * CAZUELA.medio * 0.6);
          if (ok) break;
          x = -CAIDA_X + 2 * CAIDA_X * suerte();
          if (i === 7) { // no hubo suerte: se pone al lado de la más próxima
            const b = cerca.reduce((m, c) => (Math.abs(c.tc - tc) < Math.abs(m.tc - tc) ? c : m));
            x = Math.max(-CAIDA_X, Math.min(CAIDA_X, b.x + (x > b.x ? 1 : -1) * 0.2));
          }
        }
        // y que ninguna servilleta ya puesta le caiga encima
        const pisa = cosas.some((c) => c.tipo === "servilleta" && Math.abs(c.tc - tc) <= 380
          && Math.abs(xEn(c, c.tc) - x) <= CAZUELA.medio + RADIO.servilleta + RADIO.tapa + 0.08);
        // a partir de los 8 s, la mitad vienen en diagonal (las tiran desde un balcón): cuesta más ver dónde caen
        const diagonal = t > 8000 && suerte() < 0.5;
        const vx = diagonal ? (suerte() < 0.5 ? -1 : 1) * (0.25 + 0.45 * suerte()) : 0;
        if (!pisa) {
          cosas.push({ id: id++, tipo, clase, t0, T, tc, x0: x - (vx * T) / 1000, vx, vaiven: null, r: tipo === "dorado" ? RADIO.dorado : RADIO.tapa });
          buenas.push({ tc, x });
        }
      }
    }
    t += gap;
  }
  cosas.sort((a, b) => a.tc - b.tc || a.id - b.id);
  return cosas;
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  return {
    version: VERSION,
    semilla: semilla >>> 0,
    cosas: generar(suerte),
    siguiente: 0, // índice de la próxima cosa por llegar a la cazuela
    paso: 0, // pasos de simulación hechos
    cazuela: 0, objetivo: 0, // dónde está la cazuela y adónde va
    movimientos: [], // [t, x, t, x, …] lo que se manda al servidor
    leidos: 0, // movimientos ya aplicados
    ultimoT: 0,
    puntos: 0, racha: 0, mejorRacha: 0, cogidas: 0, caidas: 0, servilletas: 0, dorados: 0,
  };
}

// El dedo ha movido la cazuela hacia x (entero, -10000…10000) en el ms t. Devuelve el motivo si no vale.
export function motivoMovimientoInvalido(partida, t, x) {
  if (!Number.isInteger(t) || !Number.isInteger(x)) return "valores que no son enteros";
  if (x < -10000 || x > 10000) return "posición fuera de la barra";
  if (t < 0 || t > DURACION_MS) return "movimiento fuera de tiempo";
  const n = partida.movimientos.length;
  if (n >= MAX_MOVIMIENTOS * 2) return "demasiados movimientos";
  if (n && t < partida.ultimoT + SEPARACION_MIN_MS) return "movimientos demasiado seguidos";
  return null;
}

export function mover(partida, t, x) {
  const motivo = motivoMovimientoInvalido(partida, t, x);
  if (motivo) throw new Error(motivo);
  partida.movimientos.push(t, x);
  partida.ultimoT = t;
}

// Tiempo (ms) que ya está decidido: los movimientos nuevos tienen que llevar este tiempo o más.
export function tiempoHecho(partida) { return Math.floor((partida.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza la partida hasta el ms «hasta» (como mucho el final). Devuelve las cosas que se han decidido en este trozo.
export function avanzar(partida, hasta) {
  const fin = Math.min(hasta, DURACION_MS);
  const decididas = [];
  const v = CAZUELA.velocidad * DT;
  for (;;) {
    const tSig = ((partida.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (tSig > fin) break;
    partida.paso++;
    // movimientos del dedo que ya tocan
    const m = partida.movimientos;
    while (partida.leidos < m.length && m[partida.leidos] <= tSig) {
      partida.objetivo = Math.max(-LIMITE_X, Math.min(LIMITE_X, m[partida.leidos + 1] / 10000));
      partida.leidos += 2;
    }
    const d = partida.objetivo - partida.cazuela;
    partida.cazuela = Math.abs(d) <= v ? partida.objetivo : partida.cazuela + (d > 0 ? v : -v);
    // lo que llega al borde de la cazuela en este paso
    while (partida.siguiente < partida.cosas.length && partida.cosas[partida.siguiente].tc <= tSig) {
      const c = partida.cosas[partida.siguiente++];
      const xc = xEn(c, c.tc);
      const dx = xc - partida.cazuela;
      const cogida = Math.abs(dx) <= CAZUELA.medio + c.r * 0.6;
      let ganados = 0;
      if (c.tipo === "servilleta") {
        if (cogida) {
          ganados = Math.max(-partida.puntos, PUNTOS.servilleta);
          partida.puntos += ganados;
          partida.racha = 0;
          partida.servilletas++;
        }
      } else if (cogida) {
        partida.racha++;
        partida.mejorRacha = Math.max(partida.mejorRacha, partida.racha);
        ganados = PUNTOS[c.tipo] * multiplicador(partida.racha);
        partida.puntos += ganados;
        partida.cogidas++;
        if (c.tipo === "dorado") partida.dorados++;
      } else {
        partida.racha = 0;
        partida.caidas++;
      }
      c.res = { cogida, dx, ganados, racha: partida.racha };
      decididas.push(c);
    }
  }
  return decididas;
}

export function resumen(partida) {
  const { puntos, cogidas, caidas, servilletas, dorados, mejorRacha } = partida;
  const buenas = partida.cosas.filter((c) => c.tipo !== "servilleta").length;
  return { puntos, cogidas, caidas, servilletas, dorados, mejorRacha, buenas };
}

// Lo que hace el servidor: repetir la partida con la semilla y los movimientos del dedo.
export function rejugar(semilla, movimientos) {
  if (!Array.isArray(movimientos)) return { valida: false, motivo: "faltan los movimientos" };
  if (movimientos.length % 2 || movimientos.length > MAX_MOVIMIENTOS * 2) return { valida: false, motivo: "movimientos mal formados" };
  const partida = crearPartida(semilla);
  for (let i = 0; i < movimientos.length; i += 2) {
    const motivo = motivoMovimientoInvalido(partida, movimientos[i], movimientos[i + 1]);
    if (motivo) return { valida: false, motivo: `movimiento ${i / 2 + 1}: ${motivo}` };
    partida.movimientos.push(movimientos[i], movimientos[i + 1]);
    partida.ultimoT = movimientos[i];
  }
  avanzar(partida, DURACION_MS);
  return { valida: true, ...resumen(partida) };
}
