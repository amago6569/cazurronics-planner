// Piezas que comparten varias escenas 3D de la Liga: monigotes articulados, caballos, hierba y ruido que casa por los
// bordes. Solo dibujo: nada de esto decide puntos.
import { textura, THREE } from "./base-3d.js";

// Ruido suave que se repite sin costura cada «w» píxeles
export function ruidoMosaico(semilla, celda, w) {
  const n = w / celda, v = new Float32Array(n * n);
  let s = semilla >>> 0;
  for (let i = 0; i < v.length; i++) { s = (s * 1103515245 + 12345) >>> 0; v[i] = (s >>> 8) / 16777216; }
  return (x, y) => {
    const gx = x / celda, gy = y / celda, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = v[(iy % n) * n + (ix % n)], b = v[(iy % n) * n + ((ix + 1) % n)], c = v[((iy + 1) % n) * n + (ix % n)], d = v[((iy + 1) % n) * n + ((ix + 1) % n)];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// Suelo con grano (hierba, tierra, arena): colores = [oscuro, claro] en [r, g, b]; briznas = rayitas más claras
export function texturaSuelo({ oscuro, claro, semilla = 3, briznas = 0, color = "rgba(190,220,120,.35)", tam = 256 }) {
  return textura(tam, tam, (g, w, h) => {
    const r1 = ruidoMosaico(semilla, 8, w), r2 = ruidoMosaico(semilla + 5, 64, w), r3 = ruidoMosaico(semilla + 9, 4, w);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.5 * r1(x, y) + 0.3 * r2(x, y) + 0.2 * r3(x, y), i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) im.data[i + c] = oscuro[c] + (claro[c] - oscuro[c]) * k;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    let s = semilla * 7919;
    const az = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    g.strokeStyle = color; g.lineWidth = 1;
    for (let i = 0; i < briznas; i++) { const x = az() * w, y = az() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (az() - 0.5) * 3, y - 3 - az() * 4); g.stroke(); }
  }, { repetir: true });
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });

// Un hueso: cápsula que cuelga de su articulación (el grupo gira en el hombro, la cadera…)
function hueso(padre, largo, radio, material, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g);
  const geo = new THREE.CapsuleGeometry(radio, Math.max(0.001, largo - radio * 2), 4, 10); geo.translate(0, -largo / 2, 0);
  const m = new THREE.Mesh(geo, material); m.castShadow = true; g.add(m);
  return g;
}

// Una persona de 1 unidad de alto (se escala fuera), de pie en el origen mirando a +z.
// colores = { camisa, pantalon, piel, pelo, chaleco, faja, calzado, mangas }
// Devuelve las articulaciones para moverla: cadera, torso, cabeza, brazos[2] = { hombro, codo, mano }, piernas[2] = { cadera, rodilla }
export function crearPersona(c = {}) {
  const M = {
    camisa: mat(c.camisa ?? 0xefe9de), pantalon: mat(c.pantalon ?? 0x2a2420), piel: mat(c.piel ?? 0xd9a87e, { roughness: 0.6 }),
    pelo: mat(c.pelo ?? 0x2a1c12), calzado: mat(c.calzado ?? 0x1c1612), mangas: mat(c.mangas ?? c.camisa ?? 0xefe9de),
  };
  const grupo = new THREE.Group();
  const cadera = new THREE.Group(); cadera.position.y = 0.5; grupo.add(cadera);
  const pon = (geo, material, x, y, z, padre) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o; };
  // pelvis y torso (el torso gira en la cintura)
  pon(new THREE.SphereGeometry(0.075, 12, 8), M.pantalon, 0, 0, 0, cadera).scale.set(1.15, 0.8, 0.85);
  const torso = new THREE.Group(); torso.position.y = 0.03; cadera.add(torso);
  const pecho = pon(new THREE.CapsuleGeometry(0.082, 0.15, 4, 12), M.camisa, 0, 0.16, 0, torso); pecho.scale.set(1.12, 1, 0.72);
  if (c.chaleco != null) { const ch = pon(new THREE.CapsuleGeometry(0.086, 0.11, 4, 12), mat(c.chaleco), 0, 0.17, -0.004, torso); ch.scale.set(1.13, 1, 0.74); }
  if (c.faja != null) pon(new THREE.CylinderGeometry(0.088, 0.09, 0.06, 16), mat(c.faja), 0, 0.03, 0, torso).scale.z = 0.76;
  // cuello y cabeza
  pon(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 10), M.piel, 0, 0.33, 0, torso);
  const cabeza = new THREE.Group(); cabeza.position.y = 0.42; torso.add(cabeza);
  pon(new THREE.SphereGeometry(0.068, 18, 14), M.piel, 0, 0, 0, cabeza).scale.set(0.92, 1.05, 1);
  const cas = pon(new THREE.SphereGeometry(0.071, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.pelo, 0, 0.008, -0.008, cabeza); cas.scale.set(0.95, 1.02, 1.02);
  pon(new THREE.SphereGeometry(0.012, 8, 6), M.piel, 0, -0.008, 0.068, cabeza); // nariz
  // brazos
  const brazos = [-1, 1].map((l) => {
    const hombro = hueso(torso, 0.17, 0.03, M.mangas, l * 0.115, 0.27, 0);
    const codo = hueso(hombro, 0.16, 0.026, c.remangado ? M.piel : M.mangas, 0, -0.17, 0);
    const mano = pon(new THREE.SphereGeometry(0.03, 10, 8), M.piel, 0, -0.17, 0, codo);
    hombro.rotation.z = l * 0.12;
    return { l, hombro, codo, mano };
  });
  // piernas
  const piernas = [-1, 1].map((l) => {
    const cad = hueso(cadera, 0.25, 0.043, M.pantalon, l * 0.055, -0.02, 0);
    const rodilla = hueso(cad, 0.23, 0.035, c.medias != null ? mat(c.medias) : M.pantalon, 0, -0.25, 0);
    const pie = pon(new THREE.BoxGeometry(0.055, 0.035, 0.12), M.calzado, 0, -0.225, 0.03, rodilla);
    return { l, cadera: cad, rodilla, pie };
  });
  return { grupo, cadera, torso, cabeza, brazos, piernas, materiales: M, pon };
}

// Un caballo de 1 unidad de largo (se escala fuera), en el origen mirando a +z, con el lomo a 0,62 de alto.
// colores = { capa, crin, casco, gualdrapa (la tela de justa, opcional), ribete }
export function crearCaballo(c = {}) {
  const capa = mat(c.capa ?? 0x5a3a22, { roughness: 0.65 }), crin = mat(c.crin ?? 0x1c1410), casco = mat(c.casco ?? 0x1a1512);
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group(); cuerpo.position.y = 0.6; grupo.add(cuerpo);
  const pon = (geo, material, x, y, z, padre = cuerpo) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o; };
  const tronco = pon(new THREE.CapsuleGeometry(0.125, 0.4, 6, 14), capa, 0, 0, 0); tronco.rotation.x = Math.PI / 2; tronco.scale.set(1, 1, 1.12);
  pon(new THREE.SphereGeometry(0.135, 14, 10), capa, 0, 0.01, -0.2).scale.set(1, 1.05, 1.1); // grupa
  pon(new THREE.SphereGeometry(0.13, 14, 10), capa, 0, 0, 0.2).scale.set(0.95, 1.05, 1); // pecho
  // cuello y cabeza
  const cuello = new THREE.Group(); cuello.position.set(0, 0.06, 0.26); cuello.rotation.x = 0.75; cuerpo.add(cuello);
  const cu = pon(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 12), capa, 0, 0.14, 0, cuello); cu.scale.z = 1.25;
  const cabeza = new THREE.Group(); cabeza.position.set(0, 0.3, 0); cabeza.rotation.x = 0.95; cuello.add(cabeza);
  pon(new THREE.CapsuleGeometry(0.052, 0.13, 4, 10), capa, 0, 0.07, 0.01, cabeza).scale.set(0.9, 1, 1.1);
  pon(new THREE.SphereGeometry(0.042, 10, 8), mat(0x2a1f18), 0, 0.165, 0.012, cabeza).scale.set(0.95, 0.8, 1); // hocico
  for (const l of [-1, 1]) {
    const o = pon(new THREE.ConeGeometry(0.018, 0.05, 6), capa, l * 0.035, -0.02, -0.045, cabeza); o.rotation.x = -0.9;
    pon(new THREE.SphereGeometry(0.009, 6, 5), mat(0x0c0a08, { roughness: 0.2 }), l * 0.045, 0.045, 0.02, cabeza);
  }
  // crin y cola
  const cr = pon(new THREE.BoxGeometry(0.022, 0.3, 0.07), crin, 0, 0.15, -0.085, cuello); cr.rotation.x = 0.06;
  pon(new THREE.BoxGeometry(0.02, 0.07, 0.05), crin, 0, 0.0, -0.05, cabeza);
  const cola = new THREE.Group(); cola.position.set(0, 0.08, -0.33); cuerpo.add(cola);
  const geoCola = new THREE.ConeGeometry(0.04, 0.34, 8); geoCola.translate(0, -0.17, 0);
  pon(geoCola, crin, 0, 0, 0, cola); cola.rotation.x = -0.5;
  // patas: muslo + caña + casco
  const patas = [];
  for (const [x, z, del] of [[-0.075, 0.2, true], [0.075, 0.2, true], [-0.08, -0.22, false], [0.08, -0.22, false]]) {
    const arriba = hueso(cuerpo, 0.27, del ? 0.04 : 0.05, capa, x, -0.06, z);
    const abajo = hueso(arriba, 0.27, 0.026, c.calzas != null ? mat(c.calzas) : capa, 0, -0.27, 0);
    const k = pon(new THREE.CylinderGeometry(0.03, 0.036, 0.045, 8), casco, 0, -0.265, 0, abajo);
    patas.push({ arriba, abajo, casco: k, del });
  }
  // la gualdrapa: la tela de torneo que cubre al caballo, con su ribete
  if (c.gualdrapa != null) {
    const tela = mat(c.gualdrapa, { roughness: 0.85, side: THREE.DoubleSide });
    const g1 = pon(new THREE.CylinderGeometry(0.15, 0.2, 0.36, 16, 1, true), tela, 0, -0.07, -0.05); g1.scale.set(1, 1, 2.35);
    const rib = pon(new THREE.TorusGeometry(0.2, 0.012, 6, 20), mat(c.ribete ?? 0xd9a940), 0, -0.25, -0.05); rib.rotation.x = Math.PI / 2; rib.scale.set(1, 2.35, 1);
    pon(new THREE.CylinderGeometry(0.075, 0.115, 0.22, 12, 1, true), tela, 0, 0.13, 0.0, cuello).scale.z = 1.3;
  }
  // silla
  pon(new THREE.BoxGeometry(0.2, 0.05, 0.24), mat(c.silla ?? 0x4a2c16), 0, 0.14, -0.02).castShadow = false;
  return { grupo, cuerpo, cuello, cabeza, cola, patas };
}

// Galope: fase en vueltas (una vuelta = un tranco), brio de 0 (parado) a 1
export function galopar(cab, fase, brio = 1) {
  const s = (x) => Math.sin(x * Math.PI * 2);
  cab.cuerpo.position.y = 0.6 + 0.035 * brio * s(fase + 0.1);
  cab.cuerpo.rotation.x = 0.07 * brio * s(fase + 0.35);
  cab.cuello.rotation.x = 0.75 + 0.14 * brio * s(fase + 0.55);
  cab.cola.rotation.x = -0.5 - 0.7 * brio + 0.2 * brio * s(fase + 0.2);
  cab.patas.forEach((p, i) => {
    const f = fase + (p.del ? 0 : 0.42) + (i % 2 ? 0.1 : 0);
    const a = s(f);
    p.arriba.rotation.x = (p.del ? -0.15 : 0.1) * brio + 0.85 * brio * a;
    p.abajo.rotation.x = brio * (p.del ? 0.5 + 0.75 * Math.max(0, s(f + 0.3)) : -0.15 + 0.85 * Math.max(0, -s(f + 0.15))) * (p.del ? 1 : -1) * -1;
  });
}

// Un chopo (los de las riberas de León): tronco fino y copa alta
export function crearChopo(alto = 2.4, verde = 0x5f8f3a) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, alto * 0.4, 6), mat(0x6a5a48)); t.position.y = alto * 0.2; g.add(t);
  const copa = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(verde, { roughness: 0.9 })); copa.scale.set(0.42, alto * 0.72, 0.42); copa.position.y = alto * 0.62; copa.castShadow = true; g.add(copa);
  return g;
}
