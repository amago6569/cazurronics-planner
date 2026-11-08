// La Vidriera, en 3D. Aquí solo se dibuja: qué vidriera se enciende sale de motor-vidriera.js y de la «vista» de
// juego-vidriera.js, la misma que usa el dibujo plano.
//
// El rosetón de la fachada de la Catedral: un círculo de piedra caliza con 8 vidrieras apuntadas, 8 ojos pequeños
// entre las puntas y un ojo en el centro. Cada vidriera tiene sus plomos. Al encenderse, el cristal brilla, echa un
// halo y tiñe la piedra de su color. Detrás, la foto de la fachada, desenfocada.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { COLORES, contorno } from "./juego-vidriera.js";
import { PANELES } from "./motor-vidriera.js";

const D = 4.6, YC = 0;
const R_PIEDRA = 1.12, GRUESO = 0.12;

export function crearEscena({ lienzo, contexto, foto, reducido, marco }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 30,
    cielo: { colores: [[0, "#2f6fd0"], [0.42, "#9cc0ec"], [0.5, "#efe4cf"], [0.56, "#a8987e"], [1, "#4a4036"]], luces: [{ x: 0.25, y: 0.2, r: 0.08, color: "rgba(255,250,235,1)" }], intensidad: 0.8 },
  });
  const { escena } = base;

  // ── Luz de mediodía en la fachada ──
  escena.add(new THREE.HemisphereLight(0xcfe0ff, 0x8a7a62, 0.9));
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sol.position.set(-2.5, 3.5, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 1, far: 12 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.01;
  escena.add(sol, sol.target);

  const rosa = new THREE.Group();
  escena.add(rosa);

  // ── Piedra caliza ──
  const caliza = textura(256, 256, (g, w, h) => {
    const r = ruido2d(11, 5, w, h), r2 = ruido2d(3, 32, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.84 + 0.06 * r(x, y) + 0.1 * r2(x, y);
      const i = (y * w + x) * 4;
      im.data[i] = 226 * k; im.data[i + 1] = 212 * k; im.data[i + 2] = 186 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, { repetir: true });
  caliza.repeat.set(1.5, 1.5);
  const relieve = textura(256, 256, (g, w, h) => {
    const r = ruido2d(7, 4, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 255 * r(x, y), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, { color: false, repetir: true });
  const piedra = new THREE.MeshStandardMaterial({ map: caliza, bumpMap: relieve, bumpScale: 0.3, roughness: 0.88 });

  // el disco de piedra con los huecos de las vidrieras
  const forma = new THREE.Shape();
  forma.absarc(0, 0, R_PIEDRA, 0, Math.PI * 2, false);
  const huecos = [];
  for (let i = 0; i < PANELES; i++) huecos.push(new THREE.Shape(contorno(i, 10).map(([x, y]) => new THREE.Vector2(x, y))));
  const ojos = [];
  for (let i = 0; i < PANELES; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / PANELES, x = 1.0 * Math.sin(a), y = 1.0 * Math.cos(a);
    ojos.push([x, y]);
    const h = new THREE.Shape(); h.absarc(x, y, 0.065, 0, Math.PI * 2, true); huecos.push(h);
  }
  const centro = new THREE.Shape(); centro.absarc(0, 0, 0.2, 0, Math.PI * 2, true); huecos.push(centro);
  forma.holes = huecos;
  const disco = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: GRUESO, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 48 }), piedra);
  disco.position.z = -GRUESO / 2;
  disco.castShadow = true; disco.receiveShadow = true;
  rosa.add(disco);
  // molduras: dos aros alrededor
  for (const [r, t, z] of [[R_PIEDRA + 0.02, 0.05, 0.03], [R_PIEDRA + 0.13, 0.035, 0.0]]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 96), piedra);
    aro.position.z = z; aro.castShadow = true; aro.receiveShadow = true;
    rosa.add(aro);
  }
  // el fondo detrás de los cristales: oscuro, la nave de la catedral
  const nave = new THREE.Mesh(new THREE.CircleGeometry(R_PIEDRA, 48), new THREE.MeshBasicMaterial({ color: 0x0b0710 }));
  nave.position.z = -GRUESO / 2 - 0.05;
  rosa.add(nave);

  // ── Cristales con sus plomos ──
  function plomos(semilla) {
    return textura(256, 256, (g, w, h) => {
      const s = suerteVisual(semilla), r = ruido2d(semilla, 10, w, h);
      const im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 200 + 55 * r(x, y), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      g.strokeStyle = "#17120e"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 3.5;
      // plomos: unas pocas piezas grandes (bandas suaves) y un cuadrifolio en medio
      for (let i = 1; i < 4; i++) {
        const y = (i * h) / 4 + (s() - 0.5) * 20;
        g.beginPath(); g.moveTo(-4, y); g.quadraticCurveTo(w / 2, y + (s() - 0.5) * 40, w + 4, y + (s() - 0.5) * 16); g.stroke();
      }
      for (const x of [w * 0.34, w * 0.66]) { g.beginPath(); g.moveTo(x + (s() - 0.5) * 12, -4); g.lineTo(x + (s() - 0.5) * 12, h + 4); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; g.beginPath(); g.arc(w / 2 + 17 * Math.cos(a), h / 2 + 17 * Math.sin(a), 15, 0, Math.PI * 2); g.fill(); g.stroke(); }
    });
  }
  const vidrios = [];
  for (let i = 0; i < PANELES; i++) {
    const pts = contorno(i, 10).map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
    // uv: el cristal entero ocupa la textura
    const p = geo.attributes.position, uv = geo.attributes.uv;
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const lado = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (p.getX(j) - x0) / lado, (p.getY(j) - y0) / lado);
    const color = new THREE.Color(COLORES[i]);
    const tex = plomos(31 + i * 7);
    const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.22), map: tex, emissive: color, emissiveMap: tex, emissiveIntensity: 0.1, roughness: 0.55, metalness: 0 });
    const o = new THREE.Mesh(geo, mat);
    o.position.z = -0.015;
    rosa.add(o);
    // halo: un brillo suave por delante
    const a = (i * 2 * Math.PI) / PANELES;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(0.62 * Math.sin(a), 0.62 * Math.cos(a), 0.12);
    halo.scale.setScalar(1.0);
    rosa.add(halo);
    vidrios.push({ mat, color, halo, o, base: color.clone() });
  }
  // ojos pequeños y el del centro: de adorno, se encienden todos cuando aciertas una serie
  const ojoMats = ojos.map(([x, y], i) => {
    const color = new THREE.Color(COLORES[(i + 3) % PANELES]);
    const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.5), emissive: color, emissiveIntensity: 0.2, roughness: 0.2 });
    const o = new THREE.Mesh(new THREE.CircleGeometry(0.066, 20), mat);
    o.position.set(x, y, -0.015);
    rosa.add(o);
    return mat;
  });
  const matCentro = new THREE.MeshStandardMaterial({ color: 0x4a2a6a, map: plomos(5), emissive: 0x8a4ac0, emissiveMap: plomos(5), emissiveIntensity: 0.25, roughness: 0.2 });
  const ojoCentro = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), matCentro);
  ojoCentro.position.z = -0.015;
  rosa.add(ojoCentro);

  // la luz de la vidriera encendida tiñe la piedra
  const tinte = new THREE.PointLight(0xffffff, 0, 2.2, 1.6);
  escena.add(tinte);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.cy, k: m.campo.R, D, yc: YC }); }

  const rojo = new THREE.Color(0xff2a1a), tmp = new THREE.Color();
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.3, y: 0.2, z: 0.9 }, dt);
    const fiesta = Math.max(0, 1 - (v.tj - v.completa) / 600);
    let mejor = -1, bMejor = 0;
    vidrios.forEach((c, i) => {
      const b = Math.max(v.brillo[i], v.ojo[i], fiesta * 0.55);
      const mal = v.mal[i];
      c.mat.emissive.copy(tmp.copy(c.base).lerp(rojo, mal));
      c.mat.emissiveIntensity = 0.05 + 1.6 * b + 1.2 * mal;
      c.halo.material.opacity = Math.min(1, b * 0.55);
      c.halo.scale.setScalar(0.85 + 0.35 * b);
      c.o.position.x = mal > 0 && !reducido ? Math.sin(d.ahora / 18) * 0.012 * mal : 0;
      if (b > bMejor) { bMejor = b; mejor = i; }
    });
    for (const mat of ojoMats) mat.emissiveIntensity = 0.2 + 2 * fiesta;
    matCentro.emissiveIntensity = 0.25 + 2.2 * fiesta;
    if (mejor >= 0 && bMejor > 0.05) {
      const a = (mejor * 2 * Math.PI) / PANELES;
      tinte.color.copy(vidrios[mejor].base);
      tinte.position.set(0.62 * Math.sin(a), 0.62 * Math.cos(a), 0.6);
      tinte.intensity = 2.2 * bMejor;
    } else tinte.intensity = 0;
    void marco;
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}

// halo redondo y suave (para los sprites)
const texHalo = textura(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, "rgba(255,255,255,.9)"); r.addColorStop(0.35, "rgba(255,255,255,.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
