// Bajada en San Isidro, en 3D. Aquí solo se dibuja: dónde está cada puerta y cada pino sale de motor-esqui.js y de la
// «vista» de juego-esqui.js, la misma que usa el dibujo plano.
//
// Una pista nevada que baja hacia el fondo, con bosque de pinos a los lados. El esquiador (de espaldas, chaqueta
// roja) se inclina al girar y levanta nieve. Puertas de eslalon gigante (dos palos y una lona roja o azul) y pinos
// sueltos en medio. Nieva un poco. Detrás, la foto de las montañas de León, desenfocada.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { VE_HASTA } from "./juego-esqui.js";

const D = 3.2, YC = 1.05;
const PENDIENTE = 0.1; // la pista baja hacia el fondo

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 60,
    cielo: { colores: [[0, "#8fb4e0"], [0.45, "#e6eef8"], [0.5, "#ffffff"], [0.55, "#c9d3e0"], [1, "#7a8494"]], luces: [{ x: 0.35, y: 0.2, r: 0.1, color: "rgba(255,255,250,1)" }], intensidad: 1.1 },
  });
  const { escena } = base;
  escena.fog = new THREE.Fog(0xe8eef6, 8, VE_HASTA + 2);

  // ── Luz de día de montaña: sol alto, cielo que rebota en la nieve ──
  escena.add(new THREE.HemisphereLight(0xdfeaff, 0xbfc8d6, 1.1));
  const sol = new THREE.DirectionalLight(0xfffaf0, 2.2);
  sol.position.set(-2, 5, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -6, near: 1, far: 20 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.01;
  escena.add(sol, sol.target);
  const yEn = (z) => PENDIENTE * z; // altura de la nieve en z (z negativo = más abajo, hacia el fondo)

  // ── La nieve ──
  const LARGO_TEX = 4;
  const nieve = textura(256, 256, (g, w, h) => {
    const r = ruido2d(13, 8, w, h), r2 = ruido2d(2, 40, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.9 + 0.06 * r(x, y) + 0.05 * r2(x, y), i = (y * w + x) * 4;
      im.data[i] = 238 * k; im.data[i + 1] = 243 * k; im.data[i + 2] = 252 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    // huellas de otros esquís
    g.strokeStyle = "rgba(170,185,210,.35)"; g.lineWidth = 2;
    for (const x0 of [60, 70, 180, 190]) { g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + 30, h * 0.3, x0 - 30, h * 0.6, x0, h); g.stroke(); }
  }, { repetir: true });
  nieve.repeat.set(22, 60 / LARGO_TEX);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshStandardMaterial({ map: nieve, roughness: 0.95 }));
  suelo.rotation.x = -Math.PI / 2 + Math.atan(PENDIENTE);
  suelo.position.set(0, yEn(-24), -24);
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ── Pinos ──
  const verde = new THREE.MeshStandardMaterial({ color: 0x1f4a32, roughness: 0.85 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.9 });
  const tronco = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
  const geoCopa = [0, 1, 2].map((k) => new THREE.ConeGeometry(0.16 - k * 0.035, 0.22, 10));
  const geoNieve = [0, 1, 2].map((k) => new THREE.ConeGeometry(0.1 - k * 0.022, 0.07, 10));
  const geoTronco = new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6);
  function hacerPino(escala = 1) {
    const o = new THREE.Group();
    const tr = new THREE.Mesh(geoTronco, tronco); tr.position.y = 0.06; o.add(tr);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(geoCopa[k], verde); c.position.y = 0.2 + k * 0.13; o.add(c);
      const n = new THREE.Mesh(geoNieve[k], blanco); n.position.y = 0.28 + k * 0.13; o.add(n);
    }
    o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    o.scale.setScalar(escala);
    escena.add(o);
    return o;
  }
  // bosque a los lados: se repite cada BOSQUE unidades
  const BOSQUE = 26, sv = suerteVisual(77);
  const bosque = Array.from({ length: 44 }, (_, i) => {
    const lado = i % 2 ? 1 : -1;
    return { o: hacerPino(1.4 + sv() * 1.4), x: lado * (1.35 + sv() * 2.2), d: sv() * BOSQUE };
  });
  // los pinos de la pista (los del motor)
  const pinos = new Map(), libresPino = [];

  // ── Puertas ──
  const palo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8);
  const matPalo = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
  const lonaRoja = new THREE.MeshStandardMaterial({ color: 0xd0262e, roughness: 0.7, side: THREE.DoubleSide });
  const lonaAzul = new THREE.MeshStandardMaterial({ color: 0x2d62d6, roughness: 0.7, side: THREE.DoubleSide });
  const lonaBien = new THREE.MeshStandardMaterial({ color: 0x4fbf6e, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x2f8f4a, emissiveIntensity: 0.4 });
  const lonaMal = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7, side: THREE.DoubleSide });
  function hacerPuerta() {
    const o = new THREE.Group();
    const a = new THREE.Mesh(palo, matPalo), b = new THREE.Mesh(palo, matPalo);
    a.position.y = b.position.y = 0.275;
    const lona = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.13), lonaRoja);
    lona.position.y = 0.42;
    o.add(a, b, lona);
    o.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    escena.add(o);
    return { o, a, b, lona };
  }
  const puertas = new Map(), libresPuerta = [];

  // ── El esquiador ──
  const esquiador = new THREE.Group();
  const cuerpo = new THREE.Group(); esquiador.add(cuerpo);
  const chaqueta = new THREE.MeshStandardMaterial({ color: 0xc8262c, roughness: 0.55 });
  const pantalon = new THREE.MeshStandardMaterial({ color: 0x1d2f5a, roughness: 0.6 });
  const casco = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.25, clearcoat: 0.8 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  for (const lado of [-1, 1]) {
    const esqui = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.42), new THREE.MeshStandardMaterial({ color: 0xe8b13a, roughness: 0.35 }));
    esqui.position.set(lado * 0.035, 0.005, -0.03); esquiador.add(esqui);
    const pierna = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), pantalon);
    pierna.position.set(lado * 0.035, 0.09, 0.01); pierna.rotation.x = 0.35; cuerpo.add(pierna);
    const bota = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.06), negro); bota.position.set(lado * 0.035, 0.025, 0); cuerpo.add(bota);
    const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.09, 4, 8), chaqueta);
    brazo.position.set(lado * 0.07, 0.22, -0.02); brazo.rotation.set(-0.6, 0, lado * 0.25); cuerpo.add(brazo);
    const baston = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 5), negro);
    baston.position.set(lado * 0.1, 0.12, 0.02); baston.rotation.x = -0.35; cuerpo.add(baston);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 4, 10), chaqueta);
  torso.position.set(0, 0.22, 0.02); torso.rotation.x = 0.45; cuerpo.add(torso);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), casco); cabeza.position.set(0, 0.31, -0.02); cuerpo.add(cabeza);
  esquiador.traverse((x) => { if (x.isMesh) { x.castShadow = true; } });
  esquiador.scale.setScalar(1.25);
  escena.add(esquiador);

  // copo redondo y difuminado (sin esto los puntos se ven cuadrados)
  const redondo = textura(32, 32, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,.7)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  // nieve que salta al girar
  const N = 80;
  const posPolvo = new Float32Array(N * 3), velPolvo = new Float32Array(N * 3), vidaPolvo = new Float32Array(N);
  const geoPolvo = new THREE.BufferGeometry(); geoPolvo.setAttribute("position", new THREE.BufferAttribute(posPolvo, 3));
  const polvo = new THREE.Points(geoPolvo, new THREE.PointsMaterial({ color: 0xffffff, map: redondo, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.05 }));
  escena.add(polvo);
  let siguientePolvo = 0;
  // copos que caen
  const C = reducido ? 0 : 260;
  const posCopos = new Float32Array(C * 3), sc = suerteVisual(5);
  for (let i = 0; i < C; i++) { posCopos[i * 3] = (sc() - 0.5) * 6; posCopos[i * 3 + 1] = sc() * 3; posCopos[i * 3 + 2] = -sc() * 10 + 1.5; }
  const geoCopos = new THREE.BufferGeometry(); geoCopos.setAttribute("position", new THREE.BufferAttribute(posCopos, 3));
  const copos = new THREE.Points(geoCopos, new THREE.PointsMaterial({ color: 0xffffff, map: redondo, size: 0.03, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 }));
  escena.add(copos);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.ySki, k: m.campo.hw, D, yc: YC }); }

  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.3, y: 0.15, z: 0.8 }, dt);
    // la nieve corre hacia la cámara
    nieve.offset.y = v.recorrido / LARGO_TEX;
    for (const b of bosque) {
      const dist = ((b.d - v.recorrido) % BOSQUE + BOSQUE) % BOSQUE - 3;
      b.o.position.set(b.x, yEn(-dist), -dist);
    }
    // cosas de la pista
    const vistos = new Set();
    for (const c of v.cosas) {
      vistos.add(c.n);
      const z = -c.dist, y = yEn(z);
      if (c.tipo === "pino") {
        let o = pinos.get(c.n);
        if (!o) { o = libresPino.pop() || hacerPino(1); o.visible = true; pinos.set(c.n, o); }
        o.position.set(c.x, y, z);
        o.rotation.z = c.res && !c.res.bien ? Math.sin(d.ahora / 30) * 0.05 * Math.max(0, 1 + c.dist / 1.5) : 0;
      } else {
        let p = puertas.get(c.n);
        if (!p) { p = libresPuerta.pop() || hacerPuerta(); p.o.visible = true; puertas.set(c.n, p); }
        p.o.position.set(c.x, y, z);
        p.a.position.x = -c.medio; p.b.position.x = c.medio;
        p.lona.scale.x = c.medio * 2;
        p.lona.material = c.res ? (c.res.bien ? lonaBien : lonaMal) : c.color ? lonaAzul : lonaRoja;
      }
    }
    for (const [n, o] of pinos) if (!vistos.has(n)) { o.visible = false; libresPino.push(o); pinos.delete(n); }
    for (const [n, p] of puertas) if (!vistos.has(n)) { p.o.visible = false; libresPuerta.push(p); puertas.delete(n); }
    // esquiador: se inclina al girar; si se cae, rueda
    esquiador.position.set(v.x, 0, 0);
    const giro = Math.max(-0.5, Math.min(0.5, v.vx * 0.22));
    esquiador.rotation.set(0, -giro * 0.6, v.caido ? -1.3 * Math.min(1, v.caido * 2) : -giro);
    cuerpo.position.y = v.caido ? 0 : -Math.abs(giro) * 0.04;
    // polvo de nieve en los giros
    const fuerza = Math.min(1, Math.abs(v.vx) / 2);
    if (!reducido && d.estado === "juego" && fuerza > 0.15) {
      for (let k = 0; k < 2; k++) {
        const i = siguientePolvo++ % N, s = Math.random;
        posPolvo[i * 3] = v.x - Math.sign(v.vx) * 0.04; posPolvo[i * 3 + 1] = 0.02; posPolvo[i * 3 + 2] = 0.05;
        velPolvo[i * 3] = -Math.sign(v.vx) * (0.4 + s() * 0.6) * fuerza; velPolvo[i * 3 + 1] = 0.4 + s() * 0.6; velPolvo[i * 3 + 2] = 0.3 + s() * 0.5;
        vidaPolvo[i] = 0.5;
      }
    }
    for (let i = 0; i < N; i++) {
      if (vidaPolvo[i] <= 0) { posPolvo[i * 3 + 1] = -10; continue; }
      vidaPolvo[i] -= dt; velPolvo[i * 3 + 1] -= 3 * dt;
      posPolvo[i * 3] += velPolvo[i * 3] * dt; posPolvo[i * 3 + 1] += velPolvo[i * 3 + 1] * dt; posPolvo[i * 3 + 2] += velPolvo[i * 3 + 2] * dt;
    }
    geoPolvo.attributes.position.needsUpdate = true;
    for (let i = 0; i < C; i++) {
      posCopos[i * 3 + 1] -= dt * 0.5; posCopos[i * 3 + 2] += dt * (d.estado === "juego" ? 5 : 0.6);
      if (posCopos[i * 3 + 1] < -0.6 || posCopos[i * 3 + 2] > 2.5) { posCopos[i * 3 + 1] = 2.6 + Math.random() * 0.4; posCopos[i * 3 + 2] = -Math.random() * 10; }
    }
    if (C) geoCopos.attributes.position.needsUpdate = true;
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
