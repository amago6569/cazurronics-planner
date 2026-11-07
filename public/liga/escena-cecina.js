// La loncha de cecina, en 3D. Aquí solo se dibuja: el grosor de cada loncha sale de motor-cecina.js y la «vista»
// de juego-cecina.js (dónde está el borde de la pieza), la misma que usa el dibujo plano.
//
// Una cortadora de charcutería roja, de las de toda la vida, con la cuchilla redonda detrás de la pieza. La pieza
// avanza hacia la derecha; lo que pasa de la cuchilla es la loncha. La raya dorada en la bandeja marca el grosor bueno.
// Las lonchas cortadas caen en un plato a la derecha. Detrás, la foto de una cecina de verdad, desenfocada.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { GROSOR } from "./juego-cecina.js";

const D = 4.2, YC = 0.75;
const XC = -0.2; // la cuchilla (igual que en el plano)
const ALTO = 0.36, FONDO = 0.42; // la pieza
const GIRO = -0.55; // la máquina, un poco girada para que se vea en 3D

export function crearEscena({ lienzo, contexto, foto, reducido, marco }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 12,
    cielo: { colores: [[0, "#3a2a24"], [0.45, "#d9b89a"], [0.5, "#fff2e0"], [0.55, "#6b4636"], [1, "#24140f"]], luces: [{ x: 0.5, y: 0.15, r: 0.12, color: "rgba(255,240,220,1)" }], intensidad: 1.0 },
  });
  const { escena } = base;

  // ── Luz de charcutería: un foco cálido de arriba y algo de luz de ventana ──
  escena.add(new THREE.HemisphereLight(0xfff0e0, 0x4a2a20, 0.9));
  const foco = new THREE.DirectionalLight(0xffe6c8, 2.3);
  foco.position.set(-1.2, 3.5, 2.5);
  foco.castShadow = true;
  foco.shadow.mapSize.set(1024, 1024);
  Object.assign(foco.shadow.camera, { left: -1.6, right: 1.6, top: 1.4, bottom: -1, near: 0.5, far: 8 });
  foco.shadow.radius = 3; foco.shadow.bias = -0.0005; foco.shadow.normalBias = 0.008;
  escena.add(foco, foco.target);
  const ventana = new THREE.DirectionalLight(0xcfe0ff, 0.6);
  ventana.position.set(2.5, 1.5, 1);
  escena.add(ventana);

  const maquina = new THREE.Group();
  maquina.rotation.y = GIRO;
  escena.add(maquina);
  const rojo = new THREE.MeshPhysicalMaterial({ color: 0xb3221c, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.18 });
  const acero = new THREE.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 1, roughness: 0.32 });
  const caja = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; maquina.add(o); return o; };
  // cuerpo y bandeja
  caja(2.6, 0.32, 0.8, rojo, -0.3, -0.195, -0.12);
  caja(2.4, 0.035, 0.62, acero, -0.4, -0.018, 0.02);
  // la raya dorada del grosor bueno
  const raya = caja(0.012, 0.004, 0.62, new THREE.MeshStandardMaterial({ color: 0xe9b44c, emissive: 0x6a4a10, metalness: 0.6, roughness: 0.3 }), XC + GROSOR, 0.002, 0.02);
  raya.castShadow = false;
  // la cuchilla: disco de acero detrás de la pieza, con su tapa roja y su eje
  const cuchilla = new THREE.Group();
  cuchilla.position.set(XC - 0.006, ALTO * 0.5, -0.32);
  maquina.add(cuchilla);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.012, 64), cromo);
  disco.rotation.z = Math.PI / 2; disco.castShadow = true;
  cuchilla.add(disco);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 40), rojo);
  tapa.rotation.z = Math.PI / 2; tapa.position.x = -0.03; cuchilla.add(tapa);
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 20), cromo);
  eje.rotation.z = Math.PI / 2; eje.position.x = -0.07; cuchilla.add(eje);
  // marcas en el disco para que se vea girar
  const marcas = textura(128, 128, (g, w) => {
    g.fillStyle = "#cfd4da"; g.fillRect(0, 0, w, w);
    g.strokeStyle = "rgba(90,96,104,.5)"; g.lineWidth = 2;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 20, w / 2 + Math.sin(a) * 20); g.lineTo(w / 2 + Math.cos(a) * 62, w / 2 + Math.sin(a) * 62); g.stroke(); }
  });
  const caraDisco = new THREE.Mesh(new THREE.CircleGeometry(0.355, 64), new THREE.MeshStandardMaterial({ map: marcas, metalness: 0.9, roughness: 0.25 }));
  caraDisco.rotation.y = Math.PI / 2; caraDisco.position.x = 0.0065; cuchilla.add(caraDisco);
  // la guarda curva de arriba
  const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.03, 8, 40, Math.PI * 0.9), rojo);
  guarda.rotation.y = Math.PI / 2; guarda.rotation.x = 0; guarda.position.x = 0.01; cuchilla.add(guarda);

  // ── La pieza de cecina ──
  const cara = textura(256, 256, (g, w, h) => {
    const r = ruido2d(31, 10, w, h), s = suerteVisual(77);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const borde = Math.min(x, y, w - 1 - x, h - 1 - y);
      const k = 0.75 + 0.4 * r(x, y);
      const i = (y * w + x) * 4;
      let R = 150 * k, G = 26 * k, B = 22 * k;
      if (borde < 10) { R = 92 * k; G = 46 * k; B = 28 * k; } // corteza
      else if (y < 34) { R = 236 * k; G = 214 * k; B = 186 * k; } // tocino de arriba
      im.data[i] = R; im.data[i + 1] = G; im.data[i + 2] = B; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.strokeStyle = "rgba(245,225,205,.55)"; g.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) { g.beginPath(); const y0 = 50 + s() * 190; g.moveTo(10, y0); g.bezierCurveTo(80, y0 + (s() - 0.5) * 60, 170, y0 + (s() - 0.5) * 60, 246, y0 + (s() - 0.5) * 40); g.stroke(); }
  });
  const corteza = textura(256, 128, (g, w, h) => {
    const r = ruido2d(13, 6, w, h);
    const im = g.createImageData(w, h);
    const r2 = ruido2d(4, 9, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.55 + 0.5 * r2(x, y), flor = Math.max(0, r(x, y) - 0.62) * 2.2, i = (y * w + x) * 4; // corteza oscura con «flor» clara de curación
      im.data[i] = 96 * k + 140 * flor; im.data[i + 1] = 30 * k + 120 * flor; im.data[i + 2] = 26 * k + 100 * flor; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, { repetir: true });
  corteza.repeat.set(3, 1);
  const matCara = new THREE.MeshStandardMaterial({ map: cara, roughness: 0.55 });
  const matCorteza = new THREE.MeshStandardMaterial({ map: corteza, roughness: 0.8 });
  const LARGO = 2.2;
  const pieza = new THREE.Mesh(new THREE.BoxGeometry(LARGO, ALTO, FONDO), [matCara, matCorteza, matCorteza, matCorteza, matCorteza, matCorteza]);
  pieza.castShadow = pieza.receiveShadow = true;
  maquina.add(pieza);
  // el empujador (la garra que sujeta la pieza)
  const garra = caja(0.1, ALTO * 1.1, FONDO * 0.9, cromo, 0, ALTO * 0.55, 0);

  // ── El plato y las lonchas ──
  const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.025, 48), new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.25 }));
  plato.position.set(0.65, -0.005, 0.05); plato.receiveShadow = true;
  maquina.add(plato);
  const geoLoncha = new THREE.BoxGeometry(1, ALTO, FONDO);
  const libres = [], vivas = new Map(); // por t de la loncha
  function malla() { const o = libres.pop() || new THREE.Mesh(geoLoncha, [matCara, matCara, matCorteza, matCorteza, matCorteza, matCorteza]); o.castShadow = o.receiveShadow = true; o.visible = true; maquina.add(o); return o; }

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yCorte, k: m.campo.k, D, yc: YC }); }

  let partidaVista = null, giroDisco = 0;
  const q = new THREE.Quaternion(), eje3 = new THREE.Vector3(0, 0, 1);
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.25, y: 0.12, z: 0.6 }, dt);
    if (marco.partida !== partidaVista) { partidaVista = marco.partida; for (const o of vivas.values()) { maquina.remove(o); libres.push(o); } vivas.clear(); }
    // la pieza: su borde está a «borde» lonchas de la cuchilla
    const xb = XC + v.borde * GROSOR;
    pieza.position.set(xb - LARGO / 2, ALTO / 2, 0);
    garra.position.x = xb - LARGO + 0.05;
    // la cuchilla gira siempre; al cortar, brilla un instante
    const s = (v.tj - v.ultimoCorte) / 1000;
    giroDisco += dt * (reducido ? 0 : s < 0.25 ? 30 : 16);
    caraDisco.rotation.x = giroDisco;
    cromo.emissive?.setScalar(s >= 0 && s < 0.2 ? 0.25 * (1 - s / 0.2) : 0);
    // lonchas: caen de la cuchilla al plato y se quedan, en abanico
    const vistas = new Set();
    const ultimas = v.lonchas.slice(-14);
    ultimas.forEach((l, i) => {
      vistas.add(l.t);
      let o = vivas.get(l.t);
      if (!o) { o = malla(); vivas.set(l.t, o); }
      const g = Math.max(0.12, l.grosor) * GROSOR;
      const gPlato = Math.max(0.005, g * 0.2); // en el plato, la loncha se ve fina (ya no hace falta exagerarla)
      const rota = l.nota === "rota";
      o.scale.set(g + (gPlato - g) * Math.min(1, Math.max(0, (v.tj - l.t) / 380)), rota ? 0.55 : 1, 1);
      const u = Math.min(1, Math.max(0, (v.tj - l.t) / 380));
      const e = 1 - (1 - u) ** 3;
      // de pie junto a la cuchilla → tumbada en el plato
      const sv = suerteVisual(l.k * 97 + 3);
      const xf = 0.6 + (i % 5) * 0.03, yf = 0.012 + i * 0.007 + gPlato / 2, zf = 0.05 + (sv() - 0.5) * 0.08;
      o.position.set(XC + g / 2 + (xf - XC - g / 2) * e, ALTO / 2 + (yf - ALTO / 2) * e + 0.18 * Math.sin(Math.PI * u), zf * e);
      q.setFromAxisAngle(eje3, -Math.PI / 2 * e);
      o.quaternion.copy(q);
      o.rotateX((sv() - 0.5) * 0.25 * e);
    });
    for (const [t, o] of vivas) if (!vistas.has(t)) { maquina.remove(o); libres.push(o); vivas.delete(t); }
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
