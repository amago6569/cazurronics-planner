// La torre del botillo, en 3D. Aquí solo se dibuja: lo que cuenta sale de motor-botillo.js y de la «vista» de
// juego-botillo.js (dónde está cada botillo en cada instante), que es la misma que usa el dibujo plano.
//
// Una mesa con mantel de cuadros en la plaza de Botines, un plato de barro y la torre de botillos encima. Una grúa
// (solo se ve la cuerda) trae cada botillo. La cámara sube con la torre; la foto de Botines, lejos, casi no se mueve.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { ALTO_B } from "./juego-botillo.js";
import { ANCHO } from "./motor-botillo.js";

const D = 7, YC = 0.9;

export function crearEscena({ lienzo, contexto, foto, reducido, marco }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 60,
    cielo: { colores: [[0, "#3f7fd6"], [0.4, "#a9c8ee"], [0.49, "#f4ead8"], [0.53, "#9a8b78"], [1, "#4a4038"]], luces: [{ x: 0.3, y: 0.2, r: 0.08, color: "rgba(255,250,235,1)" }], intensidad: 0.9 },
  });
  const { escena } = base;

  // ── Luz de mediodía: sol alto por la izquierda y por delante, cielo azul ──
  escena.add(new THREE.HemisphereLight(0xbcd6ff, 0x8a7458, 1.0));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sol.position.set(-3, 7, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 20 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.01;
  escena.add(sol, sol.target);
  const relleno = new THREE.DirectionalLight(0xc9dcff, 0.6);
  relleno.position.set(3, 2, -3);
  escena.add(relleno);

  // ── Mesa con mantel de cuadros ──
  const cuadros = textura(256, 256, (g, w) => {
    g.fillStyle = "#f6f1e8"; g.fillRect(0, 0, w, w);
    g.fillStyle = "rgba(190,40,34,.55)";
    for (let i = 0; i < 8; i++) { g.fillRect(i * 32, 0, 16, w); g.fillRect(0, i * 32, w, 16); }
    g.fillStyle = "rgba(170,28,24,.35)";
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) g.fillRect(i * 32, j * 32, 16, 16);
  }, { repetir: true });
  cuadros.repeat.set(6, 2);
  const tela = new THREE.MeshStandardMaterial({ map: cuadros, roughness: 0.92 });
  const frenteTela = cuadros.clone(); frenteTela.needsUpdate = true; frenteTela.repeat.set(6, 3);
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 1.6), [tela, tela, tela, tela, new THREE.MeshStandardMaterial({ map: frenteTela, roughness: 0.95 }), tela]);
  mesa.position.set(0, -0.04 - 1.5, -0.2);
  mesa.receiveShadow = true;
  escena.add(mesa);
  // plato de barro
  const barro = new THREE.MeshStandardMaterial({ color: 0xa8582c, roughness: 0.75 });
  const perfil = [[0, 0], [0.22, 0], [0.3, 0.02], [0.34, 0.045], [0.33, 0.05], [0.27, 0.035], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const plato = new THREE.Mesh(new THREE.LatheGeometry(perfil, 40), barro);
  plato.position.y = -0.04;
  plato.castShadow = true; plato.receiveShadow = true;
  escena.add(plato);
  // una jarra de vino al lado, para el ambiente (fuera del sitio de la torre)
  const jarra = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.11, 0.08], [0.1, 0.2], [0.07, 0.26], [0.08, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 24), new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.3 }));
  jarra.position.set(-0.95, -0.04, -0.45); jarra.castShadow = true;
  escena.add(jarra);

  // ── Botillos ──
  const piel = textura(256, 128, (g, w, h) => {
    const r = ruido2d(21, 6, w, h), r2 = ruido2d(5, 2, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.72 + 0.35 * r(x, y) + 0.1 * r2(x, y);
      const i = (y * w + x) * 4;
      im.data[i] = 150 * k; im.data[i + 1] = 48 * k; im.data[i + 2] = 30 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  const relieve = textura(256, 128, (g, w, h) => {
    const r = ruido2d(8, 12, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 255 * r(x, y), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, { color: false });
  const matPiel = new THREE.MeshPhysicalMaterial({ map: piel, bumpMap: relieve, bumpScale: 0.5, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.35 });
  const matCuerda = new THREE.MeshStandardMaterial({ color: 0xeee3c8, roughness: 0.95 });
  // cuerpo abultado (una esfera con bultos), un poco distinto cada uno
  function geoCuerpo(semilla) {
    const g = new THREE.SphereGeometry(1, 32, 22);
    const p = g.attributes.position, s = suerteVisual(semilla);
    const bultos = Array.from({ length: 5 }, () => ({ v: new THREE.Vector3(s() - 0.5, s() - 0.5, s() - 0.5).normalize(), a: 0.04 + 0.05 * s() }));
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      let k = 1;
      for (const b of bultos) { const d = v.dot(b.v); if (d > 0.6) k += b.a * (d - 0.6) / 0.4; }
      if (v.y > 0.6) k -= (v.y - 0.6) * 0.5; // se estrecha hacia el atado
      p.setXYZ(i, v.x * k * (ANCHO / 2), v.y * k * (ALTO_B * 0.62), v.z * k * (ANCHO * 0.45));
    }
    g.computeVertexNormals();
    return g;
  }
  const geos = [1, 2, 3, 4, 5, 6].map(geoCuerpo);
  const geoAtado = new THREE.CylinderGeometry(0.012, 0.03, 0.07, 10);
  const geoLazo = new THREE.TorusGeometry(0.02, 0.006, 6, 14);
  function hacerBotillo(n) {
    const o = new THREE.Group();
    const cuerpo = new THREE.Mesh(geos[n % geos.length], matPiel);
    cuerpo.position.y = ALTO_B / 2;
    o.add(cuerpo);
    const atado = new THREE.Mesh(geoAtado, matPiel); atado.position.y = ALTO_B * 1.08; o.add(atado);
    const lazo = new THREE.Mesh(geoLazo, matCuerda); lazo.rotation.x = Math.PI / 2; lazo.position.y = ALTO_B * 1.0; o.add(lazo);
    o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    o.rotation.y = (n * 2.39996) % (Math.PI * 2);
    escena.add(o);
    return o;
  }
  const porN = new Map();
  function botillo(n) { let o = porN.get(n); if (!o) { o = hacerBotillo(n); porN.set(n, o); } o.visible = true; return o; }

  // cuerda de la grúa y gancho
  const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.8 }));
  const gancho = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 16, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 1, roughness: 0.35 }));
  cuerda.castShadow = true;
  escena.add(cuerda, gancho);

  // en el menú, dos de adorno en el plato
  const adorno = [hacerBotillo(101), hacerBotillo(102)];

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yMesa, k: m.campo.hw, D, yc: YC }); }

  let partidaVista = null;
  let golpe = { t: -1e9, h: 0 }; // para que la torre se mueva un poco al recibir uno
  let alturaAntes = 0;
  // polvo en la luz de la plaza, y lo que salta cuando un botillo cae encima de otro (solo adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 40, caja: [-1.7, 1.7, 0, 6, -0.5, 0.9], color: 0xfff0d0, tam: 0.02, opacidad: 0.4 });
  const caidosVistos = new Set();
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.35, y: 0.2, z: 1.4 }, dt, { y: v.elev });
    if (marco.partida !== partidaVista) { partidaVista = marco.partida; for (const o of porN.values()) { escena.remove(o); } porN.clear(); alturaAntes = 0; caidosVistos.clear(); }
    for (const o of porN.values()) o.visible = false;
    if (v.altura > alturaAntes) {
      golpe = { t: d.ahora, h: v.altura };
      const arriba = v.torre[v.torre.length - 1];
      if (arriba && d.estado === "juego") { // pimentón y polvo donde apoya, y un temblor (más cuanto más alta)
        fx.sacudir(0.28 + Math.min(0.3, v.altura * 0.03));
        fx.humo({ x: arriba.x, y: arriba.y + 0.02, z: 0.12, n: 3, color: 0xe2c4a8, tam: [0.08, 0.32], opacidad: 0.28, abre: 0.35, sube: 0.12 });
        fx.trozos({ x: arriba.x, y: arriba.y + 0.03, z: 0.08, ancho: 0.1, n: 7, colores: [0x8a2a1c, 0xb8431f, 0xe8d2a8], fuerza: 0.7, arriba: 1.3, tam: [0.008, 0.018], suelo: 0.005, vida: 0.9 });
      }
    }
    for (const b of v.caidos) if (!caidosVistos.has(b.n)) { caidosVistos.add(b.n); fx.sacudir(0.55); fx.humo({ x: b.x, y: b.y, z: 0.1, n: 2, color: 0xe2c4a8, tam: [0.1, 0.4], opacidad: 0.3 }); }
    alturaAntes = v.altura;
    // la torre se balancea un poco al recibir cada botillo (solo estética: cuanto más alta, más)
    const s = (d.ahora - golpe.t) / 1000;
    const vaiven = reducido || s > 1.5 ? 0 : 0.012 * Math.sin(s * 11) * Math.exp(-s * 3.5) * Math.min(1, golpe.h / 8);
    v.torre.forEach((b, i) => {
      const o = botillo(b.n);
      o.position.set(b.x + vaiven * i, b.y, 0);
      o.rotation.z = vaiven * 2;
    });
    for (const b of [...v.cayendo, ...v.caidos]) { const o = botillo(b.n); o.position.set(b.x, b.y, 0); o.rotation.z = b.giro; }
    const enMenu = !marco.partida;
    adorno.forEach((o, i) => { o.visible = enMenu; o.position.set(0.02 * i, i * ALTO_B, 0); });
    if (v.cuelga) {
      const o = enMenu ? (porN.get(-1) || (porN.set(-1, hacerBotillo(7)), porN.get(-1))) : botillo(v.cuelga.n);
      o.visible = true;
      const yC = enMenu ? v.cuelga.y + 2 * ALTO_B : v.cuelga.y;
      o.position.set(v.cuelga.x, yC, 0);
      o.rotation.z = v.cuelga.giro;
      const arriba = yC + ALTO_B * 1.12;
      const largo = 7;
      cuerda.visible = gancho.visible = true;
      cuerda.scale.y = largo; cuerda.position.set(v.cuelga.x - Math.sin(v.cuelga.giro) * 0.0, arriba + largo / 2, 0);
      gancho.position.set(v.cuelga.x, arriba, 0);
    } else cuerda.visible = gancho.visible = false;
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
