// Los maragatos del reloj, en 3D. Aquí solo se dibuja: los mazazos y las campanadas salen de motor-maragatos.js y de
// la «vista» de juego-maragatos.js. Las marcas que bajan las pinta el juego encima, en plano.
//
// Lo alto del Ayuntamiento de Astorga al caer la tarde: la piedra dorada, la cornisa con su balaustrada, el reloj, la
// campana colgada de su yugo de hierro y, a los lados, los dos maragatos con el mazo: él, de sombrero, chaleco y
// bragas negras con la faja roja; ella, con el manteo, el mandil y el pañuelo. A los lados, las dos torres de pizarra.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { crearPersona } from "./comun-3d.js";

const D = 6.8, YC = 1.5;
const CORNISA = 1.08, EJE = 2.02, ALTO_FIG = 0.66;

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 50,
    cielo: { colores: [[0, "#2f4a86"], [0.38, "#d08a72"], [0.5, "#ffd9a0"], [0.56, "#8a6a52"], [1, "#3a2c22"]], luces: [{ x: 0.72, y: 0.4, r: 0.12, color: "rgba(255,196,128,1)" }], intensidad: 0.95 },
  });
  const { escena } = base;

  escena.add(new THREE.HemisphereLight(0xb8c8f0, 0x6a5040, 0.8));
  const sol = new THREE.DirectionalLight(0xffc98a, 2.8);
  sol.position.set(4, 3.2, 4.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2, near: 1, far: 16 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.012;
  sol.target.position.set(0, 1.2, 0);
  escena.add(sol, sol.target);
  const frio = new THREE.DirectionalLight(0x9ab4ff, 0.55); frio.position.set(-4, 2.5, 2); escena.add(frio);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };

  // ── La piedra: sillares dorados ──
  const sillares = textura(256, 256, (g, w, h) => {
    const r = ruido2d(5, 6, w, h), r2 = ruido2d(11, 48, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.8 + 0.14 * r(x, y) + 0.12 * r2(x, y), i = (y * w + x) * 4; im.data[i] = 214 * k; im.data[i + 1] = 184 * k; im.data[i + 2] = 136 * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    g.strokeStyle = "rgba(90,66,40,.5)"; g.lineWidth = 2;
    for (let f = 0; f < 4; f++) { g.beginPath(); g.moveTo(0, f * 64); g.lineTo(w, f * 64); g.stroke(); for (let c = 0; c < 2; c++) { const x = c * 128 + (f % 2) * 64; g.beginPath(); g.moveTo(x, f * 64); g.lineTo(x, f * 64 + 64); g.stroke(); } }
  }, { repetir: true });
  const piedra = (rx, ry) => { const t = sillares.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return M(0xffffff, { map: t, bumpMap: t, bumpScale: 0.8, roughness: 0.9 }); };
  const lisa = M(0xd9bf8e, { roughness: 0.85 }), sombra = M(0xb89c6c, { roughness: 0.9 });

  // el paño de la fachada y la cornisa
  const muro = pon(new THREE.BoxGeometry(7, 3.2, 0.5), piedra(7, 3.2), 0, CORNISA - 1.6 - 0.08, -0.5); muro.receiveShadow = true;
  const cornisa = pon(new THREE.BoxGeometry(7.2, 0.09, 0.95), lisa, 0, CORNISA - 0.045, -0.28); cornisa.castShadow = true; cornisa.receiveShadow = true;
  pon(new THREE.BoxGeometry(7.1, 0.07, 0.8), sombra, 0, CORNISA - 0.12, -0.33);
  // balaustrada a los lados (deja libre el centro, donde están ellos)
  const geoBal = new THREE.LatheGeometry([[0.001, 0], [0.03, 0], [0.034, 0.02], [0.016, 0.05], [0.036, 0.1], [0.03, 0.15], [0.014, 0.19], [0.03, 0.22], [0.001, 0.22]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
  for (const l of [-1, 1]) {
    for (let i = 0; i < 9; i++) { const b = pon(geoBal, lisa, l * (1.02 + i * 0.13), CORNISA, 0.08); b.castShadow = true; }
    pon(new THREE.BoxGeometry(1.2, 0.035, 0.09), lisa, l * 1.54, CORNISA + 0.235, 0.08).castShadow = true;
    const pil = pon(new THREE.BoxGeometry(0.1, 0.3, 0.1), lisa, l * 0.92, CORNISA + 0.15, 0.08); pil.castShadow = true;
    pon(new THREE.SphereGeometry(0.045, 10, 8), lisa, l * 0.92, CORNISA + 0.34, 0.08);
  }

  // ── El reloj ──
  const esfera = textura(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#f4efe2"; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#b08a3c"; g.lineWidth = 10; g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#1c1814"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 26px Georgia, serif";
    const R = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    R.forEach((n, i) => { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(c + Math.sin(a) * (c - 40), c - Math.cos(a) * (c - 40)); g.rotate(a); g.fillText(n, 0, 0); g.restore(); });
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, l = i % 5 ? 5 : 11; g.fillRect(c + Math.sin(a) * (c - 20) - 1, c - Math.cos(a) * (c - 20) - 1, 2, 2 + (l > 5 ? 2 : 0)); }
  });
  const marco = pon(new THREE.TorusGeometry(0.31, 0.03, 10, 40), lisa, 0, 0.42, -0.22); marco.castShadow = true;
  pon(new THREE.CircleGeometry(0.3, 40), M(0xffffff, { map: esfera, roughness: 0.5 }), 0, 0.42, -0.235);
  const hierro = M(0x1c1a18, { roughness: 0.5, metalness: 0.6 });
  const aguja = (largo, ancho) => { const g = new THREE.Group(); g.position.set(0, 0.42, -0.22); escena.add(g); const geo = new THREE.BoxGeometry(ancho, largo, 0.008); geo.translate(0, largo / 2 - 0.02, 0); g.add(new THREE.Mesh(geo, hierro)); return g; };
  const minutero = aguja(0.25, 0.016), horario = aguja(0.16, 0.024);
  pon(new THREE.SphereGeometry(0.018, 10, 8), M(0xb08a3c, { metalness: 1, roughness: 0.3 }), 0, 0.42, -0.21);
  // las dos ventanas con frontón, debajo de los aros
  for (const l of [-1, 1]) {
    pon(new THREE.BoxGeometry(0.34, 0.6, 0.04), M(0x2a2622, { roughness: 0.4 }), l * 1.45, 0.28, -0.24);
    pon(new THREE.BoxGeometry(0.44, 0.05, 0.1), lisa, l * 1.45, 0.61, -0.22); pon(new THREE.BoxGeometry(0.44, 0.05, 0.1), lisa, l * 1.45, -0.04, -0.22);
  }

  // ── La campana, colgada de su yugo de hierro sobre dos pilastras ──
  for (const l of [-1, 1]) { const p = pon(new THREE.BoxGeometry(0.1, 1.12, 0.14), lisa, l * 0.98, CORNISA + 0.56, -0.3); p.castShadow = true; }
  const arco = pon(new THREE.TorusGeometry(0.98, 0.028, 8, 40, Math.PI), hierro, 0, CORNISA + 1.12, -0.3); arco.castShadow = true;
  // volutas de forja y la veleta
  for (const l of [-1, 1]) { const v = pon(new THREE.TorusGeometry(0.11, 0.012, 6, 20, Math.PI * 1.5), hierro, l * 0.62, CORNISA + 1.72, -0.3); v.rotation.z = l > 0 ? 0.6 : Math.PI - 0.6 - Math.PI * 1.5; }
  pon(new THREE.CylinderGeometry(0.01, 0.012, 0.42, 6), hierro, 0, CORNISA + 2.3, -0.3);
  const veleta = new THREE.Group(); veleta.position.set(0, CORNISA + 2.46, -0.3); escena.add(veleta);
  { const f = new THREE.Shape(); f.moveTo(-0.16, 0); f.lineTo(0.02, 0.012); f.lineTo(0.02, 0.05); f.lineTo(0.14, 0); f.lineTo(0.02, -0.05); f.lineTo(0.02, -0.012); f.closePath(); veleta.add(new THREE.Mesh(new THREE.ShapeGeometry(f), M(0x1c1a18, { side: THREE.DoubleSide }))); }
  const yugo = pon(new THREE.BoxGeometry(0.5, 0.07, 0.09), M(0x4a3420, { roughness: 0.7 }), 0, EJE + 0.035, -0.02); yugo.castShadow = true;
  for (const l of [-1, 1]) pon(new THREE.CylinderGeometry(0.012, 0.012, CORNISA + 2.1 - EJE, 6), hierro, l * 0.2, (EJE + CORNISA + 2.1) / 2, -0.06);
  const campana = new THREE.Group(); campana.position.set(0, EJE, -0.02); escena.add(campana);
  const bronce = M(0xb5822e, { metalness: 1, roughness: 0.34 });
  const perfil = [[0.03, 0], [0.09, -0.01], [0.13, -0.06], [0.15, -0.16], [0.17, -0.3], [0.2, -0.4], [0.255, -0.47], [0.27, -0.5], [0.25, -0.5], [0.2, -0.45]];
  const cuerpo = new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 28), bronce); cuerpo.castShadow = true; campana.add(cuerpo);
  bronce.side = THREE.DoubleSide;
  for (const y of [-0.12, -0.42]) { const a = pon(new THREE.TorusGeometry(y < -0.3 ? 0.228 : 0.142, 0.006, 6, 28), M(0xd9a94a, { metalness: 1, roughness: 0.25 }), 0, y, 0, campana); a.rotation.x = Math.PI / 2; }
  const badajo = new THREE.Group(); badajo.position.y = -0.06; campana.add(badajo);
  pon(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), hierro, 0, -0.18, 0, badajo); pon(new THREE.SphereGeometry(0.034, 10, 8), hierro, 0, -0.38, 0, badajo);

  // ── Las torres de los lados, con su chapitel de pizarra ──
  const pizarra = M(0x3a4250, { roughness: 0.55, metalness: 0.2 });
  for (const l of [-1, 1]) {
    const t = new THREE.Group(); t.position.set(l * 2.75, 0, -0.9); escena.add(t);
    const c = pon(new THREE.BoxGeometry(1.1, 4.6, 1.1), piedra(1.1, 4.6), 0, 0.4, 0, t); c.castShadow = true;
    pon(new THREE.BoxGeometry(1.24, 0.1, 1.24), lisa, 0, 2.72, 0, t);
    pon(new THREE.BoxGeometry(0.3, 0.62, 0.04), M(0x2a2622), 0, 1.9, 0.56, t);
    const ch = pon(new THREE.ConeGeometry(0.82, 1.5, 4), pizarra, 0, 3.52, 0, t); ch.rotation.y = Math.PI / 4; ch.castShadow = true;
    pon(new THREE.SphereGeometry(0.06, 10, 8), M(0xb08a3c, { metalness: 1, roughness: 0.3 }), 0, 4.3, 0, t);
    pon(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), hierro, 0, 4.48, 0, t);
  }

  // ── Los maragatos ──
  const mazoDe = (padre) => {
    const g = new THREE.Group(); g.position.y = -0.17; padre.add(g);
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6), M(0x6a4426)); mango.position.y = -0.13; g.add(mango);
    const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.11, 10), hierro); cabeza.rotation.x = Math.PI / 2; cabeza.position.y = -0.27; cabeza.castShadow = true; g.add(cabeza);
    return g;
  };
  function figura(lado) {
    const ella = lado > 0;
    const p = crearPersona(ella
      ? { camisa: 0x1c1a18, mangas: 0xefe9de, pantalon: 0x8f1d24, medias: 0xefe9de, pelo: 0x2a1c12, calzado: 0x1c1612 }
      : { camisa: 0xefe9de, chaleco: 0x1c1a18, faja: 0xb3121e, pantalon: 0x1c1a18, medias: 0xefe9de, pelo: 0x2a1c12, calzado: 0x1c1612 });
    p.grupo.scale.setScalar(ALTO_FIG);
    p.grupo.position.set(lado * 0.56, CORNISA, 0.02);
    p.grupo.rotation.y = -lado * 1.05; // de medio lado, hacia la campana
    escena.add(p.grupo);
    if (ella) {
      // manteo (la falda de paño rojo con su ribete), mandil negro bordado, dengue cruzado y pañuelo
      const falda = p.pon(new THREE.CylinderGeometry(0.1, 0.2, 0.42, 16, 1, true), M(0x8f1d24, { roughness: 0.9, side: THREE.DoubleSide }), 0, -0.2, 0, p.cadera); falda.castShadow = true;
      const rib = p.pon(new THREE.TorusGeometry(0.196, 0.012, 6, 20), M(0x1c1a18), 0, -0.4, 0, p.cadera); rib.rotation.x = Math.PI / 2;
      p.pon(new THREE.BoxGeometry(0.14, 0.3, 0.01), M(0x15120f), 0, -0.2, 0.145, p.cadera).rotation.x = -0.24;
      p.pon(new THREE.BoxGeometry(0.1, 0.02, 0.012), M(0xe9b44c), 0, -0.3, 0.165, p.cadera);
      const dengue = p.pon(new THREE.TorusGeometry(0.095, 0.03, 6, 16), M(0xe9b44c, { roughness: 0.85 }), 0, 0.24, 0, p.torso); dengue.rotation.x = Math.PI / 2 - 0.5; dengue.scale.set(1.1, 0.8, 1);
      const pan = p.pon(new THREE.SphereGeometry(0.075, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0xb3121e, { roughness: 0.85 }), 0, 0.012, -0.012, p.cabeza); pan.scale.set(1, 1.05, 1.08);
      p.pon(new THREE.ConeGeometry(0.03, 0.09, 6), M(0xb3121e), 0, -0.05, -0.07, p.cabeza).rotation.x = 2.4;
    } else {
      // sombrero de ala ancha, bragas (los calzones anchos) y el chaleco con botonadura
      p.pon(new THREE.CylinderGeometry(0.125, 0.125, 0.012, 20), M(0x151311), 0, 0.058, 0, p.cabeza);
      p.pon(new THREE.CylinderGeometry(0.06, 0.068, 0.07, 16), M(0x151311), 0, 0.097, 0, p.cabeza);
      p.pon(new THREE.CylinderGeometry(0.069, 0.069, 0.014, 16), M(0xb3121e), 0, 0.07, 0, p.cabeza);
      p.piernas.forEach((q) => { const b = p.pon(new THREE.SphereGeometry(0.075, 12, 10), M(0x1c1a18, { roughness: 0.9 }), 0, -0.15, 0, q.cadera); b.scale.set(1, 1.5, 1.05); b.castShadow = true; });
      for (let i = 0; i < 4; i++) p.pon(new THREE.SphereGeometry(0.008, 6, 5), M(0xd9b25a, { metalness: 1, roughness: 0.3 }), 0, 0.1 + i * 0.045, 0.066, p.torso);
    }
    // el brazo del mazo es el que queda hacia la campana
    const brazo = p.brazos[ella ? 1 : 0], otro = p.brazos[ella ? 0 : 1]; // (el que queda del lado de la cámara)
    mazoDe(brazo.codo);
    otro.hombro.rotation.x = 0.1; otro.codo.rotation.x = -0.5;
    return { p, brazo, lado };
  }
  const figuras = [figura(-1), figura(1)];

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yBase, k: m.campo.hw, D, yc: YC }); }

  const fx = base.efectos;
  fx.ponerMotas({ n: 34, caja: [-2.4, 2.4, 0.3, 3.4, -0.2, 1.2], color: 0xffd9a0, tam: 0.022, opacidad: 0.4 });
  let dada = -1e9;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.3, y: 0.15, z: 1.3 }, dt);
    const s = d.ahora / 1000;
    // el reloj: el minutero da una vuelta entera en lo que dura la partida
    minutero.rotation.z = -v.avance * Math.PI * 2; horario.rotation.z = -Math.PI * 2 * (9 / 12) - v.avance * Math.PI / 6;
    veleta.rotation.y = 0.5 * Math.sin(s * 0.4) + 0.1 * Math.sin(s * 1.7);
    // los mazazos: el brazo va atrás, pega y vuelve
    figuras.forEach((f, i) => {
      const dg = v.tj - v.golpes[i];
      let k = 0; // 0 en guardia · 1 pegando
      if (dg >= 0 && dg < 70) k = dg / 70; else if (dg >= 70 && dg < 330) k = 1 - (dg - 70) / 260;
      const guardia = -1.05 + 0.05 * Math.sin(s * 1.6 + i * 2) - 0.18 * v.pulso;
      f.brazo.hombro.rotation.x = guardia + (-1.75 - guardia) * k;
      f.brazo.hombro.rotation.z = f.brazo.l * 0.1;
      f.brazo.codo.rotation.x = -1.25 + 0.95 * k;
      f.p.torso.rotation.y = -f.lado * (0.18 - 0.4 * k);
      f.p.torso.rotation.x = 0.06 + 0.1 * k;
      f.p.cabeza.rotation.y = -f.lado * 0.25;
      f.p.cadera.position.y = 0.5 - 0.012 * v.pulso;
    });
    // la campana se mece hacia el lado contrario al mazazo y se va parando
    const dc = (v.tj - v.campanada.t) / 1000;
    const mece = dc >= 0 && dc < 1.6 ? 0.2 * v.campanada.fuerza * Math.sin(dc * 13) * Math.exp(-dc * 2.8) * (v.campanada.lado ? 1 : -1) : 0;
    campana.rotation.z = mece; badajo.rotation.z = -mece * 1.7;
    if (v.campanada.t !== dada && dc >= 0 && dc < 0.2) {
      dada = v.campanada.t;
      const x = v.campanada.lado ? 0.26 : -0.26;
      if (v.campanada.fuerza >= 1) { fx.sacudir(0.16); fx.humo({ x, y: EJE - 0.46, z: 0.1, n: 2, color: 0xffe2a0, tam: [0.08, 0.5], opacidad: 0.75, vida: 0.3, luz: true }); }
      if (!v.menu) fx.trozos({ x, y: EJE - 0.46, z: 0.12, n: v.campanada.fuerza >= 1 ? 9 : 4, colores: [0xffe9a8, 0xe9b44c, 0xfff6d8], fuerza: 0.8, arriba: 0.9, gravedad: 3.5, tam: [0.006, 0.016], vida: 0.5 });
    }
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
