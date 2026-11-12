// La Justa del Paso Honroso, en 3D. Aquí solo se dibuja: dónde está la punta de la lanza y el escudo del rival sale
// de motor-justa.js y de la «vista» de juego-justa.js, la misma que usa el dibujo plano.
//
// El palenque junto al puente de Hospital de Órbigo, en la vega: hierba, dos calles de arena, la tela (la valla de
// tablas con paños) por el medio, vallas con gallardetes a los lados, las tiendas de los caballeros, chopos y, al
// fondo, el puente de piedra. Se ve desde tu caballo, a la altura de tus ojos: delante, la cabeza del caballo; por
// abajo a la derecha entra tu lanza, que cruza la tela; el rival viene de frente por el otro lado. El choque es en el
// plano z = 0, que la cámara ve tal cual (el mismo píxel que el dedo y que el dibujo plano).
import { crearBase, textura, ruido2d, THREE } from "./base-3d.js";
import { crearPersona, crearCaballo, galopar, crearChopo, texturaSuelo } from "./comun-3d.js";
import { plano, D, TELA_X, PUNTA_X, RIVAL_X, alto, RADIO, PALETAS } from "./juego-justa.js";
import { ESCUDO } from "./motor-justa.js";

const VUELTA = 40; // cada cuánto se repite lo que pasa por los lados (m)
const S = 2.4; // escala de caballos y jinetes (el caballo de comun-3d mide 1 de largo)

export function crearEscena({ lienzo, contexto, foto, reducido }) {
  const base = crearBase({
    lienzo, contexto, foto, reducido, lejos: 80,
    cielo: { colores: [[0, "#3f77c9"], [0.42, "#bcd9ee"], [0.5, "#f3ead2"], [0.54, "#7f9a58"], [1, "#3c4a28"]], luces: [{ x: 0.3, y: 0.3, r: 0.12, color: "rgba(255,240,205,1)" }], intensidad: 0.9 },
  });
  const { escena } = base;
  escena.fog = new THREE.Fog(0xd2e2ec, 26, 120);

  escena.add(new THREE.HemisphereLight(0xcfe2ff, 0x6c7a45, 1.0));
  // el sol, por detrás y a la izquierda: el escudo del rival (que mira hacia ti) queda iluminado
  const sol = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sol.position.set(-3.5, 7, 7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 6, bottom: -10, near: 1, far: 30 });
  sol.shadow.radius = 3; sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
  sol.target.position.set(-0.4, 0, -2);
  escena.add(sol, sol.target);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const pon = (geo, material, x, y, z, padre = escena) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); padre.add(o); return o; };

  // ── La vega: hierba y las dos calles de arena, que corren hacia la cámara ──
  const hierba = texturaSuelo({ oscuro: [70, 112, 44], claro: [128, 168, 72], semilla: 3, briznas: 900 });
  hierba.repeat.set(30, 50);
  const prado = pon(new THREE.PlaneGeometry(70, 100), M(0xffffff, { map: hierba, roughness: 0.95 }), 0, 0, -42);
  prado.rotation.x = -Math.PI / 2; prado.receiveShadow = true;
  const arena = texturaSuelo({ oscuro: [176, 150, 104], claro: [222, 200, 150], semilla: 12, briznas: 260, color: "rgba(120,96,60,.35)" });
  arena.repeat.set(1, 50);
  const matArena = M(0xffffff, { map: arena, roughness: 1 });
  for (const [x0, x1] of [[TELA_X - 1.5, TELA_X - 0.06], [TELA_X + 0.06, TELA_X + 1.5]]) {
    const c = pon(new THREE.PlaneGeometry(x1 - x0, 100), matArena, (x0 + x1) / 2, 0.004, -42);
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
    g.fillStyle = "rgba(217,169,64,.9)"; g.fillRect(0, h - 5, w, 3); g.fillRect(0, 2, w, 3);
  }, { repetir: true });
  const LARGO_TELA = 90, Z_TELA = -LARGO_TELA / 2 + D + 1;
  panos.repeat.set(LARGO_TELA / 3, 1);
  const pano = pon(new THREE.PlaneGeometry(LARGO_TELA, 0.72), M(0xffffff, { map: panos, side: THREE.DoubleSide, roughness: 0.9 }), TELA_X, 0.5, Z_TELA);
  pano.rotation.y = Math.PI / 2; pano.castShadow = true; pano.receiveShadow = true;
  const madera = M(0x7a5a3a, { roughness: 0.7 });
  pon(new THREE.BoxGeometry(0.07, 0.07, LARGO_TELA), madera, TELA_X, 0.92, Z_TELA).castShadow = true;
  pon(new THREE.BoxGeometry(0.05, 0.05, LARGO_TELA), madera, TELA_X, 0.11, Z_TELA);

  // ── Lo que pasa por los lados: postes, gallardetes, tiendas y chopos. Todo da la vuelta cada VUELTA metros ──
  const pasan = []; // { o, y0 } y0 = a qué distancia está con la cuenta a cero
  const pasa = (o, x, y0) => { o.position.x = x; escena.add(o); pasan.push({ o, y0 }); return o; };
  const geoPoste = new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6); geoPoste.translate(0, 0.5, 0);
  for (let y = 0; y < VUELTA; y += 2) { const p = new THREE.Mesh(geoPoste, madera); p.castShadow = true; pasa(p, TELA_X, y); }
  // vallas de los lados con sus gallardetes
  const COLORES = [0xa3182a, 0xe9c46a, 0x1f4f8f, 0xefe3c6, 0x1f6b3a, 0x5b2a86];
  const geoAsta = new THREE.CylinderGeometry(0.025, 0.03, 3, 6); geoAsta.translate(0, 1.5, 0);
  const geoBandera = new THREE.BufferGeometry();
  geoBandera.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -0.4, 0, 0, -0.2, -0.9]), 3));
  geoBandera.computeVertexNormals();
  const banderas = [];
  for (const lado of [TELA_X - 1.75, TELA_X + 1.7]) {
    pon(new THREE.BoxGeometry(0.06, 0.06, LARGO_TELA), madera, lado, 0.85, Z_TELA).castShadow = true;
    pon(new THREE.BoxGeometry(0.05, 0.05, LARGO_TELA), madera, lado, 0.45, Z_TELA);
    for (let y = 1; y < VUELTA; y += 4) {
      const g = new THREE.Group();
      const asta = new THREE.Mesh(geoAsta, madera); asta.castShadow = true; g.add(asta);
      const b = new THREE.Mesh(geoBandera, M(COLORES[Math.floor(y / 4 + (lado > 0 ? 3 : 0)) % COLORES.length], { side: THREE.DoubleSide, roughness: 0.85 }));
      b.position.y = 2.97; g.add(b); banderas.push(b);
      pasa(g, lado, y);
      const corto = new THREE.Mesh(geoPoste, madera); corto.scale.y = 0.9; pasa(corto, lado, y + 2);
    }
  }
  // tiendas de los caballeros: cono a franjas sobre un tambor de lona
  const lona = (a, b) => textura(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); } }, { repetir: true });
  const tienda = (a, b, colorPunta) => {
    const g = new THREE.Group(), t = lona(a, b);
    const m = M(0xffffff, { map: t, roughness: 0.9 });
    const tambor = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 1.9, 18, 1, true), m); tambor.position.y = 0.95; g.add(tambor);
    const techo = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.9, 18), m); techo.position.y = 2.85; techo.castShadow = true; g.add(techo);
    const pin = new THREE.Mesh(geoAsta, madera); pin.scale.set(0.8, 0.35, 0.8); pin.position.y = 3.7; g.add(pin);
    const b2 = new THREE.Mesh(geoBandera, M(colorPunta, { side: THREE.DoubleSide })); b2.position.y = 4.7; b2.scale.setScalar(0.8); g.add(b2); banderas.push(b2);
    return g;
  };
  pasa(tienda("#a3182a", "#efe3c6", 0xe9c46a), -6.2, 6);
  pasa(tienda("#1f4f8f", "#efe3c6", 0xa3182a), 5.6, 15);
  pasa(tienda("#e9c46a", "#efe3c6", 0x1f6b3a), -6.6, 25);
  pasa(tienda("#1f6b3a", "#efe3c6", 0xe9c46a), 6.0, 34);
  for (let i = 0; i < 14; i++) {
    const lado = i % 2 ? 1 : -1;
    pasa(crearChopo(5.2 + (i % 3) * 1, i % 4 === 0 ? 0x6f9a3e : 0x5a8a36), lado * (9 + (i % 3) * 1.6), i * 2.9 + 1.2);
  }
  // gente mirando detrás de las vallas (de lejos, sencilla)
  const gente = [];
  for (let i = 0; i < 10; i++) {
    const p = crearPersona({ camisa: [0xe9e2d2, 0x7a94b8, 0x9c1c24, 0x2f5d8a, 0xc9871f][i % 5], pantalon: [0x3a342e, 0x4a3c2c, 0x2a2622][i % 3], pelo: [0x2a1c12, 0x8a8880, 0x5a3a22][i % 3] });
    p.grupo.scale.setScalar(1.65 + (i % 3) * 0.06);
    p.grupo.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
    gente.push(p);
    pasa(p.grupo, (i % 2 ? TELA_X + 2.3 : TELA_X - 2.35) + (i % 3) * 0.25, 3.5 + i * 3.7);
  }

  // ── Al fondo, el puente de piedra (no se acerca: está lejos) ──
  const puente = new THREE.Group(); puente.position.set(0, 0, -95); escena.add(puente);
  const piedra = M(0xa8946f, { roughness: 0.95, fog: false });
  {
    const f = new THREE.Shape();
    const W = 50, H = 4.5;
    f.moveTo(-W, 0); f.lineTo(W, 0); f.lineTo(W, H); f.lineTo(0, H + 0.9); f.lineTo(-W, H); f.closePath();
    for (let x = -W + 6; x < W - 3; x += 9.5) {
      const ojo = new THREE.Shape();
      ojo.moveTo(x - 3.1, 0); ojo.lineTo(x - 3.1, 2); ojo.absarc(x, 2, 3.1, Math.PI, 0, true); ojo.lineTo(x + 3.1, 0); ojo.closePath();
      f.holes.push(ojo);
    }
    puente.add(new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 2, bevelEnabled: false }), piedra));
    pon(new THREE.BoxGeometry(100, 0.6, 0.35), piedra, 0, 5.2, 1.85, puente);
    const agua = pon(new THREE.PlaneGeometry(110, 9), M(0x6f9fc0, { roughness: 0.25, metalness: 0.2, fog: false }), 0, 0.03, 5.5, puente); agua.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 18; i++) { const c = crearChopo(6.5 + (i % 4) * 1, i % 3 ? 0x5a8a36 : 0x74a044); c.position.set(-44 + i * 5.2 + (i % 2) * 1.4, 0, -84 - (i % 3) * 2.5); escena.add(c); }

  // ── Los caballeros ──
  const acero = M(0xaeb6c0, { metalness: 0.85, roughness: 0.32 });
  function caballero({ tela, ribete, capa, pluma }) {
    const g = new THREE.Group(); escena.add(g);
    const cuerpo = new THREE.Group(); cuerpo.scale.setScalar(S); g.add(cuerpo);
    const cab = crearCaballo({ capa, gualdrapa: tela, ribete, crin: 0x18120e });
    cuerpo.add(cab.grupo);
    const per = crearPersona({ camisa: 0x9aa2ac, mangas: 0x9aa2ac, pantalon: 0x8d949c, piel: 0x9aa2ac, pelo: 0x8d949c, calzado: 0x5a5f66, faja: tela });
    for (const k of ["camisa", "mangas", "pantalon", "piel", "pelo"]) { per.materiales[k].metalness = 0.8; per.materiales[k].roughness = 0.36; }
    per.grupo.scale.setScalar(0.78);
    cab.cuerpo.add(per.grupo); per.grupo.position.set(0, 0.375 - 0.6, -0.02); // sentado en la silla, bota con el caballo
    per.piernas.forEach((p) => { p.cadera.rotation.x = -1.05; p.cadera.rotation.z = p.l * 0.62; p.rodilla.rotation.x = 1.15; });
    per.torso.rotation.x = 0.16;
    // yelmo de justa (cara de sapo) con cimera
    const yelmo = per.pon(new THREE.SphereGeometry(0.085, 16, 12), acero, 0, 0.005, 0, per.cabeza); yelmo.scale.set(1, 1.15, 1.15);
    per.pon(new THREE.BoxGeometry(0.12, 0.012, 0.02), M(0x15171a), 0, 0.02, 0.09, per.cabeza);
    const cim = per.pon(new THREE.ConeGeometry(0.035, 0.22, 8), M(pluma, { roughness: 0.9 }), 0, 0.17, -0.03, per.cabeza); cim.rotation.x = -0.5;
    // sobreveste con sus colores encima de la coraza
    const sv = per.pon(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 12, 1, true), M(tela, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.1, 0, per.torso); sv.scale.z = 0.8;
    per.brazos.forEach((b) => { b.hombro.rotation.x = -0.55; b.hombro.rotation.z = b.l * 0.35; b.codo.rotation.x = -1.2; });
    return { g, cab, per };
  }
  // El escudo del rival: una tarja redonda pintada en anillos. Lo que pinta es exactamente lo que puntúa: la bloca
  // dorada (lanza rota), la banda (buen golpe) y el campo (de refilón). Fuera del escudo, al aire.
  const escudoDe = (pal) => {
    const g = new THREE.Group();
    const cara = new THREE.Mesh(new THREE.CylinderGeometry(RADIO, RADIO * 0.96, 0.03, 40), M(pal.escudo, { roughness: 0.55 }));
    cara.rotation.x = Math.PI / 2; cara.castShadow = true; g.add(cara);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(RADIO, 0.012, 8, 40), acero); borde.position.z = 0.012; g.add(borde);
    const anillo = new THREE.Shape(); anillo.absarc(0, 0, RADIO * (ESCUDO.medio / ESCUDO.borde), 0, Math.PI * 2, false);
    const hueco = new THREE.Shape(); hueco.absarc(0, 0, RADIO * (ESCUDO.centro / ESCUDO.borde) * 1.05, 0, Math.PI * 2, true); anillo.holes.push(hueco);
    const banda = new THREE.Mesh(new THREE.ShapeGeometry(anillo, 40), M(pal.banda, { roughness: 0.55 }));
    banda.position.z = 0.017; g.add(banda);
    const filo = new THREE.Mesh(new THREE.TorusGeometry(RADIO * (ESCUDO.medio / ESCUDO.borde), 0.004, 6, 40), M(0x1c1a18)); filo.position.z = 0.018; g.add(filo);
    const bloca = new THREE.Mesh(new THREE.SphereGeometry(RADIO * (ESCUDO.centro / ESCUDO.borde), 18, 12), M(0xe9b44c, { metalness: 1, roughness: 0.22 }));
    bloca.position.z = 0.016; bloca.scale.z = 0.55; g.add(bloca);
    // la marca del golpe (se coloca en el choque)
    const marca = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.85 }));
    marca.position.z = 0.03; marca.visible = false; g.add(marca); g.marca = marca;
    return g;
  };
  // los rivales: uno por paleta, se enseña el que toca
  const rivales = PALETAS.map((pal, i) => {
    const r = caballero({ tela: pal.tela, ribete: pal.ribete, capa: [0x2a2420, 0xd8d2c8, 0x6a4a2c, 0x3a2a20, 0x8a8480, 0x4a3020][i], pluma: pal.ribete });
    r.escudo = escudoDe(pal); escena.add(r.escudo);
    r.escudo.rotation.y = 0.18; // un poco vuelto hacia la tela
    // su lanza, hacia ti (pasa a tu izquierda)
    const geo = new THREE.CylinderGeometry(0.016, 0.034, 3.6, 8); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 1.8);
    r.lanza = new THREE.Mesh(geo, M(0xe2d2a6, { roughness: 0.6 })); r.lanza.castShadow = true; escena.add(r.lanza);
    r.g.visible = false; r.escudo.visible = false; r.lanza.visible = false;
    return r;
  });

  // ── Tu caballo: de él solo se ven el cuello y la cabeza, delante y abajo ──
  const miCaballo = crearCaballo({ capa: 0x5a3a22, gualdrapa: 0x9c1c24, ribete: 0xe9c46a, crin: 0x18120e });
  miCaballo.grupo.scale.setScalar(S); miCaballo.grupo.rotation.y = Math.PI;
  miCaballo.grupo.position.set(0, -0.12, D + 0.25);
  miCaballo.cuello.children[1].scale.set(0.45, 1, 0.6); // la crin, vista desde la silla, más fina
  escena.add(miCaballo.grupo);

  // ── Tu lanza: del puño (abajo a la derecha, fuera de cámara) a la punta, que cruza la tela ──
  const lanza = new THREE.Group(); escena.add(lanza);
  const matAsta = M(0xe6d3a3, { roughness: 0.55 });
  {
    // a lo largo de +z (lookAt), de 1 de largo: se estira cada cuadro hasta la punta
    const geo = new THREE.CylinderGeometry(0.016, 0.04, 1, 12); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    const asta = new THREE.Mesh(geo, matAsta); asta.castShadow = true; lanza.add(asta); lanza.asta = asta;
    // franjas de torneo, en espiral
    lanza.franjas = [];
    for (let i = 0; i < 9; i++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), M(0x9c1c24, { roughness: 0.6 })); a.rotation.x = Math.PI / 2; lanza.add(a); lanza.franjas.push(a); }
    // el coronel: la punta roma de tres dientes de las lanzas de justa
    const coronel = new THREE.Group(); lanza.add(coronel); lanza.coronel = coronel;
    pon(new THREE.CylinderGeometry(0.03, 0.018, 0.07, 10), acero, 0, 0, 0, coronel).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const d = pon(new THREE.ConeGeometry(0.01, 0.04, 6), acero, 0.018 * Math.cos(i * 2.09), 0.018 * Math.sin(i * 2.09), 0.05, coronel); d.rotation.x = Math.PI / 2; }
    // la arandela que protege la mano, y el guantelete
    const guarda = pon(new THREE.ConeGeometry(0.15, 0.24, 18, 1, true), acero, 0, 0, 0.32, lanza); guarda.rotation.x = -Math.PI / 2; guarda.material = acero;
    const guante = pon(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), acero, 0.02, -0.07, 0.05, lanza); guante.rotation.x = Math.PI / 2 - 0.3;
    // lo que queda de lanza cuando se rompe
    const geoRota = new THREE.CylinderGeometry(0.03, 0.04, 1, 10); geoRota.rotateX(Math.PI / 2); geoRota.translate(0, 0, 0.5);
    lanza.rota = new THREE.Mesh(geoRota, matAsta); lanza.rota.visible = false; lanza.add(lanza.rota);
    const astillas = pon(new THREE.ConeGeometry(0.035, 0.16, 6), matAsta, 0, 0, 0, lanza); astillas.rotation.x = Math.PI / 2; astillas.visible = false; lanza.astillas = astillas;
  }
  const mano = new THREE.Vector3(), punta = new THREE.Vector3();

  function medir(m) { base.medir(m, plano); }

  const fx = base.efectos;
  fx.ponerMotas({ n: 40, caja: [-3, 3, 0.2, 3.5, -12, 2], color: 0xfff0c8, tam: 0.035, opacidad: 0.35 });
  let chocado = -1, polvo = 0;
  function dibujar(d) {
    const v = d.vista;
    const dt = Math.min(0.1, (d.ahora - (dibujar.antes || d.ahora)) / 1000); dibujar.antes = d.ahora;
    base.moverCamara(d, { x: 0.25, y: 0.2, z: 1.2 }, dt);
    // el suelo corre
    hierba.offset.y = (v.distancia / TESELA) % 1; arena.offset.y = hierba.offset.y;
    panos.offset.x = (v.distancia / 3) % 1;
    for (const p of pasan) { const y = ((p.y0 - v.distancia) % VUELTA + VUELTA) % VUELTA - 6; p.o.position.z = -y; }
    const s = d.ahora / 1000;
    if (!reducido) banderas.forEach((b, i) => { b.rotation.y = 0.25 * Math.sin(s * 5 + i * 1.7); b.rotation.x = 0.12 * Math.sin(s * 6.3 + i); });
    gente.forEach((p, i) => { p.brazos[i % 2].hombro.rotation.x = -0.3 - 0.4 * Math.max(0, Math.sin(s * 3 + i)); });
    // tu caballo
    const fase = v.distancia * 0.32;
    galopar(miCaballo, fase, v.brio);
    miCaballo.cuello.rotation.x += 0.5; // al galope, con el cuello estirado: la cabeza queda abajo y no tapa
    // tu lanza: del puño a la punta, que está donde dice el motor (a la altura que marca tu dedo)
    mano.set(0.3, 1.78 + 0.05 * v.brio * Math.sin(fase * Math.PI * 2), D - 0.55);
    punta.set(PUNTA_X, alto(v.punta), 0);
    lanza.position.copy(mano);
    lanza.lookAt(punta);
    const largo = mano.distanceTo(punta);
    const rota = v.lanzaRota;
    lanza.asta.scale.set(1, 1, largo); lanza.asta.visible = !rota;
    lanza.franjas.forEach((f, i) => {
      const u = 0.18 + i * 0.085, z = largo * u, r = 0.04 - 0.024 * u + 0.002;
      f.position.set(0, 0, z); f.scale.set(r, 0.07 * largo / 3.5, r); f.visible = !rota || u < 0.32;
    });
    lanza.coronel.position.set(0, 0, largo - 0.02); lanza.coronel.visible = !rota;
    lanza.rota.scale.set(1, 1, largo * 0.34); lanza.rota.visible = rota;
    lanza.astillas.position.set(0, 0, largo * 0.34 + 0.05); lanza.astillas.visible = rota;
    // el rival
    rivales.forEach((r, i) => {
      const ve = v.hayRival && i === v.rival && v.yRival > -D - 2 && v.yRival < 60;
      r.g.visible = ve; r.escudo.visible = ve; r.lanza.visible = ve;
      if (!ve) { r.escudo.marca.visible = false; return; }
      const z = -v.yRival;
      r.g.position.set(RIVAL_X, 0, z - 0.4);
      galopar(r.cab, v.menu ? s * 1.3 : s * 2.2 + i * 0.3, v.menu ? 0.55 : 1);
      // el escudo no bota con el caballo: va a la altura que dice el motor
      const h = alto(v.escudo);
      r.escudo.position.set(PUNTA_X, h, z);
      // el brazo del escudo acompaña la altura
      const izq = r.per.brazos[1];
      izq.hombro.rotation.x = -0.9 - (h - 1.6) * 1.1; izq.hombro.rotation.z = 0.7;
      // su lanza, del puño derecho hacia ti
      const lx = RIVAL_X - 0.3, ly = 1.85 + 0.03 * Math.sin(s * 14), lz = z - 0.6;
      r.lanza.position.set(lx, ly, lz);
      r.lanza.lookAt(0.25, 1.75, lz + 3.8);
      // tocado: se echa atrás en la silla y el escudo cede
      const c = v.choque, golpe = c && c.zona !== "fallo" ? Math.max(0, 1 - c.hace / 600) : 0;
      const fuerte = c?.zona === "centro" ? 1 : c?.zona === "medio" ? 0.55 : 0.3;
      r.per.torso.rotation.x = 0.16 - golpe * 0.8 * fuerte;
      r.escudo.rotation.x = -golpe * 0.5 * fuerte;
      r.escudo.rotation.z = c?.zona === "borde" ? golpe * 0.6 * Math.sign(c.punta - c.escudo || 1) : 0;
      if (c && c.zona !== "fallo") {
        r.escudo.marca.visible = true;
        r.escudo.marca.position.y = (alto(c.punta) - alto(c.escudo));
      } else r.escudo.marca.visible = false;
    });
    // polvo de los cascos del rival
    polvo -= dt * (0.6 + v.brio * 3);
    if (polvo <= 0 && d.estado !== "fin") {
      polvo = 0.45;
      if (v.hayRival && v.yRival < 30) fx.humo({ x: RIVAL_X, y: 0.1, z: -v.yRival - 1.1, ancho: 0.25, n: 1, color: 0xd9c8a0, tam: [0.3, 1.1], opacidad: 0.3, abre: 0.3, sube: 0.35, vida: 0.8 });
    }
    // el choque: astillas, chispa y sacudida (justo en el punto donde ha dado)
    if (v.choque && v.choque.t !== chocado) {
      chocado = v.choque.t;
      const y = alto(v.choque.punta), x = PUNTA_X, z = 0.02;
      if (v.choque.zona === "centro") {
        fx.sacudir(1);
        fx.trozos({ x, y, z, n: 34, colores: [0xe6d3a3, 0xcbb47e, 0x9c1c24, 0xf4ead0], fuerza: 2.2, arriba: 2.6, vz: 2.2, tam: [0.02, 0.08], gravedad: 6, vida: 1.2 });
        fx.humo({ x, y, z, n: 3, color: 0xfff1c8, tam: [0.15, 0.8], opacidad: 0.85, vida: 0.32, luz: true });
      } else if (v.choque.zona !== "fallo") {
        fx.sacudir(v.choque.zona === "medio" ? 0.55 : 0.28);
        fx.trozos({ x, y, z, n: v.choque.zona === "medio" ? 14 : 6, colores: [0xe6d3a3, 0xffe9a8, 0xcbb47e], fuerza: 1.4, arriba: 1.8, vz: 1.4, tam: [0.012, 0.04], gravedad: 6, vida: 0.8 });
        fx.humo({ x, y, z, n: 1, color: 0xfff1c8, tam: [0.1, 0.45], opacidad: 0.7, vida: 0.25, luz: true });
      }
    }
    base.pintar(d.ahora);
  }

  return { medir, dibujar, info: base.info };
}
