// La trucha, en 3D. Aquí solo se dibuja: cuándo pica y cuánto tira sale de motor-trucha.js y de la «vista» de
// juego-trucha.js, la misma que usa el dibujo plano.
//
// Un río de la montaña leonesa visto desde la orilla, con la caña en la mano: agua clara que corre hacia ti sobre un
// lecho de cantos, peñas con espuma, alisos y hierba en las orillas y, detrás, la foto del valle. La boya (el buldó de
// pescar a la leonesa) se hunde cuando pica; la trucha común (lomo verdoso, flancos dorados con pintas negras y rojas)
// se ve bajo el agua, hace olas, salta y acaba en la mano.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { suerteVisual } from "./marco.js";
import { D, YC, zDe } from "./juego-trucha.js";

const RIO = 1.2; // media anchura del río junto a la cámara

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

export function crearEscena({ lienzo, contexto, foto, reducido, marco }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 60,
    cielo: { colores: [[0, "#6fa0d8"], [0.3, "#cfe0ee"], [0.47, "#f3f1de"], [0.52, "#5c8a4a"], [1, "#27402a"]], luces: [{ x: 0.62, y: 0.3, r: 0.12, color: "rgba(255,244,214,1)" }], intensidad: 1 },
  });
  const { escena } = base;
  escena.fog = new THREE.Fog(0x86a67c, 12, 40);
  const sv = suerteVisual(1915);
  const entre = (a, b) => a + (b - a) * sv();
  const pieza = new THREE.Object3D(), tinta = new THREE.Color();

  // ── Luz de tarde: el sol entra por la derecha, entre los alisos ──
  escena.add(new THREE.HemisphereLight(0xcfe4ff, 0x4f6a3a, 0.9));
  const sol = new THREE.DirectionalLight(0xfff0d0, 2.3);
  sol.position.set(4, 6, 1.5); sol.target.position.set(0, 0, -3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -5, right: 5, top: 6, bottom: -6, near: 1, far: 20 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.015;
  escena.add(sol, sol.target);

  // ── El lecho del río: cantos rodados, se ven cerca porque el agua es clara ──
  const cantos = textura(256, 256, (g, w, h) => {
    g.fillStyle = "#5d6a52"; g.fillRect(0, 0, w, h);
    const s = suerteVisual(8);
    for (let i = 0; i < 260; i++) {
      const x = s() * w, y = s() * h, r = 5 + s() * 12, k = 90 + s() * 90;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        g.fillStyle = `rgb(${k * 1.02},${k},${k * 0.86})`; g.beginPath(); g.ellipse(x + ox, y + oy, r, r * (0.6 + s() * 0.3), s() * 3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(30,40,30,.5)"; g.lineWidth = 1.5; g.stroke();
      }
    }
  }, { repetir: true });
  cantos.repeat.set(7, 12);
  const lecho = new THREE.Mesh(new THREE.PlaneGeometry(12, 22), new THREE.MeshStandardMaterial({ map: cantos, roughness: 1, color: 0x9fb4a0 }));
  lecho.rotation.x = -Math.PI / 2; lecho.position.set(0, -0.22, -8.5);
  escena.add(lecho);

  // ── El agua ──
  const ondas = textura(256, 256, (g, w, h) => {
    const a = ruidoMosaico(3, 16, w), b = ruidoMosaico(11, 32, w), c = ruidoMosaico(5, 8, w), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // alargadas a favor de la corriente
      const k = 0.5 * b(x * 2, y) + 0.35 * a(x * 2, y) + 0.15 * c(x * 2, y), i = (y * w + x) * 4, v2 = 255 * Math.min(1, Math.max(0, (k - 0.25) * 2));
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v2; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, { color: false, repetir: true });
  ondas.repeat.set(9, 14);
  const matAgua = new THREE.MeshPhysicalMaterial({ color: 0x2c6a60, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.8, bumpMap: ondas, bumpScale: 3.2, envMapIntensity: 1.5, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), matAgua);
  agua.rotation.x = -Math.PI / 2; agua.position.set(0, 0, -25.5); agua.receiveShadow = true; agua.renderOrder = 2;
  escena.add(agua);
  // reflejo del cielo que brilla a lo lejos (una mancha clara sobre el agua, río arriba)
  const brillo = new THREE.Mesh(new THREE.PlaneGeometry(9, 22), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5,
    map: textura(64, 128, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, "rgba(255,246,214,.9)"); r.addColorStop(0.5, "rgba(255,246,214,.25)"); r.addColorStop(1, "rgba(255,246,214,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); const l = g.createLinearGradient(0, 0, w, 0); l.addColorStop(0, "rgba(0,0,0,1)"); l.addColorStop(0.3, "rgba(0,0,0,0)"); l.addColorStop(0.7, "rgba(0,0,0,0)"); l.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = l; g.fillRect(0, 0, w, h); }) }));
  brillo.rotation.x = -Math.PI / 2; brillo.position.set(0.6, 0.012, -17); brillo.renderOrder = 3;
  escena.add(brillo);

  // ── Las orillas: hierba hasta el agua, con su playa de cantos ──
  const hierba = textura(256, 256, (g, w, h) => {
    const r1 = ruidoMosaico(3, 8, w), r2 = ruidoMosaico(8, 64, w), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = r2(x, y), k = 0.75 + 0.3 * r1(x, y), i = (y * w + x) * 4; im.data[i] = (70 + 50 * a) * k; im.data[i + 1] = (118 + 34 * a) * k; im.data[i + 2] = (44 + 10 * a) * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    const s = suerteVisual(5);
    for (let i = 0; i < 900; i++) { const x = s() * w, y = s() * h; g.strokeStyle = s() < 0.5 ? "rgba(160,190,90,.35)" : "rgba(40,74,30,.35)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (s() - 0.5) * 3, y - 3 - s() * 5); g.stroke(); }
  }, { repetir: true });
  hierba.repeat.set(4, 12);
  const matOrilla = new THREE.MeshStandardMaterial({ map: hierba, bumpMap: hierba, bumpScale: 0.6, roughness: 1 });
  const matPlaya = new THREE.MeshStandardMaterial({ map: cantos, roughness: 1, color: 0xd8d2c2 });
  // la orilla serpentea: xOrilla(z) da dónde acaba el agua a cada lado
  const xOrilla = (l, z) => l * (RIO + 0.16 * Math.sin(z * 0.45 + l) + Math.max(0, -z - 1) * 0.11) + 0.55 * Math.sin(z * 0.19 + 0.4) - 0.21;
  for (const l of [-1, 1]) {
    const N = 40, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const z = 2.6 - i * 0.85, x0 = xOrilla(l, z);
      // tres filas: borde en el agua, talud, y arriba en el prado
      pos.push(x0 - l * 0.12, -0.06, z, x0 + l * 0.45, 0.16, z, x0 + l * 16, 0.6 + 0.3 * Math.sin(z * 0.3), z);
      uv.push(0, i / 4, 0.12, i / 4, 1, i / 4);
      if (i < N) { const a = i * 3; for (const [p, q, r] of l < 0 ? [[a, a + 3, a + 1], [a + 1, a + 3, a + 4], [a + 1, a + 4, a + 2], [a + 2, a + 4, a + 5]] : [[a, a + 1, a + 3], [a + 1, a + 4, a + 3], [a + 1, a + 2, a + 4], [a + 2, a + 5, a + 4]]) idx.push(p, q, r); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, matOrilla); o.receiveShadow = true; escena.add(o);
    // la playa de cantos, pegada al agua
    const posP = [], uvP = [], idxP = [];
    for (let i = 0; i <= N; i++) {
      const z = 2.6 - i * 0.85, x0 = xOrilla(l, z);
      posP.push(x0 - l * 0.3, -0.1, z, x0 + l * 0.2, 0.075, z); uvP.push(0, i / 3, 0.25, i / 3);
      if (i < N) { const a = i * 2; if (l < 0) idxP.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idxP.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const gp = new THREE.BufferGeometry();
    gp.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posP), 3)); gp.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvP), 2));
    gp.setIndex(idxP); gp.computeVertexNormals();
    const playa = new THREE.Mesh(gp, matPlaya); playa.position.y = 0.012; playa.receiveShadow = true; escena.add(playa);
  }

  // al fondo el río tuerce: una ladera de hierba cierra la vista
  const ladera = new THREE.Mesh(new THREE.PlaneGeometry(60, 9, 1, 1), matOrilla);
  ladera.rotation.x = -Math.PI / 2 + 0.2; ladera.position.set(0, 0.75, -24); ladera.receiveShadow = true;
  escena.add(ladera);

  // ── Peñas en el agua (con su espuma) y cantos gordos en la orilla ──
  const granito = textura(64, 64, (g, w, h) => {
    const r = ruido2d(9, 3, w, h), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 120 + 100 * r(x, y), i = (y * w + x) * 4; im.data[i] = k; im.data[i + 1] = k * 0.99; im.data[i + 2] = k * 0.94; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  const matPena = new THREE.MeshStandardMaterial({ map: granito, bumpMap: granito, bumpScale: 2.5, roughness: 0.85, color: 0xb9b5a8 });
  const matMusgo = new THREE.MeshStandardMaterial({ color: 0x5f7f38, roughness: 1 });
  const aro = textura(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, w * 0.2, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.62, "rgba(255,255,255,0)"); r.addColorStop(0.8, "rgba(255,255,255,.95)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const espumas = [];
  const penas = [[-0.95, -1.7, 0.22], [1.0, -3.6, 0.3], [-1.2, -6.4, 0.42], [1.7, -8.8, 0.5], [-2.0, -11.5, 0.6], [0.6, -14, 0.5], [1.05, -0.5, 0.2]];
  for (const [x, z, r] of penas) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), matPena);
    o.position.set(x, -r * 0.25, z); o.scale.set(1.2, 0.62, 1); o.rotation.y = sv() * 3; o.castShadow = true; o.receiveShadow = true; escena.add(o);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 7, 5), matMusgo); m.position.set(x - r * 0.15, r * 0.02, z - r * 0.1); m.scale.set(1.1, 0.42, 0.9); escena.add(m);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: aro, transparent: true, opacity: 0.55, depthWrite: false }));
    e.rotation.x = -Math.PI / 2; e.position.set(x, 0.008, z + r * 0.15); e.renderOrder = 4; escena.add(e);
    espumas.push({ e, r, fase: sv() * 6 });
  }
  const nCantos = 46, mallaCantos = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), matPena, nCantos);
  for (let i = 0; i < nCantos; i++) {
    const l = i % 2 ? 1 : -1, z = 2 - sv() * 16, r = entre(0.05, 0.14);
    pieza.position.set(xOrilla(l, z) + l * entre(-0.2, 0.3), 0.02 + r * 0.2, z); pieza.rotation.set(0, sv() * 3, 0); pieza.scale.set(r * entre(1, 1.5), r * 0.6, r); pieza.updateMatrix();
    mallaCantos.setMatrixAt(i, pieza.matrix); const k = entre(0.7, 1.1); mallaCantos.setColorAt(i, tinta.setRGB(k, k, k * 0.96));
  }
  mallaCantos.castShadow = true; mallaCantos.receiveShadow = true; escena.add(mallaCantos);

  // ── Alisos y chopos en las orillas, juncos junto al agua ──
  const tronco = new THREE.MeshStandardMaterial({ color: 0x4f4034, roughness: 0.95 });
  const hojas = [0x3f6f2e, 0x4c7d33, 0x335f2a, 0x5a8a38].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  const arboles = [];
  for (let i = 0; i < 26; i++) {
    const alFondo = i >= 18, l = i % 2 ? 1 : -1, z = alFondo ? -20.5 - sv() * 2.5 : 0.2 - i * 1.15 - sv() * 0.6, x = alFondo ? (i - 22) * 2.3 + entre(-0.6, 0.6) : xOrilla(l, z) + l * entre(0.75, 2.2), s = alFondo ? entre(1.5, 2.2) : entre(0.9, 1.6), chopo = sv() < 0.35;
    const o = new THREE.Group(); o.position.set(x, alFondo ? 0.3 : 0.2, z); o.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 6), tronco); t.position.y = 0.55; t.castShadow = true; o.add(t);
    const copa = chopo ? [[0, 1.7, 0, 0.42, 2.6], [0.05, 2.5, 0, 0.3, 2.2]] : [[0, 1.45, 0, 0.62, 0.9], [0.4, 1.2, 0.1, 0.42, 0.85], [-0.38, 1.25, -0.1, 0.45, 0.85], [0.05, 1.9, 0.05, 0.42, 0.9], [-0.1, 1.1, 0.35, 0.38, 0.8]];
    for (const [cx, cy, cz, r, ay] of copa) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), hojas[Math.floor(sv() * 4)]); c.position.set(cx, cy, cz); c.scale.y = ay; c.castShadow = true; o.add(c); }
    escena.add(o); arboles.push({ o, fase: sv() * 6 });
  }
  const nJuncos = 120, juncos = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 0.42, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), nJuncos);
  for (let i = 0; i < nJuncos; i++) {
    const l = i % 2 ? 1 : -1, grupo = Math.floor(i / 10), z = 1.6 - grupo * 1.15 - sv() * 0.5;
    pieza.position.set(xOrilla(l, z) + l * entre(0.0, 0.3), 0.2, z + entre(-0.15, 0.15)); pieza.rotation.set(entre(-0.15, 0.15), 0, entre(-0.2, 0.2)); pieza.scale.set(1, entre(0.6, 1.3), 1); pieza.updateMatrix();
    juncos.setMatrixAt(i, pieza.matrix); juncos.setColorAt(i, tinta.setRGB(entre(0.25, 0.4), entre(0.45, 0.6), entre(0.12, 0.2)));
  }
  juncos.castShadow = true; escena.add(juncos);

  // ── La caña: tramos finos que se doblan con la tensión, con sus anillas, el corcho y el carrete ──
  const TRAMOS = 14;
  const matCana = new THREE.MeshPhysicalMaterial({ color: 0x2c2218, roughness: 0.35, clearcoat: 0.8 });
  const geoTramo = new THREE.CylinderGeometry(1, 1, 1, 7); geoTramo.translate(0, 0.5, 0);
  const cana = new THREE.InstancedMesh(geoTramo, matCana, TRAMOS); cana.frustumCulled = false; cana.castShadow = true;
  escena.add(cana);
  const anillas = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.22, 5, 10), new THREE.MeshStandardMaterial({ color: 0xb9b9b9, metalness: 1, roughness: 0.3 }), 4); anillas.frustumCulled = false;
  escena.add(anillas);
  const mango = new THREE.Group(); escena.add(mango);
  const corcho = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0xc9a472, roughness: 0.9 })); corcho.position.y = 0.17; mango.add(corcho);
  const carrete = new THREE.Group(); carrete.position.set(-0.05, 0.3, 0); mango.add(carrete);
  const cuerpoCarrete = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.035, 18), new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.9, roughness: 0.3 })); cuerpoCarrete.rotation.z = Math.PI / 2; carrete.add(cuerpoCarrete);
  const manivela = new THREE.Group(); manivela.position.x = -0.024; carrete.add(manivela);
  const brazoM = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.012), new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.9, roughness: 0.35 })); brazoM.position.y = 0.025; manivela.add(brazoM);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1f1a16, roughness: 0.5 })); pomo.position.set(-0.012, 0.058, 0); manivela.add(pomo);
  const PIE = new THREE.Vector3(0.36, 0.86, 2.5), PUNTA0 = new THREE.Vector3(0.1, 1.62, 1.1); // el mango (fuera de la pantalla, abajo a la derecha) y la punta en reposo
  const puntaV = new THREE.Vector3(), control = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), dir = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), hacia = new THREE.Vector3();
  const enCurva = (u, out) => { const k = 1 - u; return out.set(k * k * PIE.x + 2 * k * u * control.x + u * u * puntaV.x, k * k * PIE.y + 2 * k * u * control.y + u * u * puntaV.y, k * k * PIE.z + 2 * k * u * control.z + u * u * puntaV.z); };

  // ── La boya (buldó): media bola roja y media blanca, con su antena ──
  const boya = new THREE.Group(); escena.add(boya);
  const rojo = new THREE.MeshPhysicalMaterial({ color: 0xe0352b, roughness: 0.3, clearcoat: 0.8 }), blancoB = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ea, roughness: 0.3, clearcoat: 0.8 });
  const mitadA = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), rojo); boya.add(mitadA);
  const mitadB = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), blancoB); boya.add(mitadB);
  const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5), rojo); antena.position.y = 0.14; boya.add(antena);
  boya.traverse((x) => { if (x.isMesh) x.castShadow = true; });

  // ── Ondas en el agua: aros que crecen y se apagan ──
  const aros = Array.from({ length: 12 }, () => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: aro, transparent: true, opacity: 0, depthWrite: false }));
    o.rotation.x = -Math.PI / 2; o.visible = false; o.renderOrder = 5; escena.add(o);
    return { o, vida: 0, total: 1, r0: 0.1, r1: 1, op: 0.8 };
  });
  let sigAro = 0;
  const onda = (x, z, r1 = 0.9, vida = 1.1, op = 0.8, r0 = 0.08) => {
    const a = aros[sigAro++ % aros.length];
    a.o.position.set(x, 0.01, z); a.vida = a.total = vida; a.r0 = r0; a.r1 = r1; a.op = op; a.o.visible = true;
  };

  // ── La trucha común ──
  const pielTrucha = textura(256, 128, (g, w, h) => {
    // de arriba (lomo) a abajo (vientre): verde oliva, dorado, crema
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#3d4a2a"); gr.addColorStop(0.28, "#6f7038"); gr.addColorStop(0.5, "#b8983f"); gr.addColorStop(0.72, "#d8c078"); gr.addColorStop(1, "#efe6c8");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const s = suerteVisual(62);
    for (let i = 0; i < 70; i++) { // pintas negras, más en el lomo
      const x = 20 + s() * (w - 50), y = 6 + s() * s() * h * 0.62, r = 2 + s() * 2.6;
      g.fillStyle = "rgba(230,214,150,.55)"; g.beginPath(); g.arc(x, y, r + 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1c1a12"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 16; i++) { // pintas rojas con su halo, en los flancos
      const x = 40 + s() * (w - 90), y = h * (0.4 + s() * 0.25), r = 2.4 + s() * 1.4;
      g.fillStyle = "rgba(240,230,190,.8)"; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c2321f"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
  function hacerTrucha() {
    const o = new THREE.Group();
    // el cuerpo: una esfera estirada, con la piel de lado a lado (la textura da la vuelta por el lomo)
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // z = a lo largo (cabeza +z). Más fina hacia la cola, cabeza roma
      const estrecha = z < 0 ? 1 - 0.55 * z * z : 1 - 0.2 * z * z;
      p.setXYZ(i, x * 0.115 * estrecha, y * 0.16 * estrecha + 0.012 * (1 - z * z), z * 0.5);
      uv.setXY(i, 0.5 - z * 0.5, 0.5 + y * 0.5);
    }
    geo.computeVertexNormals();
    const piel = new THREE.MeshPhysicalMaterial({ map: pielTrucha, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2 });
    const cuerpo = new THREE.Mesh(geo, piel); o.add(cuerpo);
    const matAleta = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const forma = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); return new THREE.ShapeGeometry(s); };
    // la cola (gira aparte, para colear)
    const cola = new THREE.Group(); cola.position.z = -0.46; o.add(cola);
    const colaM = new THREE.Mesh(forma([[0, 0.02], [-0.17, 0.13], [-0.13, 0], [-0.17, -0.13], [0, -0.02]]), matAleta); colaM.rotation.y = -Math.PI / 2; cola.add(colaM);
    // aletas: dorsal, adiposa, pectorales, anal
    const dorsal = new THREE.Mesh(forma([[0, 0], [-0.03, 0.075], [-0.14, 0.05], [-0.15, 0]]), matAleta); dorsal.rotation.y = -Math.PI / 2; dorsal.position.set(0, 0.155, 0.08); o.add(dorsal);
    const adiposa = new THREE.Mesh(forma([[0, 0], [-0.02, 0.03], [-0.05, 0]]), matAleta); adiposa.rotation.y = -Math.PI / 2; adiposa.position.set(0, 0.105, -0.26); o.add(adiposa);
    const anal = new THREE.Mesh(forma([[0, 0], [-0.02, -0.06], [-0.09, -0.035], [-0.1, 0]]), matAleta); anal.rotation.y = -Math.PI / 2; anal.position.set(0, -0.09, -0.2); o.add(anal);
    for (const l of [-1, 1]) {
      const pec = new THREE.Mesh(forma([[0, 0], [-0.1, -0.03], [-0.08, -0.07], [-0.01, -0.03]]), matAleta); pec.rotation.set(0, -Math.PI / 2, 0); pec.rotation.z = l * 0.7; pec.position.set(l * 0.07, -0.08, 0.24); o.add(pec);
      const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0x0c0a08, roughness: 0.1, clearcoat: 1 })); ojo.position.set(l * 0.078, 0.035, 0.36); o.add(ojo);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 0.3 })); iris.position.set(l * 0.07, 0.035, 0.358); o.add(iris);
    }
    o.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    escena.add(o);
    return { o, cola, cuerpo };
  }
  const trucha = hacerTrucha(); // la del agua
  const trofeo = hacerTrucha(); trofeo.o.visible = false; // la que sale

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yAgua, k: m.campo.hw, D, yc: YC }); }

  // brillos del sol en el agua, mosquitos sobre la corriente y salpicaduras (adorno)
  const fx = base.efectos;
  fx.ponerMotas({ n: 60, caja: [-2.2, 2.2, 0.012, 0.05, -11, 0.5], color: 0xfff6d8, tam: 0.05, opacidad: 0.75, cae: 0, viento: 0.01 });
  const salpica = (x, z, f = 1) => {
    fx.trozos({ x, y: 0.03, z, ancho: 0.08 * f, n: Math.round(14 * f), colores: [0xffffff, 0xdff3f0, 0xbfe6e2], fuerza: 0.7 * f, arriba: 1.9 * f, tam: [0.008, 0.022], gravedad: 6, vida: 0.7, suelo: -0.05 });
    fx.humo({ x, y: 0.06, z, n: 3, color: 0xffffff, tam: [0.08, 0.45 * f], opacidad: 0.45, abre: 0.3, sube: 0.35, vida: 0.5 });
    onda(x, z, 1.1 * f, 1.2, 0.85); onda(x, z, 0.6 * f, 0.8, 0.6);
  };
  let dobla = 0, giroManivela = 0, estela = 0, rumbo = 0, xAntes = 0, zAntes = 0, enElAire = false, aroBoya = 0;
  const pantalla = new THREE.Vector3();
  const aPixeles = (v3, m) => { pantalla.copy(v3).project(base.camara); return { x: (pantalla.x * 0.5 + 0.5) * m.ancho, y: (-pantalla.y * 0.5 + 0.5) * m.alto }; };

  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    const s = reducido ? 0 : v.s;
    base.moverCamara(d, { x: 0.3, y: 0.12, z: 0.7 }, dt);
    // el agua corre hacia ti; las espumas de las peñas laten
    ondas.offset.y = (s * 0.11) % 1; ondas.offset.x = Math.sin(s * 0.13) * 0.04;
    cantos.offset.y = 0;
    for (const e of espumas) { const k = 1 + 0.08 * Math.sin(s * 2.2 + e.fase); e.e.scale.set(e.r * 3.3 * k, e.r * 3.6 * k, 1); e.e.material.opacity = 0.42 + 0.14 * Math.sin(s * 1.7 + e.fase); }
    for (const a of arboles) a.o.rotation.z = 0.02 * Math.sin(s * 0.9 + a.fase);
    brillo.material.opacity = 0.42 + 0.08 * Math.sin(s * 0.6);
    // lo que acaba de pasar
    for (const e of v.recientes) {
      if (e.visto) continue;
      e.visto = true;
      if (e.tipo === "pica" && v.boya) { salpica(v.boya.x, v.boya.z, 0.7); fx.sacudir(0.25); }
      else if (e.tipo === "amago" && v.boya) onda(v.boya.x, v.boya.z, 0.5, 0.8, 0.6);
      else if (e.tipo === "falso" && v.boya) onda(v.boya.x, v.boya.z, 0.6, 0.7, 0.6);
      else if (e.tipo === "clavada") { fx.sacudir(0.35); if (v.boya) salpica(v.boya.x, v.boya.z, 0.9); }
      else if (e.tipo === "arreon" && v.pez) { salpica(v.pez.x, v.pez.z, 0.8); fx.sacudir(0.2); }
      else if (e.tipo === "rota") fx.sacudir(0.8);
      else if (e.tipo === "trucha") { salpica(xAntes, -0.5, 1.2); fx.sacudir(0.4); }
    }
    for (const a of aros) {
      if (a.vida <= 0) { if (a.o.visible) a.o.visible = false; continue; }
      a.vida -= dt;
      const u = 1 - Math.max(0, a.vida / a.total), r = a.r0 + (a.r1 - a.r0) * (1 - (1 - u) * (1 - u));
      a.o.scale.set(r * 2, r * 2, 1); a.o.material.opacity = a.op * (1 - u) * (1 - u);
    }

    // ── la boya ──
    const hayBoya = Boolean(v.boya) && !v.sacada && (v.estado === "espera" || v.estado === "pelea");
    boya.visible = hayBoya;
    if (hayBoya) {
      const b = v.boya, vuelo = b.vuelo ?? 1;
      const flota = 0.012 * Math.sin(s * 2.6) - b.hunde * 0.13;
      if (vuelo < 1) { // viene volando desde la punta de la caña
        const u = vuelo, alto = Math.sin(u * Math.PI) * 0.9;
        boya.position.set(PUNTA0.x + (b.x - PUNTA0.x) * u, PUNTA0.y * (1 - u) + alto * (1 - u * 0.4), PUNTA0.z + (b.z - PUNTA0.z) * u);
        dibujar.cayo = false;
      } else {
        if (dibujar.cayo === false) { dibujar.cayo = true; onda(b.x, b.z, 0.7, 1, 0.8); fx.trozos({ x: b.x, y: 0.02, z: b.z, n: 6, colores: [0xffffff, 0xdff3f0], fuerza: 0.35, arriba: 0.9, tam: [0.006, 0.014], vida: 0.5, suelo: -0.05 }); }
        boya.position.set(b.x, flota, b.z);
      }
      boya.rotation.z = 0.12 * Math.sin(s * 1.9) + (v.estado === "pelea" ? 0.5 : 0) + b.hunde * 0.3; boya.rotation.x = 0.08 * Math.sin(s * 2.3);
      // ondas suaves alrededor mientras espera
      aroBoya -= dt;
      if (aroBoya <= 0 && vuelo >= 1 && v.estado === "espera" && !v.menu) { aroBoya = b.pica > 0 ? 0.16 : 1.6; onda(b.x, b.z, b.pica > 0 ? 0.75 : 0.45, b.pica > 0 ? 0.6 : 1.6, b.pica > 0 ? 0.9 : 0.35); }
      else if (aroBoya <= 0 && v.menu) { aroBoya = 2.2; onda(b.x, b.z, 0.45, 1.8, 0.3); }
    }

    // ── la trucha en el agua ──
    const hayPez = Boolean(v.pez) && !v.sacada;
    trucha.o.visible = hayPez;
    if (hayPez) {
      const p = v.pez, E = (p.cm / 50) * 1.3; // en el agua se ve algo mayor de lo que es, para que se lea bien
      const vx = (p.x - xAntes) / Math.max(dt, 0.001), vz = (p.z - zAntes) / Math.max(dt, 0.001);
      if (Math.abs(vx) + Math.abs(vz) > 0.05) { let da = Math.atan2(vx, vz + (v.apretado ? 0.4 : -0.6)) - rumbo; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; rumbo += da * Math.min(1, dt * 5); }
      let y = -0.055, cabeceo = 0;
      const colea = (p.arreon ? 22 : 9 + p.tira * 8);
      if (p.salto >= 0) { // salta: sale, se arquea y cae
        const u = p.salto; y = -0.055 + Math.sin(u * Math.PI) * 0.62 * Math.min(1.2, E); cabeceo = (0.5 - u) * 2.2;
        if (!enElAire) { enElAire = true; salpica(p.x, p.z, 0.9); }
      } else if (enElAire) { enElAire = false; salpica(p.x, p.z, 1.1); fx.sacudir(0.3); }
      trucha.o.position.set(p.x, y, p.z);
      trucha.o.rotation.set(-cabeceo, rumbo, 0.25 * Math.sin(s * colea * 0.5));
      trucha.o.scale.setScalar(E);
      trucha.cola.rotation.y = 0.6 * Math.sin(s * colea);
      // la estela en la superficie
      estela -= dt;
      if (estela <= 0 && p.salto < 0) { estela = p.arreon ? 0.09 : 0.3; onda(p.x, p.z, p.arreon ? 0.7 : 0.4, p.arreon ? 0.7 : 1, p.arreon ? 0.7 : 0.4); }
      xAntes = p.x; zAntes = p.z;
    } else enElAire = false;

    // ── la que sale: del agua a la mano, coleando ──
    trofeo.o.visible = Boolean(v.sacada);
    if (v.sacada) {
      const k = v.sacada.k, sube = Math.min(1, k / 0.3), cae = Math.max(0, (k - 0.82) / 0.18);
      const u = 1 - (1 - sube) * (1 - sube), E = (v.sacada.cm / 50) * 0.72;
      trofeo.o.position.set(xAntes * (1 - u) + 0.02 * u, -0.1 + 1.42 * u - cae * cae * 0.9, -0.5 + 1.95 * u);
      trofeo.o.rotation.set(0.25 * Math.sin(s * 15) * (1 - cae), Math.PI / 2 + 0.25 * Math.sin(s * 13), 0.2 * Math.sin(s * 17));
      trofeo.o.scale.setScalar(E);
      trofeo.cola.rotation.y = 0.75 * Math.sin(s * 24);
      if (!dibujar.gotas || d.ahora - dibujar.gotas > 90) { dibujar.gotas = d.ahora; fx.trozos({ x: trofeo.o.position.x, y: trofeo.o.position.y - 0.08, z: trofeo.o.position.z, ancho: 0.15, n: 2, colores: [0xffffff, 0xcfeeea], fuerza: 0.12, arriba: 0.1, tam: [0.005, 0.011], gravedad: 5, vida: 0.6 }); }
    }

    // ── la caña: se dobla hacia donde tira el sedal ──
    const quiere = v.estado === "pelea" ? Math.min(1.15, v.tension) : v.sacada ? 0.5 : v.boya && v.boya.pica > 0 ? 0.25 : 0.06;
    dobla += (quiere - dobla) * Math.min(1, dt * 9);
    const tiembla = v.estado === "pelea" && v.tension > 0.86 && !reducido ? Math.sin(d.ahora / 17) * 0.012 * (v.tension - 0.86) * 8 : 0;
    const objetivo = v.sacada ? trofeo.o.position : hayBoya ? boya.position : null;
    puntaV.copy(PUNTA0);
    if (objetivo) { hacia.copy(objetivo).sub(PUNTA0).normalize(); puntaV.addScaledVector(hacia, 0.5 * dobla); puntaV.y -= 0.12 * dobla; }
    puntaV.x += tiembla; puntaV.y += 0.008 * Math.sin(s * 1.4);
    // el punto de control: la caña sale recta del mango y se curva hacia la punta
    control.copy(PUNTA0).sub(PIE).multiplyScalar(0.62).add(PIE); control.y += 0.1 * dobla;
    for (let i = 0; i < TRAMOS; i++) {
      enCurva(i / TRAMOS, a3); enCurva((i + 1) / TRAMOS, b3);
      dir.copy(b3).sub(a3); const largo = dir.length(); q.setFromUnitVectors(arriba, dir.normalize());
      const r = 0.017 - 0.0135 * (i / TRAMOS);
      pieza.position.copy(a3); pieza.quaternion.copy(q); pieza.scale.set(r, largo * 1.02, r); pieza.updateMatrix();
      cana.setMatrixAt(i, pieza.matrix);
      if (i === 0) { mango.position.copy(a3).addScaledVector(dir, -0.3); mango.quaternion.copy(q); }
      if (i % 3 === 2 && (i - 2) / 3 < 4) { pieza.position.copy(b3); pieza.scale.setScalar(0.014 - i * 0.0006); pieza.updateMatrix(); anillas.setMatrixAt((i - 2) / 3, pieza.matrix); }
    }
    cana.instanceMatrix.needsUpdate = true; anillas.instanceMatrix.needsUpdate = true;
    pieza.rotation.set(0, 0, 0);
    if (v.estado === "pelea" && v.apretado) giroManivela += dt * 16; else if (v.estado === "pelea") giroManivela -= dt * 9 * Math.min(1, v.tension * 2);
    manivela.rotation.x = giroManivela;
    // para el sedal (que se pinta encima, en plano): dónde caen en la pantalla la punta y la boya
    if (d.enlace) {
      d.enlace.punta = aPixeles(puntaV, marco);
      if (v.sacada) { a3.copy(trofeo.o.position); a3.y += 0.02; d.enlace.boya = aPixeles(a3, marco); }
      else if (hayBoya) { a3.copy(boya.position); a3.y += 0.02; d.enlace.boya = aPixeles(a3, marco); }
      else d.enlace.boya = null;
    }
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
