// Bolos leoneses, en 3D. Aquí solo se dibuja: qué bolos caen y por dónde va la bola sale de motor-bolos.js y de la
// «vista» de juego-bolos.js, la misma que usa el dibujo plano.
//
// Una bolera de pueblo de la montaña: el castro de tierra apisonada, la raya de tiro, el tablón del fondo, una tapia de
// piedra con su banco y dos paisanos mirando, hierba alrededor y unos árboles. Los bolos son de madera torneada con
// su anillo; el del medio lleva la cabeza roja y el miche es el pequeño. La bola es media esfera de madera de encina.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { crearPersona, crearChopo, texturaSuelo } from "./comun-3d.js";
import { campo } from "./juego-bolos.js";
import { LARGO, ANCHO, BOLA, BOLO, ALTO } from "./motor-bolos.js";

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 60,
    cielo: { colores: [[0, "#4a82c9"], [0.42, "#cfe2ee"], [0.5, "#f1e6cc"], [0.55, "#7a8f52"], [1, "#3c4428"]], luces: [{ x: 0.68, y: 0.3, r: 0.12, color: "rgba(255,236,196,1)" }], intensidad: 0.85 },
  });
  const { escena } = base;

  escena.add(new THREE.HemisphereLight(0xcfe0ff, 0x7a6a48, 0.9));
  const sol = new THREE.DirectionalLight(0xffe8c0, 2.6);
  sol.position.set(4.5, 7, 2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 5, bottom: -5, near: 1, far: 22 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.012;
  sol.target.position.set(0, 0, -3.5);
  escena.add(sol, sol.target);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };

  // ── El suelo: hierba alrededor y el castro de tierra apisonada, con las rodadas de las bolas ──
  const hierba = texturaSuelo({ oscuro: [66, 108, 44], claro: [124, 164, 70], semilla: 5, briznas: 900 });
  hierba.repeat.set(14, 8);
  const prado = pon(new THREE.PlaneGeometry(28, 16), M(0xffffff, { map: hierba, roughness: 0.95 }), 0, 0, -LARGO - 2.4 + 8); // se acaba detrás de la tapia: por encima asoma la foto
  prado.rotation.x = -Math.PI / 2; prado.receiveShadow = true;
  const tierra = textura(256, 512, (g, w, h) => {
    const r = ruido2d(8, 7, w, h), r2 = ruido2d(3, 40, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.78 + 0.16 * r(x, y) + 0.14 * r2(x, y), i = (y * w + x) * 4;
      // por el medio, más pisada y más clara
      const centro = 1 - Math.min(1, Math.abs(x - w / 2) / (w / 2));
      im.data[i] = (178 + 26 * centro) * k; im.data[i + 1] = (150 + 22 * centro) * k; im.data[i + 2] = (106 + 16 * centro) * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.strokeStyle = "rgba(110,86,52,.18)"; g.lineWidth = 3; // rodadas
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(w * (0.3 + 0.05 * i), h); g.quadraticCurveTo(w * (0.2 + 0.07 * i), h / 2, w * (0.25 + 0.06 * i), 0); g.stroke(); }
    g.fillStyle = "rgba(96,72,44,.25)"; // piedrecillas
    let s = 77; const az = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    for (let i = 0; i < 260; i++) g.fillRect(az() * w, az() * h, 1 + az() * 2, 1 + az() * 2);
  });
  const castro = pon(new THREE.PlaneGeometry(ANCHO * 2, LARGO + 1.6), M(0xffffff, { map: tierra, bumpMap: tierra, bumpScale: 0.6, roughness: 1 }), 0, 0.005, -(LARGO - 1.6) / 2);
  castro.rotation.x = -Math.PI / 2; castro.receiveShadow = true;
  const madera = M(0x7a5634, { roughness: 0.7 }), maderaClara = M(0xb08a56, { roughness: 0.65 });
  // la raya de tiro (un listón blanqueado) y los maderos de los lados
  pon(new THREE.BoxGeometry(ANCHO * 2, 0.02, 0.06), M(0xe8dcc0), 0, 0.012, -0.05).receiveShadow = true;
  for (const l of [-1, 1]) { const b = pon(new THREE.BoxGeometry(0.09, 0.09, LARGO + 1.6), madera, l * (ANCHO + 0.045), 0.045, -(LARGO - 1.6) / 2); b.castShadow = true; b.receiveShadow = true; }
  // el tablón del fondo, con sus estacas
  const tablon = pon(new THREE.BoxGeometry(ANCHO * 2 + 0.18, 0.34, 0.07), madera, 0, 0.17, -LARGO - 0.04); tablon.castShadow = true; tablon.receiveShadow = true;
  for (const x of [-0.9, 0, 0.9]) pon(new THREE.BoxGeometry(0.07, 0.46, 0.07), madera, x, 0.23, -LARGO - 0.11).castShadow = true;

  // ── La tapia de piedra del fondo, con su banco y los paisanos ──
  const mamposteria = textura(256, 128, (g, w, h) => {
    g.fillStyle = "#6f675c"; g.fillRect(0, 0, w, h);
    let s = 31; const az = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    for (let f = 0; f < 5; f++) { let x = -az() * 30; while (x < w) { const a = 26 + az() * 34, k = 130 + az() * 60; g.fillStyle = `rgb(${k},${k - 8},${k - 22})`; g.beginPath(); g.roundRect(x + 2, f * 25.6 + 2, a - 3, 22, 5); g.fill(); x += a; } }
  }, { repetir: true });
  mamposteria.repeat.set(6, 1);
  const tapia = pon(new THREE.BoxGeometry(11, 0.85, 0.35), M(0xffffff, { map: mamposteria, bumpMap: mamposteria, bumpScale: 1.2, roughness: 0.95 }), 0, 0.425, -LARGO - 1.5);
  tapia.castShadow = true; tapia.receiveShadow = true;
  pon(new THREE.BoxGeometry(11.1, 0.07, 0.45), M(0x8a8272, { roughness: 0.95 }), 0, 0.88, -LARGO - 1.5);
  const banco = pon(new THREE.BoxGeometry(1.7, 0.05, 0.3), maderaClara, 0.95, 0.36, -LARGO - 1.15); banco.castShadow = true;
  for (const x of [0.25, 1.65]) pon(new THREE.BoxGeometry(0.06, 0.36, 0.26), madera, x, 0.18, -LARGO - 1.15);
  const paisanos = [
    { c: { camisa: 0xe9e2d2, chaleco: 0x2a2622, pantalon: 0x3a342e, pelo: 0x8a8880, faja: 0x8f1d24 }, x: 0.6, boina: true },
    { c: { camisa: 0x7a94b8, pantalon: 0x4a3c2c, pelo: 0x3a2a1c }, x: 1.3, boina: false },
  ].map(({ c, x, boina }) => {
    const p = crearPersona(c);
    p.grupo.scale.setScalar(0.78); p.grupo.position.set(x, 0.38 - 0.5 * 0.78 + 0.02, -LARGO - 1.12);
    p.piernas.forEach((q) => { q.cadera.rotation.x = -1.45; q.cadera.rotation.z = q.l * 0.12; q.rodilla.rotation.x = 1.45; });
    p.brazos.forEach((b) => { b.hombro.rotation.x = -0.5; b.codo.rotation.x = -0.9; });
    if (boina) { const b = p.pon(new THREE.CylinderGeometry(0.08, 0.075, 0.025, 14), M(0x1c1a18), 0, 0.068, 0, p.cabeza); b.rotation.z = 0.12; }
    escena.add(p.grupo);
    return p;
  });
  // un chopo y dos fresnos detrás, y un carro de heno a un lado para vestir el rincón
  for (const [x, z, a] of [[-3.6, -LARGO - 3, 3.4], [3.2, -LARGO - 2.6, 3.9], [4.4, -LARGO - 4, 3.2], [-5, -LARGO - 4.5, 4.2], [0.6, -LARGO - 5, 4.4]]) { const c = crearChopo(a, 0x5a8a36); c.position.set(x, 0, z); escena.add(c); }
  // la losa donde se guardan las bolas
  const losa = pon(new THREE.BoxGeometry(0.8, 0.06, 0.4), M(0x8a8272), 1.75, 0.03, -0.9); losa.receiveShadow = true;
  const geoBola = (() => { const g = new THREE.SphereGeometry(BOLA, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI); g.translate(0, BOLA * 0.5, 0); return g; })();
  const encina = textura(128, 64, (g, w, h) => {
    const r = ruido2d(9, 6, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.7 + 0.3 * r(x * 0.4, y * 3) + 0.08 * Math.sin(y * 0.9 + r(x, y) * 6), i = (y * w + x) * 4; im.data[i] = 118 * k; im.data[i + 1] = 74 * k; im.data[i + 2] = 40 * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  const matBola = M(0xffffff, { map: encina, roughness: 0.38 });
  for (const [x, z] of [[1.6, -0.9], [1.9, -0.86]]) { const b = pon(geoBola, matBola, x, 0.06 + BOLA * 0.5, z); b.rotation.x = Math.PI; b.castShadow = true; }

  // ── Los bolos: madera torneada (perfil al torno), con su anillo ──
  const perfil = [[0.001, 0], [0.9, 0], [1, 0.03], [0.96, 0.12], [0.78, 0.32], [0.6, 0.52], [0.5, 0.66], [0.47, 0.72], [0.56, 0.78], [0.62, 0.86], [0.55, 0.95], [0.3, 1], [0.001, 1]];
  const geoBolo = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r * BOLO * 1.15, y * ALTO)), 14);
  const geoAnillo = new THREE.CylinderGeometry(BOLO * 0.6, BOLO * 0.66, ALTO * 0.045, 12);
  const palo = textura(64, 128, (g, w, h) => {
    const r = ruido2d(2, 5, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.82 + 0.2 * r(x * 3, y * 0.5), i = (y * w + x) * 4; im.data[i] = 226 * k; im.data[i + 1] = 196 * k; im.data[i + 2] = 142 * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  const matBolo = M(0xffffff, { map: palo, roughness: 0.45 });
  const bolos = Array.from({ length: 10 }, (_, i) => {
    const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo);
    const b = new THREE.Mesh(geoBolo, matBolo); b.castShadow = true; cuerpo.add(b);
    const an = new THREE.Mesh(geoAnillo, M(i === 9 ? 0xd9a940 : i === 4 ? 0xb3121e : 0x2f5d8a, { roughness: 0.5 })); an.position.y = ALTO * 0.6; cuerpo.add(an);
    if (i === 4) { const c = new THREE.Mesh(new THREE.SphereGeometry(BOLO * 0.72, 12, 8), M(0xb3121e, { roughness: 0.45 })); c.position.y = ALTO * 0.87; c.scale.y = 0.75; cuerpo.add(c); }
    g.scale.setScalar(i === 9 ? 0.72 : 1.2); // un poco más grandes de lo que miden, para que se vean bien en el móvil
    escena.add(g);
    return { g, cuerpo, caido: 0 };
  });

  // ── La bola que se tira ──
  const bola = new THREE.Group(); escena.add(bola);
  const media = new THREE.Mesh(geoBola, matBola); media.castShadow = true; bola.add(media);
  // (la cara plana, con el agarre: dos huecos para los dedos)
  const cara = new THREE.Mesh(new THREE.CircleGeometry(BOLA * 0.99, 20), M(0x8a5a30, { roughness: 0.5, side: THREE.DoubleSide })); cara.rotation.x = -Math.PI / 2; cara.position.y = BOLA * 0.5; media.add(cara);
  for (const x of [-0.03, 0.03]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.016, 10), new THREE.MeshBasicMaterial({ color: 0x1c120a })); h.rotation.x = -Math.PI / 2; h.position.set(x, BOLA * 0.5 + 0.001, 0); media.add(h); }

  function medir(m) { base.medir(m, campo.vista3d()); }

  const fx = base.efectos;
  fx.ponerMotas({ n: 30, caja: [-2, 2, 0.1, 2.5, -LARGO, 0], color: 0xfff0c8, tam: 0.028, opacidad: 0.3 });
  const eje = new THREE.Vector3(), q = new THREE.Quaternion();
  let polvo = 0, parada = false, fiestaVista = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.25, y: 0.2, z: 1.3 }, dt);
    const s = d.ahora / 1000;
    // los bolos: de pie, o tumbándose hacia donde les han dado (con un rebote al tocar el suelo)
    bolos.forEach((b, i) => {
      const o = v.bolos[i];
      if (!o) { b.g.visible = false; return; }
      b.g.visible = true;
      const alto = o.sube ?? 1;
      b.g.position.set(o.x, (1 - alto) * -0.02, -o.y);
      b.cuerpo.scale.set(1, Math.max(0.02, alto), 1);
      const k = o.caido;
      if (k > 0) {
        const cae = k < 0.75 ? (k / 0.75) * (k / 0.75) : 1 - 0.06 * Math.sin(((k - 0.75) / 0.25) * Math.PI);
        // gira alrededor del eje que cruza la dirección de caída (en el mundo, la bolera va hacia −z)
        q.setFromAxisAngle(eje.set(-o.dy, 0, -o.dx).normalize(), cae * (Math.PI / 2 - 0.12));
        b.cuerpo.quaternion.copy(q);
        if (b.caido === 0) {
          fx.trozos({ x: o.x, y: 0.05, z: -o.y, n: 4, colores: [0xc9b083, 0xa88c5c], fuerza: 0.5, arriba: 1, tam: [0.006, 0.016], suelo: 0.01, vida: 0.6 });
          fx.humo({ x: o.x + o.dx * 0.2, y: 0.05, z: -o.y - o.dy * 0.2, n: 1, color: 0xd9c4a0, tam: [0.1, 0.4], opacidad: 0.3, vida: 0.6 });
          fx.sacudir(0.12);
        }
      } else b.cuerpo.quaternion.identity();
      b.caido = k;
    });
    // la bola: rueda con la cara plana de lado, deja polvo y golpea el tablón
    bola.visible = v.bola.ve;
    if (v.bola.ve) {
      const enMano = v.bola.enMano;
      bola.position.set(v.bola.x, enMano ? 0.02 + 0.015 * Math.sin(s * 3) : 0, -v.bola.y);
      media.position.y = 0;
      if (enMano) { media.rotation.set(0, s * 0.6, 0); }
      else { media.rotation.set(-v.bola.giro, 0, Math.PI / 2 * 0.86 + 0.2 * (v.bola.efecto || 0)); media.position.y = BOLA * 0.5; }
      if (!enMano && !v.bola.parada) {
        polvo -= dt;
        if (polvo <= 0) { polvo = 0.07; fx.humo({ x: v.bola.x, y: 0.04, z: -v.bola.y + 0.1, n: 1, color: 0xd9c4a0, tam: [0.06, 0.3], opacidad: 0.28, abre: 0.1, sube: 0.15, vida: 0.5 }); }
      }
      if (v.bola.parada && !parada && v.bola.y > LARGO - 0.4) { fx.sacudir(0.3); fx.trozos({ x: v.bola.x, y: 0.1, z: -LARGO + 0.1, n: 6, colores: [0xc9b083, 0x7a5634], fuerza: 0.7, arriba: 1.2, vz: 0.8, tam: [0.006, 0.018], suelo: 0.01, vida: 0.6 }); }
      parada = Boolean(v.bola.parada);
    }
    // los paisanos: siguen la bola con la cabeza y, con un pleno, se levantan a aplaudir
    const f = v.fiesta > 0 ? Math.sin(Math.min(1, v.fiesta * 3) * Math.PI / 2) * (v.fiesta > 0.8 ? (1 - v.fiesta) / 0.2 : 1) : 0;
    if (v.fiesta > 0 && fiestaVista === 0) fx.trozos({ x: 0, y: 1.6, z: -4.6, ancho: 0.9, n: 30, colores: [0xb3121e, 0xe9b44c, 0xf1e3c0, 0x1f6b3a], fuerza: 1, arriba: 2, gravedad: 3, tam: [0.012, 0.03], vida: 1.6 });
    fiestaVista = v.fiesta;
    paisanos.forEach((p, i) => {
      p.cabeza.rotation.y = Math.max(-0.7, Math.min(0.7, (v.bola.ve ? v.bola.x - p.grupo.position.x : 1) * 0.3)) + 0.05 * Math.sin(s * 0.7 + i);
      p.brazos.forEach((b) => { b.hombro.rotation.x = -0.5 - 2.2 * f; b.hombro.rotation.z = b.l * (0.12 + 0.35 * f + 0.2 * f * Math.sin(s * 18 + i)); b.codo.rotation.x = -0.9 + 0.6 * f; });
      p.torso.rotation.x = 0.1 - 0.1 * f;
    });
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
