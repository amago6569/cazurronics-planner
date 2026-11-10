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
  // Corte de una pieza de verdad: redondeada e irregular, más alta por un lado, con bultos; no un bloque.
  // contorno (u = a lo ancho de la máquina, v = alto), centrado en 0
  const contorno = (() => {
    const s = suerteVisual(41), n = 40, pts = [];
    const bultos = Array.from({ length: 4 }, () => ({ a: s() * Math.PI * 2, k: 0.06 + 0.09 * s(), w: 0.4 + 0.5 * s() }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let r = 1;
      for (const b of bultos) { const d = Math.atan2(Math.sin(a - b.a), Math.cos(a - b.a)); r += b.k * Math.exp(-(d * d) / (b.w * b.w * 0.3)); }
      const c = Math.cos(a), sn = Math.sin(a);
      // abajo, casi plana (apoya en la bandeja); arriba, más llena por un lado (la pieza es más gruesa por ahí)
      let u = (FONDO / 2) * Math.sign(c) * Math.abs(c) ** 0.5 * r;
      let v = (ALTO / 2) * Math.sign(sn) * Math.abs(sn) ** (sn < 0 ? 0.3 : 0.6) * r;
      if (sn > 0) v *= 0.88 + 0.12 * (u / (FONDO / 2) + 1) / 2;
      pts.push([u, v]);
    }
    const minV = Math.min(...pts.map((p) => p[1]));
    return pts.map(([u, v]) => [u, v - minV - ALTO / 2]); // que toque la bandeja abajo
  })();
  const forma = new THREE.Shape(contorno.map(([u, v]) => new THREE.Vector2(u, v)));
  // la cara del corte: carne roja oscura con vetas de grasa, borde de corteza siguiendo el contorno
  const cara = textura(256, 256, (g, w, h) => {
    const aT = ([u, v]) => [(u / FONDO + 0.5) * w, (0.5 - v / ALTO) * h];
    const s = suerteVisual(77), r = ruido2d(31, 9, w, h);
    g.fillStyle = "#3a1410"; g.fillRect(0, 0, w, h);
    const camino = () => { g.beginPath(); contorno.forEach((p, i) => { const [x, y] = aT(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    // corteza: el contorno, oscuro y algo dorado
    camino(); g.fillStyle = "#5a2a18"; g.fill();
    // carne: el mismo contorno un poco más pequeño
    g.save(); g.translate(w / 2, h / 2); g.scale(0.9, 0.88); g.translate(-w / 2, -h / 2);
    camino(); g.clip();
    const grad = g.createRadialGradient(w * 0.45, h * 0.55, 10, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, "#9c1e1c"); grad.addColorStop(0.6, "#7d1416"); grad.addColorStop(1, "#5a0f10");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // vetas de grasa (finas, curvas, en grupos) y la capa de grasa de un lado
    g.strokeStyle = "rgba(240,215,190,.6)"; g.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      g.lineWidth = 0.8 + s() * 2;
      const x0 = s() * w, y0 = s() * h, l = 30 + s() * 90, a = s() * Math.PI;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * l * 0.5 + (s() - 0.5) * 30, y0 + Math.sin(a) * l * 0.5 + (s() - 0.5) * 30, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke();
    }
    g.fillStyle = "rgba(236,214,186,.85)";
    g.beginPath(); g.ellipse(w * 0.16, h * 0.42, w * 0.06, h * 0.22, 0.25, 0, Math.PI * 2); g.fill();
    g.restore();
    // brillo y grano de carne curada
    const im = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = 0.82 + 0.3 * r(x, y); im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k; }
    g.putImageData(im, 0, 0);
  });
  cara.repeat.set(1 / FONDO, 1 / ALTO); cara.offset.set(0.5, 0.5);
  // corteza de cecina curada: granate muy oscuro, con fibras a lo largo y brillos de grasa
  const corteza = textura(256, 512, (g, w, h) => {
    const r = ruido2d(13, 18, w, h), r2 = ruido2d(4, 5, w, h), s = suerteVisual(9);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.7 + 0.35 * r(x, y) + 0.12 * r2(x, y), i = (y * w + x) * 4;
      im.data[i] = 118 * k; im.data[i + 1] = 28 * k; im.data[i + 2] = 26 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    // fibras a lo largo de la pieza (en los lados, la v de la textura va a lo largo)
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = s() < 0.5 ? "rgba(40,10,8,.35)" : "rgba(170,80,60,.22)"; g.lineWidth = 1 + s() * 2;
      const y = s() * h, x = s() * w, l = 40 + s() * 160;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (s() - 0.5) * 6, y + l); g.stroke();
    }
    // vetas de grasa que asoman
    g.fillStyle = "rgba(225,190,160,.35)";
    for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(s() * w, s() * h, 2 + s() * 4, 20 + s() * 50, (s() - 0.5) * 0.2, 0, Math.PI * 2); g.fill(); }
  }, { repetir: true });
  corteza.repeat.set(2.5, 0.5);
  const matCara = new THREE.MeshStandardMaterial({ map: cara, roughness: 0.55 });
  const matCorteza = new THREE.MeshPhysicalMaterial({ map: corteza, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.5 });
  const LARGO = 2.2;
  // la pieza y las lonchas: el contorno estirado a lo largo (x). Grupo 0 = las dos caras del corte, 1 = la corteza
  function geoPieza(largo, curvas) {
    const g = new THREE.ExtrudeGeometry(forma, { depth: largo, bevelEnabled: curvas, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -largo / 2);
    g.rotateY(Math.PI / 2); // lo extruido (z) pasa a ser x
    return g;
  }
  const pieza = new THREE.Mesh(geoPieza(LARGO, false), [matCara, matCorteza]);
  pieza.castShadow = pieza.receiveShadow = true;
  maquina.add(pieza);
  // el empujador (la garra que sujeta la pieza)
  const garra = caja(0.1, ALTO * 1.1, FONDO * 0.9, cromo, 0, ALTO * 0.55, 0);

  // ── El plato y las lonchas ──
  const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.025, 48), new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.25 }));
  plato.position.set(0.65, -0.005, 0.05); plato.receiveShadow = true;
  maquina.add(plato);
  const geoLoncha = geoPieza(1, false);
  const libres = [], vivas = new Map(); // por t de la loncha
  function malla() { const o = libres.pop() || new THREE.Mesh(geoLoncha, [matCara, matCorteza]); o.castShadow = o.receiveShadow = true; o.visible = true; maquina.add(o); return o; }

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yCorte, k: m.campo.k, D, yc: YC }); }

  let partidaVista = null, giroDisco = 0;
  // virutas que saltan de la cuchilla en cada corte y un destello si la loncha sale fina (adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 24, caja: [-1.4, 1.4, 0, 1.8, -0.3, 0.9], color: 0xffe8cc, tam: 0.014, opacidad: 0.35 });
  let corteVisto = -1e9;
  const pCorte = new THREE.Vector3();
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
    if (v.ultimoCorte !== corteVisto) {
      corteVisto = v.ultimoCorte;
      const l = v.lonchas[v.lonchas.length - 1];
      if (l && d.estado === "juego" && s >= 0 && s < 0.3) {
        maquina.localToWorld(pCorte.set(XC + 0.02, ALTO * 0.55, 0.12));
        fx.sacudir(l.nota === "gorda" ? 0.3 : 0.16);
        fx.trozos({ x: pCorte.x, y: pCorte.y, z: pCorte.z, fondo: 0.08, n: 7, colores: [0x7d1416, 0x9c1e1c, 0x5a2a18, 0xe6cdb0], fuerza: 0.45, vx: 0.35, arriba: 1.1, tam: [0.006, 0.016], suelo: 0.02, vida: 0.8 });
        if (l.nota === "papel" || l.nota === "fina") fx.humo({ x: pCorte.x, y: pCorte.y, z: pCorte.z + 0.1, n: l.nota === "papel" ? 4 : 2, color: 0xffe2a0, tam: [0.08, 0.4], opacidad: 0.4, luz: true, vida: 0.45 });
      }
    }
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
