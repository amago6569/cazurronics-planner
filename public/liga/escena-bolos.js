// Bolos leoneses, en 3D. Aquí solo se dibuja: qué bolos caen y por dónde va la bola sale de motor-bolos.js y de la
// «vista» de juego-bolos.js, la misma que usa el dibujo plano.
//
// Una bolera de pueblo: un llano de tierra apisonada con las rayas de cal (el castro, la mano, la raya de parada y la
// raya del once, del cincón al miche), el tope de tablones al fondo, una tapia de piedra con su banco y paisanos
// mirando, y árboles. Los bolos son los leoneses: altos, finos y de madera clara; el miche, el pequeño. La bola es
// media esfera de encina: rueda de canto, se inclina hacia su cara plana al perder fuerza y acaba tumbada.
// El que tira está en la mano, de espaldas: echa el brazo atrás mientras deslizas y suelta la bola por abajo.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { crearPersona, crearChopo, texturaSuelo } from "./comun-3d.js";
import { campo } from "./juego-bolos.js";
import { CASTRO, PARADA, BOLERA, BOLA, ALTO, ALTO_MICHE } from "./motor-bolos.js";

const CAE_MS = 360; // lo que tarda un bolo en llegar al suelo (un palo de 55 cm que se vuelca)
const VISTA = 1.15; // bolos y bola un poco más grandes de lo que miden, para que se vean en el móvil

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 60,
    cielo: { colores: [[0, "#4a82c9"], [0.42, "#cfe2ee"], [0.5, "#f1e6cc"], [0.55, "#7a8f52"], [1, "#3c4428"]], luces: [{ x: 0.68, y: 0.3, r: 0.12, color: "rgba(255,236,196,1)" }], intensidad: 0.85 },
  });
  const { escena } = base;

  escena.add(new THREE.HemisphereLight(0xcfe0ff, 0x7a6a48, 0.95));
  const sol = new THREE.DirectionalLight(0xffe8c0, 2.7);
  sol.position.set(5, 8, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -5, right: 5, top: 8, bottom: -8, near: 1, far: 30 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.015;
  sol.target.position.set(0, 0, -5);
  escena.add(sol, sol.target);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };
  // del suelo del juego (x de lado, y hacia el castro) al mundo 3D (la bolera va hacia −z)
  const Z = (y) => -y;

  // ── El suelo: hierba alrededor y la bolera de tierra apisonada ──
  const hierba = texturaSuelo({ oscuro: [66, 108, 44], claro: [124, 164, 70], semilla: 5, briznas: 900 });
  hierba.repeat.set(16, 10);
  const prado = pon(new THREE.PlaneGeometry(36, 24), M(0xffffff, { map: hierba, roughness: 0.95 }), 0, -0.004, Z(BOLERA.fondo / 2));
  prado.rotation.x = -Math.PI / 2; prado.receiveShadow = true;
  const tierra = textura(512, 512, (g, w, h) => {
    const r = ruido2d(8, 9, w, h), r2 = ruido2d(3, 48, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 0.8 + 0.14 * r(x, y) + 0.12 * r2(x, y), i = (y * w + x) * 4;
      im.data[i] = 186 * k; im.data[i + 1] = 156 * k; im.data[i + 2] = 112 * k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    let s = 77; const az = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    g.fillStyle = "rgba(96,72,44,.28)"; // piedrecillas
    for (let i = 0; i < 900; i++) g.fillRect(az() * w, az() * h, 1 + az() * 2, 1 + az() * 2);
    g.strokeStyle = "rgba(110,86,52,.14)"; g.lineWidth = 2; // rodadas de otras bolas
    for (let i = 0; i < 14; i++) { g.beginPath(); const x0 = w * (0.35 + az() * 0.3); g.moveTo(x0, h); g.quadraticCurveTo(x0 - w * 0.15, h * 0.5, x0 + w * (az() - 0.3) * 0.4, h * 0.2); g.stroke(); }
  }, { repetir: true });
  tierra.repeat.set(2.4, 3);
  const largoBolera = BOLERA.fondo + 1.5;
  const bolera = pon(new THREE.PlaneGeometry(BOLERA.ancho * 2, largoBolera), M(0xffffff, { map: tierra, bumpMap: tierra, bumpScale: 0.5, roughness: 1 }), 0, 0, Z(BOLERA.fondo - largoBolera / 2));
  bolera.rotation.x = -Math.PI / 2; bolera.receiveShadow = true;

  // ── Las rayas de cal ──
  const cal = M(0xf4efe2, { roughness: 1 });
  const raya = (x0, y0, x1, y1, ancho = 0.035, material = cal) => {
    const l = Math.hypot(x1 - x0, y1 - y0);
    const r = pon(new THREE.BoxGeometry(ancho, 0.006, l), material, (x0 + x1) / 2, 0.004, Z((y0 + y1) / 2));
    r.rotation.y = Math.atan2(x1 - x0, y1 - y0); r.receiveShadow = true;
    return r;
  };
  const cuadro = (cx, cy, m) => { raya(cx - m, cy - m, cx + m, cy - m); raya(cx - m, cy + m, cx + m, cy + m); raya(cx - m, cy - m, cx - m, cy + m); raya(cx + m, cy - m, cx + m, cy + m); };
  cuadro(0, CASTRO.y, CASTRO.medio); // el castro
  cuadro(0, 0, 0.62); // la mano
  // la raya de parada: un círculo de cal a trozos (como se pinta a mano)
  for (let k = 0; k < 40; k++) {
    if (k % 2) continue;
    const a0 = (k / 40) * Math.PI * 2, a1 = ((k + 1) / 40) * Math.PI * 2;
    raya(Math.cos(a0) * PARADA, CASTRO.y + Math.sin(a0) * PARADA, Math.cos(a1) * PARADA, CASTRO.y + Math.sin(a1) * PARADA, 0.03);
  }
  // la raya del once (se mueve con el miche) y la marca de cal de cada bolo
  const matOnce = M(0xf4efe2, { roughness: 1, emissive: 0xe9b44c, emissiveIntensity: 0 });
  const rayaOnce = pon(new THREE.BoxGeometry(0.04, 0.007, 1), matOnce, 0, 0.005, 0);
  rayaOnce.receiveShadow = true;
  const geoPunto = new THREE.CircleGeometry(0.07, 12);
  for (let f = -1; f <= 1; f++) for (let c = -1; c <= 1; c++) { const p = pon(geoPunto, M(0xe2d6bc, { roughness: 1 }), c * CASTRO.paso, 0.003, Z(CASTRO.y + f * CASTRO.paso)); p.rotation.x = -Math.PI / 2; }

  // ── El tope del fondo: tablones con estacas, y detrás la tapia, el banco y los paisanos ──
  const madera = M(0x7a5634, { roughness: 0.7 }), maderaClara = M(0xb08a56, { roughness: 0.65 });
  for (let i = 0; i < 3; i++) { const t = pon(new THREE.BoxGeometry(BOLERA.ancho * 2, 0.17, 0.07), i % 2 ? maderaClara : madera, 0, 0.09 + i * 0.18, Z(BOLERA.fondo) - 0.04); t.castShadow = true; t.receiveShadow = true; }
  for (let x = -BOLERA.ancho; x <= BOLERA.ancho + 0.01; x += 1.5) pon(new THREE.BoxGeometry(0.09, 0.7, 0.09), madera, x, 0.35, Z(BOLERA.fondo) - 0.12).castShadow = true;
  const mamposteria = textura(256, 128, (g, w, h) => {
    g.fillStyle = "#6f675c"; g.fillRect(0, 0, w, h);
    let s = 31; const az = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    for (let f = 0; f < 5; f++) { let x = -az() * 30; while (x < w) { const a = 26 + az() * 34, k = 130 + az() * 60; g.fillStyle = `rgb(${k},${k - 8},${k - 22})`; g.beginPath(); g.roundRect(x + 2, f * 25.6 + 2, a - 3, 22, 5); g.fill(); x += a; } }
  }, { repetir: true });
  mamposteria.repeat.set(8, 1);
  const zTapia = Z(BOLERA.fondo) - 1.6;
  const tapia = pon(new THREE.BoxGeometry(18, 1.1, 0.4), M(0xffffff, { map: mamposteria, bumpMap: mamposteria, bumpScale: 1.2, roughness: 0.95 }), 0, 0.55, zTapia);
  tapia.castShadow = true; tapia.receiveShadow = true;
  pon(new THREE.BoxGeometry(18.1, 0.08, 0.5), M(0x8a8272, { roughness: 0.95 }), 0, 1.14, zTapia);
  const banco = pon(new THREE.BoxGeometry(3.4, 0.06, 0.36), maderaClara, 0, 0.45, zTapia + 0.42); banco.castShadow = true;
  for (const x of [-1.5, 0, 1.5]) pon(new THREE.BoxGeometry(0.07, 0.45, 0.3), madera, x, 0.225, zTapia + 0.42);
  const paisanos = [
    { c: { camisa: 0xe9e2d2, chaleco: 0x2a2622, pantalon: 0x3a342e, pelo: 0x8a8880, faja: 0x8f1d24 }, x: -1.1, boina: true },
    { c: { camisa: 0x7a94b8, pantalon: 0x4a3c2c, pelo: 0x3a2a1c }, x: -0.3, boina: false },
    { c: { camisa: 0x9c1c24, pantalon: 0x2a2622, pelo: 0x5a3a22 }, x: 0.6, boina: false },
    { c: { camisa: 0xefe9de, chaleco: 0x4a3c2c, pantalon: 0x2a2622, pelo: 0xbab6ae, faja: 0x1f4f8f }, x: 1.4, boina: true },
  ].map(({ c, x, boina }) => {
    const p = crearPersona(c);
    p.grupo.scale.setScalar(1.7); p.grupo.position.set(x, 0.48 - 0.5 * 1.7 + 0.04, zTapia + 0.45);
    p.piernas.forEach((q) => { q.cadera.rotation.x = -1.45; q.cadera.rotation.z = q.l * 0.12; q.rodilla.rotation.x = 1.45; });
    p.brazos.forEach((b) => { b.hombro.rotation.x = -0.5; b.codo.rotation.x = -0.9; });
    if (boina) { const b = p.pon(new THREE.CylinderGeometry(0.08, 0.075, 0.025, 14), M(0x1c1a18), 0, 0.068, 0, p.cabeza); b.rotation.z = 0.12; }
    escena.add(p.grupo);
    return p;
  });
  for (const [x, z, a] of [[-6, -2.5, 6.5], [6.5, -1.5, 7.2], [7.4, -5, 6], [-8, -4, 7.6], [1.5, -5.5, 8], [-3.5, -5, 6.8], [4, -6, 6.5]]) { const c = crearChopo(a, 0x5a8a36); c.position.set(x, 0, zTapia + z); escena.add(c); }
  // a un lado, el cesto con las otras bolas
  const encina = textura(128, 64, (g, w, h) => {
    const r = ruido2d(9, 6, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.7 + 0.3 * r(x * 0.4, y * 3) + 0.08 * Math.sin(y * 0.9 + r(x, y) * 6), i = (y * w + x) * 4; im.data[i] = 118 * k; im.data[i + 1] = 74 * k; im.data[i + 2] = 40 * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  const matBola = M(0xffffff, { map: encina, roughness: 0.4 });
  const R = BOLA * 1.5; // la bola, más grande de lo que mide: si no, en el móvil no se ve
  // media esfera con la cara plana mirando a +x (la cúpula hacia −x)
  const geoMedia = (() => { const g = new THREE.SphereGeometry(R, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateZ(Math.PI / 2); return g; })();
  const geoCara = (() => { const g = new THREE.CircleGeometry(R * 0.995, 24); g.rotateY(Math.PI / 2); return g; })();
  const matCara = M(0x8a5a30, { roughness: 0.55, side: THREE.DoubleSide });
  const mediaBola = () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(geoMedia, matBola); a.castShadow = true; g.add(a);
    const c = new THREE.Mesh(geoCara, matCara); g.add(c);
    // los anillos del torno en la cara plana
    const an = new THREE.Mesh(new THREE.TorusGeometry(R * 0.6, R * 0.04, 6, 20), M(0x5a3418)); an.rotation.y = Math.PI / 2; an.position.x = 0.002; g.add(an);
    return g;
  };
  const cesto = pon(new THREE.CylinderGeometry(0.28, 0.22, 0.26, 16, 1, true), M(0x9a7a4a, { side: THREE.DoubleSide, roughness: 0.95 }), 1.75, 0.13, Z(-0.5));
  cesto.castShadow = true;
  for (const [x, z] of [[1.68, -0.45], [1.82, -0.55]]) { const b = mediaBola(); b.position.set(x, 0.24, Z(z)); b.rotation.set(0.3, 0.5, Math.PI / 2); escena.add(b); }

  // ── Los bolos leoneses: altos y finos, torneados, de madera clara ──
  const perfil = [[0.001, 0], [1, 0], [1, 0.035], [0.94, 0.16], [0.82, 0.42], [0.68, 0.7], [0.56, 0.86], [0.52, 0.92], [0.47, 0.97], [0.3, 1], [0.001, 1]];
  const geoBolo = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r * 0.06 * VISTA, y * ALTO * VISTA)), 14);
  const geoMiche = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r * 0.045 * VISTA, y * ALTO_MICHE * VISTA)), 12);
  const palo = textura(64, 128, (g, w, h) => {
    const r = ruido2d(2, 5, w, h);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = 0.82 + 0.2 * r(x * 3, y * 0.5), i = (y * w + x) * 4; im.data[i] = 230 * k; im.data[i + 1] = 202 * k; im.data[i + 2] = 150 * k; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    g.fillStyle = "rgba(90,60,30,.25)"; for (let i = 0; i < 5; i++) g.fillRect(0, h * (0.1 + i * 0.18), w, 1); // vetas del torno
  });
  const matBolo = M(0xffffff, { map: palo, roughness: 0.5 }), matMiche = M(0xf0d8a8, { map: palo, roughness: 0.45 });
  const bolos = Array.from({ length: 10 }, (_, i) => {
    const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo);
    const b = new THREE.Mesh(i === 9 ? geoMiche : geoBolo, i === 9 ? matMiche : matBolo); b.castShadow = true; cuerpo.add(b);
    escena.add(g);
    return { g, cuerpo, aterrizo: false };
  });

  // ── El que tira: un paisano en la mano, de espaldas ──
  const jugador = crearPersona({ camisa: 0xefe9de, chaleco: 0x2a2622, pantalon: 0x3a342e, pelo: 0x2a1c12, faja: 0x9c1c24, remangado: true });
  jugador.grupo.scale.setScalar(1.72); jugador.grupo.rotation.y = Math.PI;
  escena.add(jugador.grupo);
  { const b = jugador.pon(new THREE.CylinderGeometry(0.08, 0.075, 0.025, 14), M(0x1c1a18), 0, 0.068, 0, jugador.cabeza); b.rotation.z = -0.1; }
  const derecho = jugador.brazos[0], izquierdo = jugador.brazos[1];

  // ── La bola que se tira: posición y rumbo · inclinación · giro de rueda ──
  const bola = new THREE.Group(); escena.add(bola);
  const inclina = new THREE.Group(); bola.add(inclina);
  const orienta = new THREE.Group(); inclina.add(orienta);
  const giro = new THREE.Group(); orienta.add(giro);
  giro.add(mediaBola());
  const enMano = new THREE.Vector3();

  function medir(m) { base.medir(m, campo.vista3d()); }

  const fx = base.efectos;
  fx.ponerMotas({ n: 30, caja: [-3, 3, 0.1, 2.5, -10, 0], color: 0xfff0c8, tam: 0.03, opacidad: 0.3 });
  const eje = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  let polvo = 0, paradaVista = false, fiestaVista = 0, onceVisto = -1, brazo = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.3, y: 0.2, z: 1.4 }, dt);
    const s = d.ahora / 1000;

    // la raya del once, del cincón al miche: se enciende cuando la bola la cruza
    {
      const x0 = v.ci.x, y0 = v.ci.y, x1 = v.mi.x, y1 = v.mi.y, l = Math.hypot(x1 - x0, y1 - y0);
      rayaOnce.position.set((x0 + x1) / 2, 0.005, Z((y0 + y1) / 2)); rayaOnce.scale.z = l; rayaOnce.rotation.y = Math.atan2(x1 - x0, y1 - y0);
      const brillo = v.once >= 0 && v.once < 1600 ? 1 - v.once / 1600 : 0;
      matOnce.emissiveIntensity = 1.4 * brillo; matOnce.color.setHex(brillo > 0 ? 0xffd27a : 0xf4efe2);
      if (v.once >= 0 && v.once < 100 && onceVisto !== Math.round(d.tj - v.once)) {
        onceVisto = Math.round(d.tj - v.once);
        fx.humo({ x: (x0 + x1) / 2, y: 0.05, z: Z((y0 + y1) / 2), ancho: l / 3, n: 4, color: 0xffe2a0, tam: [0.2, 0.7], opacidad: 0.6, vida: 0.5, luz: true });
      }
    }

    // los bolos: de pie, armándose (bajan y asientan), o volcándose hacia donde les dan
    bolos.forEach((b, i) => {
      const o = v.bolos[i];
      if (!o) { b.g.visible = false; return; }
      b.g.visible = true;
      const alto = o.miche ? ALTO_MICHE : ALTO;
      const sube = o.sube ?? 1, cae = o.cae;
      let x = o.x, y = o.y, h = 0;
      if (sube < 1) h = (1 - sube) * (1 - sube) * 0.5;
      if (cae >= 0) {
        // resbala lo que lo empujaron (los que da la bola salen despedidos; los demás, apenas)
        const e = o.empuje * Math.min(1, cae / 520) * (2 - Math.min(1, cae / 520));
        x += o.dx * e; y += o.dy * e;
        if (o.empuje > 0.1) h = 0.05 * Math.max(0, Math.sin(Math.min(1, cae / 260) * Math.PI));
        let ang;
        if (cae < CAE_MS) { const k = cae / CAE_MS; ang = (Math.PI / 2 - 0.06) * k * k; }
        else { const t = cae - CAE_MS; ang = Math.PI / 2 - 0.06 - 0.16 * Math.exp(-t / 90) * Math.abs(Math.sin(t / 45)); }
        q.setFromAxisAngle(eje.set(-o.dy, 0, -o.dx).normalize(), ang);
        // tumbado, rueda un poco sobre sí mismo
        q2.setFromAxisAngle(eje.set(0, 1, 0), cae > CAE_MS ? Math.min(0.8, (cae - CAE_MS) / 400) * (i % 2 ? 1 : -1) * 0.6 : 0);
        b.cuerpo.quaternion.copy(q).multiply(q2);
        if (cae >= CAE_MS && !b.aterrizo) {
          b.aterrizo = true;
          const px = x + o.dx * alto * 0.6, py = y + o.dy * alto * 0.6;
          fx.humo({ x: px, y: 0.04, z: Z(py), ancho: 0.15, n: 2, color: 0xd9c4a0, tam: [0.1, 0.45], opacidad: 0.35, abre: 0.2, sube: 0.12, vida: 0.7 });
          fx.trozos({ x: px, y: 0.04, z: Z(py), n: 4, colores: [0xc9b083, 0xa88c5c], fuerza: 0.4, arriba: 0.9, tam: [0.006, 0.014], suelo: 0.01, vida: 0.5 });
          if (o.empuje > 0.1) fx.sacudir(0.08);
        }
      } else { b.cuerpo.quaternion.identity(); b.aterrizo = false; }
      b.g.position.set(x, h, Z(y));
      b.g.scale.setScalar(1 - (o.recoge || 0) * 0.9);
    });

    // el que tira: echa el brazo atrás mientras deslizas, suelta por abajo y acompaña; para birlar, anda hasta la bola
    const j = v.jugador;
    jugador.grupo.position.set(j.x, 0, Z(j.y));
    const tira = j.tira;
    const carga = v.apunte ? Math.min(1, 0.3 + v.apunte.s) : 0;
    brazo += (carga - brazo) * Math.min(1, dt * 10);
    let hombro = 0.15 + brazo * 1.5, inclinaTorso = 0.1 + brazo * 0.3, paso = 0;
    if (tira >= 0 && tira < 900) {
      const k = tira / 900;
      // 0–0,14 s: el brazo viene de atrás hasta delante y suelta; luego acompaña y vuelve
      hombro = tira < 140 ? 1.6 - (tira / 140) * 3.0 : -1.4 + 1.55 * Math.min(1, (tira - 140) / 700);
      inclinaTorso = 0.45 * (1 - k); paso = Math.max(0, 1 - k * 1.4);
    }
    const birla = j.birla;
    derecho.hombro.rotation.x = hombro * (birla ? 0.8 : 1); derecho.codo.rotation.x = -0.15; derecho.hombro.rotation.z = -0.15;
    izquierdo.hombro.rotation.x = -0.3 - 0.4 * paso; izquierdo.hombro.rotation.z = 0.25; izquierdo.codo.rotation.x = -0.6;
    jugador.torso.rotation.x = inclinaTorso + (birla ? 0.35 : 0);
    const andar = j.anda ? Math.sin(s * 11) : 0;
    jugador.piernas.forEach((p, i) => {
      const lado = i ? 1 : -1;
      p.cadera.rotation.x = (i === 1 ? -0.55 * paso : 0.2 * paso) - (birla ? 0.5 : 0) + 0.5 * andar * lado;
      p.rodilla.rotation.x = 0.25 * brazo + (birla ? 0.8 : 0) + 0.3 * Math.max(0, andar * lado);
    });
    jugador.cadera.position.y = 0.5 - (birla ? 0.07 : 0.02 * brazo);
    jugador.grupo.updateMatrixWorld(true);

    // la bola: en la mano, rodando de canto (inclinándose hacia la cara plana al frenar) o tumbada
    bola.visible = v.bola.ve;
    if (v.bola.ve) {
      const vb = v.bola;
      if (vb.enMano) {
        derecho.mano.getWorldPosition(enMano);
        bola.position.set(enMano.x, enMano.y - 0.02, enMano.z);
        bola.rotation.set(0, 0, 0); inclina.rotation.set(0, 0, 0); orienta.rotation.set(0, Math.PI, 0); giro.rotation.set(0, 0, Math.PI / 2 - 0.4);
      } else {
        const lado = (vb.efecto || 0) >= 0 ? 1 : -1; // la cara plana, hacia donde tuerce
        bola.position.set(vb.x, R, Z(vb.y));
        bola.rotation.set(0, Math.atan2(vb.hx, -vb.hy), 0);
        orienta.rotation.set(0, lado > 0 ? Math.PI : 0, 0);
        let incl;
        if (vb.parada || vb.enSuelo) { const t = Math.max(0, vb.hace ?? 400); incl = Math.PI / 2 - 0.3 * Math.exp(-t / 160) * Math.cos(t / 55); }
        else incl = 0.18 + 0.75 * (1 - Math.min(1, vb.v / 4)) * Math.min(1, Math.abs(vb.efecto || 0) + 0.3);
        inclina.rotation.set(0, 0, -lado * incl);
        giro.rotation.set((lado > 0 ? -1 : 1) * vb.rodado / R, 0, 0);
        // polvo al rodar
        if (!vb.parada && !vb.enSuelo) {
          polvo -= dt;
          if (polvo <= 0) { polvo = 0.06; fx.humo({ x: vb.x, y: 0.03, z: Z(vb.y) + 0.08, n: 1, color: 0xd9c4a0, tam: [0.05, 0.28], opacidad: 0.3 * Math.min(1, vb.v / 3 + 0.3), abre: 0.08, sube: 0.12, vida: 0.5 }); }
        }
        if (vb.parada && !paradaVista && vb.y > BOLERA.fondo - 0.4) { fx.sacudir(0.3); fx.trozos({ x: vb.x, y: 0.15, z: Z(BOLERA.fondo) + 0.1, n: 8, colores: [0xc9b083, 0x7a5634], fuerza: 0.7, arriba: 1.2, vz: 0.8, tam: [0.006, 0.018], suelo: 0.01, vida: 0.6 }); }
        paradaVista = Boolean(vb.parada);
      }
    }

    // los paisanos: siguen la bola con la cabeza y, con un once, se levantan a aplaudir
    const f = v.fiesta > 0 ? Math.sin(Math.min(1, v.fiesta * 3) * Math.PI / 2) * (v.fiesta > 0.8 ? (1 - v.fiesta) / 0.2 : 1) : 0;
    if (v.fiesta > 0 && fiestaVista === 0) fx.trozos({ x: 0, y: 2.2, z: zTapia + 0.6, ancho: 1.6, n: 34, colores: [0xb3121e, 0xe9b44c, 0xf1e3c0, 0x1f6b3a], fuerza: 1.2, arriba: 2.2, gravedad: 3, tam: [0.02, 0.05], vida: 1.8 });
    fiestaVista = v.fiesta;
    paisanos.forEach((p, i) => {
      const mira = v.bola.ve && !v.bola.enMano ? v.bola.x - p.grupo.position.x : 0;
      p.cabeza.rotation.y = Math.max(-0.7, Math.min(0.7, mira * 0.25)) + 0.05 * Math.sin(s * 0.7 + i);
      p.brazos.forEach((b) => { b.hombro.rotation.x = -0.5 - 2.2 * f; b.hombro.rotation.z = b.l * (0.12 + 0.35 * f + 0.2 * f * Math.sin(s * 18 + i)); b.codo.rotation.x = -0.9 + 0.6 * f; });
      p.torso.rotation.x = 0.1 - 0.1 * f;
      p.grupo.position.y = 0.48 - 0.5 * 1.7 + 0.04 + 0.25 * f;
      p.piernas.forEach((pq) => { pq.cadera.rotation.x = -1.45 * (1 - f); pq.rodilla.rotation.x = 1.45 * (1 - f); });
    });
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
