// El Pendón, en 3D. Aquí solo se dibuja: cuánto se inclina la vara sale de motor-pendon.js y de la «vista» de
// juego-pendon.js, la misma que usa el dibujo plano.
//
// La plaza de San Marcos al atardecer. Un pendón leonés como los de las romerías: la vara larga de madera apoyada en la
// cuja del pendonero, el remate dorado arriba y la tela atada a la vara como una bandera, larga, a franjas carmesí y
// verde, que acaba en dos farpas y ondea hacia el lado del viento. Lo lleva un pendonero con
// camisa blanca, chaleco negro y faja roja. La cámara le sigue por la plaza.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { CUJA, LARGO, TELA, puntoTela } from "./juego-pendon.js";

const D = 6.8, YC = 1.3;

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 40,
    cielo: { colores: [[0, "#4d79c4"], [0.4, "#d7c6b0"], [0.5, "#ffd9a0"], [0.56, "#8a6a52"], [1, "#3a2c22"]], luces: [{ x: 0.7, y: 0.42, r: 0.1, color: "rgba(255,200,130,1)" }], intensidad: 0.9 },
  });
  const { escena } = base;

  // ── Luz de atardecer: sol bajo por la derecha, dorado ──
  escena.add(new THREE.HemisphereLight(0xbcd0f0, 0x6a5040, 0.85));
  const sol = new THREE.DirectionalLight(0xffcf96, 2.6);
  sol.position.set(4, 4, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: 1, far: 16 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.01;
  escena.add(sol, sol.target);
  // contraluz frío por detrás: recorta al pendonero y la tela contra la plaza
  const contraluz = new THREE.DirectionalLight(0xa9c4ff, 0.7);
  contraluz.position.set(-3, 2.5, -3);
  escena.add(contraluz);

  // ── Suelo de la plaza: losas (corren cuando la cámara sigue al pendonero) ──
  const losas = textura(256, 256, (g, w, h) => {
    const r = ruido2d(4, 6, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.8 + 0.2 * r(x, y), i = (y * w + x) * 4;
      im.data[i] = 168 * k; im.data[i + 1] = 156 * k; im.data[i + 2] = 142 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.strokeStyle = "rgba(60,50,42,.55)"; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); }
  }, { repetir: true });
  const ANCHO_SUELO = 24;
  losas.repeat.set(ANCHO_SUELO / 2, 7);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO_SUELO, 14), new THREE.MeshStandardMaterial({ map: losas, bumpMap: losas, bumpScale: 0.7, roughness: 0.82 }));
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ── El pendonero ──
  const camisa = new THREE.MeshStandardMaterial({ color: 0xefe9de, roughness: 0.8 });
  const chaleco = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.7 });
  const faja = new THREE.MeshStandardMaterial({ color: 0xb3121e, roughness: 0.75 });
  const pantalon = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.8 });
  const piel = new THREE.MeshStandardMaterial({ color: 0xd9a87e, roughness: 0.6 });
  const cuero = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.6 });
  const pendonero = new THREE.Group();
  escena.add(pendonero);
  const malla = (geo, mat, x, y, z, padre = pendonero) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o; };
  for (const l of [-1, 1]) {
    const pierna = malla(new THREE.CapsuleGeometry(0.035, 0.3, 4, 8), pantalon, l * 0.055, 0.2, -0.1);
    pierna.rotation.z = l * 0.12;
    malla(new THREE.BoxGeometry(0.06, 0.04, 0.12), chaleco, l * 0.075, 0.02, -0.08);
  }
  const torso = malla(new THREE.CapsuleGeometry(0.075, 0.2, 4, 12), camisa, 0, 0.53, -0.12);
  torso.scale.z = 0.75;
  const vest = malla(new THREE.CapsuleGeometry(0.078, 0.14, 4, 12), chaleco, 0, 0.56, -0.12); vest.scale.set(1.02, 1, 0.8);
  malla(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), faja, 0, 0.4, -0.12).scale.z = 0.8;
  malla(new THREE.SphereGeometry(0.06, 16, 12), piel, 0, 0.77, -0.12);
  const sombrero = malla(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20), chaleco, 0, 0.815, -0.12);
  malla(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 16), chaleco, 0, 0.025, 0, sombrero);
  // la cuja: el cinto de cuero con el hueco donde va la vara
  malla(new THREE.CylinderGeometry(0.035, 0.03, 0.06, 12), cuero, 0, CUJA - 0.02, 0);
  // brazos: del hombro a las manos, que van sobre la vara (se recolocan cada cuadro)
  const geoBrazo = new THREE.CylinderGeometry(0.022, 0.02, 1, 8); geoBrazo.translate(0, 0.5, 0);
  const brazos = [-1, 1].map((l) => ({ l, brazo: malla(geoBrazo, camisa, 0, 0, 0), mano: malla(new THREE.SphereGeometry(0.026, 10, 8), piel, 0, 0, 0) }));

  // ── El pendón ──
  const pendon = new THREE.Group(); // gira en la cuja
  escena.add(pendon);
  const madera = new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: 0.55 });
  const oro = new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 1, roughness: 0.3 });
  const vara = malla(new THREE.CylinderGeometry(0.02, 0.03, LARGO + 0.05, 12), madera, 0, (LARGO - 0.05) / 2, 0, pendon);
  vara.receiveShadow = true;
  // el remate de arriba: bola y cruz doradas
  malla(new THREE.SphereGeometry(0.035, 14, 10), oro, 0, LARGO + 0.01, 0, pendon);
  malla(new THREE.BoxGeometry(0.022, 0.17, 0.022), oro, 0, LARGO + 0.12, 0, pendon);
  malla(new THREE.BoxGeometry(0.1, 0.02, 0.02), oro, 0, LARGO + 0.15, 0, pendon);

  // la tela, atada a la vara como una bandera: franjas carmesí y verde a lo largo, separadas por un hilo dorado, el
  // galón junto a la vara y el corte de las dos farpas en la punta. Ancho de la textura = largo de la tela.
  const FRANJAS = ["#b0142a", "#1f6b3a", "#b0142a", "#1f6b3a", "#b0142a"];
  const tex = textura(1024, 256, (g, w, h) => {
    const r = ruido2d(5, 9, w, h);
    g.beginPath(); // silueta: corte en V en la punta (finTela)
    g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w * (1 - TELA.farpa), h / 2); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.clip();
    const fr = h / FRANJAS.length;
    FRANJAS.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * fr, w, fr + 1); });
    const im = g.getImageData(0, 0, w, h); // grano de la tela (damasco) y pliegues
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!im.data[i + 3]) continue;
      const k = 0.82 + 0.22 * r(x, y) + 0.05 * Math.sin(x * 0.09);
      im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k;
    }
    g.putImageData(im, 0, 0);
    g.fillStyle = "rgba(230,200,120,.85)";
    for (let i = 1; i < FRANJAS.length; i++) g.fillRect(0, i * fr - 1.5, w, 3);
    g.fillStyle = "#d4a63e"; g.fillRect(0, 0, 18, h); // galón junto a la vara
  });
  const SX = 30, SY = 10;
  const geoTela = new THREE.PlaneGeometry(1, 1, SX, SY);
  const tela = new THREE.Mesh(geoTela, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.75 }));
  tela.castShadow = true; tela.frustumCulled = false;
  escena.add(tela);

  // la línea de plomo: un hilo dorado que aparece cuando va derecho
  const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, LARGO + 0.2, 6), new THREE.MeshBasicMaterial({ color: 0xe9b44c, transparent: true, opacity: 0 }));
  escena.add(hilo);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yBase, k: m.campo.hw, D, yc: YC }); }

  let plomoVisto = 0;
  // polvo de la plaza que se lleva el viento, hojas que cruzan y la polvareda cuando el pendón se va al suelo (adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 44, caja: [-2.6, 2.6, 0.05, 4, -0.8, 1.2], color: 0xffe2b8, tam: 0.022, opacidad: 0.4 });
  let enSuelo = false, hoja = 0;
  const arriba = new THREE.Vector3(0, 1, 0), hombro = new THREE.Vector3(), mano = new THREE.Vector3(), dir = new THREE.Vector3();
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.4, y: 0.15, z: 1.2 }, dt);
    const x = v.x - v.camara; // la cámara sigue al pendonero: lo que se mueve es la plaza
    losas.offset.x = (v.camara / 2) % 1;
    pendonero.position.x = x;
    pendonero.rotation.z = -v.angulo * 0.15; // se echa un poco hacia donde tira el pendón
    pendon.position.set(x, CUJA, 0);
    pendon.rotation.z = -v.angulo;
    // las manos sobre la vara (una a la altura del pecho, otra más arriba), los brazos desde los hombros
    for (const b of brazos) {
      const h = b.l < 0 ? 0.2 : 0.42;
      mano.set(x + Math.sin(v.angulo) * h, CUJA + Math.cos(v.angulo) * h, 0.03);
      b.mano.position.copy(mano).sub(pendonero.position);
      hombro.set(b.l * 0.09, 0.66, -0.12);
      b.brazo.position.copy(hombro);
      dir.copy(b.mano.position).sub(hombro);
      b.brazo.scale.set(1, dir.length(), 1);
      b.brazo.quaternion.setFromUnitVectors(arriba, dir.normalize());
    }
    // la tela: cada punto sale de puntoTela (lo mismo que en plano)
    const p = geoTela.attributes.position, sg = reducido ? 0 : d.ahora / 1000;
    for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
      const q = puntoTela(v, i / SX, j / SY, sg);
      p.setXYZ(j * (SX + 1) + i, q.x, q.y, reducido ? 0 : q.z);
    }
    p.needsUpdate = true;
    geoTela.computeVertexNormals();
    fx.motas.viento = v.viento * 1.6;
    hoja -= dt;
    if (d.estado === "juego" && Math.abs(v.viento) > 0.05 && hoja <= 0) {
      hoja = 0.9 - Math.min(0.6, Math.abs(v.viento));
      const s = Math.sign(v.viento);
      fx.trozos({ x: x - s * 2.4, y: 0.25 + 1.6 * Math.abs(Math.sin(d.ahora * 0.0031)), z: 0.3, fondo: 0.5, n: 1, colores: [0xb5651d, 0x8a6a1c, 0xc98a2a, 0x6a7a2a], fuerza: 0.15, vx: s * (1.6 + 2 * Math.abs(v.viento)), arriba: 0.5, gravedad: 0.9, tam: [0.016, 0.03], suelo: 0.01, vida: 2.6 });
    }
    const tumbado = Math.abs(v.angulo) > 1.38;
    if (tumbado && !enSuelo) {
      const s = Math.sign(v.angulo);
      fx.sacudir(0.7);
      fx.humo({ x: x + s * LARGO * 0.75, y: 0.08, z: 0.1, ancho: LARGO * 0.25, n: 6, color: 0xd9c4a6, tam: [0.15, 0.7], opacidad: 0.35, abre: 0.5, sube: 0.3, vida: 1.0 });
      fx.trozos({ x: x + s * LARGO * 0.8, y: 0.04, z: 0.1, ancho: LARGO * 0.2, n: 10, colores: [0xa89a88, 0x8a7c6c], fuerza: 0.6, arriba: 1.2, tam: [0.008, 0.018], suelo: 0.01, vida: 0.8 });
    }
    enSuelo = tumbado;
    plomoVisto += ((v.plomo ? 1 : 0) - plomoVisto) * Math.min(1, dt * 8);
    hilo.position.set(x, CUJA + (LARGO + 0.2) / 2, -0.05);
    hilo.material.opacity = 0.5 * plomoVisto;
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
