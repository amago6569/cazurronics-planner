// Trashumancia, en 3D. Aquí solo se dibuja: por dónde va cada oveja sale de motor-rebano.js y de la «vista» de
// juego-rebano.js, la misma que usa el dibujo plano.
//
// Un prado de puerto en la montaña de Riaño, visto desde arriba y desde atrás. Al fondo, el corral de piedra seca con
// su portilla de madera, el chozo del pastor con el techo de escobas y el pastor apoyado en la cayada. Ovejas merinas
// (y alguna negra) que pastan, trotan y se apiñan, y un mastín leonés con su carlanca. Detrás, la foto de Riaño.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { D, PRADO_HASTA } from "./juego-rebano.js";
import { PARED, PORTILLA, CORRAL, OVEJA, LADO, CERCA } from "./motor-rebano.js";

// Ruido suave que se repite sin costuras (para texturas en mosaico). «celda» tiene que dividir a «w».
function ruidoMosaico(semilla, celda, w) {
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

const MAX_OVEJAS = 24; // las del rebaño que se juega y las que ya están guardadas
const ALTO_MURO = 0.15;

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 70,
    cielo: { colores: [[0, "#5d93d6"], [0.42, "#cfe2f2"], [0.5, "#eef4e4"], [0.56, "#6f9a48"], [1, "#35502a"]], luces: [{ x: 0.3, y: 0.24, r: 0.1, color: "rgba(255,246,220,1)" }], intensidad: 0.85 },
  });
  const { escena } = base;
  const sv = suerteVisual(1188);
  const entre = (a, b) => a + (b - a) * sv();

  // ── Luz de mañana de verano en el puerto: sol alto por la izquierda, sombras cortas y limpias ──
  escena.add(new THREE.HemisphereLight(0xcfe3ff, 0x5f7a3a, 0.95));
  const sol = new THREE.DirectionalLight(0xfff1d6, 2.5);
  sol.position.set(-3.2, 6, 2.2);
  sol.target.position.set(0, 0, -1.8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -2.6, right: 2.6, top: 3.2, bottom: -3.2, near: 1, far: 16 });
  sol.shadow.radius = 2.5; sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.012;
  escena.add(sol, sol.target);

  // ── El prado ──
  const hierba = textura(512, 512, (g, w, h) => {
    const r1 = ruidoMosaico(3, 8, w), r2 = ruidoMosaico(8, 128, w), r3 = ruidoMosaico(21, 4, w);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = r2(x, y), b = r1(x, y), c = r3(x, y), i = (y * w + x) * 4;
      const k = 0.78 + 0.2 * b + 0.1 * c;
      im.data[i] = (92 + 46 * a) * k; im.data[i + 1] = (136 + 30 * a) * k; im.data[i + 2] = (52 + 10 * a) * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    // briznas
    const s = suerteVisual(5);
    for (let i = 0; i < 2600; i++) {
      const x = s() * w, y = s() * h, l = 3 + s() * 5;
      g.strokeStyle = s() < 0.5 ? `rgba(168,196,92,${0.2 + s() * 0.3})` : `rgba(48,84,34,${0.2 + s() * 0.3})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (s() - 0.5) * 3, y - l); g.stroke();
    }
  }, { repetir: true });
  hierba.repeat.set(4, 2.4);
  const ANCHO = 11, DELANTE = 2.6;
  const prado = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, PRADO_HASTA + DELANTE), new THREE.MeshStandardMaterial({ map: hierba, bumpMap: hierba, bumpScale: 0.5, roughness: 0.95 }));
  prado.rotation.x = -Math.PI / 2;
  prado.position.set(0, 0, (DELANTE - PRADO_HASTA) / 2);
  prado.receiveShadow = true;
  escena.add(prado);

  // el suelo pisado del corral y el camino que llega a la portilla (tierra, con los bordes difuminados)
  const tierra = (ancho, fondo, x, z, opacidad = 1) => {
    const t = textura(128, 128, (g, w, h) => {
      const r = ruido2d(31, 7, w, h), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
        const dx = Math.abs(x2 / w - 0.5) * 2, dy = Math.abs(y / h - 0.5) * 2, borde = Math.max(dx, dy);
        const k = 0.8 + 0.3 * r(x2, y), i = (y * w + x2) * 4;
        im.data[i] = 146 * k; im.data[i + 1] = 118 * k; im.data[i + 2] = 82 * k;
        im.data[i + 3] = 255 * opacidad * Math.max(0, Math.min(1, (1 - borde) * 5 + (r(x2 * 3, y * 3) - 0.5) * 1.4));
      }
      g.putImageData(im, 0, 0);
    });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1 }));
    o.rotation.x = -Math.PI / 2; o.position.set(x, 0.004, z); o.receiveShadow = true; o.renderOrder = 1;
    escena.add(o);
  };
  tierra(CORRAL.medio * 2 + 0.12, CORRAL.fondo - PARED + 0.14, 0, -(PARED + CORRAL.fondo) / 2);
  tierra(PORTILLA * 2 + 0.3, 0.9, 0, -(PARED - 0.32), 0.7);

  // ── Paredes de piedra seca: muchas piedras distintas en una sola malla ──
  const piedras = [];
  const pared = (x0, z0, x1, z1, alto = ALTO_MURO, grueso = 0.07) => {
    const largo = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(largo / 0.085)), hiladas = Math.round(alto / 0.05);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    for (let h = 0; h < hiladas; h++) for (let i = 0; i < n + (h % 2); i++) {
      const u = (i + (h % 2 ? 0 : 0.5)) / (n + (h % 2 ? 1 : 0.5)) + (h % 2 ? -0.5 / n : 0);
      if (u < 0 || u > 1) continue;
      piedras.push({
        x: x0 + (x1 - x0) * u + entre(-0.006, 0.006), y: (h + 0.5) * (alto / hiladas) + entre(-0.004, 0.004), z: z0 + (z1 - z0) * u + entre(-0.008, 0.008),
        sx: (largo / n) * entre(0.85, 1.12), sy: (alto / hiladas) * entre(0.9, 1.15), sz: grueso * entre(0.8, 1.15),
        ry: -ang + entre(-0.12, 0.12), rz: entre(-0.06, 0.06), tono: entre(0.72, 1.08), musgo: h === hiladas - 1 && sv() < 0.3,
      });
    }
  };
  const C = CORRAL.medio, F = CORRAL.fondo;
  pared(-C, -PARED, -PORTILLA - 0.03, -PARED); pared(PORTILLA + 0.03, -PARED, C, -PARED);
  pared(-C, -PARED, -C, -F); pared(C, -PARED, C, -F); pared(-C, -F, C, -F);
  // la pared que cierra el prado por el fondo, medio caída
  for (let x = -5.4; x < 5.4; x += 0.9) if (sv() < 0.8) pared(x, -PRADO_HASTA + 0.06 + entre(-0.02, 0.02), x + entre(0.6, 0.9), -PRADO_HASTA + 0.06 + entre(-0.02, 0.02), 0.1, 0.08);
  const geoPiedra = new THREE.BoxGeometry(1, 1, 1);
  const granito = textura(64, 64, (g, w, h) => {
    const r = ruido2d(9, 3, w, h), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 150 + 90 * r(x, y), i = (y * w + x) * 4; im.data[i] = k; im.data[i + 1] = k * 0.98; im.data[i + 2] = k * 0.93; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  const mallaPiedras = new THREE.InstancedMesh(geoPiedra, new THREE.MeshStandardMaterial({ map: granito, bumpMap: granito, bumpScale: 1.2, roughness: 0.95 }), piedras.length);
  const pieza = new THREE.Object3D(), tinta = new THREE.Color();
  piedras.forEach((p, i) => {
    pieza.position.set(p.x, p.y, p.z); pieza.rotation.set(0, p.ry, p.rz); pieza.scale.set(p.sx, p.sy, p.sz); pieza.updateMatrix();
    mallaPiedras.setMatrixAt(i, pieza.matrix);
    mallaPiedras.setColorAt(i, p.musgo ? tinta.setRGB(0.62 * p.tono, 0.72 * p.tono, 0.5 * p.tono) : tinta.setRGB(p.tono, p.tono * 0.98, p.tono * 0.95));
  });
  mallaPiedras.castShadow = true; mallaPiedras.receiveShadow = true;
  escena.add(mallaPiedras);

  const madera = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 });
  const maderaVieja = new THREE.MeshStandardMaterial({ color: 0x8a7256, roughness: 0.9 });
  const pon = (geo, mat, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; padre.add(o); return o; };
  // la portilla: dos postes y la cancilla de tablas, abierta hacia dentro
  for (const l of [-1, 1]) pon(new THREE.CylinderGeometry(0.018, 0.022, 0.24, 7), madera, l * (PORTILLA + 0.012), 0.12, -PARED);
  const cancilla = new THREE.Group();
  cancilla.position.set(-PORTILLA - 0.005, 0, -PARED - 0.02);
  cancilla.rotation.y = 1.9; // abierta
  for (const y of [0.05, 0.11, 0.17]) pon(new THREE.BoxGeometry(PORTILLA * 1.9, 0.022, 0.01), maderaVieja, PORTILLA * 0.95, y, 0, cancilla);
  for (const x of [0.02, PORTILLA * 0.95, PORTILLA * 1.88]) pon(new THREE.BoxGeometry(0.02, 0.19, 0.012), maderaVieja, x, 0.105, 0.006, cancilla);
  const cruz = pon(new THREE.BoxGeometry(PORTILLA * 1.95, 0.018, 0.008), maderaVieja, PORTILLA * 0.95, 0.11, 0.008, cancilla); cruz.rotation.z = 0.3;
  escena.add(cancilla);

  // ── El chozo: redondo, de piedra, con el techo de escobas ──
  const chozo = new THREE.Group(); chozo.position.set(1.12, 0, -3.02);
  const matChozo = new THREE.MeshStandardMaterial({ map: granito, bumpMap: granito, bumpScale: 2, roughness: 1, color: 0xb9b2a6 });
  pon(new THREE.CylinderGeometry(0.3, 0.32, 0.26, 18), matChozo, 0, 0.13, 0, chozo);
  const paja = textura(128, 128, (g, w, h) => {
    g.fillStyle = "#6e5a34"; g.fillRect(0, 0, w, h);
    const s = suerteVisual(3);
    for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${150 + s() * 70},${120 + s() * 60},${60 + s() * 40},.7)`; g.beginPath(); const x = s() * w, y = s() * h; g.moveTo(x, y); g.lineTo(x + (s() - 0.5) * 6, y + 14 + s() * 16); g.stroke(); }
  }, { repetir: true });
  paja.repeat.set(5, 2);
  pon(new THREE.ConeGeometry(0.39, 0.46, 20), new THREE.MeshStandardMaterial({ map: paja, bumpMap: paja, bumpScale: 1.5, roughness: 1 }), 0, 0.48, 0, chozo);
  pon(new THREE.BoxGeometry(0.1, 0.17, 0.02), new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 1 }), -0.12, 0.085, 0.29, chozo).rotation.y = -0.4;
  escena.add(chozo);

  // ── Hayas y escobas al borde del prado, peñas sueltas y flores ──
  const hoja = [0x3d6b2c, 0x4a7a30, 0x2f5a28].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  const tronco = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  const arboles = [];
  const arbol = (x, z, s) => {
    const o = new THREE.Group(); o.position.set(x, 0, z); o.scale.setScalar(s);
    pon(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 6), tronco, 0, 0.2, 0, o);
    for (const [cx, cy, cz, r] of [[0, 0.62, 0, 0.3], [0.17, 0.5, 0.05, 0.2], [-0.16, 0.52, -0.04, 0.21], [0.02, 0.82, 0.02, 0.2]]) {
      const c = pon(new THREE.SphereGeometry(r, 9, 7), hoja[Math.floor(sv() * 3)], cx, cy, cz, o); c.scale.y = 0.85;
    }
    escena.add(o); arboles.push({ o, fase: sv() * 6 });
  };
  for (const [x, z, s] of [[-2.15, -3.5, 0.95], [-1.55, -3.56, 0.7], [1.75, -3.52, 0.8], [2.35, -3.46, 1.0], [-2.3, -2.0, 1.1], [2.45, -1.2, 1.15]]) arbol(x, z, s);
  // escobas (piornos) en flor: las matas, una a una; las flores amarillas, todas en una malla
  const escoba = new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 1 });
  const floresEscoba = [];
  for (let i = 0; i < 16; i++) {
    const lado = i % 2 ? 1 : -1, x = i < 10 ? lado * entre(1.3, 2.6) : entre(-2.4, 2.4), z = i < 10 ? -entre(0.2, 3.4) : -entre(3.4, 3.56), s = i < 10 ? entre(0.7, 1.3) : entre(0.5, 0.8);
    if (Math.hypot(x - 1.12, z + 3.02) < 0.5) continue;
    const m = pon(new THREE.SphereGeometry(0.12 * s, 8, 6), escoba, x, 0.07 * s, z); m.scale.y = 0.75;
    for (let k = 0; k < 6; k++) floresEscoba.push([x + entre(-0.09, 0.09) * s, (0.1 + entre(0, 0.05)) * s, z + entre(-0.06, 0.09) * s, 0.03 * s]);
  }
  const mallaFlorEscoba = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), new THREE.MeshStandardMaterial({ color: 0xe8c531, roughness: 0.8, emissive: 0x6b5200, emissiveIntensity: 0.25 }), floresEscoba.length);
  floresEscoba.forEach(([x, y, z, r], i) => { pieza.position.set(x, y, z); pieza.rotation.set(0, 0, 0); pieza.scale.setScalar(r); pieza.updateMatrix(); mallaFlorEscoba.setMatrixAt(i, pieza.matrix); });
  escena.add(mallaFlorEscoba);

  // el cierre del prado: estacas y dos varas a cada lado y por delante (hasta ahí llegan las ovejas)
  const estacas = [], varas = [];
  const cierre = (x0, z0, x1, z1) => {
    const largo = Math.hypot(x1 - x0, z1 - z0), n = Math.round(largo / 0.36), ang = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i <= n; i++) estacas.push([x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n), entre(0.13, 0.16), entre(-0.07, 0.07)]);
    for (let i = 0; i < n; i++) for (const y of [0.055, 0.105]) varas.push([x0 + (x1 - x0) * ((i + 0.5) / n), y + entre(-0.008, 0.008), z0 + (z1 - z0) * ((i + 0.5) / n), (largo / n) * 1.06, -ang, entre(-0.05, 0.05)]);
  };
  const XC = LADO + OVEJA + 0.03, ZC = -(CERCA - OVEJA - 0.03);
  cierre(-XC, ZC, -XC, -PARED); cierre(XC, ZC, XC, -PARED); cierre(-XC, ZC, XC, ZC);
  cierre(-XC, -PARED, -C, -PARED); cierre(C, -PARED, XC, -PARED);
  const mallaEstacas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.014, 1, 5), maderaVieja, estacas.length);
  estacas.forEach(([x, z, h, t], i) => { pieza.position.set(x, h / 2, z); pieza.rotation.set(t, 0, t * 0.7); pieza.scale.set(1, h, 1); pieza.updateMatrix(); mallaEstacas.setMatrixAt(i, pieza.matrix); });
  const mallaVaras = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.016, 0.01), maderaVieja, varas.length);
  varas.forEach(([x, y, z, l, ry, rz], i) => { pieza.position.set(x, y, z); pieza.rotation.set(0, ry, rz); pieza.scale.set(l, 1, 1); pieza.updateMatrix(); mallaVaras.setMatrixAt(i, pieza.matrix); });
  for (const o of [mallaEstacas, mallaVaras]) { o.castShadow = true; o.receiveShadow = true; escena.add(o); }
  const matPena = new THREE.MeshStandardMaterial({ map: granito, bumpMap: granito, bumpScale: 2.5, roughness: 0.95, color: 0xc6c0b4 });
  for (const [x, z, s] of [[-1.45, -1.5, 1.2], [1.5, -0.5, 0.9], [-1.4, -3.3, 1.5], [1.65, -2.1, 1.1], [-0.82, -3.4, 0.7], [-1.9, -0.6, 1.4]]) {
    const o = pon(new THREE.SphereGeometry(0.11 * s, 6, 5), matPena, x, 0.03 * s, z); o.scale.set(1.3, 0.62, 1); o.rotation.y = sv() * 3;
  }
  // matas de hierba alta y flores del prado (una sola malla cada cosa)
  const N_MATAS = 150, matas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 0.05, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), N_MATAS);
  for (let i = 0; i < N_MATAS; i++) {
    let x = entre(-2.4, 2.4), z = -entre(-0.6, PRADO_HASTA - 0.2);
    if (Math.abs(x) < C + 0.1 && z < -PARED + 0.05 && z > -F - 0.1) { x += x > 0 ? 0.7 : -0.7; }
    pieza.position.set(x, 0.03, z); pieza.rotation.set(entre(-0.25, 0.25), sv() * 3, entre(-0.25, 0.25)); pieza.scale.set(entre(0.8, 1.8), entre(0.6, 1.5), entre(0.8, 1.8)); pieza.updateMatrix();
    matas.setMatrixAt(i, pieza.matrix); matas.setColorAt(i, tinta.setRGB(entre(0.1, 0.2), entre(0.24, 0.36), entre(0.05, 0.1)));
  }
  matas.receiveShadow = true; escena.add(matas);
  const N_FLORES = 110, flores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 5, 4), new THREE.MeshStandardMaterial({ roughness: 0.7 }), N_FLORES);
  const colorFlor = [[1, 0.86, 0.2], [1, 1, 0.95], [0.72, 0.5, 0.9], [1, 0.86, 0.2], [0.95, 0.55, 0.6]];
  for (let i = 0; i < N_FLORES; i++) {
    const mancha = Math.floor(sv() * 9), mx = ((mancha * 37) % 50) / 25 - 1, mz = ((mancha * 53) % 40) / 10;
    let x = mx * 1.9 + entre(-0.35, 0.35), z = -(mz + entre(-0.3, 0.3)) + 0.3;
    if (Math.abs(x) < C + 0.05 && z < -PARED + 0.05 && z > -F - 0.05) x += x > 0 ? 0.75 : -0.75;
    pieza.position.set(x, 0.022 + sv() * 0.012, z); pieza.rotation.set(0, 0, 0); pieza.scale.setScalar(entre(0.7, 1.3)); pieza.updateMatrix();
    flores.setMatrixAt(i, pieza.matrix); const c = colorFlor[mancha % 5]; flores.setColorAt(i, tinta.setRGB(c[0], c[1], c[2]));
  }
  escena.add(flores);

  // ── El pastor: boina, chaleco, manta al hombro y la cayada. Vigila junto a la portilla ──
  const pastor = new THREE.Group(); pastor.position.set(-1.2, 0, -2.42); pastor.rotation.y = 0.9; pastor.scale.setScalar(0.62);
  const tela = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const pana = tela(0x4a3b2a), camisa = tela(0xe6dfd0), chaleco = tela(0x2a2622), piel = tela(0xd2a078, 0.6), manta = tela(0x7a2f26), boina = tela(0x17130f);
  for (const l of [-1, 1]) { pon(new THREE.CapsuleGeometry(0.035, 0.26, 4, 8), pana, l * 0.05, 0.19, 0, pastor); pon(new THREE.BoxGeometry(0.06, 0.04, 0.12), chaleco, l * 0.05, 0.02, 0.02, pastor); }
  pon(new THREE.CapsuleGeometry(0.078, 0.18, 4, 12), camisa, 0, 0.5, 0, pastor).scale.z = 0.72;
  pon(new THREE.CapsuleGeometry(0.081, 0.13, 4, 12), chaleco, 0, 0.52, -0.004, pastor).scale.set(1, 1, 0.74);
  const mantaO = pon(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8), manta, -0.055, 0.56, 0.01, pastor); mantaO.rotation.z = -0.5; mantaO.scale.z = 1.5;
  const cabeza = new THREE.Group(); cabeza.position.set(0, 0.74, 0); pastor.add(cabeza);
  pon(new THREE.SphereGeometry(0.058, 14, 10), piel, 0, 0, 0, cabeza);
  pon(new THREE.CylinderGeometry(0.068, 0.064, 0.022, 16), boina, 0.006, 0.048, 0, cabeza).rotation.z = -0.12;
  pon(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 5), boina, 0.006, 0.064, 0, cabeza);
  const brazoD = new THREE.Group(); brazoD.position.set(0.1, 0.62, 0); pastor.add(brazoD);
  pon(new THREE.CapsuleGeometry(0.022, 0.2, 4, 8), camisa, 0.03, -0.1, 0.05, brazoD).rotation.set(-0.5, 0, 0.25);
  pon(new THREE.SphereGeometry(0.026, 8, 6), piel, 0.06, -0.2, 0.11, brazoD);
  const cayada = new THREE.Group(); cayada.position.set(0.16, 0, 0.12); pastor.add(cayada);
  pon(new THREE.CylinderGeometry(0.011, 0.013, 0.78, 6), madera, 0, 0.39, 0, cayada);
  const gancho = pon(new THREE.TorusGeometry(0.035, 0.011, 6, 10, Math.PI), madera, 0.035, 0.78, 0, cayada);
  gancho.castShadow = false;
  pon(new THREE.CapsuleGeometry(0.02, 0.2, 4, 8), camisa, -0.1, 0.5, 0.02, pastor).rotation.z = 0.12;
  escena.add(pastor);

  // ── El mastín leonés: grande, leonado, con la máscara oscura y la carlanca de pinchos ──
  const perro = new THREE.Group();
  const leonado = tela(0xc89a5c, 0.9), claro = tela(0xe8d3aa, 0.9), mascara = tela(0x4a3524, 0.8), hierro = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.8, roughness: 0.45 }), lengua = tela(0xd9697a, 0.5);
  const cuerpoP = new THREE.Group(); perro.add(cuerpoP);
  const lomo = pon(new THREE.CapsuleGeometry(0.047, 0.11, 5, 10), leonado, 0, 0.118, -0.01, cuerpoP); lomo.rotation.x = Math.PI / 2;
  pon(new THREE.SphereGeometry(0.052, 10, 8), leonado, 0, 0.122, 0.055, cuerpoP);
  pon(new THREE.SphereGeometry(0.036, 8, 6), claro, 0, 0.098, 0.082, cuerpoP);
  const cabezaP = new THREE.Group(); cabezaP.position.set(0, 0.165, 0.105); cuerpoP.add(cabezaP);
  pon(new THREE.SphereGeometry(0.043, 10, 8), leonado, 0, 0, 0, cabezaP);
  pon(new THREE.BoxGeometry(0.042, 0.034, 0.05), mascara, 0, -0.012, 0.043, cabezaP);
  pon(new THREE.SphereGeometry(0.011, 6, 5), tela(0x15100c, 0.3), 0, -0.002, 0.07, cabezaP);
  for (const l of [-1, 1]) {
    const oreja = pon(new THREE.BoxGeometry(0.022, 0.036, 0.008), mascara, l * 0.036, 0.004, -0.008, cabezaP); oreja.rotation.z = l * 0.5;
    pon(new THREE.SphereGeometry(0.0055, 5, 4), tela(0x0d0906, 0.2), l * 0.017, 0.012, 0.037, cabezaP).castShadow = false;
  }
  const lenguaO = pon(new THREE.BoxGeometry(0.014, 0.004, 0.026), lengua, 0, -0.03, 0.052, cabezaP); lenguaO.castShadow = false;
  const carlanca = new THREE.Group(); carlanca.position.set(0, 0.148, 0.078); carlanca.rotation.x = 1.15; cuerpoP.add(carlanca);
  pon(new THREE.TorusGeometry(0.043, 0.008, 6, 14), hierro, 0, 0, 0, carlanca);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, p = pon(new THREE.ConeGeometry(0.005, 0.022, 4), hierro, Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0, carlanca); p.rotation.z = a - Math.PI / 2; p.castShadow = false; }
  const patasP = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([l, f]) => {
    const g = new THREE.Group(); g.position.set(l * 0.032, 0.095, f > 0 ? 0.06 : -0.065); cuerpoP.add(g);
    pon(new THREE.CylinderGeometry(0.014, 0.012, 0.095, 6), leonado, 0, -0.047, 0, g);
    pon(new THREE.SphereGeometry(0.015, 6, 5), claro, 0, -0.09, 0.005, g);
    return { g, fase: l * f > 0 ? 0 : Math.PI };
  });
  const rabo = new THREE.Group(); rabo.position.set(0, 0.14, -0.105); cuerpoP.add(rabo);
  const raboO = pon(new THREE.CapsuleGeometry(0.012, 0.08, 4, 6), leonado, 0, 0.03, -0.035, rabo); raboO.rotation.x = -0.9;
  pon(new THREE.SphereGeometry(0.014, 6, 5), claro, 0, 0.062, -0.066, rabo);
  perro.scale.setScalar(1.3);
  escena.add(perro);

  // ── Las ovejas: todas en unas pocas mallas (lana, cabezas, orejas, patas), una copia por pieza ──
  const lanaTex = textura(128, 128, (g, w, h) => {
    const r = ruido2d(17, 5, w, h), r2 = ruido2d(4, 11, w, h), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 190 + 65 * (0.6 * r(x, y) + 0.4 * r2(x, y)), i = (y * w + x) * 4; im.data[i] = k; im.data[i + 1] = k; im.data[i + 2] = k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, { repetir: true });
  const instanciada = (geo, mat, n) => { const o = new THREE.InstancedMesh(geo, mat, n); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.count = 0; for (let i = 0; i < n; i++) o.setColorAt(i, tinta.setRGB(1, 1, 1)); escena.add(o); return o; };
  const lana = instanciada(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ map: lanaTex, bumpMap: lanaTex, bumpScale: 2.2, roughness: 1 }), MAX_OVEJAS * 4);
  const cabezas = instanciada(new THREE.SphereGeometry(1, 9, 7), new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_OVEJAS * 2);
  const orejas = instanciada(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_OVEJAS * 2);
  const geoPata = new THREE.CylinderGeometry(1, 0.8, 1, 5); geoPata.translate(0, -0.5, 0);
  const patas = instanciada(geoPata, new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_OVEJAS * 4);
  const CREMA = [0.97, 0.93, 0.84], NEGRA = [0.2, 0.16, 0.14], CARA = [0.12, 0.09, 0.08], CARA_NEGRA = [0.05, 0.04, 0.035];
  const cuenta = { lana: 0, cabezas: 0, orejas: 0, patas: 0 };
  const madre = new THREE.Matrix4(), hija = new THREE.Matrix4();
  const poner = (malla, clave, px, py, pz, sx, sy, sz, rx, ry, rz, c, luz = 1) => {
    pieza.position.set(px, py, pz); pieza.rotation.set(rx, ry, rz); pieza.scale.set(sx, sy, sz); pieza.updateMatrix();
    hija.multiplyMatrices(madre, pieza.matrix);
    const i = cuenta[clave]++;
    malla.setMatrixAt(i, hija); malla.setColorAt(i, tinta.setRGB(c[0] * luz, c[1] * luz, c[2] * luz));
  };
  // lo que cada oveja recuerda para moverse con gracia: hacia dónde mira, el paso, si pasta
  const memoria = new Map();
  const recordar = (id, ang) => { let r = memoria.get(id); if (!r) { r = { ang, paso: (id * 2.4) % 6.28, pasta: 0, salto: 0, tam: 1.18 + ((id * 37) % 17) / 100, visto: 0 }; memoria.set(id, r); } return r; };
  const girarHacia = (de, a, k) => { let d = a - de; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return de + d * k; };

  // Una oveja. x, y del prado; v = velocidad; modo: 0 suelta, 1 en el corral o guardada
  function oveja(r, x, y, vx, vy, negra, dt, s, asustada) {
    const v = Math.hypot(vx, vy);
    if (v > 0.02) r.ang = girarHacia(r.ang, Math.atan2(vx, -vy), Math.min(1, dt * (asustada ? 12 : 7)));
    r.paso += dt * (4 + v * 26);
    r.pasta += ((v < 0.03 ? 0.5 + 0.5 * Math.sin(s * 0.5 + r.tam * 40) : 0) - r.pasta) * Math.min(1, dt * 3);
    r.salto += ((asustada ? 1 : 0) - r.salto) * Math.min(1, dt * 8);
    const trote = Math.min(1, v / 0.5), bote = (0.006 * trote + 0.016 * r.salto) * Math.abs(Math.sin(r.paso)), E = r.tam;
    pieza.position.set(x, bote, -y); pieza.rotation.set(0, r.ang, 0); pieza.scale.setScalar(E); pieza.updateMatrix();
    madre.copy(pieza.matrix);
    const lanaC = negra ? NEGRA : CREMA, caraC = negra ? CARA_NEGRA : CARA, cabeceo = 0.02 * trote * Math.sin(r.paso * 2);
    // la lana: lomo, pecho y anca, y el copete de la cabeza
    poner(lana, "lana", 0, 0.092, -0.004, 0.052, 0.047, 0.068, 0, 0, 0, lanaC);
    poner(lana, "lana", 0, 0.097, 0.04, 0.045, 0.043, 0.04, 0, 0, 0, lanaC, 1.03);
    poner(lana, "lana", 0, 0.094, -0.05, 0.047, 0.044, 0.04, 0, 0, 0, lanaC, 0.97);
    // cabeza: baja a pastar
    const baja = r.pasta * 0.062, hy = 0.112 - baja + cabeceo, hz = 0.088 + r.pasta * 0.012;
    poner(lana, "lana", 0, hy + 0.017, hz - 0.012, 0.022, 0.018, 0.022, 0, 0, 0, lanaC, 1.05);
    poner(cabezas, "cabezas", 0, hy, hz, 0.019, 0.02, 0.03, 0.5 + r.pasta * 0.7, 0, 0, caraC);
    for (const l of [-1, 1]) poner(orejas, "orejas", l * 0.024, hy + 0.006, hz - 0.012, 0.018, 0.006, 0.011, 0, 0, l * 0.5, caraC);
    // patas: al trote, en diagonal
    for (const [l, f, fase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
      const giro = Math.sin(r.paso + fase) * (0.12 + 0.75 * trote);
      poner(patas, "patas", l * 0.026, 0.062, f * 0.036, 0.0095, 0.062 + bote / E, 0.0095, giro, 0, 0, caraC);
    }
  }
  // dónde pastan las que ya se encerraron en rebaños anteriores: en la majada, a los lados del corral
  const majada = Array.from({ length: 12 }, (_, i) => {
    const l = i % 2 ? 1 : -1;
    return { x: l * (0.74 + ((i * 29) % 40) / 100), y: 2.74 + ((i * 47) % 55) / 100, ang: sv() * 6.28 };
  }).filter((p) => Math.hypot(p.x - 1.12, p.y - 3.02) > 0.45 && Math.hypot(p.x + 1.2, p.y - 2.42) > 0.3);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yCerca, k: m.campo.hw, D, yc: m.campo.yc }); }

  // polen y motas en el aire, polvo de las pezuñas, hierba que salta con los sustos y el brillo al entrar (adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 46, caja: [-2, 2, 0.1, 1.3, -3.6, 0.4], color: 0xfffbe0, tam: 0.03, opacidad: 0.5, cae: -0.004, viento: 0.05 });
  let angPerro = 0, pasoPerro = 0, polvo = 0, vistos = 0, jadeo = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    const s = reducido ? 0 : d.ahora / 1000;
    base.moverCamara(d, { x: 0.5, y: 0.5, z: 1.4 }, dt);
    // lo que acaba de pasar
    for (const e of v.recientes) {
      if (e.visto) continue;
      e.visto = true;
      if (e.tipo === "dentro") {
        fx.humo({ x: e.x, y: 0.14, z: -PARED - 0.02, ancho: 0.06, n: 4, color: e.negra ? 0xffd66b : 0xfff3c4, tam: [0.05, 0.3], opacidad: 0.6, luz: true, vida: 0.5, sube: 0.35 });
        fx.trozos({ x: e.x, y: 0.03, z: -PARED, n: 6, colores: [0xb39468, 0x8f744e], fuerza: 0.35, arriba: 0.8, tam: [0.006, 0.012], suelo: 0.005, vida: 0.6 });
      } else if (e.tipo === "susto") {
        const o = v.ovejas.find((x) => x.id === e.id);
        if (o) { fx.trozos({ x: o.x, y: 0.03, z: -o.y, n: 9, colores: [0x6f9a3e, 0x8fb552, 0x4f7a2c], fuerza: 0.7, arriba: 1.3, tam: [0.006, 0.014], suelo: 0.004, vida: 0.7 }); fx.sacudir(0.25); }
      } else if (e.tipo === "rebano") {
        for (let k = 0; k < 3; k++) fx.humo({ x: (k - 1) * 0.3, y: 0.3, z: -(PARED + 0.25), ancho: 0.15, n: 3, color: 0xffe49a, tam: [0.08, 0.5], opacidad: 0.5, luz: true, vida: 0.9, sube: 0.5 });
        vistos = 1;
      }
    }
    // ── ovejas ──
    cuenta.lana = cuenta.cabezas = cuenta.orejas = cuenta.patas = 0;
    let n = 0;
    polvo -= dt;
    for (const o of v.ovejas) {
      if (n >= MAX_OVEJAS) break;
      const r = recordar(o.id, Math.atan2(o.x1 - o.x0, -(o.y1 - o.y0)));
      const asustada = v.tj < o.sustoHasta;
      oveja(r, o.x, o.y, o.vx, o.vy, o.negra, dt, s, asustada);
      r.visto = d.ahora; n++;
      const vel = Math.hypot(o.vx, o.vy);
      if (polvo <= 0 && vel > 0.55 && d.estado === "juego") fx.humo({ x: o.x, y: 0.02, z: -o.y + 0.03, n: 1, color: 0xd9cfae, tam: [0.03, 0.16], opacidad: 0.22, abre: 0.08, sube: 0.12, vida: 0.5 });
    }
    if (polvo <= 0) polvo = 0.07;
    for (let i = 0; i < Math.min(v.guardadas, majada.length) && n < MAX_OVEJAS; i++, n++) {
      const p = majada[i], r = recordar(-1 - i, p.ang);
      oveja(r, p.x, p.y, 0, 0, i % 5 === 4, dt, s, false);
    }
    for (const [malla, clave] of [[lana, "lana"], [cabezas, "cabezas"], [orejas, "orejas"], [patas, "patas"]]) {
      malla.count = cuenta[clave]; malla.instanceMatrix.needsUpdate = true; if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    }
    if (memoria.size > 80) for (const [id, r] of memoria) if (id >= 0 && d.ahora - r.visto > 5000) memoria.delete(id);
    // ── el mastín ──
    const p = v.perro, vp = Math.hypot(p.vx, p.vy);
    if (vp > 0.05) angPerro = girarHacia(angPerro, Math.atan2(p.vx, -p.vy), Math.min(1, dt * 10));
    else if (v.ovejas.length) { // parado: mira al rebaño
      let cx = 0, cy = 0, c = 0; for (const o of v.ovejas) if (o.estado !== "dentro") { cx += o.x; cy += o.y; c++; }
      if (c) angPerro = girarHacia(angPerro, Math.atan2(cx / c - p.x, -(cy / c - p.y)), Math.min(1, dt * 3));
    }
    pasoPerro += dt * (3 + vp * 11);
    const galope = Math.min(1, vp / 1.6);
    perro.position.set(p.x, 0, -p.y); perro.rotation.y = angPerro;
    cuerpoP.position.y = 0.012 * galope * Math.abs(Math.sin(pasoPerro));
    cuerpoP.rotation.x = -0.1 * galope * Math.sin(pasoPerro);
    for (const pata of patasP) pata.g.rotation.x = Math.sin(pasoPerro + pata.fase) * (0.1 + 0.9 * galope);
    rabo.rotation.y = Math.sin(s * (vp > 0.1 ? 11 : 5)) * (vp > 0.1 ? 0.5 : 0.25);
    cabezaP.rotation.x = 0.06 * Math.sin(pasoPerro * 2) * galope;
    jadeo += ((vp < 0.15 ? 1 : 0.3) - jadeo) * Math.min(1, dt * 2);
    lenguaO.position.y = -0.03 - 0.004 * jadeo * (1 + Math.sin(s * 14));
    if (galope > 0.6 && d.estado === "juego" && Math.sin(pasoPerro) > 0.95) fx.humo({ x: p.x, y: 0.02, z: -p.y, n: 1, color: 0xd9cfae, tam: [0.04, 0.2], opacidad: 0.25, abre: 0.1, sube: 0.12, vida: 0.5 });
    // ── el pastor: sigue con la cabeza al rebaño y levanta la cayada cuando entra entero ──
    vistos = Math.max(0, vistos - dt * 0.7);
    const alza = vistos > 0 ? Math.sin(Math.min(1, (1 - vistos) * 3) * Math.PI) : 0;
    cayada.position.y = alza * 0.16; cayada.rotation.z = -alza * 0.35 + 0.02 * Math.sin(s * 0.8);
    brazoD.rotation.x = -alza * 0.9;
    cabeza.rotation.y = girarHacia(cabeza.rotation.y, Math.max(-0.9, Math.min(0.9, Math.atan2(p.x + 1.2, -(p.y - 2.42)) - 0.9)), Math.min(1, dt * 2));
    pastor.rotation.z = 0.012 * Math.sin(s * 0.9);
    // los árboles se mecen un pelo
    for (const a of arboles) a.o.rotation.z = 0.015 * Math.sin(s * 0.8 + a.fase);
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
