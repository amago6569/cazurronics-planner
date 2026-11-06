// ============ EL CUERPO DE CADA MONIGOTE ============
// Personas hechas con formas de three.js, sin descargar modelos (0 € y nada de licencias). Cada parte que se mueve es
// una sola malla con el color en sus vértices: 27 personas se pintan con unas 270 llamadas y todas comparten material.
// Medidas en metros: mide 1,72 m con la pelvis a 0,90 m. Cada pieza va relativa a su articulación.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const MATERIAL_PERSONA = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0 });

function pintar(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const datos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { datos[i * 3] = c.r; datos[i * 3 + 1] = c.g; datos[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(datos, 3));
  return geo;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
function colocar(geo, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) {
  M.compose(new THREE.Vector3(...p), Q.setFromEuler(E.set(...r)), new THREE.Vector3(...s));
  geo.applyMatrix4(M);
  return geo;
}

const pieza = (geo, color, opc) => pintar(colocar(geo, opc), color);
const capsula = (radio, largo, color, opc) => pieza(new THREE.CapsuleGeometry(radio, largo, 4, 12), color, opc);
const bola = (radio, color, opc, w = 16, h = 12) => pieza(new THREE.SphereGeometry(radio, w, h), color, opc);
const caja = (x, y, z, color, opc) => pieza(new THREE.BoxGeometry(x, y, z), color, opc);
const cilindro = (a, b, h, color, opc, seg = 12) => pieza(new THREE.CylinderGeometry(a, b, h, seg), color, opc);

// Une piezas en una malla. Sin uv: el color va en los vértices. Todas pasan a sin índice para poder mezclarlas.
function unir(piezas) {
  const limpias = piezas.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    return n;
  });
  const u = mergeGeometries(limpias, false);
  limpias.forEach((g) => g.dispose());
  return u;
}

// El tronco es un óvalo con su forma: más estrecho en la cintura y más ancho en el pecho
function tronco(color, ancho, alto) {
  const perfil = [[0.0, 0], [0.128, 0.002], [0.135, 0.05], [0.13, 0.13], [0.145, 0.24], [0.158, 0.33], [0.152, 0.39], [0.118, 0.44], [0.058, 0.47], [0, 0.475]]
    .map(([x, y]) => new THREE.Vector2(x * ancho, y * alto));
  return pintar(colocar(new THREE.LatheGeometry(perfil, 18), { s: [1, 1, 0.68] }), color);
}

const PEINADOS = {
  corto: (c) => [
    bola(0.104, c, { p: [0, 0.03, -0.012], s: [1, 0.92, 1.03] }),
  ],
  raya: (c) => [
    bola(0.106, c, { p: [0, 0.035, -0.014], s: [1, 0.88, 1.04] }),
    bola(0.05, c, { p: [0.055, 0.075, 0.05], s: [1.1, 0.5, 0.8] }),
  ],
  melena: (c) => [
    bola(0.108, c, { p: [0, 0.03, -0.014], s: [1.03, 0.94, 1.06] }),
    capsula(0.082, 0.14, c, { p: [0, -0.09, -0.052], s: [1.18, 1, 0.62] }),
  ],
  coleta: (c) => [
    bola(0.104, c, { p: [0, 0.033, -0.014], s: [1, 0.9, 1.04] }),
    bola(0.032, c, { p: [0, 0.03, -0.112] }),
    capsula(0.028, 0.13, c, { p: [0, -0.07, -0.128], r: [0.22, 0, 0] }),
  ],
  mono: (c) => [
    bola(0.104, c, { p: [0, 0.03, -0.012], s: [1, 0.9, 1.03] }),
    bola(0.046, c, { p: [0, 0.122, -0.04] }),
  ],
  rizos: (c) => {
    const l = [bola(0.1, c, { p: [0, 0.03, -0.01], s: [1, 0.9, 1] })];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, y = 0.02 + (i % 4) * 0.03, r = 0.098 - (i % 4) * 0.014;
      l.push(bola(0.036, c, { p: [Math.cos(a) * r, y + 0.03, Math.sin(a) * r - 0.012] }, 8, 6));
    }
    return l;
  },
  entradas: (c) => [
    bola(0.104, c, { p: [0, 0.012, -0.03], s: [1, 0.74, 0.86] }),
  ],
};
export const NOMBRES_PEINADO = Object.keys(PEINADOS);

// p = { piel, pelo, camisa, pantalon, zapatos, peinado, gafas, barba, manga, jefe, ancho }
export function crearCuerpo(p) {
  const { piel, pelo, camisa, pantalon, zapatos = "#1b1a20", peinado = "corto", gafas = false, barba = false, manga = "larga", jefe = false, ancho = 1 } = p;
  const camiseta = camisa;

  // Pelvis: cuelga de ahí todo lo demás
  const pelvis = unir([
    bola(0.135, pantalon, { p: [0, -0.02, 0], s: [ancho, 0.72, 0.72] }),
    cilindro(0.128 * ancho, 0.13 * ancho, 0.035, jefe ? "#101014" : "#3b2a20", { p: [0, 0.05, 0], s: [1, 1, 0.72] }),
  ]);

  // Tronco: con cuello de camisa. El jefe, de traje con corbata
  const torsoPiezas = [tronco(camiseta, ancho, 1)];
  if (jefe) {
    torsoPiezas.push(
      caja(0.1, 0.17, 0.012, "#f0ece4", { p: [0, 0.35, 0.102], r: [-0.14, 0, 0] }),
      caja(0.032, 0.18, 0.012, "#b4202f", { p: [0, 0.33, 0.112], r: [-0.14, 0, 0] }),
      caja(0.05, 0.2, 0.012, "#16181f", { p: [-0.062, 0.32, 0.108], r: [-0.14, 0, 0.3] }),
      caja(0.05, 0.2, 0.012, "#16181f", { p: [0.062, 0.32, 0.108], r: [-0.14, 0, -0.3] }),
    );
  } else {
    torsoPiezas.push(
      pieza(new THREE.TorusGeometry(0.058, 0.014, 8, 16), new THREE.Color(camiseta).multiplyScalar(0.72).getStyle(), { p: [0, 0.462, 0], r: [Math.PI / 2, 0, 0] }),
    );
  }
  const torso = unir(torsoPiezas);

  // Cabeza: el centro está en el cuello para que gire desde ahí
  const cara = [0, 0.125, 0];
  const cabezaPiezas = [
    cilindro(0.046, 0.05, 0.08, piel, { p: [0, 0.02, -0.004] }),
    bola(0.1, piel, { p: cara, s: [0.93, 1.1, 1] }, 20, 16),
    bola(0.06, piel, { p: [0, 0.075, 0.028], s: [1.1, 0.8, 1] }),
    pieza(new THREE.ConeGeometry(0.016, 0.042, 8), new THREE.Color(piel).multiplyScalar(0.94).getStyle(), { p: [0, 0.117, 0.104], r: [-1.2, 0, 0] }),
    bola(0.02, piel, { p: [-0.095, 0.122, -0.004], s: [0.5, 1, 0.75] }, 8, 6),
    bola(0.02, piel, { p: [0.095, 0.122, -0.004], s: [0.5, 1, 0.75] }, 8, 6),
    // Boca y cejas
    caja(0.036, 0.0055, 0.006, "#8a4a42", { p: [0, 0.073, 0.093] }),
    caja(0.03, 0.007, 0.008, pelo, { p: [-0.036, 0.151, 0.09], r: [0, 0, 0.1] }),
    caja(0.03, 0.007, 0.008, pelo, { p: [0.036, 0.151, 0.09], r: [0, 0, -0.1] }),
  ];
  for (const g of (PEINADOS[peinado] || PEINADOS.corto)(pelo)) cabezaPiezas.push(colocar(g, { p: cara }));
  if (barba) {
    cabezaPiezas.push(bola(0.07, pelo, { p: [0, 0.075, 0.03], s: [1.12, 0.7, 1] }, 12, 8));
    cabezaPiezas.push(caja(0.04, 0.006, 0.006, "#8a4a42", { p: [0, 0.078, 0.1] }));
  }
  if (gafas) {
    const m = "#17151c";
    cabezaPiezas.push(
      pieza(new THREE.TorusGeometry(0.023, 0.0035, 6, 14), m, { p: [-0.035, 0.127, 0.094] }),
      pieza(new THREE.TorusGeometry(0.023, 0.0035, 6, 14), m, { p: [0.035, 0.127, 0.094] }),
      caja(0.024, 0.004, 0.004, m, { p: [0, 0.13, 0.096] }),
    );
  }
  const cabeza = unir(cabezaPiezas);

  // Ojos aparte para que parpadeen
  const ojos = unir([
    bola(0.013, "#f4f1ea", { p: [-0.035, 0, 0], s: [1, 0.72, 0.5] }, 10, 8),
    bola(0.013, "#f4f1ea", { p: [0.035, 0, 0], s: [1, 0.72, 0.5] }, 10, 8),
    bola(0.0078, "#1a1412", { p: [-0.035, 0, 0.006], s: [1, 1, 0.6] }, 8, 6),
    bola(0.0078, "#1a1412", { p: [0.035, 0, 0.006], s: [1, 1, 0.6] }, 8, 6),
  ]);

  // Brazo: hombro → codo y codo → mano. Con manga corta se ve el brazo
  const conManga = manga === "larga" || jefe;
  const tela = camiseta;
  const brazoSup = unir([
    bola(0.054, tela, { s: [1, 1, 1] }, 12, 8),
    conManga
      ? capsula(0.045, 0.2, tela, { p: [0, -0.13, 0] })
      : capsula(0.04, 0.2, piel, { p: [0, -0.13, 0] }),
    ...(conManga ? [] : [capsula(0.047, 0.08, tela, { p: [0, -0.06, 0] })]),
  ]);
  const antebrazo = unir([
    conManga ? capsula(0.038, 0.18, tela, { p: [0, -0.11, 0] }) : capsula(0.034, 0.18, piel, { p: [0, -0.11, 0] }),
    bola(0.04, piel, { p: [0, -0.26, 0.005], s: [0.8, 1.15, 0.5] }, 10, 8),
  ]);

  // Pierna: cadera → rodilla y rodilla → pie. La zapatilla apunta hacia delante
  const muslo = unir([capsula(0.075, 0.28, pantalon, { p: [0, -0.2, 0], s: [1, 1, 1.05] })]);
  const espinilla = unir([
    capsula(0.056, 0.3, pantalon, { p: [0, -0.2, 0] }),
    caja(0.09, 0.05, 0.22, zapatos, { p: [0, -0.4, 0.04] }),
    bola(0.052, zapatos, { p: [0, -0.385, 0.13], s: [0.88, 0.62, 1.05] }, 10, 8),
    caja(0.094, 0.018, 0.25, "#e9e4d8", { p: [0, -0.418, 0.045] }),
  ]);

  return { pelvis, torso, cabeza, ojos, brazoSup, antebrazo, muslo, espinilla };
}

export function liberarCuerpo(c) {
  Object.values(c).forEach((g) => g.dispose());
}

// Se reparte el aspecto con el número de cada uno: siempre es el mismo y no hay dos iguales seguidos
export function aspectoDe(i, { pieles, pelos }) {
  const pantalones = ["#2c3650", "#3a3a42", "#4a3a2c", "#20242e", "#51483a", "#2a3d46"];
  return {
    piel: pieles[(i * 7) % pieles.length],
    pelo: pelos[(i * 5) % pelos.length],
    pantalon: pantalones[(i * 3) % pantalones.length],
    zapatos: ["#1b1a20", "#efeae0", "#6b4a2e", "#2d3340"][(i * 5) % 4],
    peinado: NOMBRES_PEINADO[(i * 3 + (i >> 2)) % (NOMBRES_PEINADO.length - 1)],
    gafas: i % 5 === 2,
    barba: i % 7 === 3,
    manga: i % 3 === 1 ? "corta" : "larga",
    ancho: 0.93 + ((i * 11) % 7) * 0.025,
    alto: 0.96 + ((i * 13) % 6) * 0.015,
  };
}
