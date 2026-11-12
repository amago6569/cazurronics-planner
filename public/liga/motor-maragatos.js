// ============ LOS MARAGATOS DEL RELOJ: el motor ============
// En lo alto del Ayuntamiento de Astorga, dos maragatos de metal dan las horas a mazazos en la campana. Aquí los
// llevas tú: el de la izquierda y la de la derecha. Las marcas bajan por su lado hacia la campana y hay que tocar
// justo cuando llegan. Cuanto más clavado, más puntos; sin fallar, los puntos se multiplican. El compás se acelera
// dos veces.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos toques). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas.
//
// Lo que manda el jugador: [t, lado, t, lado, …] = en el ms t toca el lado (0 izquierda, 1 derecha).

export const VERSION = 1;
export const DURACION_MS = 46000;
export const PASOS_POR_SEGUNDO = 120;

// Los tres tramos: cuándo empiezan y lo que dura un golpe de compás (ms, pares para que el medio golpe sea entero)
export const TRAMOS = [
  { desde: 2000, golpe: 640, golpes: 22 },
  { desde: 2000 + 22 * 640, golpe: 540, golpes: 26 },
  { desde: 2000 + 22 * 640 + 26 * 540, golpe: 460, golpes: 32 },
];
export const MARGEN = { clavada: 55, buena: 105, justa: 150 }; // ms de diferencia para cada nota
export const PUNTOS = { clavada: 3, buena: 2, justa: 1, enFalso: -2 }; // tocar sin marca resta: aporrear no sirve
export const RACHA = { cada: 10, maximo: 3 }; // cada 10 seguidas, un multiplicador más (hasta ×3)
export const VIAJE_MS = 1500; // lo que tarda una marca en bajar (solo para verla venir)
export const MAX_TOQUES = 420;
export const SEPARACION_MIN_MS = 30; // entre dos toques cualesquiera
export const FIN_MS = TRAMOS[2].desde + TRAMOS[2].golpes * TRAMOS[2].golpe;

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

// La partitura: compases de 4 golpes. Cada compás sale de unos cuantos dibujos de ritmo, más cargados según avanza.
// Un dibujo son 8 medios golpes: 0 nada, 1 un lado, 2 el otro, 3 los dos a la vez.
const DIBUJOS = [
  // tranquilos: a golpe
  [[1, 0, 2, 0, 1, 0, 2, 0], [1, 0, 1, 0, 2, 0, 2, 0], [1, 0, 0, 0, 2, 0, 0, 0], [1, 0, 2, 0, 1, 0, 0, 0], [2, 0, 0, 0, 1, 0, 2, 0]],
  // con medios golpes
  [[1, 0, 2, 2, 1, 0, 2, 0], [1, 1, 2, 0, 1, 0, 2, 2], [1, 0, 2, 0, 1, 2, 1, 0], [3, 0, 0, 0, 1, 0, 2, 0], [1, 0, 1, 2, 0, 2, 1, 0], [2, 0, 1, 0, 3, 0, 0, 0]],
  // apretados
  [[1, 2, 1, 0, 2, 1, 2, 0], [1, 1, 2, 2, 1, 0, 3, 0], [3, 0, 1, 2, 3, 0, 2, 1], [1, 2, 1, 2, 1, 0, 2, 0], [1, 0, 3, 0, 2, 1, 2, 0], [2, 2, 1, 0, 1, 1, 2, 0]],
];

function partitura(suerte) {
  const notas = [];
  TRAMOS.forEach((tr, i) => {
    const compases = Math.floor(tr.golpes / 4);
    for (let c = 0; c < compases; c++) {
      // el primer compás de cada tramo, de respiro: solo marca el compás nuevo
      const nivel = c === 0 ? 0 : suerte() < 0.3 + 0.1 * i ? Math.min(2, i + 1) : i;
      const lista = DIBUJOS[nivel], dib = lista[Math.floor(suerte() * lista.length)];
      const gira = suerte() < 0.5; // cambia izquierda por derecha
      for (let k = 0; k < 8; k++) {
        const v = dib[k];
        if (!v) continue;
        const t = tr.desde + c * 4 * tr.golpe + (k * tr.golpe) / 2;
        const lado = (v === 1) !== gira ? 0 : 1;
        if (v === 3) { notas.push({ t, lado: 0, doble: true }, { t, lado: 1, doble: true }); }
        else notas.push({ t, lado, doble: false });
      }
    }
  });
  return notas;
}

export function crearPartida(semilla) {
  const suerte = crearSuerte(semilla);
  const notas = partitura(suerte).map((n, i) => ({ ...n, i, estado: "viene", dif: 0 }));
  return {
    version: VERSION, semilla: semilla >>> 0,
    paso: 0, toques: [], leidos: 0, ultimoT: 0,
    notas, primera: 0, // primera nota que aún puede tocarse
    puntos: 0, racha: 0, mejorRacha: 0, clavadas: 0, buenas: 0, justas: 0, perdidas: 0, enFalso: 0,
  };
}

// El golpe de compás que toca en el ms t (para el tic del compás): { n, golpe } o null
export function compasEn(t) {
  for (let i = TRAMOS.length - 1; i >= 0; i--) {
    const tr = TRAMOS[i];
    if (t >= tr.desde) { const n = Math.floor((t - tr.desde) / tr.golpe); return n < tr.golpes ? { tramo: i, n, golpe: tr.golpe, t: tr.desde + n * tr.golpe } : null; }
  }
  return null;
}

export const multiplicador = (racha) => Math.min(RACHA.maximo, 1 + Math.floor(racha / RACHA.cada));

export function motivoToqueInvalido(p, t, lado) {
  if (!Number.isInteger(t) || !Number.isInteger(lado)) return "valores que no son enteros";
  if (t < 0 || t > DURACION_MS) return "toque fuera de tiempo";
  if (lado !== 0 && lado !== 1) return "lado desconocido";
  const n = p.toques.length;
  if (n >= MAX_TOQUES * 2) return "demasiados toques";
  if (n && t < p.ultimoT) return "toques desordenados";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS && p.toques[n - 1] === lado) return "toques demasiado seguidos";
  return null;
}

export function tocar(p, t, lado) {
  const motivo = motivoToqueInvalido(p, t, lado);
  if (motivo) throw new Error(motivo);
  p.toques.push(t, lado);
  p.ultimoT = t;
}

export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado: { tipo: "nota" | "perdida" | "falso", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  const N = p.notas;
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    // ── los toques de este paso: cada uno busca la marca de su lado que tiene más cerca ──
    while (p.leidos < p.toques.length && p.toques[p.leidos] <= t) {
      const tt = p.toques[p.leidos], lado = p.toques[p.leidos + 1];
      p.leidos += 2;
      let mejor = null, dm = MARGEN.justa + 1;
      for (let i = p.primera; i < N.length && N[i].t <= tt + MARGEN.justa; i++) {
        const n = N[i];
        if (n.estado !== "viene" || n.lado !== lado) continue;
        const d = n.t > tt ? n.t - tt : tt - n.t;
        if (d < dm) { dm = d; mejor = n; }
      }
      if (!mejor) {
        p.enFalso++; p.racha = 0;
        p.puntos += PUNTOS.enFalso; if (p.puntos < 0) p.puntos = 0;
        pasado.push({ tipo: "falso", t: tt, lado });
        continue;
      }
      const nota = dm <= MARGEN.clavada ? "clavada" : dm <= MARGEN.buena ? "buena" : "justa";
      const por = multiplicador(p.racha), ganados = PUNTOS[nota] * por;
      mejor.estado = nota; mejor.dif = tt - mejor.t;
      p.puntos += ganados; p.racha++;
      if (nota === "clavada") p.clavadas++; else if (nota === "buena") p.buenas++; else p.justas++;
      if (p.racha > p.mejorRacha) p.mejorRacha = p.racha;
      pasado.push({ tipo: "nota", t: tt, lado, nota, ganados, por, dif: mejor.dif, racha: p.racha, i: mejor.i, doble: mejor.doble });
    }
    // ── las que se han pasado ──
    while (p.primera < N.length && (N[p.primera].estado !== "viene" || N[p.primera].t + MARGEN.justa < t)) {
      const n = N[p.primera];
      if (n.estado === "viene") {
        n.estado = "perdida"; p.perdidas++; p.racha = 0;
        pasado.push({ tipo: "perdida", t, lado: n.lado, i: n.i });
      }
      p.primera++;
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, mejorRacha, clavadas, buenas, justas, perdidas, enFalso } = p;
  return { puntos, mejorRacha, clavadas, tocadas: clavadas + buenas + justas, perdidas, enFalso, notas: p.notas.length };
}

export function rejugar(semilla, toques) {
  if (!Array.isArray(toques)) return { valida: false, motivo: "faltan los toques" };
  if (toques.length % 2 || toques.length > MAX_TOQUES * 2) return { valida: false, motivo: "toques mal formados" };
  const p = crearPartida(semilla);
  for (let i = 0; i < toques.length; i += 2) {
    const motivo = motivoToqueInvalido(p, toques[i], toques[i + 1]);
    if (motivo) return { valida: false, motivo: `toque ${i / 2 + 1}: ${motivo}` };
    p.toques.push(toques[i], toques[i + 1]);
    p.ultimoT = toques[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
