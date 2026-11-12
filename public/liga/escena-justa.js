// La Justa del Paso Honroso, en 3D. Aquí solo se dibuja: dónde está la punta de la lanza y el escudo del rival sale
// de motor-justa.js y de la «vista» de juego-justa.js, la misma que usa el dibujo plano.
//
// El palenque junto al puente de Hospital de Órbigo, en la vega: hierba, dos calles de arena, la tela (la valla de
// tablas con paños) por el medio, vallas con gallardetes a los lados, las tiendas de los caballeros, chopos y, al
// fondo, el puente de piedra. Se ve desde detrás de tu caballo; el rival viene de frente por el otro lado de la tela.
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { crearPersona, crearCaballo, galopar, crearChopo, texturaSuelo } from "./comun-3d.js";
import { campo, D, Y_CHOQUE, YO, ALTO_LANZA, aLado, PALETAS, ABRE, TELA_X } from "./juego-justa.js";
import { ESCUDO } from "./motor-justa.js";

const VUELTA = 36; // cada cuánto se repite lo que pasa por los lados (m)

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 70,
    cielo: { colores: [[0, "#3f77c9"], [0.42, "#bcd9ee"], [0.5, "#f3ead2"], [0.54, "#7f9a58"], [1, "#3c4a28"]], luces: [{ x: 0.3, y: 0.3, r: 0.12, color: "rgba(255,240,205,1)" }], intensidad: 0.85 },
  });
  const { escena } = base;
  escena.fog = new THREE.Fog(0xcfe1ee, 22, 110);

  escena.add(new THREE.HemisphereLight(0xcfe2ff, 0x6c7a45, 0.95));
  const sol = new THREE.DirectionalLight(0xfff0d0, 2.5);
  sol.position.set(-4, 7, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -9, near: 1, far: 22 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.012;
  sol.target.position.set(0, 0, -3);
  escena.add(sol, sol.target);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };

  // ── La vega: hierba y las dos calles de arena, que corren hacia la cámara ──
  const hierba = texturaSuelo({ oscuro: [70, 112, 44], claro: [128, 168, 72], semilla: 3, briznas: 900 });
  hierba.repeat.set(30, 40);
  const prado = pon(new THREE.PlaneGeometry(60, 80), M(0xffffff, { map: hierba, roughness: 0.95 }), 0, 0, -30);
  prado.rotation.x = -Math.PI / 2; prado.receiveShadow = true;
  const arena = texturaSuelo({ oscuro: [176, 150, 104], claro: [222, 200, 150], semilla: 12, briznas: 260, color: "rgba(120,96,60,.35)" });
  arena.repeat.set(1, 40);
  const matArena = M(0xffffff, { map: arena, roughness: 1 });
  for (const [x0, x1] of [[TELA_X - 1.36, TELA_X - 0.07], [TELA_X + 0.07, TELA_X + 1.26]]) {
    const c = pon(new THREE.PlaneGeometry(x1 - x0, 80), matArena, (x0 + x1) / 2, 0.004, -30);
    c.rotation.x = -Math.PI / 2; c.receiveShadow = true;
  }
  const TESELA = 2; // metros que mide una baldosa de textura a lo largo

  // ── La tela: tablas arriba y abajo, y paños rojos y crema entre poste y poste ──
  const panos = textura(256, 64, (g, w, h) => {
    const r = ruido2d(6, 5, w, h);
    for (let i = 0; i < 2; i++) { g.fillStyle = i ? "#efe3c6" : "#a3182a"; g.fillRect(i * w / 2, 0, w / 2, h); }
    const im = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = 0.78 + 0.26 * r(x, y) + 0.06 * Math.sin(x * 0.4); im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k; }
    g.putImageData(im, 0, 0);
    g.fillStyle = "rgba(60,30,20,.35)"; g.fillRect(0, 0, 3, h); g.fillRect(w / 2 - 1, 0, 3, h);
    g.fillStyle = "rgba(217,169,64,.9)"; g.fillRect(0, h - 5, w, 3);
  }, { repetir: true });
  const LARGO_TELA = 52;
  panos.repeat.set(LARGO_TELA / 3, 1);
  const pano = pon(new THREE.PlaneGeometry(LARGO_TELA, 0.5), M(0xffffff, { map: panos, side: THREE.DoubleSide, roughness: 0.9 }), TELA_X, 0.33, -LARGO_TELA / 2 + 6);
  pano.rotation.y = Math.PI / 2; pano.castShadow = true;
  const madera = M(0x7a5a3a, { roughness: 0.7 });
  pon(new THREE.BoxGeometry(0.05, 0.05, LARGO_TELA), madera, TELA_X, 0.61, -LARGO_TELA / 2 + 6).castShadow = true;
  pon(new THREE.BoxGeometry(0.04, 0.04, LARGO_TELA), madera, TELA_X, 0.07, -LARGO_TELA / 2 + 6);

  // ── Lo que pasa por los lados: postes, gallardetes, tiendas y chopos. Todo da la vuelta cada VUELTA metros ──
  const pasan = []; // { o, y0 } y0 = a qué distancia está con la cuenta a cero
  const pasa = (o, x, y0) => { o.position.x = x; escena.add(o); pasan.push({ o, y0 }); return o; };
  const geoPoste = new THREE.CylinderGeometry(0.028, 0.034, 0.7, 6); geoPoste.translate(0, 0.35, 0);
  for (let y = 0; y < VUELTA; y += 1.5) { const p = new THREE.Mesh(geoPoste, madera); p.castShadow = true; pasa(p, TELA_X, y); }
  // vallas de los lados con sus gallardetes
  const COLORES = [0xa3182a, 0xe9c46a, 0x1f4f8f, 0xefe3c6, 0x1f6b3a, 0x5b2a86];
  const geoAsta = new THREE.CylinderGeometry(0.018, 0.022, 1.7, 6); geoAsta.translate(0, 0.85, 0);
  const geoBandera = new THREE.BufferGeometry();
  geoBandera.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -0.22, 0, 0, -0.11, -0.5]), 3));
  geoBandera.computeVertexNormals();
  const banderas = [];
  for (const lado of [TELA_X - 1.66, TELA_X + 1.56]) {
    pon(new THREE.BoxGeometry(0.04, 0.04, LARGO_TELA), madera, lado, 0.5, -LARGO_TELA / 2 + 6).castShadow = true;
    pon(new THREE.BoxGeometry(0.035, 0.035, LARGO_TELA), madera, lado, 0.25, -LARGO_TELA / 2 + 6);
    for (let y = 0.7; y < VUELTA; y += 3) {
      const g = new THREE.Group();
      const asta = new THREE.Mesh(geoAsta, madera); asta.castShadow = true; g.add(asta);
      const b = new THREE.Mesh(geoBandera, M(COLORES[Math.floor(y / 3 + (lado > 0 ? 3 : 0)) % COLORES.length], { side: THREE.DoubleSide, roughness: 0.85 }));
      b.position.y = 1.68; g.add(b); banderas.push(b);
      pasa(g, lado, y);
      const corto = new THREE.Mesh(geoPoste, madera); corto.scale.y = 0.78; pasa(corto, lado, y + 1.5);
    }
  }
  // tiendas de los caballeros: cono a franjas sobre un tambor de lona
  const lona = (a, b) => textura(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); } }, { repetir: true });
  const tienda = (a, b, colorPunta) => {
    const g = new THREE.Group(), t = lona(a, b);
    const m = M(0xffffff, { map: t, roughness: 0.9 });
    const tambor = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.84, 0.95, 16, 1, true), m); tambor.position.y = 0.475; g.add(tambor);
    const techo = new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.95, 16), m); techo.position.y = 1.42; techo.castShadow = true; g.add(techo);
    const pin = new THREE.Mesh(geoAsta, madera); pin.scale.set(0.8, 0.35, 0.8); pin.position.y = 1.85; g.add(pin);
    const b2 = new THREE.Mesh(geoBandera, M(colorPunta, { side: THREE.DoubleSide })); b2.position.y = 2.42; b2.scale.setScalar(0.8); g.add(b2); banderas.push(b2);
    return g;
  };
  pasa(tienda("#a3182a", "#efe3c6", 0xe9c46a), -3.4, 5);
  pasa(tienda("#1f4f8f", "#efe3c6", 0xa3182a), 3.1, 13);
  pasa(tienda("#e9c46a", "#efe3c6", 0x1f6b3a), -3.7, 22);
  pasa(tienda("#1f6b3a", "#efe3c6", 0xe9c46a), 3.4, 30);
  for (let i = 0; i < 12; i++) {
    const lado = i % 2 ? 1 : -1;
    pasa(crearChopo(2.6 + (i % 3) * 0.5, i % 4 === 0 ? 0x6f9a3e : 0x5a8a36), lado * (5 + (i % 3) * 0.9), i * 3 + 1.2);
  }

  // ── Al fondo, el puente de piedra (no se acerca: está lejos) ──
  const puente = new THREE.Group(); puente.position.set(0, 0, -58); escena.add(puente);
  const piedra = M(0xa8946f, { roughness: 0.95, fog: false });
  {
    const f = new THREE.Shape();
    const W = 30, H = 2.5;
    f.moveTo(-W, 0); f.lineTo(W, 0); f.lineTo(W, H); f.lineTo(0, H + 0.5); f.lineTo(-W, H); f.closePath();
    for (let x = -W + 3.5; x < W - 2; x += 5.5) {
      const ojo = new THREE.Shape();
      ojo.moveTo(x - 1.8, 0); ojo.lineTo(x - 1.8, 1.1); ojo.absarc(x, 1.1, 1.8, Math.PI, 0, true); ojo.lineTo(x + 1.8, 0); ojo.closePath();
      f.holes.push(ojo);
    }
    const arco = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 1.2, bevelEnabled: false }), piedra);
    puente.add(arco);
    pon(new THREE.BoxGeometry(60, 0.35, 0.2), piedra, 0, 2.9, 1.1, puente);
    // el río, por debajo
    const agua = pon(new THREE.PlaneGeometry(64, 5), M(0x6f9fc0, { roughness: 0.25, metalness: 0.2 }), 0, 0.03, 3.2, puente); agua.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 18; i++) { const c = crearChopo(3.6 + (i % 4) * 0.6, i % 3 ? 0x5a8a36 : 0x74a044); c.position.set(-26 + i * 3.1 + (i % 2) * 0.8, 0, -50 - (i % 3) * 1.5); escena.add(c); }

  // ── Los caballeros ──
  const acero = M(0xaeb6c0, { metalness: 0.85, roughness: 0.32 });
  function caballero({ tela, ribete, capa, pluma, haciaCamara }) {
    const g = new THREE.Group(); escena.add(g);
    const cab = crearCaballo({ capa, gualdrapa: tela, ribete, crin: 0x18120e });
    cab.grupo.scale.setScalar(0.95);
    cab.grupo.rotation.y = haciaCamara ? 0 : Math.PI;
    g.add(cab.grupo);
    const per = crearPersona({ camisa: 0x9aa2ac, mangas: 0x9aa2ac, pantalon: 0x8d949c, piel: 0x9aa2ac, pelo: 0x8d949c, calzado: 0x5a5f66, faja: tela });
    for (const k of ["camisa", "mangas", "pantalon", "piel", "pelo"]) { per.materiales[k].metalness = 0.8; per.materiales[k].roughness = 0.36; }
    per.grupo.scale.setScalar(0.74);
    per.grupo.position.set(0, 0.375, -0.02);
    cab.cuerpo.add(per.grupo); per.grupo.position.y = 0.375 - 0.6; // sentado en la silla, bota con el caballo
    per.piernas.forEach((p) => { p.cadera.rotation.x = -1.05; p.cadera.rotation.z = p.l * 0.62; p.rodilla.rotation.x = 1.15; });
    per.torso.rotation.x = 0.16;
    // yelmo con cimera
    const yelmo = per.pon(new THREE.SphereGeometry(0.085, 16, 12), acero, 0, 0.005, 0, per.cabeza); yelmo.scale.set(1, 1.12, 1.1);
    per.pon(new THREE.BoxGeometry(0.12, 0.014, 0.02), M(0x15171a), 0, 0.012, 0.088, per.cabeza);
    const cim = per.pon(new THREE.ConeGeometry(0.035, 0.2, 8), M(pluma, { roughness: 0.9 }), 0, 0.16, -0.03, per.cabeza); cim.rotation.x = -0.5;
    // sobreveste: la tela con sus colores encima de la coraza
    const sv = per.pon(new THREE.CylinderGeometry(0.1, 0.115, 0.22, 12, 1, true), M(tela, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.1, 0, per.torso); sv.scale.z = 0.8;
    // brazos: el de la lanza, recogido; el del escudo, doblado por delante
    per.brazos.forEach((b) => { b.hombro.rotation.x = -0.55; b.hombro.rotation.z = b.l * 0.35; b.codo.rotation.x = -1.2; });
    return { g, cab, per };
  }
  const escudoDe = (pal) => {
    const g = new THREE.Group();
    const ancho = ESCUDO.borde * ABRE; // de medio lado: lo que cuenta como golpe
    const f = new THREE.Shape();
    f.moveTo(-ancho, ancho * 0.9); f.lineTo(ancho, ancho * 0.9); f.lineTo(ancho, -ancho * 0.2);
    f.quadraticCurveTo(ancho * 0.9, -ancho * 1.2, 0, -ancho * 1.75); f.quadraticCurveTo(-ancho * 0.9, -ancho * 1.2, -ancho, -ancho * 0.2); f.closePath();
    const cara = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), M(pal.escudo, { roughness: 0.5 }));
    cara.castShadow = true; g.add(cara);
    // banda (lo que cuenta como «buen golpe») y la bloca dorada del centro (lanza rota)
    const banda = new THREE.Mesh(new THREE.BoxGeometry(ESCUDO.medio * ABRE * 2, ancho * 2.5, 0.006), M(pal.banda, { roughness: 0.55 })); banda.position.set(0, -ancho * 0.4, 0.026); g.add(banda);
    const bloca = new THREE.Mesh(new THREE.SphereGeometry(ESCUDO.centro * ABRE * 1.05, 14, 10), M(0xe9b44c, { metalness: 1, roughness: 0.25 })); bloca.position.set(0, 0, 0.03); bloca.scale.z = 0.6; g.add(bloca);
    return g;
  };
  // tú: caballo castaño con gualdrapa carmesí y oro, de espaldas
  const yo = caballero({ tela: 0x9c1c24, ribete: 0xe9c46a, capa: 0x5a3a22, pluma: 0xefe3c6, haciaCamara: false });
  yo.g.position.set(YO.x, 0, -YO.y);
  { const e = escudoDe({ escudo: "#9c1c24", banda: "#e9c46a" }); e.scale.setScalar(1.6); e.rotation.y = Math.PI * 0.62; e.position.set(-0.2, 0.92, -0.08); yo.g.add(e); }
  // los rivales: uno por paleta, se enseña el que toca
  const rivales = PALETAS.map((pal, i) => {
    const r = caballero({ tela: pal.tela, ribete: pal.ribete, capa: [0x2a2420, 0xd8d2c8, 0x6a4a2c, 0x3a2a20, 0x8a8480, 0x4a3020][i], pluma: pal.ribete, haciaCamara: true });
    const e = escudoDe(pal); e.position.set(0.17, ALTO_LANZA, 0.16); r.g.add(e); r.escudo = e;
    // su lanza, hacia ti
    const geo = new THREE.CylinderGeometry(0.012, 0.026, 1.9, 8); geo.rotateX(Math.PI / 2);
    const l = new THREE.Mesh(geo, M(0xe2d2a6, { roughness: 0.6 })); l.position.set(-0.2, 0.98, 0.75); l.rotation.y = 0.1; l.castShadow = true; r.g.add(l);
    r.g.visible = false;
    return r;
  });

  // ── Tu lanza: de la mano a la punta (que cruza por encima de la tela) ──
  const LARGO = 3;
  const lanza = new THREE.Group(); escena.add(lanza);
  {
    // (un grupo con lookAt apunta su +z al objetivo: la lanza se construye a lo largo de +z, con el puño 0,45 m por delante del cuento)
    const geo = new THREE.CylinderGeometry(0.011, 0.028, LARGO, 10); geo.rotateX(Math.PI / 2); geo.translate(0, 0, LARGO / 2 - 0.45);
    const asta = new THREE.Mesh(geo, M(0xe6d3a3, { roughness: 0.55 })); asta.castShadow = true; lanza.add(asta); lanza.asta = asta;
    // a franjas, como las de torneo
    for (let i = 0; i < 5; i++) { const r = 0.0135 + 0.0027 * (4 - i); const a = pon(new THREE.CylinderGeometry(r, r + 0.001, 0.09, 10), M(0x9c1c24), 0, 0, 0.3 + i * 0.3, asta); a.rotation.x = Math.PI / 2; }
    const hierro = pon(new THREE.ConeGeometry(0.02, 0.07, 8), acero, 0, 0, LARGO - 0.45 + 0.03, asta); hierro.rotation.x = Math.PI / 2;
    const guarda = pon(new THREE.ConeGeometry(0.06, 0.1, 12, 1, true), acero, 0, 0, 0.04, lanza); guarda.rotation.x = -Math.PI / 2;
    const geoRota = new THREE.CylinderGeometry(0.02, 0.028, 0.75, 8); geoRota.rotateX(Math.PI / 2); geoRota.translate(0, 0, 0.375 - 0.45);
    lanza.rota = new THREE.Mesh(geoRota, asta.material); lanza.rota.visible = false; lanza.add(lanza.rota);
  }
  const mano = new THREE.Vector3(), punta = new THREE.Vector3();

  function medir(m) { base.medir(m, campo.vista3d()); }

  const fx = base.efectos;
  fx.ponerMotas({ n: 40, caja: [-2.5, 2.5, 0.1, 3, -9, 1], color: 0xfff0c8, tam: 0.03, opacidad: 0.35 });
  let chocado = -1, polvo = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.3, y: 0.25, z: 1.4 }, dt);
    // el suelo corre
    hierba.offset.y = (v.distancia / TESELA) % 1; arena.offset.y = hierba.offset.y;
    panos.offset.x = (v.distancia / 3) % 1;
    for (const p of pasan) { const y = ((p.y0 - v.distancia) % VUELTA + VUELTA) % VUELTA - 5.5; p.o.position.z = -y; }
    const s = d.ahora / 1000;
    if (!reducido) banderas.forEach((b, i) => { b.rotation.y = 0.25 * Math.sin(s * 5 + i * 1.7); b.rotation.x = 0.12 * Math.sin(s * 6.3 + i); });
    // tu caballo
    galopar(yo.cab, v.distancia * 0.62, v.brio);
    // tu lanza
    mano.set(YO.x + 0.17, 1.0 + 0.03 * v.brio * Math.sin(v.distancia * 0.62 * Math.PI * 2), -(YO.y + 0.12));
    punta.set(aLado(v.punta), ALTO_LANZA, -Y_CHOQUE);
    lanza.position.copy(mano);
    lanza.lookAt(punta);
    // se estira lo justo para que la punta caiga a la distancia del choque
    const largoHastaPunta = mano.distanceTo(punta);
    lanza.asta.scale.z = (largoHastaPunta + 0.02) / (LARGO - 0.45);
    lanza.asta.visible = !v.lanzaRota; lanza.rota.visible = v.lanzaRota;
    yo.per.brazos[0].hombro.rotation.z = -0.5 - 0.3 * v.punta; // el brazo acompaña
    // el rival
    rivales.forEach((r, i) => {
      const ve = v.hayRival && i === v.rival && v.yRival > -D + 0.6 && v.yRival < 40;
      r.g.visible = ve;
      if (!ve) return;
      r.g.position.set(aLado(v.escudo) - 0.17, 0, -(v.yRival - 0.16));
      galopar(r.cab, s * 2.3 + i * 0.3, v.menu ? 0.6 : 1);
      // el escudo no bota con el caballo: va donde dice el motor
      r.escudo.position.y = ALTO_LANZA;
      // tocado: se echa atrás en la silla
      const golpe = v.choque && v.choque.zona !== "fallo" ? Math.max(0, 1 - v.choque.hace / 500) : 0;
      r.per.torso.rotation.x = 0.16 - golpe * (v.choque?.zona === "centro" ? 0.75 : 0.35);
    });
    // polvo de los cascos
    polvo -= dt * (0.6 + v.brio * 3);
    if (polvo <= 0 && d.estado !== "fin") {
      polvo = 0.5;
      fx.humo({ x: YO.x, y: 0.08, z: -YO.y + 0.4, ancho: 0.12, n: 1, color: 0xd9c8a0, tam: [0.12, 0.5], opacidad: 0.3 * v.brio, abre: 0.2, sube: 0.25, vida: 0.7 });
      if (v.hayRival && v.yRival < 9) fx.humo({ x: aLado(v.escudo) - 0.17, y: 0.08, z: -v.yRival - 0.5, ancho: 0.12, n: 1, color: 0xd9c8a0, tam: [0.12, 0.55], opacidad: 0.3, abre: 0.2, sube: 0.25, vida: 0.7 });
    }
    // el choque: astillas, chispa y sacudida
    if (v.choque && v.choque.t !== chocado) {
      chocado = v.choque.t;
      const x = aLado(v.choque.punta), z = -Y_CHOQUE;
      if (v.choque.zona === "centro") {
        fx.sacudir(0.9);
        fx.trozos({ x, y: ALTO_LANZA, z, n: 26, colores: [0xe6d3a3, 0xcbb47e, 0x9c1c24, 0xf4ead0], fuerza: 1.6, arriba: 2.4, vz: 2.5, tam: [0.012, 0.05], gravedad: 6, vida: 1.1 });
        fx.humo({ x, y: ALTO_LANZA, z, n: 3, color: 0xfff1c8, tam: [0.1, 0.55], opacidad: 0.8, vida: 0.3, luz: true });
      } else if (v.choque.zona !== "fallo") {
        fx.sacudir(v.choque.zona === "medio" ? 0.5 : 0.25);
        fx.trozos({ x, y: ALTO_LANZA, z, n: v.choque.zona === "medio" ? 12 : 5, colores: [0xe6d3a3, 0xffe9a8, 0xcbb47e], fuerza: 1.1, arriba: 1.6, vz: 1.5, tam: [0.008, 0.026], gravedad: 6, vida: 0.7 });
        fx.humo({ x, y: ALTO_LANZA, z, n: 1, color: 0xfff1c8, tam: [0.06, 0.3], opacidad: 0.6, vida: 0.22, luz: true });
      }
    }
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
