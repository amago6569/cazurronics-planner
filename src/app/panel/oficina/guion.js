// ============ LA PLANTA Y EL GUION DE LA OFICINA 3D ============
// Funciones puras (sin React ni three.js) para poder probarlas:
//  · planta(departamentos): dónde está la mesa de cada empleado, en metros (x a la derecha, z hacia la cámara).
//  · ruta(desde, hasta): por qué pasillos camina alguien para ir de una mesa a otra sin atravesar muebles.
//  · episodios(charla): agrupa lo que se han dicho en escenas (uno va a la mesa del otro, habla y el otro contesta).

// Rejilla común: todas las mesas están en filas con un pasillo detrás de las sillas, y tres pasillos de arriba abajo.
export const PASO_X = 2.2;
export const FILAS_Z = [-7, -3.8, -0.6, 2.6];
export const PASILLO_FILA = 1.6; // el pasillo de cada fila va 1,6 m por detrás de la mesa
export const PASILLOS_X = [-12.2, -1.7, 6.6];
export const AL_LADO = 1.1; // quien visita una mesa se queda de pie a su lado, en el hueco entre mesas

// Zonas de la planta abierta: columna x de la primera mesa, columnas y fila de inicio
export const ZONAS = {
  agenda: { x: -10.5, cols: 4, fila: 0, color: "#fecdd3", nombre: "Agenda" },
  territorio: { x: 0.5, cols: 3, fila: 0, color: "#bae6fd", nombre: "Territorio" },
  despensa: { x: 0.5, cols: 3, fila: 2, color: "#fde68a", nombre: "Despensa" },
  negocio: { x: -10.5, cols: 2, fila: 3, color: "#ddd6fe", nombre: "Negocio" },
};
// El despacho del jefe (cristal), con la puerta en el pasillo de la fila 3
export const DESPACHO = { x0: 7.8, x1: 12.2, z0: -2.5, z1: 7.5, mesa: [10, 3.4], visita: [8.9, 3.4], puertaZ: FILAS_Z[3] - PASILLO_FILA };
export const CAFE = { x0: -6.5, x1: -2.5, z0: 1.8, z1: 7 };

export function planta(departamentos = []) {
  const sitios = {};
  for (const d of departamentos) {
    const z = ZONAS[d.id];
    if (!z) continue;
    d.empleados.forEach((e, i) => {
      const x = z.x + (i % z.cols) * PASO_X;
      const mz = FILAS_Z[z.fila + Math.floor(i / z.cols)] ?? FILAS_Z.at(-1);
      sitios[e.id] = { id: e.id, dep: d.id, mesa: [x, mz], silla: [x, mz - 0.75], visita: [x + AL_LADO, mz], pasillo: mz - PASILLO_FILA };
    });
  }
  sitios.jefe = { id: "jefe", dep: "jefe", mesa: DESPACHO.mesa, silla: [DESPACHO.mesa[0], DESPACHO.mesa[1] - 0.75], visita: DESPACHO.visita, pasillo: DESPACHO.puertaZ };
  return sitios;
}

// De la silla de "a" al sitio de visita de "b": silla → pasillo de su fila → pasillo vertical → pasillo de la fila
// de "b" → al lado de su mesa. Devuelve los puntos [x, z] por los que pasa (sin repetidos).
export function ruta(a, b) {
  const [xa] = a.silla, [xb, zb] = b.visita;
  const puntos = [a.silla, [xa, a.pasillo]];
  if (Math.abs(a.pasillo - b.pasillo) > 0.01) {
    const v = PASILLOS_X.reduce((m, x) => (Math.abs(xa - x) + Math.abs(xb - x) < Math.abs(xa - m) + Math.abs(xb - m) ? x : m));
    puntos.push([v, a.pasillo], [v, b.pasillo]);
  }
  puntos.push([xb, b.pasillo], [xb, zb]);
  return puntos.filter((p, i) => i === 0 || Math.hypot(p[0] - puntos[i - 1][0], p[1] - puntos[i - 1][1]) > 0.01);
}

export const largo = (puntos) => puntos.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - puntos[i][0], p[1] - puntos[i][1]), 0);

// Punto a una distancia d a lo largo de la ruta, y hacia dónde mira (ángulo en el plano)
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

// Escenas: una frase y, si la siguiente es la respuesta del otro, juntas. Quien habla primero va a la mesa del
// otro (si los dos están en la oficina). Lo que va o viene de Alejandro ("tu") es un bocadillo con el móvil.
export function episodios(charla = [], sitios = {}) {
  const lista = [];
  for (let i = 0; i < charla.length; i++) {
    const l = charla[i];
    const sig = charla[i + 1];
    const respuesta = sig && sig.de === l.a && sig.a === l.de ? sig : null;
    const anda = l.de !== l.a && sitios[l.de] && sitios[l.a];
    lista.push({ id: `${l.cuando}-${i}`, quien: l.de, a: l.a, texto: l.texto, tipo: l.tipo, cuando: l.cuando, anda: !!anda, respuesta });
    if (respuesta) i++;
  }
  return lista;
}
