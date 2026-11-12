// Lucha leonesa, en 3D. Aquí solo se dibuja: qué maña entra y quién cae sale de motor-lucha.js y de la «vista» de
// juego-lucha.js, la misma que usa el dibujo plano.
//
// Un corro de aluches en un prado de la montaña: el círculo de cal en la hierba, la gente sentada alrededor, una ristra
// de banderines y los montes detrás. Los luchadores van descalzos, con calzón y el cinto de cuero al que se agarran:
// el tuyo, de rojo, a la izquierda; el rival, de verde.
import { crearBase, THREE } from "./base-3d.js";
import { crearPersona, texturaSuelo } from "./comun-3d.js";

const D = 6.8, YC = 1.25;
const ALTO = 1.38; // lo que mide un luchador (en anchos de media pantalla)
const SEP = 0.3; // de cada luchador al centro

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 45,
    cielo: { colores: [[0, "#5a8fd0"], [0.42, "#d6e4ee"], [0.5, "#eef0e0"], [0.55, "#6f8a4a"], [1, "#35422a"]], luces: [{ x: 0.3, y: 0.28, r: 0.12, color: "rgba(255,240,205,1)" }], intensidad: 0.9 },
  });
  const { escena } = base;

  escena.add(new THREE.HemisphereLight(0xd4e4ff, 0x64783e, 0.95));
  const sol = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sol.position.set(-3.5, 5.5, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2.5, near: 1, far: 16 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.012;
  escena.add(sol, sol.target);
  const contraluz = new THREE.DirectionalLight(0xbcd2ff, 0.6); contraluz.position.set(3, 3, -4); escena.add(contraluz);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };

  // ── El prado y el corro de cal ──
  const hierba = texturaSuelo({ oscuro: [62, 104, 42], claro: [122, 164, 68], semilla: 7, briznas: 1100 });
  hierba.repeat.set(12, 7);
  const prado = pon(new THREE.PlaneGeometry(26, 14), M(0xffffff, { map: hierba, roughness: 0.95 }), 0, 0, -3);
  prado.rotation.x = -Math.PI / 2; prado.receiveShadow = true;
  const cal = pon(new THREE.TorusGeometry(1.75, 0.028, 4, 72), M(0xf2efe6, { roughness: 1 }), 0, 0.004, -0.15);
  cal.rotation.x = Math.PI / 2; cal.scale.z = 0.25;
  // la hierba pisada del centro
  const pisada = pon(new THREE.CircleGeometry(0.8, 32), new THREE.MeshBasicMaterial({ color: 0x9a8a4a, transparent: true, opacity: 0.22, depthWrite: false }), 0, 0.006, -0.05); pisada.rotation.x = -Math.PI / 2;

  // ── Los banderines, de poste a poste, por detrás ──
  const madera = M(0x6a4a2c);
  for (const x of [-2.6, 2.6]) { const p = pon(new THREE.CylinderGeometry(0.03, 0.04, 2.5, 8), madera, x, 1.25, -2.9); p.castShadow = true; }
  const COLORES = [0xb3121e, 0xf1e3c0, 0x1f6b3a, 0xe9b44c, 0x5b2a86, 0xf1e3c0];
  const geoTri = new THREE.BufferGeometry();
  geoTri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.09, 0, 0, 0.09, 0, 0, 0, -0.2, 0]), 3)); geoTri.computeVertexNormals();
  const banderines = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26, x = -2.6 + 5.2 * u, y = 2.42 - 0.5 * 4 * u * (1 - u);
    if (i % 1 === 0 && i > 0 && i < 26) { const b = pon(geoTri, M(COLORES[i % COLORES.length], { side: THREE.DoubleSide, roughness: 0.9 }), x, y, -2.9); banderines.push(b); }
  }
  const geoCuerda = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const u = i / 8; return new THREE.Vector3(-2.6 + 5.2 * u, 2.42 - 2 * u * (1 - u), -2.9); })), 24, 0.006, 4);
  pon(geoCuerda, M(0x3a3026), 0, 0, 0);

  // ── La gente del corro: sentada en la hierba, en media luna por detrás ──
  const ROPA = [0xe9e2d2, 0x7a94b8, 0xb04a3a, 0x4a6a8a, 0xd9c27a, 0x5a7a4a, 0x8a5a7a, 0xcfd6dc, 0x3a4a6a];
  const publico = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + 0.76 * (i / 8)), x = -Math.cos(a) * 2.25, z = -0.15 - Math.sin(a) * 1.9;
    const p = crearPersona({ camisa: ROPA[i], pantalon: i % 2 ? 0x3a342e : 0x4a4436, pelo: [0x2a1c12, 0x8a8880, 0x5a3a1c][i % 3], chaleco: i % 4 === 0 ? 0x2a2622 : null });
    p.grupo.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    p.grupo.scale.setScalar(0.86 + (i % 3) * 0.04);
    p.grupo.position.set(x, -0.5 * 0.86 + 0.09, z);
    p.grupo.rotation.y = Math.atan2(-x, -0.15 - z); // mirando al centro
    p.piernas.forEach((q) => { q.cadera.rotation.x = -1.5; q.cadera.rotation.z = q.l * 0.3; q.rodilla.rotation.x = 1.9; });
    p.brazos.forEach((b) => { b.hombro.rotation.x = -0.9; b.codo.rotation.x = -0.6; });
    p.torso.rotation.x = 0.2;
    escena.add(p.grupo);
    publico.push(p);
  }

  // ── Los luchadores ──
  const cuero = M(0x5a3418, { roughness: 0.55 });
  function luchador(calzon, pelo, mira) {
    const fuera = new THREE.Group(); escena.add(fuera); // se mueve y se tumba
    const p = crearPersona({ camisa: 0xd9a87e, mangas: 0xd9a87e, pantalon: calzon, medias: 0xd9a87e, calzado: 0xd9a87e, pelo, remangado: true });
    p.materiales.camisa.roughness = 0.6;
    p.grupo.scale.setScalar(ALTO);
    p.grupo.rotation.y = (mira * Math.PI) / 2;
    fuera.add(p.grupo);
    // el cinto, con su hebilla
    const c = p.pon(new THREE.TorusGeometry(0.092, 0.014, 6, 20), cuero, 0, 0.035, 0, p.torso); c.rotation.x = Math.PI / 2; c.scale.set(1.12, 0.78, 1);
    p.pon(new THREE.BoxGeometry(0.03, 0.03, 0.01), M(0xd9b25a, { metalness: 1, roughness: 0.3 }), 0, 0.035, 0.075, p.torso);
    return { fuera, p, mira };
  }
  const yo = luchador(0xb3121e, 0x2a1c12, 1), rival = luchador(0x1f6b3a, 0x5a3a1c, -1);

  function medir(m) { base.medir(m, { cx: m.campo.cx, yPlano: m.campo.yBase, k: m.campo.hw, D, yc: YC }); }

  // Coloca a un luchador. o = { x, y, tumbado (−1…1: hacia atrás), ladea, agacha (0…1), sube, brazos (0 agarrado … 1 arriba), paso }
  function posar(l, o, s) {
    const { p, fuera, mira } = l;
    fuera.position.set(o.x, o.y, 0);
    // se tumba de espaldas: gira por los pies hacia atrás
    fuera.rotation.z = mira * o.tumbado * 1.47 + o.ladea;
    const ag = o.agacha;
    p.cadera.position.y = 0.5 - 0.09 * ag;
    p.torso.rotation.x = 0.62 * ag * (1 - Math.abs(o.tumbado)) - 0.25 * o.brazos;
    p.cabeza.rotation.x = -0.35 * ag;
    p.piernas.forEach((q, i) => {
      const abre = (i ? 1 : -1) * (0.42 + 0.1 * o.paso) * ag;
      q.cadera.rotation.x = -0.25 * ag + abre; q.rodilla.rotation.x = 0.5 * ag + (abre > 0 ? 0.25 : 0.1) * ag;
      q.cadera.rotation.z = q.l * 0.1;
    });
    p.brazos.forEach((b, i) => {
      const respira = 0.04 * Math.sin(s * 2.1 + i + mira);
      b.hombro.rotation.x = (-1.05 + respira) * (1 - o.brazos) + -2.9 * o.brazos;
      b.hombro.rotation.z = b.l * (0.18 + 0.25 * o.brazos);
      b.codo.rotation.x = -0.45 * (1 - o.brazos) - 0.15 * o.brazos;
    });
  }

  const fx = base.efectos;
  fx.ponerMotas({ n: 36, caja: [-2.6, 2.6, 0.05, 2.6, -2, 1], color: 0xfff2c8, tam: 0.024, opacidad: 0.35 });
  let visto = null;
  const SUAVE = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.35, y: 0.12, z: 1.2 }, dt);
    const s = d.ahora / 1000;
    if (!reducido) banderines.forEach((b, i) => { b.rotation.x = 0.35 * Math.sin(s * 4 + i * 0.9); });
    // ── la pelea ──
    const a = { x: -SEP, y: 0, tumbado: 0, ladea: 0, agacha: 1, sube: 0, brazos: 0, paso: Math.sin(s * 1.7) };
    const b = { x: SEP, y: 0, tumbado: 0, ladea: 0, agacha: 1, sube: 0, brazos: 0, paso: Math.sin(s * 1.7 + 2) };
    // en guardia se mueven en redondo, tanteándose
    const tanteo = 0.035 * Math.sin(s * 1.3);
    a.x += tanteo; b.x += tanteo;
    let lado = 0, alza = 0;
    if (v.mana) {
      const e = SUAVE(v.mana.desde / 160) * (v.mana.amago ? 0.45 : 1) + (v.mana.amago ? 0 : 0.15 * (1 - v.mana.queda));
      if (v.mana.d === 0) lado = -e; else if (v.mana.d === 1) lado = e; else if (v.mana.d === 2) alza = e; else alza = -e;
    }
    // la contra: un tirón al revés que se apaga
    if (v.ultimo && v.ultimo.tipo === "contra" && v.hace < 380) {
      const e = (1 - v.hace / 380) * 0.8;
      if (v.ultimo.d === 0) lado += e; else if (v.ultimo.d === 1) lado -= e; else if (v.ultimo.d === 2) alza -= e * 0.7; else alza += e * 0.7;
      b.ladea += -0.25 * e; // el rival se descompone
    }
    a.x += lado * 0.17; b.x += lado * 0.17; a.ladea -= lado * 0.2; b.ladea -= lado * 0.2;
    if (alza > 0) { a.y += 0.2 * alza; a.agacha = 1 - 0.7 * alza; b.agacha = 1 - 0.45 * alza; a.ladea += 0.12 * alza; } // te levanta
    else if (alza < 0) { b.agacha = 1 - 0.5 * alza; a.ladea += -0.22 * alza; b.x += 0.08 * alza; } // se te mete por abajo: te vas de espaldas
    // alguien al suelo
    const cae = v.estado === "caida" ? b : v.estado === "suelo" ? a : null;
    if (cae && v.ultimo) {
      const k = v.hace < 380 ? (v.hace / 380) * (v.hace / 380) : v.hace > v.pausa - 420 ? Math.max(0, (v.pausa - v.hace) / 420) : 1;
      const bote = v.hace > 380 && v.hace < 560 ? 0.035 * Math.sin(((v.hace - 380) / 180) * Math.PI) : 0;
      cae.tumbado = k; cae.agacha = 1 - k; cae.y += bote; cae.x += (cae === b ? 1 : -1) * 0.1 * k;
      const gana = cae === b ? a : b;
      gana.agacha = 1 - 0.85 * SUAVE(v.hace / 300); gana.brazos = SUAVE((v.hace - 150) / 300) * (v.hace > v.pausa - 420 ? Math.max(0, (v.pausa - v.hace) / 420) : 1);
      if (visto !== v.ultimo.t && v.hace >= 360) {
        visto = v.ultimo.t;
        const x = cae.x + (cae === b ? 0.55 : -0.55);
        fx.sacudir(0.75);
        fx.humo({ x, y: 0.08, z: 0.1, ancho: 0.4, n: 6, color: 0xe6dcb8, tam: [0.15, 0.7], opacidad: 0.35, abre: 0.6, sube: 0.3, vida: 0.9 });
        fx.trozos({ x, y: 0.05, z: 0.15, ancho: 0.4, n: 16, colores: [0x6f9a3e, 0x4f7a2e, 0x8a7a4a], fuerza: 0.8, arriba: 1.6, tam: [0.008, 0.022], suelo: 0.01, vida: 0.8 });
        if (cae === b) fx.trozos({ x: 0, y: 2.1, z: -1.5, ancho: 2, n: 26, colores: [0xb3121e, 0xe9b44c, 0xf1e3c0, 0x1f6b3a], fuerza: 0.8, arriba: 1.2, gravedad: 2.2, tam: [0.012, 0.03], vida: 1.8 });
      }
    }
    posar(yo, a, s); posar(rival, b, s);
    // el público: mira, y aplaude cuando tumbas al rival
    const fiesta = v.estado === "caida" && v.hace > 300 ? 1 : 0;
    publico.forEach((p, i) => {
      const f = fiesta * (0.6 + 0.4 * Math.sin(s * 14 + i * 2));
      p.brazos.forEach((q) => { q.hombro.rotation.x = -0.9 - 1.5 * fiesta * (i % 2 ? 1 : 0.5); q.hombro.rotation.z = q.l * (0.1 + 0.25 * f); });
      p.cabeza.rotation.y = 0.12 * Math.sin(s * 0.6 + i) + lado * 0.1;
    });
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
