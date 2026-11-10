// Tapeo en el Húmedo, en 3D. Aquí solo se dibuja: qué cae, dónde y qué se coge sale de motor-tapas.js.
//
// Una barra de madera de un bar del Húmedo, de noche, con la calle detrás (la foto, desenfocada). Encima de la barra,
// una cazuela de barro que va de lado a lado. Las tapas caen en el plano de la cazuela (z = 0), que la cámara ve igual
// que el dibujo plano: así lo que ves coincide con lo que cuenta. Lo que coges se va amontonando en la cazuela.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { xEn, alturaEn } from "./motor-tapas.js";
import { suerteVisual } from "./marco.js";

const ALTO = 0.19; // la cazuela: el borde en y = 0 y el culo en la barra
const BARRA = -ALTO;
const D = 7, YC = 1.25; // cámara: a 7 unidades del plano de juego y a 1,25 por encima del borde de la cazuela
const ESCALA_COSA = 1.45; // las tapas se ven un poco más grandes que su radio de juego (en el móvil son pequeñas)

export function crearEscena({ lienzo, contexto, foto, reducido, marco }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 30,
    cielo: {
      colores: [[0, "#0a1430"], [0.42, "#24386a"], [0.5, "#d3a066"], [0.56, "#3b2615"], [1, "#120a05"]],
      luces: [{ x: 0.2, y: 0.33, r: 0.08, color: "rgba(255,220,160,1)" }, { x: 0.7, y: 0.4, r: 0.06, color: "rgba(255,200,130,.9)" }],
      intensidad: 0.8,
    },
  });
  const { escena } = base;

  // ── Luz: la farola de la izquierda (como en la foto), el azul de la noche y un contraluz frío ──
  escena.add(new THREE.HemisphereLight(0x5a78b8, 0x3a2410, 0.75));
  const farola = new THREE.DirectionalLight(0xffcf96, 2.6);
  farola.position.set(-3.2, 5.5, 4.2);
  farola.target.position.set(0, 0, 0);
  farola.castShadow = true;
  farola.shadow.mapSize.set(1024, 1024);
  Object.assign(farola.shadow.camera, { left: -2.6, right: 2.6, top: 3.2, bottom: -1.2, near: 1, far: 16 });
  farola.shadow.radius = 3;
  farola.shadow.bias = -0.0005;
  farola.shadow.normalBias = 0.01;
  escena.add(farola, farola.target);
  const contraluz = new THREE.DirectionalLight(0xa9c2ff, 0.9);
  contraluz.position.set(3, 3, -4);
  escena.add(contraluz);
  // luz del bar, cálida y baja, que sale de detrás de la barra
  const bar = new THREE.PointLight(0xffa860, 1.4, 6, 1.6);
  bar.position.set(0.6, 0.5, -1.4);
  escena.add(bar);

  // ── La barra de madera ──
  const madera = textura(512, 128, (g, w, h) => {
    const r = ruido2d(7, 4, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const veta = 0.5 + 0.5 * Math.sin(y * 0.55 + r(x * 0.15, y) * 9 + Math.sin(x * 0.02) * 2);
      const tabla = (Math.floor(y / 32) % 2) * 0.06;
      const k = 0.62 + 0.25 * veta + 0.12 * r(x, y * 3) - tabla;
      const i = (y * w + x) * 4;
      im.data[i] = 120 * k; im.data[i + 1] = 72 * k; im.data[i + 2] = 38 * k; im.data[i + 3] = 255;
      if (y % 32 === 0) { im.data[i] *= 0.45; im.data[i + 1] *= 0.45; im.data[i + 2] *= 0.45; }
    }
    g.putImageData(im, 0, 0);
  }, { repetir: true });
  madera.repeat.set(5, 1);
  const matMadera = new THREE.MeshStandardMaterial({ map: madera, roughness: 0.42, metalness: 0, color: 0xffffff });
  const frente = madera.clone(); frente.needsUpdate = true; frente.repeat.set(5, 3);
  const matFrente = new THREE.MeshStandardMaterial({ map: frente, roughness: 0.6, color: 0x9a8f88 });
  const barra = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 1.3), [matFrente, matFrente, matMadera, matFrente, matFrente, matFrente]);
  barra.position.set(0, BARRA - 1.5, -0.05);
  barra.receiveShadow = true;
  escena.add(barra);
  // canto de latón en el borde de delante
  const laton = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3 });
  const canto = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 16, 10), laton);
  canto.rotation.z = Math.PI / 2;
  canto.position.set(0, BARRA - 0.01, 0.6);
  escena.add(canto);

  // ── Lo que hay en la barra (detrás del plano de juego, para dar ambiente): una caña y un plato de pan ──
  const cana = new THREE.Group();
  const vidrio = new THREE.MeshStandardMaterial({ color: 0xe9b54a, transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0, emissive: 0x3a2100 });
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.26, 24), vidrio);
  vaso.position.y = 0.13; cana.add(vaso);
  const espuma = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.075, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0xfbf3e2, roughness: 0.9 }));
  espuma.position.y = 0.285; cana.add(espuma);
  cana.position.set(-0.98, BARRA, -0.45);
  cana.traverse((o) => { o.castShadow = true; });
  escena.add(cana);
  const plato = new THREE.Group();
  const loza = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.025, 32), new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.3 }));
  loza.position.y = 0.012; plato.add(loza);
  const matPan = new THREE.MeshStandardMaterial({ color: 0xd59a52, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const pan = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 10), matPan);
    pan.rotation.set(Math.PI / 2, 0, 0.6 * i - 0.6); pan.position.set(-0.05 + 0.05 * i, 0.055, 0.02 * i);
    plato.add(pan);
  }
  plato.position.set(1.0, BARRA, -0.4);
  plato.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  escena.add(plato);

  // ── La cazuela de barro ──
  const cazuela = new THREE.Group();
  escena.add(cazuela);
  const barro = textura(256, 64, (g, w, h) => {
    const r = ruido2d(3, 3, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.82 + 0.3 * r(x, y) + (y > h * 0.75 ? -0.18 : 0); // más tostada abajo, donde le da el fuego
      const i = (y * w + x) * 4;
      im.data[i] = 176 * k; im.data[i + 1] = 92 * k; im.data[i + 2] = 48 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  const fuera = [[0.0, -ALTO], [0.105, -ALTO], [0.125, -ALTO + 0.02], [0.15, -0.08], [0.163, -0.02], [0.168, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const dentro = [[0.155, 0.004], [0.15, -0.03], [0.138, -0.09], [0.11, -ALTO + 0.035], [0.0, -ALTO + 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const exterior = new THREE.Mesh(new THREE.LatheGeometry(fuera, 40), new THREE.MeshStandardMaterial({ map: barro, roughness: 0.88 }));
  const interior = new THREE.Mesh(new THREE.LatheGeometry(dentro, 40), new THREE.MeshStandardMaterial({ color: 0x5a2a12, roughness: 0.28, side: THREE.DoubleSide }));
  const borde = new THREE.Mesh(new THREE.TorusGeometry(0.1615, 0.0085, 8, 48), new THREE.MeshStandardMaterial({ color: 0x8a4320, roughness: 0.4 }));
  borde.rotation.x = Math.PI / 2; borde.position.y = 0.002;
  const salsa = new THREE.Mesh(new THREE.CircleGeometry(0.135, 32), new THREE.MeshStandardMaterial({ color: 0x7a2c0c, roughness: 0.18, metalness: 0.05 }));
  salsa.rotation.x = -Math.PI / 2; salsa.position.y = -0.085;
  cazuela.add(exterior, interior, borde, salsa);
  for (const lado of [-1, 1]) { // las dos orejas
    const oreja = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 6, 14, Math.PI), exterior.material);
    oreja.position.set(lado * 0.17, -0.03, 0); oreja.rotation.set(Math.PI / 2, 0, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
    cazuela.add(oreja);
  }
  cazuela.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  const montonGrupo = new THREE.Group();
  cazuela.add(montonGrupo);

  // ── Las tapas ──
  const migas = textura(128, 64, (g, w, h) => {
    const r = ruido2d(11, 2, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.7 + 0.5 * r(x, y);
      const i = (y * w + x) * 4;
      im.data[i] = 220 * k; im.data[i + 1] = 138 * k; im.data[i + 2] = 56 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  const cara = (fondo, motas, n, semilla) => textura(128, 128, (g, w, h) => {
    const s = suerteVisual(semilla);
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = motas[i % motas.length];
      g.beginPath(); g.ellipse(s() * w, s() * h, 2 + s() * 6, 2 + s() * 4, s() * 3, 0, 7); g.fill();
    }
  });
  const MAT = {
    croqueta: new THREE.MeshStandardMaterial({ map: migas, bumpMap: migas, bumpScale: 2.5, roughness: 0.85 }),
    morcillaLado: new THREE.MeshStandardMaterial({ color: 0x1c0907, roughness: 0.45 }),
    morcillaCara: new THREE.MeshStandardMaterial({ map: cara("#3b1210", ["#e6d9c0", "#5a1b16", "#d9c9a8"], 70, 5), roughness: 0.6 }),
    chorizoLado: new THREE.MeshStandardMaterial({ color: 0x7c160c, roughness: 0.35 }),
    chorizoCara: new THREE.MeshStandardMaterial({ map: cara("#b8321f", ["#f4d9c4", "#8e1d10", "#e9b9a0"], 55, 9), roughness: 0.45 }),
    cecina: new THREE.MeshStandardMaterial({ map: textura(128, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#efe1cd"); gr.addColorStop(0.13, "#c98a7a"); gr.addColorStop(0.2, "#7a1d16"); gr.addColorStop(1, "#4d0f0b");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(240,220,200,.35)"; g.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, 18 + i * 7); g.bezierCurveTo(40, 12 + i * 7, 80, 26 + i * 6, w, 16 + i * 7); g.stroke(); }
    }), roughness: 0.5, side: THREE.DoubleSide }),
    oro: new THREE.MeshStandardMaterial({ color: 0xffcb52, metalness: 1, roughness: 0.2, emissive: 0x4a2c00 }),
    cuerda: new THREE.MeshStandardMaterial({ color: 0xeee0c0, roughness: 0.9 }),
    papel: new THREE.MeshStandardMaterial({ map: textura(128, 128, (g, w, h) => {
      g.fillStyle = "#f7f4ec"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#3d64a8"; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = "#3d64a8"; g.font = "bold 15px sans-serif"; g.textAlign = "center"; g.fillText("GRACIAS", w / 2, h / 2 - 4); g.fillText("POR SU VISITA", w / 2, h / 2 + 14);
    }), roughness: 0.95, side: THREE.DoubleSide }),
  };
  const GEO = {
    croqueta: new THREE.CapsuleGeometry(0.05, 0.085, 6, 14),
    rodaja: (r) => new THREE.CylinderGeometry(r, r, 0.036, 26),
  };
  const geoMorcilla = GEO.rodaja(0.074), geoChorizo = GEO.rodaja(0.068);
  const geoCecina = (() => {
    const g = new THREE.PlaneGeometry(0.2, 0.14, 12, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.018 * Math.sin(x * 22) + 0.4 * y * y); }
    g.computeVertexNormals();
    return g;
  })();
  const geoPapel = (() => {
    const g = new THREE.PlaneGeometry(0.21, 0.21, 8, 8);
    const p = g.attributes.position, s = suerteVisual(42);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (s() - 0.5) * 0.045 + 0.6 * (x * x - y * y)); }
    g.computeVertexNormals();
    return g;
  })();
  const geoOro = new THREE.SphereGeometry(0.085, 28, 18);
  const brillo = textura(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,226,140,.9)"); r.addColorStop(0.35, "rgba(255,190,70,.35)"); r.addColorStop(1, "rgba(255,170,40,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  function hacer(clase) {
    let o;
    if (clase === "croqueta") o = new THREE.Mesh(GEO.croqueta, MAT.croqueta);
    else if (clase === "morcilla") o = new THREE.Mesh(geoMorcilla, [MAT.morcillaLado, MAT.morcillaCara, MAT.morcillaCara]);
    else if (clase === "chorizo") o = new THREE.Mesh(geoChorizo, [MAT.chorizoLado, MAT.chorizoCara, MAT.chorizoCara]);
    else if (clase === "cecina") o = new THREE.Mesh(geoCecina, MAT.cecina);
    else if (clase === "servilleta") o = new THREE.Mesh(geoPapel, MAT.papel);
    else {
      o = new THREE.Group();
      const cuerpo = new THREE.Mesh(geoOro, MAT.oro); cuerpo.scale.set(1, 0.86, 0.92); o.add(cuerpo);
      const nudo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 8), MAT.oro); nudo.position.y = 0.085; o.add(nudo);
      const atado = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 12), MAT.cuerda); atado.rotation.x = Math.PI / 2; atado.position.y = 0.075; o.add(atado);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.set(0.42, 0.42, 1); o.add(halo); o.userData.halo = halo;
    }
    o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    escena.add(o);
    return o;
  }
  const libres = new Map(), usadas = new Map(); // por clase
  function pedir(clase) {
    const l = libres.get(clase) || [];
    const o = l.pop() || hacer(clase);
    o.visible = true;
    if (!usadas.has(clase)) usadas.set(clase, []);
    usadas.get(clase).push(o);
    return o;
  }
  function devolverTodas() {
    for (const [clase, l] of usadas) {
      if (!libres.has(clase)) libres.set(clase, []);
      for (const o of l) { o.visible = false; libres.get(clase).push(o); }
      l.length = 0;
    }
  }

  // giro de cada cosa al caer (solo estética)
  const giros = new Map();
  function giroDe(c) {
    let g = giros.get(c.id);
    if (!g) {
      const s = suerteVisual(c.id * 7919 + 13);
      g = { a: new THREE.Euler(s() * 6.3, s() * 6.3, s() * 6.3), v: new THREE.Vector3((s() - 0.5) * 6, (s() - 0.5) * 6, (s() - 0.5) * 6) };
      giros.set(c.id, g);
    }
    return g;
  }
  const eu = new THREE.Euler();
  function orientar(o, c, s) {
    const g = giroDe(c);
    if (c.clase === "servilleta") { // la servilleta planea: se balancea, casi plana
      eu.set(-1.1 + 0.35 * Math.sin(s * 5 + g.a.x), g.a.y + s * 0.8, 0.4 * Math.sin(s * 3.3 + g.a.z));
    } else if (c.clase === "dorado") eu.set(0.25 * Math.sin(s * 2), s * 2.6, 0.15);
    else if (c.clase === "morcilla" || c.clase === "chorizo") { // rodajas: casi de cara, girando despacio
      eu.set(1.25 + 0.35 * Math.sin(s * 2.2 + g.a.x), g.a.y + s * 1.2, 0.3 * Math.sin(s * 1.7 + g.a.z));
    } else if (c.clase === "cecina") eu.set(0.35 * Math.sin(s * 2.4 + g.a.x), 0.5 * Math.sin(s * 1.6 + g.a.y), g.a.z + s * 1.5);
    else eu.set(g.a.x + g.v.x * 0.4 * s, g.a.y + g.v.y * 0.4 * s, g.a.z + g.v.z * 0.4 * s);
    o.rotation.copy(eu);
  }

  // ── El montón de la cazuela: las últimas tapas cogidas, tumbadas encima de la salsa ──
  const SITIOS = [[0, 0], [0.06, 0.03], [-0.06, 0.02], [0.02, -0.06], [-0.04, -0.05], [0.07, -0.04], [-0.08, -0.02], [0.03, 0.07], [-0.03, 0.07], [0.0, 0.0]];
  const monton = []; // { o, clase }
  const enMonton = new Set();
  function alMonton(c) {
    if (enMonton.has(c.id)) return;
    enMonton.add(c.id);
    const n = monton.length;
    let o;
    if (n >= 14) { const viejo = monton.shift(); viejo.o.visible = false; montonGrupo.remove(viejo.o); }
    o = hacer(c.clase === "dorado" ? "dorado" : c.clase);
    escena.remove(o); montonGrupo.add(o);
    if (o.userData.halo) o.userData.halo.visible = false;
    const k = monton.length % SITIOS.length, capa = Math.floor(monton.length / SITIOS.length);
    const g = giroDe(c);
    o.position.set(SITIOS[k][0], -0.07 + 0.035 * capa + 0.01 * (k % 3), SITIOS[k][1]);
    o.rotation.set(c.clase === "croqueta" ? Math.PI / 2 : c.clase === "cecina" ? -1.3 : 0.25 * Math.sin(g.a.x), g.a.y, 0.2 * Math.sin(g.a.z));
    o.scale.setScalar(0.8);
    monton.push({ o, clase: c.clase });
  }
  function vaciarMonton() { for (const x of monton) montonGrupo.remove(x.o); monton.length = 0; enMonton.clear(); }

  // ── Medidas ──
  function medir(m) {
    base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yBorde, k: m.campo.hw, D, yc: YC });
  }

  // ── Escaparate del menú: tres tapas flotando sobre la cazuela ──
  const escaparate = [pedirFija("croqueta"), pedirFija("chorizo"), pedirFija("dorado")];
  function pedirFija(clase) { const o = hacer(clase); o.visible = false; return o; }

  let partidaVista = null;
  let golpe = -1e9; // ms de partida en que cayó algo en la cazuela (para que bote un poco)
  // migas que saltan de la cazuela, lo que se estrella en la barra y el polvillo en la luz de los faroles (adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 34, caja: [-1.5, 1.5, -0.2, 2.4, -0.5, 0.8], color: 0xffd9a0, tam: 0.018, opacidad: 0.4 });
  let enBarra = new WeakSet();
  function dibujar(d) {
    const { partida, decididas } = d;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.35, y: 0.25, z: 1.6 }, dt);
    if (partida !== partidaVista) { partidaVista = partida; vaciarMonton(); giros.clear(); golpe = -1e9; enBarra = new WeakSet(); }
    devolverTodas();
    const caida = marco.campo.caida;
    const tj = d.tj;
    const xc = d.cazuela;

    // menú sin partida: el escaparate
    const menu = !partida && (d.estado === "inicio" || d.estado === "cuenta");
    escaparate.forEach((o, i) => {
      o.visible = menu;
      if (!menu) return;
      const t = d.ahora / 1000;
      o.position.set(-0.32 + 0.32 * i, 0.55 + 0.22 * i + 0.05 * Math.sin(t * 1.3 + i), 0);
      o.rotation.set(0.5 * Math.sin(t * 0.7 + i), t * 0.6 + i, 0.3 * Math.cos(t * 0.5 + i));
    });

    if (partida) {
      // lo que cae
      for (let i = partida.siguiente; i < partida.cosas.length; i++) {
        const c = partida.cosas[i];
        if (c.t0 > tj) break;
        const u = (tj - c.t0) / c.T;
        const o = pedir(c.clase);
        o.position.set(xEn(c, tj), alturaEn(u) * caida, 0);
        o.scale.setScalar(ESCALA_COSA * Math.min(1, 0.3 + u * 5));
        orientar(o, c, (tj - c.t0) / 1000);
        if (o.userData.halo) o.userData.halo.material.opacity = 0.7 + 0.3 * Math.sin(tj / 90);
      }
      // lo que ya llegó
      for (const c of decididas) {
        const s = (tj - c.tc) / 1000;
        if (s < 0) continue;
        if (c.res.cogida && c.tipo !== "servilleta") {
          if (s >= 0.12) {
            alMonton(c);
            if (c.tc > golpe) {
              golpe = c.tc;
              if (s < 0.5) { // recién caída (no al volver a pintar las de antes)
                const oro = c.clase === "dorado";
                fx.sacudir(oro ? 0.3 : 0.16);
                fx.trozos({ x: xc, y: 0.03, z: 0.05, ancho: 0.08, n: oro ? 12 : 6, colores: oro ? [0xffd76a, 0xf2b53a, 0xfff2c0] : [0xd9a441, 0xb5651d, 0xf0d9a0], fuerza: 0.6, arriba: 1.5, tam: [0.008, 0.02], suelo: BARRA + 0.01, vida: 0.9 });
                if (oro) fx.humo({ x: xc, y: 0.1, z: 0.15, n: 4, color: 0xffd76a, tam: [0.1, 0.5], opacidad: 0.45, luz: true, vida: 0.5 });
              }
            }
            continue;
          }
          const o = pedir(c.clase);
          const k = s / 0.12;
          o.position.set(xc + (xEn(c, c.tc) - xc) * (1 - k), -0.07 * k, 0);
          o.scale.setScalar(ESCALA_COSA * (1 - 0.3 * k));
          orientar(o, c, (c.tc - c.t0) / 1000 + s);
          continue;
        }
        if (s > 1.2) continue;
        const o = pedir(c.clase);
        if (c.res.cogida) { // servilleta en la cazuela: se queda encima y sale volando
          o.position.set(xc + 0.2 * s * s, 0.02 + 0.6 * s * s, 0.1 * s);
          o.scale.setScalar(ESCALA_COSA * Math.max(0, 1 - s / 1.2));
          orientar(o, c, (c.tc - c.t0) / 1000 + s * 3);
          continue;
        }
        // al suelo de la barra: sigue cayendo, bota y se queda; luego desaparece
        const suelo = BARRA + c.r * 0.6;
        const x = xEn(c, c.tc) + c.vx * s * 0.3; // lo que venía en diagonal sigue un poco de lado
        let y = -(1.4 * s + 4.9 * s * s);
        if (y < suelo) {
          y = suelo;
          if (!enBarra.has(c) && s < 1) { // el golpe contra la barra
            enBarra.add(c);
            if (c.clase !== "servilleta") { fx.sacudir(0.14); fx.trozos({ x, y: suelo, z: 0.15, n: 5, colores: [0xd9a441, 0x8a4a1c, 0xf0d9a0], fuerza: 0.5, arriba: 1.0, tam: [0.008, 0.018], suelo, vida: 0.7 }); }
          }
        }
        o.position.set(x, y, 0.15 * Math.min(1, s * 3));
        o.scale.setScalar(ESCALA_COSA * (s < 0.7 ? 1 : Math.max(0, 1 - (s - 0.7) / 0.5)));
        if (y > suelo) orientar(o, c, (c.tc - c.t0) / 1000 + s);
        else if (c.clase === "servilleta" || c.clase === "cecina") o.rotation.set(-Math.PI / 2, o.rotation.y, 0);
      }
    }

    // la cazuela, y un pequeño bote cuando cae algo dentro
    cazuela.position.set(xc, 0, 0);
    const b = (tj - golpe) / 1000;
    const bote = b >= 0 && b < 0.25 && !reducido ? Math.sin(b / 0.25 * Math.PI) * 0.06 : 0;
    cazuela.scale.set(1 + bote * 0.5, 1 - bote, 1 + bote * 0.5);

    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
