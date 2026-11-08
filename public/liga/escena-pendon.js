// El Pendón, en 3D. Aquí solo se dibuja: cuánto se inclina el palo sale de motor-pendon.js y de la «vista» de
// juego-pendon.js, la misma que usa el dibujo plano.
//
// La plaza de San Marcos al atardecer. Un pendón leonés: el palo largo de madera, la cruz dorada arriba, el
// travesaño y la tela a rayas carmesí y morado, con sus puntas, que ondea con el viento. Abajo, el cinto de cuero
// donde se apoya. Detrás, la foto de San Marcos, desenfocada.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { LARGO, TELA } from "./juego-pendon.js";

const D = 6.5, YC = 1.0;

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 40,
    cielo: { colores: [[0, "#4d79c4"], [0.4, "#d7c6b0"], [0.5, "#ffd9a0"], [0.56, "#8a6a52"], [1, "#3a2c22"]], luces: [{ x: 0.7, y: 0.42, r: 0.1, color: "rgba(255,200,130,1)" }], intensidad: 0.9 },
  });
  const { escena } = base;

  // ── Luz de atardecer: sol bajo por la derecha, dorado ──
  escena.add(new THREE.HemisphereLight(0xbcd0f0, 0x6a5040, 0.85));
  const sol = new THREE.DirectionalLight(0xffcf96, 2.6);
  sol.position.set(4, 3, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 1, far: 14 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.01;
  escena.add(sol, sol.target);

  // ── Suelo de la plaza: losas ──
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
  losas.repeat.set(8, 7);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), new THREE.MeshStandardMaterial({ map: losas, roughness: 0.9 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.set(0, 0, 0);
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ── El pendón ──
  const pendon = new THREE.Group();
  escena.add(pendon);
  const madera = new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: 0.6 });
  const oro = new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 1, roughness: 0.3 });
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, LARGO, 12), madera);
  palo.position.y = LARGO / 2; palo.castShadow = true;
  pendon.add(palo);
  const yT = LARGO - TELA.desde;
  const travesano = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, TELA.ancho + 0.08, 8), madera);
  travesano.rotation.z = Math.PI / 2; travesano.position.y = yT; travesano.castShadow = true;
  pendon.add(travesano);
  for (const lado of [-1, 1]) { const bola = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), oro); bola.position.set(lado * (TELA.ancho / 2 + 0.05), yT, 0); pendon.add(bola); }
  // la cruz de arriba
  const cruz = new THREE.Group();
  const v1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.025), oro); v1.position.y = 0.08;
  const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.022), oro); h1.position.y = 0.11;
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), oro);
  cruz.add(v1, h1, pomo); cruz.position.y = LARGO;
  cruz.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  pendon.add(cruz);
  // el cinto de cuero (la base)
  const cinto = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.08, 18), new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.7 }));
  cinto.position.y = 0.04; cinto.castShadow = true;
  escena.add(cinto);

  // la tela: rayas carmesí y morado, con las puntas abajo (lo que no es tela, transparente)
  const COLS = 7;
  const tex = textura(256, 512, (g, w, h) => {
    const r = ruido2d(9, 4, w, h);
    for (let i = 0; i < COLS; i++) {
      g.fillStyle = i % 2 ? "#5b1f6e" : "#a3122a";
      const x0 = (i * w) / COLS, x1 = ((i + 1) * w) / COLS;
      const corto = i % 3 === 1 ? 0.88 : 1;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.lineTo(x1, h * corto); g.lineTo((x0 + x1) / 2, h * (corto - 0.06)); g.lineTo(x0, h * corto); g.closePath(); g.fill();
    }
    // tejido: un poco de grano
    const im = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (im.data[i + 3]) { const k = 0.85 + 0.25 * r(x, y); im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k; } }
    g.putImageData(im, 0, 0);
    // la franja de arriba, dorada
    g.fillStyle = "#c99a3c"; g.fillRect(0, 0, w, 14);
  });
  const SX = 14, SY = 22;
  const geoTela = new THREE.PlaneGeometry(TELA.ancho, TELA.alto, SX, SY);
  geoTela.translate(0, -TELA.alto / 2, 0);
  const reposo = geoTela.attributes.position.array.slice();
  const tela = new THREE.Mesh(geoTela, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85 }));
  tela.castShadow = true;
  const colgado = new THREE.Group(); colgado.position.y = yT; colgado.add(tela);
  pendon.add(colgado);

  // la línea de plomo: un hilo dorado que aparece cuando va derecho
  const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, LARGO + 0.15, 6), new THREE.MeshBasicMaterial({ color: 0xe9b44c, transparent: true, opacity: 0 }));
  hilo.position.set(0, (LARGO + 0.15) / 2, -0.04);
  escena.add(hilo);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yBase, k: m.campo.hw, D, yc: YC }); }

  let plomoVisto = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.4, y: 0.15, z: 1.2 }, dt);
    pendon.position.x = v.x; cinto.position.x = v.x;
    pendon.rotation.z = -v.angulo;
    // la tela cuelga (casi) hacia abajo aunque el palo se incline, y el viento la empuja y la hace ondear
    colgado.rotation.z = v.angulo * 0.75 - v.viento * 0.22;
    const p = geoTela.attributes.position, s = d.ahora / 1000, fuerza = 0.25 + Math.min(1, Math.abs(v.viento) * 1.5);
    for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
      const k = j * (SX + 1) + i, u = i / SX, w = j / SY; // w: 0 arriba, 1 abajo
      const z = reducido ? 0 : 0.035 * fuerza * w * Math.sin(u * 7 - s * 5.5 + w * 2) + 0.02 * fuerza * w * Math.sin(w * 6 - s * 3.1);
      p.setXYZ(k, reposo[k * 3], reposo[k * 3 + 1], z);
    }
    p.needsUpdate = true;
    geoTela.computeVertexNormals();
    plomoVisto += ((v.plomo ? 1 : 0) - plomoVisto) * Math.min(1, dt * 8);
    hilo.position.x = v.x;
    hilo.material.opacity = 0.55 * plomoVisto;
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
