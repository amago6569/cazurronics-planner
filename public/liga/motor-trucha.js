// ============ LA TRUCHA: el motor ============
// Pesca «a la leonesa» en un río de la montaña: un buldó (la boya) y una mosca de pluma de gallo de León. La boya se
// hunde cuando pica: hay que clavar a tiempo. Luego, la pelea: con el dedo apretado recoges sedal; si lo sueltas, das
// sedal. La trucha tira a arreones: si recoges cuando tira, el sedal se rompe; si lo dejas flojo, se suelta.
// Cuanto más grande, más puntos (los centímetros que mide) y más guerra da.
//
// Este archivo decide TODO lo que cuenta. Lo usan el móvil y el servidor (que repite la partida con la misma semilla
// y los mismos toques). Por eso aquí no hay Math.random, ni senos, ni potencias, ni fechas: solo sumas, productos y
// divisiones, que dan exactamente lo mismo en cualquier móvil y en el servidor.
//
// Lo que manda el jugador: una lista de tiempos (ms de partida) en los que aprieta, suelta, aprieta, suelta…
// Unidades: la tensión del sedal va de 0 (flojo) a 1 (a punto de romper) y algo más; la distancia, en metros.

export const VERSION = 1;
export const DURACION_MS = 50000;
export const PASOS_POR_SEGUNDO = 120;
const DT = 1 / PASOS_POR_SEGUNDO;

export const TENSION = { flojo: 0.16, bien: [0.45, 0.86], rompe: 1 }; // las zonas del sedal
export const AGUANTE = { rompe: 300, flojo: 750 }; // ms seguidos por encima de «rompe» o por debajo de «flojo» antes de perderla
export const CLAVAR_MS = 700; // lo que tarda en soltar la mosca si no clavas
export const PERFECTA_MS = 260; // clavada rápida: premio
export const EN_FALSO_MS = 900; // tirar antes de que pique la espanta: lo que se alarga la espera
export const PAUSA = { trucha: 1100, rota: 1900, suelta: 1100, sefue: 500, lance: 500 }; // ms hasta volver a tener la mosca en el agua
export const RECOGER = 2.5; // metros por segundo que recoge el carrete con el sedal en su punto
export const CARRERA = 3.4; // metros por segundo que se lleva la trucha cuando tira a tope y le das sedal
export const SEDAL = 16; // metros de sedal: de ahí no pasa
export const PUNTOS = { perfecta: 3, limpia: 5 };
export const MAX_TOQUES = 700;
export const SEPARACION_MIN_MS = 25;
export const EMPIEZA_MS = 300;

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

// La trucha que toca: cada una que sacas, la siguiente tiende a ser mayor. De 22 a 62 cm.
function nuevaTrucha(p) {
  const s = p.suerte, base = 24 + (p.sacadas > 5 ? 5 : p.sacadas) * 4;
  let cm = Math.floor(base + (s() + s() - 1) * 7);
  if (s() < 0.1) cm += 8 + Math.floor(s() * 6); // de vez en cuando, un truchón
  if (cm < 22) cm = 22; else if (cm > 62) cm = 62;
  const k = (cm - 22) / 40; // 0 la más pequeña … 1 la más grande
  return { cm, k, fuerza: 0.72 + 0.4 * k, distancia: 5 + 3.5 * k + s() * 1.5, fondo: 0.5 + 0.3 * k };
}

// Echar la mosca: cuándo pica y los amagos de antes (la boya tiembla pero no se hunde)
function lanzar(p, t, extra) {
  const s = p.suerte;
  p.estado = "espera";
  p.trucha = nuevaTrucha(p);
  p.pica = t + extra + 900 + Math.floor(s() * 1900);
  p.amagos = [];
  const n = s() < 0.45 ? 0 : s() < 0.7 ? 1 : 2;
  for (let i = 0; i < n; i++) p.amagos.push(t + extra + 250 + Math.floor(s() * (p.pica - t - extra - 600)));
  p.amagos.sort((a, b) => a - b);
  p.iAmago = 0;
  p.lanzada = t;
}

// Los tirones de una trucha: tramos tranquilos y arreones, unidos por rampas (se la ve venir un cuarto de segundo antes)
function generarPelea(p, t) {
  const s = p.suerte, tr = p.trucha, nudos = [[t, 0.55]];
  let u = t + 500 + Math.floor(s() * 500);
  while (u < t + 40000) {
    const calma = 0.26 + 0.2 * s();
    nudos.push([u, calma]);
    u += 600 + Math.floor(s() * (1500 - 500 * tr.k)); // un rato tranquila (las grandes, menos)
    nudos.push([u, calma + 0.05 * (s() * 2 - 1)]);
    const aviso = 170 + Math.floor(s() * 110), fuerte = 0.92 + 0.26 * s() + 0.12 * tr.k;
    u += aviso; nudos.push([u, fuerte]); // arranca
    u += 450 + Math.floor(s() * (500 + 500 * tr.k)); nudos.push([u, fuerte * (0.9 + 0.1 * s())]); // aguanta el arreón
    u += 300 + Math.floor(s() * 200);
  }
  nudos.push([u, 0.3]);
  p.nudos = nudos; p.iNudo = 0;
}
function tiraEn(p, t) {
  const n = p.nudos;
  while (p.iNudo + 1 < n.length - 1 && n[p.iNudo + 1][0] <= t) p.iNudo++;
  const [t0, v0] = n[p.iNudo], [t1, v1] = n[p.iNudo + 1];
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

export function crearPartida(semilla) {
  const p = {
    version: VERSION, semilla: semilla >>> 0, suerte: crearSuerte(semilla),
    paso: 0, toques: [], leidos: 0, ultimoT: 0, apretado: false,
    estado: "pausa", vuelve: EMPIEZA_MS, extra: 0, // pausa → espera → pelea → pausa…
    trucha: null, pica: 0, amagos: [], iAmago: 0, lanzada: 0,
    nudos: null, iNudo: 0, tension: 0, tira: 0, distancia: 0, aguante: 1, sobre: 0, bajo: 0, apuros: 0, clavada: 0, perfecta: false,
    puntos: 0, sacadas: 0, mayor: 0, rotas: 0, sueltas: 0, falsos: 0, perfectas: 0, cm: 0,
  };
  return p;
}

export function motivoToqueInvalido(p, t) {
  if (!Number.isInteger(t)) return "valores que no son enteros";
  if (t < 0 || t > DURACION_MS) return "toque fuera de tiempo";
  const n = p.toques.length;
  if (n >= MAX_TOQUES) return "demasiados toques";
  if (n && t < p.ultimoT + SEPARACION_MIN_MS) return "toques demasiado seguidos";
  return null;
}

// Apretar o soltar (van alternos: el primero aprieta)
export function tocar(p, t) {
  const motivo = motivoToqueInvalido(p, t);
  if (motivo) throw new Error(motivo);
  p.toques.push(t);
  p.ultimoT = t;
}

// Tiempo (ms) que ya está decidido: los toques nuevos tienen que llevar este tiempo o más.
export function tiempoHecho(p) { return Math.floor((p.paso * 1000) / PASOS_POR_SEGUNDO) + 1; }

// Cuánto rinde el carrete según la tensión: a tope en la zona buena, poco si va flojo o a punto de romper
export function rinde(tension) {
  const [a, b] = TENSION.bien;
  if (tension >= a && tension <= b) return 1;
  if (tension < a) return 0.35 + 0.65 * (tension / a);
  const k = (tension - b) / (TENSION.rompe - b);
  return k >= 1 ? 0.3 : 1 - 0.7 * k;
}

function perder(p, t, tipo, pasado) {
  if (tipo === "rota") p.rotas++; else p.sueltas++;
  pasado.push({ tipo, t, cm: p.trucha.cm });
  p.estado = "pausa"; p.vuelve = t + PAUSA[tipo]; p.extra = 0;
  p.tension = 0;
}

// Avanza hasta el ms «hasta». Devuelve lo que ha pasado:
// { tipo: "lance" | "amago" | "pica" | "clavada" | "falso" | "sefue" | "arreon" | "rota" | "suelta" | "trucha", t, … }
export function avanzar(p, hasta) {
  const fin = hasta < DURACION_MS ? hasta : DURACION_MS;
  const pasado = [];
  for (;;) {
    const t = ((p.paso + 1) * 1000) / PASOS_POR_SEGUNDO;
    if (t > fin) break;
    p.paso++;
    // ── los toques de este paso ──
    let aprieta = false;
    while (p.leidos < p.toques.length && p.toques[p.leidos] <= t) {
      p.apretado = p.leidos % 2 === 0;
      if (p.apretado) aprieta = true;
      p.leidos++;
    }
    if (p.estado === "pausa") {
      if (t >= p.vuelve) { lanzar(p, t, p.extra + PAUSA.lance); pasado.push({ tipo: "lance", t }); }
      continue;
    }
    if (p.estado === "espera") {
      while (p.iAmago < p.amagos.length && p.amagos[p.iAmago] <= t) { p.iAmago++; pasado.push({ tipo: "amago", t }); }
      if (t < p.pica) {
        // tirar antes de tiempo: la trucha se asusta y tarda más en picar
        if (aprieta && t > p.lanzada + PAUSA.lance) {
          p.falsos++;
          p.pica += EN_FALSO_MS; p.amagos = p.amagos.map((a) => (a > t ? a + EN_FALSO_MS : a));
          pasado.push({ tipo: "falso", t });
        }
        continue;
      }
      if (!p.picada) { p.picada = true; pasado.push({ tipo: "pica", t, cm: p.trucha.cm }); }
      if (aprieta) {
        // ¡clavada!
        const tardo = t - p.pica;
        p.picada = false;
        p.estado = "pelea"; p.clavada = t;
        p.perfecta = tardo <= PERFECTA_MS;
        if (p.perfecta) { p.perfectas++; p.puntos += PUNTOS.perfecta; }
        p.distancia = p.trucha.distancia * (p.perfecta ? 0.88 : 1);
        p.tension = 0.5; p.aguante = 1; p.sobre = 0; p.bajo = 0; p.apuros = 0; p.arreon = false;
        generarPelea(p, t);
        pasado.push({ tipo: "clavada", t, tardo, perfecta: p.perfecta, ganados: p.perfecta ? PUNTOS.perfecta : 0, cm: p.trucha.cm });
      } else if (t >= p.pica + CLAVAR_MS) {
        p.picada = false;
        pasado.push({ tipo: "sefue", t });
        p.estado = "pausa"; p.vuelve = t + PAUSA.sefue; p.extra = 0;
      }
      continue;
    }
    // ── la pelea ──
    const tr = p.trucha;
    const tira = tiraEn(p, t) * tr.fuerza * (0.5 + 0.5 * p.aguante); // cansada tira menos
    p.tira = tira;
    if (!p.arreon && tira > 0.7 * tr.fuerza * (0.5 + 0.5 * p.aguante) && tira > 0.6) { p.arreon = true; pasado.push({ tipo: "arreon", t }); }
    else if (p.arreon && tira < 0.5) p.arreon = false;
    // la tensión va hacia lo que tira la trucha, más lo que recoges tú
    const quiere = p.apretado ? tira * 0.78 + 0.44 : tira * 0.78 - 0.26;
    const destino = quiere < 0 ? 0 : quiere;
    p.tension += (destino - p.tension) * (destino > p.tension ? 5.5 : 4) * DT;
    // el sedal
    if (p.apretado) p.distancia -= RECOGER * rinde(p.tension) * (1.15 - 0.3 * tr.k) * DT;
    else if (p.distancia < SEDAL) p.distancia += CARRERA * tira * tira * DT;
    // se cansa con el sedal tenso
    p.aguante -= p.tension * (0.085 - 0.03 * tr.k) * DT;
    if (p.aguante < 0) p.aguante = 0;
    // apuros
    if (p.tension > TENSION.rompe) { if (p.sobre === 0) p.apuros++; p.sobre += 1000 * DT; } else if (p.sobre > 0) { p.sobre -= 500 * DT; if (p.sobre < 0) p.sobre = 0; }
    if (p.tension < TENSION.flojo) { if (p.bajo === 0) p.apuros++; p.bajo += 1000 * DT; } else if (p.bajo > 0) { p.bajo -= 700 * DT; if (p.bajo < 0) p.bajo = 0; }
    if (p.sobre >= AGUANTE.rompe) { perder(p, t, "rota", pasado); continue; }
    if (p.bajo >= AGUANTE.flojo && t > p.clavada + 600) { perder(p, t, "suelta", pasado); continue; }
    if (p.distancia <= 0) {
      const limpia = p.apuros === 0;
      const ganados = tr.cm + (limpia ? PUNTOS.limpia : 0);
      p.puntos += ganados; p.sacadas++; p.cm += tr.cm;
      if (tr.cm > p.mayor) p.mayor = tr.cm;
      pasado.push({ tipo: "trucha", t, cm: tr.cm, ganados, limpia, segundos: Math.ceil((t - p.clavada) / 1000) });
      p.estado = "pausa"; p.vuelve = t + PAUSA.trucha; p.extra = 0; p.tension = 0;
    }
  }
  return pasado;
}

export function resumen(p) {
  const { puntos, sacadas, mayor, rotas, sueltas, perfectas } = p;
  return { puntos, truchas: sacadas, mayor, perdidas: rotas + sueltas, rotas, sueltas, perfectas };
}

export function rejugar(semilla, toques) {
  if (!Array.isArray(toques)) return { valida: false, motivo: "faltan los toques" };
  if (toques.length > MAX_TOQUES) return { valida: false, motivo: "demasiados toques" };
  const p = crearPartida(semilla);
  for (let i = 0; i < toques.length; i++) {
    const motivo = motivoToqueInvalido(p, toques[i]);
    if (motivo) return { valida: false, motivo: `toque ${i + 1}: ${motivo}` };
    p.toques.push(toques[i]);
    p.ultimoT = toques[i];
  }
  avanzar(p, DURACION_MS);
  return { valida: true, ...resumen(p) };
}
