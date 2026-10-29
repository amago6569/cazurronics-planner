// ============ EL EDIFICIO DE LA OFICINA 3D ============
// Funciones puras (sin React ni three.js) para poder probarlas:
//  · SALAS: las habitaciones, en el orden del trabajo. Atrás: búsqueda → control de fuentes → archivo → despacho.
//    Delante: cafetería, Despensa, Negocio y el escaparate a la calle. Entre las dos filas, el pasillo.
//  · planta(departamentos): la mesa de cada empleado y el camino de su silla a la puerta de su sala.
//  · ruta(a, b): por dónde camina alguien de un sitio a otro (sala → puerta → pasillo → puerta → sala).
// Medidas en metros: x hacia la derecha, z hacia la cámara.

export const PASILLO_Z = 0;
export const EDIFICIO = { x0: -16, x1: 16, z0: -11, z1: 11 };
export const SALAS = {
  busqueda: { rotulo: [-13.4, -10.7], x0: -16, x1: -1, z0: -11, z1: -1.2, puerta: [-8.4, -1.2], nombre: "Sala de búsqueda", corto: "Búsqueda", emoji: "🔎", suelo: "#d5d9df" },
  control: { rotulo: [2.5, -10.7], x0: -1, x1: 6, z0: -11, z1: -1.2, puerta: [2.5, -1.2], nombre: "Control de fuentes", corto: "Control", emoji: "🧐", suelo: "#d9dbe0" },
  archivo: { rotulo: [8.5, -10.7], x0: 6, x1: 11, z0: -11, z1: -1.2, puerta: [8.5, -1.2], nombre: "Archivo · Agenda", corto: "Archivo", emoji: "🗄️", suelo: "#d5d9df" },
  despacho: { rotulo: [13.5, -10.7], x0: 11, x1: 16, z0: -11, z1: -1.2, puerta: [13.5, -1.2], nombre: "Despacho del jefe", corto: "Jefe", emoji: "👔", suelo: "#c9b9a6" },
  cafe: { rotulo: [-11, 10.6], x0: -16, x1: -6, z0: 1.2, z1: 11, puerta: [-7, 1.2], nombre: "Cafetería", corto: "Cafetería", emoji: "☕", suelo: "#d6b48c" },
  despensa: { rotulo: [-3, 10.6], x0: -6, x1: 0, z0: 1.2, z1: 11, puerta: [-3, 1.2], nombre: "Despensa", corto: "Despensa", emoji: "🧺", suelo: "#dcd3c4" },
  negocio: { rotulo: [2.5, 10.6], x0: 0, x1: 5, z0: 1.2, z1: 11, puerta: [2.5, 1.2], nombre: "Negocio", corto: "Negocio", emoji: "📣", suelo: "#d8d4e3" },
  escaparate: { rotulo: [10.5, 10.6], x0: 5, x1: 16, z0: 1.2, z1: 11, puerta: [7.5, 1.2], nombre: "Escaparate", corto: "Escaparate", emoji: "🪟", suelo: "#d9dbe0" },
};
// Cada departamento trabaja en su sala. Uno nuevo (o una sala llena) va al anexo, en el escaparate
export const SALA_DE = { agenda: "busqueda", territorio: "busqueda", despensa: "despensa", negocio: "negocio", control: "control" };

// Sala de búsqueda: 3 filas de 6 mesas con un pasillo en medio (agenda delante… detrás, territorio en la última)
const COLS_BUSQUEDA = [-14.2, -12, -9.8, -7, -4.8, -2.6], FILAS_BUSQUEDA = [-8.6, -5.6, -2.6], EJE_BUSQUEDA = -8.4;
const SILLA = 0.75, DETRAS = 1.55;

function mesa(id, sala, x, z, salida) {
  const silla = [x, z - SILLA];
  return { id, sala, mesa: [x, z], silla, pos: silla, giro: 0, salida: [silla, ...salida, SALAS[sala].puerta] };
}

// El hueco n de cada sala (null si está llena). Cada uno: [x, z de la mesa, camino de la silla a la puerta]
const HUECOS = {
  busqueda: (n) => {
    if (n >= 18) return null;
    const x = COLS_BUSQUEDA[n % 6], z = FILAS_BUSQUEDA[Math.floor(n / 6)];
    return [x, z, [[x, z - DETRAS], [EJE_BUSQUEDA, z - DETRAS]]];
  },
  despensa: (n) => (n < 3 ? [[-4.6, -3, -1.4][n], 4.6, [[[-4.6, -3, -1.4][n], 2.6], [-3, 2.6]]] : null),
  negocio: (n) => (n < 2 ? [[1.4, 3.6][n], 4.6, [[[1.4, 3.6][n], 2.6], [2.5, 2.6]]] : null),
  // Control de fuentes: dos mesas al fondo; se sale rodeando el mostrador
  control: (n) => {
    if (n >= 2) return null;
    const x = [0.9, 4.1][n], fuera = [-0.4, 5.4][n];
    return [x, -9, [[x, -10.4], [fuera, -10.4], [fuera, -3.2], [2.5, -3.2]]];
  },
  // Anexo (en el escaparate): para departamentos nuevos o salas llenas
  anexo: (n) => {
    if (n < 3) { const x = [7.2, 9.6, 11.8][n]; return [x, 3.4, [[x, 2.0], [7.5, 2.0]]]; }
    if (n < 5) { const x = [7.2, 9.2][n - 3]; return [x, 10.2, [[10.4, 10.2 - SILLA], [10.4, 2.6], [7.5, 2.6]]]; }
    return null;
  },
};

export function planta(departamentos = []) {
  const sitios = {};
  const usados = {};
  const coger = (sala) => {
    const n = usados[sala] || 0;
    const h = HUECOS[sala]?.(n);
    if (!h) return null;
    usados[sala] = n + 1;
    return h;
  };
  for (const d of departamentos) {
    for (const e of d.empleados) {
      let sala = SALA_DE[d.id] || "anexo";
      let h = coger(sala);
      if (!h && sala !== "anexo") { sala = "anexo"; h = coger(sala); }
      if (!h) continue; // no cabe: sale en la lista y en el chat, pero sin mesa en el 3D
      const [x, z, camino] = h;
      sitios[e.id] = mesa(e.id, sala === "anexo" ? "escaparate" : sala, x, z, camino);
    }
  }
  sitios.jefe = mesa("jefe", "despacho", 13.5, -6.2, [[12.2, -6.95], [12.2, -2.2], [13.5, -2.2]]);
  return sitios;
}

// ---------- Sala de reuniones (en el escaparate): mesa redonda con 8 sillas ----------
export const MESA_REUNION = [12.6, 8.6];
export function sitioReunion(i = 0) {
  const a = (i % 8) * (Math.PI / 4) + Math.PI / 8;
  const [cx, cz] = MESA_REUNION;
  const pos = [cx + Math.sin(a) * 1.55, cz + Math.cos(a) * 1.55];
  const lado = pos[1] > cz ? 10.55 : 6.6;
  return { id: `reunion-${i % 8}`, sala: "escaparate", pos, giro: Math.atan2(cx - pos[0], cz - pos[1]), salida: [pos, [pos[0], lado], [10.4, lado], [10.4, 2.6], [7.5, 2.6], SALAS.escaparate.puerta] };
}

// Ir a hablar con alguien: un paso al lado de donde está (su silla, su sitio en la cafetería o la puerta del jefe)
export function visita(sitio) {
  const pos = [sitio.pos[0] + 0.75, sitio.pos[1] + 0.25];
  return { id: `visita-${sitio.id}`, sala: sitio.sala, pos, giro: -Math.PI / 2, salida: [pos, ...sitio.salida.slice(1)] };
}

// ---------- Cafetería: mesas redondas, barra y sofás ----------
export const CAFE_MESAS = [[-12.2, 5.6], [-9.2, 5.6], [-12.2, 8.8], [-9.2, 8.8]];
export const CAFE_SOFAS = [[-15.15, 6.0], [-15.15, 9.0]];
export const BARRA = { x0: -15.7, x1: -9.9, z: 1.85 };
export const TABURETES = Array.from({ length: 8 }, (_, i) => -15.35 + i * 0.72);
const A_CAFE = [-7, 3.6]; // nada más entrar

function sitioCafe(tipo, pos, giro, camino) {
  return { id: `cafe-${tipo}-${pos.join("/")}`, sala: "cafe", tipo, pos, giro, salida: [pos, ...camino, A_CAFE, SALAS.cafe.puerta] };
}

// Primero las sillas de las mesas, luego la barra y al final los sofás (los sofás, para dormir)
export const CAFE_SITIOS = (() => {
  const mesas = CAFE_MESAS.flatMap(([tx, tz], i) => {
    const calle = i < 2 ? [] : [[-7, 7.3]];
    const zc = i < 2 ? 3.6 : 7.3;
    return [
      sitioCafe("mesa", [tx, tz - 0.8], 0, [[tx, zc], ...calle]),
      sitioCafe("mesa", [tx - 0.85, tz], Math.PI / 2, [[tx - 0.85, zc], ...calle]),
      sitioCafe("mesa", [tx + 0.85, tz], -Math.PI / 2, [[tx + 0.85, zc], ...calle]),
    ];
  });
  const barra = TABURETES.map((x) => {
    return sitioCafe("barra", [x, 2.6], Math.PI, [[x, 3.6]]);
  });
  const sofas = CAFE_SOFAS.flatMap(([sx, sz]) => [-0.7, 0, 0.7].map((dz) => sitioCafe("sofa", [sx + 0.1, sz + dz], Math.PI / 2, [[-14.2, sz + dz], [-14.2, 3.6]])));
  return [...mesas, ...barra, ...sofas];
})();

// ---------- Control de fuentes, puerta del jefe y destinos de las carpetas ----------
export const MOSTRADOR = [2.5, -5.6];
export function entrega(i = 0) {
  const x = MOSTRADOR[0] + ((i % 3) - 1) * 0.8;
  return { id: `entrega-${i % 3}`, sala: "control", pos: [x, -4.4], giro: Math.PI, salida: [[x, -4.4], [x, -2], SALAS.control.puerta] };
}
// Quien ha fallado espera en el pasillo, delante de la puerta del despacho
export function puertaJefe(i = 0) {
  const pos = [12.6 - (i % 5) * 0.75, 0.45 + Math.floor(i / 5) * 0.6];
  const [px, pz] = SALAS.despacho.puerta;
  return { id: `puerta-${i}`, sala: "pasillo", pos, giro: Math.atan2(px - pos[0], pz - pos[1]), salida: [pos] };
}
// Dónde caen las carpetas que salen del mostrador (x, altura, z)
export const DESTINOS = {
  archivo: [8.5, 0.95, -3.1],
  papelera: [0, 0.75, -2.2],
  buzon: [15.3, 1.1, -4.2],
  mostrador: [MOSTRADOR[0], 1.05, MOSTRADOR[1]],
};

// ---------- Caminar ----------
const enPasillo = (s) => (s.sala === "pasillo" ? s.pos : [s.salida.at(-1)[0], PASILLO_Z]);

export function ruta(a, b) {
  const puntos = [...a.salida];
  if (a.sala !== b.sala) puntos.push(enPasillo(a), enPasillo(b));
  puntos.push(...[...b.salida].reverse());
  return puntos.filter((p, i) => i === 0 || Math.hypot(p[0] - puntos[i - 1][0], p[1] - puntos[i - 1][1]) > 0.01);
}

export const largo = (puntos) => puntos.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - puntos[i][0], p[1] - puntos[i][1]), 0);

// Punto a una distancia d a lo largo de la ruta, y hacia dónde mira
export function puntoEn(puntos, d) {
  let resto = Math.max(0, d);
  for (let i = 1; i < puntos.length; i++) {
    const [x0, z0] = puntos[i - 1], [x1, z1] = puntos[i];
    const tramo = Math.hypot(x1 - x0, z1 - z0);
    if (resto <= tramo || i === puntos.length - 1) {
      const t = tramo ? Math.min(1, resto / tramo) : 1;
      return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, giro: Math.atan2(x1 - x0, z1 - z0) };
    }
    resto -= tramo;
  }
  const [x, z] = puntos.at(-1);
  return { x, z, giro: 0 };
}

// ---------- Dónde se pone cada uno ahora ----------
// donde = { id: "mesa" | "cafe" | "sofa" | "puerta" } → { id: { sitio, modo } }
// modo: "teclea" (en su mesa), "sentado" (cafetería), "duerme" (sofá), "espera" (puerta del jefe)
export function colocar(donde = {}, sitios = {}) {
  const libres = [...CAFE_SITIOS];
  const coger = (tipos) => {
    const i = libres.findIndex((s) => tipos.includes(s.tipo));
    return i < 0 ? null : libres.splice(i, 1)[0];
  };
  const r = {};
  let enPuerta = 0;
  // Primero los del sofá, para que no les quiten el sitio
  const orden = Object.entries(donde).sort(([, a], [, b]) => Number(b === "sofa") - Number(a === "sofa"));
  for (const [id, d] of orden) {
    if (d === "mesa" && sitios[id]) r[id] = { sitio: sitios[id], modo: "teclea" };
    else if (d === "puerta") r[id] = { sitio: puertaJefe(enPuerta++), modo: "espera" };
    else if (d === "sofa") r[id] = { sitio: coger(["sofa"]) || coger(["mesa", "barra"]), modo: "duerme" };
    else r[id] = { sitio: coger(["mesa", "barra"]) || coger(["sofa"]), modo: "sentado" };
    if (!r[id].sitio) r[id] = { sitio: sitios[id], modo: "teclea" };
  }
  return r;
}
