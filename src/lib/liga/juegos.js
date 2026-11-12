// ============ LIGA CAZURRA: juegos y comprobación de partidas ============
// Cada juego tiene un motor determinista en public/liga/motor-*.js. El móvil juega con él y el servidor
// repite la partida con la misma semilla y lo que hizo el jugador: los puntos que valen son los de aquí.
import * as canasta from "../../../public/liga/motor-canasta.js";
import * as tapas from "../../../public/liga/motor-tapas.js";
import * as botillo from "../../../public/liga/motor-botillo.js";
import * as cecina from "../../../public/liga/motor-cecina.js";
import * as vidriera from "../../../public/liga/motor-vidriera.js";
import * as pendon from "../../../public/liga/motor-pendon.js";
import * as esqui from "../../../public/liga/motor-esqui.js";
import * as rebano from "../../../public/liga/motor-rebano.js";
import * as trucha from "../../../public/liga/motor-trucha.js";
import * as justa from "../../../public/liga/motor-justa.js";
import * as bolos from "../../../public/liga/motor-bolos.js";
import * as lucha from "../../../public/liga/motor-lucha.js";
import * as maragatos from "../../../public/liga/motor-maragatos.js";

export const JUEGOS = {
  canasta: {
    id: "canasta",
    nombre: "Canasta en la Catedral",
    sitio: "Catedral",
    pagina: "/liga/canasta.html",
    foto: "/liga/fondo-v.webp",
    habilidad: "Puntería",
    version: canasta.VERSION,
    duracionMs: canasta.DURACION_MS,
    // datos = { tiros: [{ t, s, a }, …] }
    repetir: (semilla, datos) => canasta.rejugar(semilla, datos?.tiros),
    ultimoMomento: (datos) => (Array.isArray(datos?.tiros) && datos.tiros.length ? Math.max(...datos.tiros.map((x) => Number(x?.t) || 0)) : 0),
  },
  tapas: {
    id: "tapas",
    nombre: "Tapeo en el Húmedo",
    sitio: "Húmedo",
    pagina: "/liga/tapas.html",
    foto: "/liga/fondos/humedo-v.webp",
    habilidad: "Reflejos",
    version: tapas.VERSION,
    duracionMs: tapas.DURACION_MS,
    maxBytes: 40000, // como mucho 50 movimientos por segundo: ~25 KB en el peor caso
    // datos = { movimientos: [t, x, t, x, …] } (ms de partida y posición de la cazuela ×10000)
    repetir: (semilla, datos) => tapas.rejugar(semilla, datos?.movimientos),
    ultimoMomento: (datos) => ultimoPar(datos?.movimientos),
  },
  botillo: {
    id: "botillo",
    nombre: "La torre del botillo",
    sitio: "Botines",
    pagina: "/liga/botillo.html",
    foto: "/liga/fondos/botillo-v.webp",
    habilidad: "Pulso",
    version: botillo.VERSION,
    duracionMs: botillo.DURACION_MS,
    // datos = { toques: [t, t, …] } (ms de partida en que se soltó cada botillo)
    repetir: (semilla, datos) => botillo.rejugar(semilla, datos?.toques),
    ultimoMomento: ultimoToque,
  },
  cecina: {
    id: "cecina",
    nombre: "La loncha de cecina",
    sitio: "Charcutería",
    pagina: "/liga/cecina.html",
    foto: "/liga/fondos/cecina-v.webp",
    habilidad: "Precisión",
    version: cecina.VERSION,
    duracionMs: cecina.DURACION_MS,
    // datos = { toques: [t, t, …] } (ms de partida de cada corte)
    repetir: (semilla, datos) => cecina.rejugar(semilla, datos?.toques),
    ultimoMomento: ultimoToque,
  },
  vidriera: {
    id: "vidriera",
    nombre: "La Vidriera",
    sitio: "Catedral",
    pagina: "/liga/vidriera.html",
    foto: "/liga/fondos/vidriera-v.webp",
    habilidad: "Memoria",
    version: vidriera.VERSION,
    duracionMs: vidriera.DURACION_MS,
    // datos = { toques: [t, vidriera, t, vidriera, …] }
    repetir: (semilla, datos) => vidriera.rejugar(semilla, datos?.toques),
    ultimoMomento: (datos) => ultimoPar(datos?.toques),
  },
  pendon: {
    id: "pendon",
    nombre: "El Pendón",
    sitio: "San Marcos",
    pagina: "/liga/pendon.html",
    foto: "/liga/fondos/pendon-v.webp",
    habilidad: "Equilibrio",
    version: pendon.VERSION,
    duracionMs: pendon.DURACION_MS,
    maxBytes: 40000, // como mucho 50 movimientos por segundo
    // datos = { movimientos: [t, x, t, x, …] } (ms de partida y posición de la base ×10000)
    repetir: (semilla, datos) => pendon.rejugar(semilla, datos?.movimientos),
    ultimoMomento: (datos) => ultimoPar(datos?.movimientos),
  },
  esqui: {
    id: "esqui",
    nombre: "Bajada en San Isidro",
    sitio: "San Isidro",
    pagina: "/liga/esqui.html",
    foto: "/liga/fondos/montes-v.webp",
    habilidad: "Esquí",
    version: esqui.VERSION,
    duracionMs: esqui.DURACION_MS,
    maxBytes: 40000, // como mucho 50 movimientos por segundo
    // datos = { movimientos: [t, x, t, x, …] } (ms de partida y posición del esquiador ×10000)
    repetir: (semilla, datos) => esqui.rejugar(semilla, datos?.movimientos),
    ultimoMomento: (datos) => ultimoPar(datos?.movimientos),
  },
  rebano: {
    id: "rebano",
    nombre: "Trashumancia",
    sitio: "Riaño",
    pagina: "/liga/rebano.html",
    foto: "/liga/fondos/riano-v.webp",
    habilidad: "Pastoreo",
    version: rebano.VERSION,
    duracionMs: rebano.DURACION_MS,
    maxBytes: 40000, // como mucho 30 movimientos por segundo, de tres números cada uno
    // datos = { movimientos: [t, x, y, t, x, y, …] } (ms de partida y adónde va el mastín ×10000)
    repetir: (semilla, datos) => rebano.rejugar(semilla, datos?.movimientos),
    ultimoMomento: (datos) => (Array.isArray(datos?.movimientos) && datos.movimientos.length >= 3 ? Number(datos.movimientos[datos.movimientos.length - 3]) || 0 : 0),
  },
  trucha: {
    id: "trucha",
    nombre: "La trucha",
    sitio: "Río de montaña",
    pagina: "/liga/trucha.html",
    foto: "/liga/fondos/valle-v.webp",
    habilidad: "Pesca",
    version: trucha.VERSION,
    duracionMs: trucha.DURACION_MS,
    // datos = { toques: [t, t, …] } (ms de partida en que aprieta, suelta, aprieta…)
    repetir: (semilla, datos) => trucha.rejugar(semilla, datos?.toques),
    ultimoMomento: ultimoToque,
  },
  justa: {
    id: "justa",
    nombre: "La Justa del Paso Honroso",
    sitio: "Hospital de Órbigo",
    pagina: "/liga/justa.html",
    foto: "/liga/fondos/vega-v.webp",
    habilidad: "Puntería",
    version: justa.VERSION,
    duracionMs: justa.DURACION_MS,
    // datos = { movimientos: [t, y, t, y, …] } (ms de partida y dónde quiere la punta de la lanza ×10000)
    maxBytes: 40000, // como mucho 1.500 movimientos de dos números
    repetir: (semilla, datos) => justa.rejugar(semilla, datos?.movimientos),
    ultimoMomento: (datos) => ultimoPar(datos?.movimientos),
  },
  bolos: {
    id: "bolos",
    nombre: "Bolos leoneses",
    sitio: "Bolera de pueblo",
    pagina: "/liga/bolos.html",
    foto: "/liga/fondos/valle-v.webp",
    habilidad: "Efecto",
    version: bolos.VERSION,
    duracionMs: bolos.DURACION_MS,
    // datos = { tiros: [t, x, a, c, s, …] } (ms de partida, salida, dirección, efecto y fuerza de cada bola)
    repetir: (semilla, datos) => bolos.rejugar(semilla, datos?.tiros),
    ultimoMomento: (datos) => (Array.isArray(datos?.tiros) && datos.tiros.length >= 5 ? Number(datos.tiros[datos.tiros.length - 5]) || 0 : 0),
  },
  lucha: {
    id: "lucha",
    nombre: "Lucha leonesa",
    sitio: "Corro de aluches",
    pagina: "/liga/lucha.html",
    foto: "/liga/fondos/montes-v.webp",
    habilidad: "Reflejos",
    version: lucha.VERSION,
    duracionMs: lucha.DURACION_MS,
    // datos = { gestos: [t, d, t, d, …] } (ms de partida y hacia dónde desliza: 0 izq, 1 der, 2 arriba, 3 abajo)
    repetir: (semilla, datos) => lucha.rejugar(semilla, datos?.gestos),
    ultimoMomento: (datos) => ultimoPar(datos?.gestos),
  },
  maragatos: {
    id: "maragatos",
    nombre: "Los maragatos del reloj",
    sitio: "Astorga",
    pagina: "/liga/maragatos.html",
    foto: "/liga/fondos/tarde-v.webp",
    habilidad: "Ritmo",
    version: maragatos.VERSION,
    duracionMs: maragatos.DURACION_MS,
    // datos = { toques: [t, lado, t, lado, …] } (ms de partida y lado: 0 izquierda, 1 derecha)
    repetir: (semilla, datos) => maragatos.rejugar(semilla, datos?.toques),
    ultimoMomento: (datos) => ultimoPar(datos?.toques),
  },
};

function ultimoToque(datos) {
  return Array.isArray(datos?.toques) && datos.toques.length ? Number(datos.toques[datos.toques.length - 1]) || 0 : 0;
}

// tiempo del último [t, x] de una lista plana
function ultimoPar(lista) {
  if (!Array.isArray(lista) || lista.length < 2) return 0;
  return Number(lista[lista.length - 2]) || 0;
}

// Orden en que rotan por los días (calendario.juegosDelDia)
export const EN_LIGA = ["canasta", "tapas", "botillo", "cecina", "vidriera", "pendon", "esqui", "rebano", "trucha", "justa", "bolos", "lucha", "maragatos"];

// Los juegos que puntúan un día dado: los nuevos entran el día de su «estreno» (un lunes, para no cambiar los juegos
// de una semana que ya está en marcha). dia = "2026-11-16" en hora de Madrid.
export function enLigaEl(dia) { return EN_LIGA.filter((id) => !JUEGOS[id].estreno || dia >= JUEGOS[id].estreno); }

export const MAX_BYTES_DATOS = 20000; // lo normal (una canasta ocupa unos 2 KB); cada juego puede subirlo con maxBytes

// Margen para el reloj del móvil y la red: el tiempo real entre empezar y terminar no puede ser
// mucho menor que lo que dice la partida (si no, alguien la ha jugado "a cámara rápida").
const MARGEN_RELOJ_MS = 2500;
const MAX_PARTIDA_MS = 15 * 60 * 1000; // pasado esto, la partida se da por abandonada

// Devuelve { estado: "valida" | "rechazada", puntos, motivo, resumen }
export function comprobarPartida({ juego, version, semilla, empezada, ahora, datos }) {
  const j = JUEGOS[juego];
  if (!j) return { estado: "rechazada", puntos: null, motivo: "juego desconocido" };
  if (Number(version) !== j.version) return { estado: "rechazada", puntos: null, motivo: "se jugó con una versión vieja del juego" };
  let tam = 0;
  try { tam = JSON.stringify(datos ?? null).length; } catch { return { estado: "rechazada", puntos: null, motivo: "datos ilegibles" }; }
  if (tam > (j.maxBytes || MAX_BYTES_DATOS)) return { estado: "rechazada", puntos: null, motivo: "demasiados datos" };
  const real = new Date(ahora).getTime() - new Date(empezada).getTime();
  if (!(real >= 0)) return { estado: "rechazada", puntos: null, motivo: "fechas imposibles" };
  if (real > MAX_PARTIDA_MS) return { estado: "rechazada", puntos: null, motivo: "la partida se dejó a medias demasiado tiempo" };
  const ultimo = j.ultimoMomento(datos);
  if (ultimo > real + MARGEN_RELOJ_MS) return { estado: "rechazada", puntos: null, motivo: "partida más rápida que el reloj" };
  let r;
  try { r = j.repetir(Number(semilla), datos); } catch (e) { return { estado: "rechazada", puntos: null, motivo: `no se pudo repetir: ${e?.message || e}` }; }
  if (!r?.valida) return { estado: "rechazada", puntos: null, motivo: r?.motivo || "partida imposible" };
  return { estado: "valida", puntos: r.puntos, motivo: null, resumen: r };
}

// Semilla de 32 bits que no sea 0 (el motor la usa tal cual)
export function semillaServidor() {
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] === 0);
  return a[0];
}
