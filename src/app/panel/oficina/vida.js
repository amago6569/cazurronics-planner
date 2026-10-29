// ============ LA OFICINA EN DIRECTO: QUE SE MUEVAN ============
// Funciones puras para que la oficina no esté quieta entre turnos:
//  · Paseos: alguien se levanta, va a hablar con otro (lo que se dijeron de verdad en la charla), vuelve a su sitio.
//  · Reunión: los que tienen propuesta van a la mesa redonda del escaparate y la dicen por turnos.
// El tiempo t va en segundos de reloj (el de three.js). Nada de esto llama al servidor.
import { largo, puntoEn, ruta, sitioReunion, visita } from "./guion";

export const VEL = 2.6;           // metros por segundo andando
export const HABLA = 4.2;         // segundos que dura un bocadillo
export const CADA = 7;            // un paseo nuevo cada tantos segundos
export const A_LA_VEZ = 2;        // como mucho, paseos a la vez

// desde/hacia: sitios de guion.js (con pos y salida). Devuelve el paseo con sus tiempos
export function montarPaseo({ id, desde, hacia, t0, texto = null, a = null, habla = HABLA }) {
  const destino = visita(hacia);
  const ida = ruta(desde, destino), vuelta = ruta(destino, desde);
  const t1 = t0 + largo(ida) / VEL, t2 = t1 + habla, t3 = t2 + largo(vuelta) / VEL;
  return { id, a, texto, ida, vuelta, t0, t1, t2, t3, mira: Math.atan2(hacia.pos[0] - destino.pos[0], hacia.pos[1] - destino.pos[1]) };
}

// { x, z, giro, modo } o null si el paseo no está en marcha en t
export function poseDePaseo(p, t) {
  if (!p || t < p.t0 || t >= p.t3) return null;
  if (t < p.t1) return { ...puntoEn(p.ida, (t - p.t0) * VEL), modo: "anda" };
  if (t < p.t2) { const [x, z] = p.ida.at(-1); return { x, z, giro: p.mira, modo: "habla" }; }
  return { ...puntoEn(p.vuelta, (t - p.t2) * VEL), modo: "anda" };
}
export const hablandoEn = (p, t) => !!p && t >= p.t1 && t < p.t2;

// Elige la siguiente conversación: recorre la charla de verdad (de los últimos días) en orden, saltando a quien
// ya está paseando, a quien no tiene sitio o a quien está trabajando en su mesa. Si no hay charla, un café.
// vivos = { id: { sitio, modo } } (colocar de guion.js) · ocupados = ids que ya pasean · i = por dónde va
// dichos = Set de lo que ya se ha dicho una vez. Un fallo se le cuenta al jefe UNA sola vez (y solo si aún lo tiene
// pendiente): luego se vuelve a la cafetería y lo repasa al empezar su turno, sin dar la lata en el despacho.
const UNA_VEZ = new Set(["fallo", "repaso"]);
const claveLinea = (l) => `${l.de}|${l.a}|${l.texto}`;
export function siguientePaseo({ charla = [], vivos = {}, ocupados = [], i = 0, t0 = 0, jefe = null, dichos = new Set() }) {
  const lugar = (id) => (id === "jefe" ? jefe : vivos[id]?.sitio);
  const libre = (id) => !ocupados.includes(id) && (id === "jefe" || (vivos[id] && vivos[id].modo !== "teclea"));
  const lineas = charla.filter((l) => l.de !== "tu" && l.a !== "tu" && l.de !== l.a);
  for (let k = 0; k < lineas.length; k++) {
    const n = (i + k) % lineas.length;
    const l = lineas[n];
    // Quien habla va a ver al otro (el jefe no se mueve de su despacho: le van a ver a él o le contesta en su sitio)
    const anda = l.de === "jefe" ? l.a : l.de;
    const a = anda === l.de ? l.a : l.de;
    if (!libre(anda) || anda === "jefe" || ocupados.includes(a) || !lugar(anda) || !lugar(a)) continue;
    if (UNA_VEZ.has(l.tipo)) {
      if (dichos.has(claveLinea(l)) || (l.tipo === "fallo" && !vivos[anda]?.pendiente)) continue;
      dichos.add(claveLinea(l));
    }
    return { paseo: montarPaseo({ id: anda, desde: lugar(anda), hacia: lugar(a), t0, texto: l.texto, a: l.de === anda ? a : null }), i: n + 1 };
  }
  return { paseo: null, i };
}

// La reunión: cada uno de los que proponen va a una silla de la mesa redonda y dice su propuesta por turnos.
// participantes = [{ id, texto }] (el primero suele ser el jefe). Devuelve { paseos, bocadillos, fin }
export function montarReunionEscena(participantes = [], vivos = {}, jefe = null, t0 = 0) {
  const lugar = (id) => (id === "jefe" ? jefe : vivos[id]?.sitio);
  const van = [];
  for (const p of participantes) if (lugar(p.id) && !van.some((v) => v.id === p.id) && van.length < 8) van.push(p);
  const paseos = van.map((p, i) => {
    const silla = sitioReunion(i);
    const ida = ruta(lugar(p.id), silla);
    return { id: p.id, ida, t0, t1: t0 + largo(ida) / VEL, silla };
  });
  const sentados = Math.max(t0 + 1, ...paseos.map((p) => p.t1)) + 0.6;
  const bocadillos = van.map((p, i) => ({ quien: p.id, texto: p.texto, s0: sentados + i * HABLA, s1: sentados + (i + 1) * HABLA }));
  const acaba = sentados + van.length * HABLA + 0.5;
  for (const p of paseos) {
    p.vuelta = ruta(p.silla, lugar(p.id));
    p.t2 = acaba;
    p.t3 = acaba + largo(p.vuelta) / VEL;
    p.mira = p.silla.giro;
  }
  return { paseos, bocadillos, fin: Math.max(acaba, ...paseos.map((p) => p.t3)) };
}

// En la reunión, el que está sentado no anda: espera en su silla mirando a la mesa
export function poseDeReunion(p, t) {
  if (!p || t < p.t0 || t >= p.t3) return null;
  if (t < p.t1) return { ...puntoEn(p.ida, (t - p.t0) * VEL), modo: "anda" };
  if (t < p.t2) return { x: p.silla.pos[0], z: p.silla.pos[1], giro: p.mira, modo: "reunion" };
  return { ...puntoEn(p.vuelta, (t - p.t2) * VEL), modo: "anda" };
}
