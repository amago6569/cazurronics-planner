// Canasta en la Catedral, en 3D. Aquí solo se dibuja: los puntos y la física que cuenta salen de motor-canasta.js.
//
// La canasta está de pie, con su poste, delante de la Catedral. La foto de la Catedral va detrás (es una imagen de la
// web, debajo de este lienzo transparente), desenfocada como en una foto de verdad, y se mueve mucho menos que la
// canasta cuando se mueve la cámara: eso es lo que da la profundidad.
//
// Mundo 3D: el centro del aro está en (0, 3,05, 0) y el tablero mira hacia +z, hacia quien tira. La canasta no se
// mueve (salvo en el último nivel, que se desliza de lado): cuando «cambia de sitio», quien se mueve es la cámara.
// Un punto del motor (x, y, z), visto desde el sitio de tiro s = {x: aro.x, z: aro.z}, está en el mundo en
// (x − s.x, y, s.z − z). Con la cámara quieta en su sitio, este dibujo coincide al píxel con proyectar() del motor,
// que es con lo que se calcula hacia dónde va el tiro.
import * as THREE from "./vendor/three-liga.js";
import { xAro, SALIDA, R_BALON, R_ARO, ALTURA_ARO, ARO_TABLERO, TABLERO, CAMARA, PASO } from "./motor-canasta.js";

const ARO_INICIAL = { z: 4.2, x: 0, viento: 0, amplitud: 0, periodo: 1, fase: 0 };
const FONDO_LEJOS = 52; // m de la cámara de referencia a la Catedral (solo para el movimiento de la foto)
const SOBRANTE = 1.12; // la foto se pinta un 12 % más grande para que, al moverse, nunca se le vean los bordes
const POSTE_Z = -1.35, R_POSTE = 0.085, ALTO_BRAZO = 2.8; // el brazo sale por debajo del tablero
const SUAVE = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

// Red: 12 cuerdas en rombo, 5 filas de nudos. Se simula como una tela sencilla (Verlet): cuelga, el balón la empuja y
// se balancea. Es solo para verse; no cambia nada del resultado del tiro.
const N_RED = 12, FILAS_RED = 5, LARGO_RED = 0.42, R_ABAJO = 0.13;
const PASO_SIM = 1 / 240;

export function webgl2(lienzo, forzar) {
  try {
    return lienzo.getContext("webgl2", {
      alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false,
      powerPreference: "high-performance",
      // si el móvil solo puede dibujar 3D sin tarjeta gráfica (muy lento), mejor la versión plana
      failIfMajorPerformanceCaveat: !forzar,
    });
  } catch { return null; }
}

export function crearEscena3D({ lienzo, contexto, foto, reducido = false, calidadFija = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, context: contexto });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(); // la proyección se pone a mano en medir()

  // ── Luz: el sol bajo de la tarde, por detrás y a la izquierda de quien tira (como en la foto), y el cielo ──
  const sol = new THREE.DirectionalLight(0xffe2c2, 2.5);
  sol.position.set(-3.4, 7.1, 6.6);
  sol.target.position.set(0, 2.95, -0.25);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 3, far: 16 });
  sol.shadow.radius = 4;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.012;
  escena.add(sol, sol.target);
  escena.add(new THREE.HemisphereLight(0xc2d5ee, 0x4f4238, 1.05));
  // contraluz fría desde detrás de la canasta: perfila el balón, el aro y el poste contra el fondo
  const contraluz = new THREE.DirectionalLight(0xb9d0ff, 0.9);
  contraluz.position.set(3.5, 4.2, -5.5);
  contraluz.target.position.set(0, 2.4, 0);
  escena.add(contraluz, contraluz.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromEquirectangular(texturaCielo()).texture;
  escena.environmentIntensity = 0.75;

  // ── La canasta (todo lo que se desliza junto en el último nivel) ──
  const canasta = new THREE.Group();
  escena.add(canasta);
  const metalOscuro = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.55 });
  const naranja = new THREE.MeshStandardMaterial({ color: 0xe0531c, roughness: 0.42, metalness: 0.25 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xeef3ff, roughness: 0.5, emissive: 0x262a30 }); // un punto frío: con el sol de la tarde se ve blanco
  const marco = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.38, metalness: 0.6 });
  const caja = (w, h, d, mat, x, y, z, sombra = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = sombra; m.receiveShadow = true;
    canasta.add(m);
    return m;
  };

  const zCara = -ARO_TABLERO; // cara delantera del tablero
  const yMedio = (TABLERO.abajo + TABLERO.arriba) / 2, altoT = TABLERO.arriba - TABLERO.abajo, anchoT = TABLERO.ancho;
  const grosor = 0.025;
  // cristal
  const cristal = new THREE.Mesh(
    new THREE.BoxGeometry(anchoT, altoT, grosor),
    new THREE.MeshStandardMaterial({ color: 0xd3e0e8, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0, depthWrite: false }),
  );
  cristal.position.set(0, yMedio, zCara - grosor / 2);
  canasta.add(cristal);
  // reflejo del cristal: una franja diagonal suave
  const reflejo = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoT, altoT),
    new THREE.MeshBasicMaterial({ map: texturaReflejo(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
  );
  reflejo.position.set(0, yMedio, zCara + 0.0006);
  canasta.add(reflejo);
  // sombras sobre el cristal (del aro, la red y el balón)
  const sombraCristal = new THREE.Mesh(new THREE.PlaneGeometry(anchoT, altoT), new THREE.ShadowMaterial({ opacity: 0.34 }));
  sombraCristal.position.set(0, yMedio, zCara + 0.001);
  sombraCristal.receiveShadow = true;
  canasta.add(sombraCristal);
  // marco de acero oscuro (se le ve el grosor desde abajo y de lado)
  const mw = 0.045, md = 0.05, zm = zCara - grosor / 2;
  caja(anchoT + 2 * mw, mw, md, marco, 0, TABLERO.arriba + mw / 2, zm);
  caja(anchoT + 2 * mw, mw, md, marco, 0, TABLERO.abajo - mw / 2, zm);
  caja(mw, altoT, md, marco, -(anchoT / 2 + mw / 2), yMedio, zm);
  caja(mw, altoT, md, marco, anchoT / 2 + mw / 2, yMedio, zm);
  // líneas blancas pintadas: borde y cuadro de tiro
  const lw = 0.05, zl = zCara + 0.0018, dl = 0.0024, ins = 0.05;
  caja(anchoT - 2 * ins, lw, dl, blanco, 0, TABLERO.arriba - ins - lw / 2, zl, false);
  caja(anchoT - 2 * ins, lw, dl, blanco, 0, TABLERO.abajo + ins + lw / 2, zl, false);
  caja(lw, altoT - 2 * ins, dl, blanco, -(anchoT / 2 - ins - lw / 2), yMedio, zl, false);
  caja(lw, altoT - 2 * ins, dl, blanco, anchoT / 2 - ins - lw / 2, yMedio, zl, false);
  const cy0 = ALTURA_ARO + 0.02, cy1 = ALTURA_ARO + 0.47, cx = 0.295;
  caja(2 * cx, lw, dl, blanco, 0, cy1 - lw / 2, zl, false);
  caja(2 * cx, lw, dl, blanco, 0, cy0 + lw / 2, zl, false);
  caja(lw, cy1 - cy0, dl, blanco, -cx + lw / 2, (cy0 + cy1) / 2, zl, false);
  caja(lw, cy1 - cy0, dl, blanco, cx - lw / 2, (cy0 + cy1) / 2, zl, false);
  // aro y su soporte
  const aro = new THREE.Mesh(new THREE.TorusGeometry(R_ARO, 0.0115, 12, 64), naranja);
  aro.rotation.x = Math.PI / 2;
  aro.position.set(0, ALTURA_ARO, 0);
  aro.castShadow = true;
  canasta.add(aro);
  caja(0.13, 0.03, zCara + R_ARO + 0.01, naranja, 0, ALTURA_ARO - 0.004, (zCara - R_ARO) / 2 - 0.005);
  caja(0.2, 0.14, 0.014, naranja, 0, ALTURA_ARO - 0.05, zCara + 0.007);
  // brazo (por debajo del tablero, con una placa detrás) y poste
  const zDetras = zCara - grosor;
  caja(0.34, 0.2, 0.02, metalOscuro, 0, TABLERO.abajo + 0.06, zDetras - 0.03);
  caja(0.09, 0.09, zDetras - 0.04 - POSTE_Z, metalOscuro, 0, ALTO_BRAZO, (zDetras - 0.04 + POSTE_Z) / 2);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(R_POSTE, R_POSTE, 5, 24), metalOscuro);
  poste.position.set(0, ALTO_BRAZO + 0.1 - 2.5, POSTE_Z);
  poste.castShadow = true; poste.receiveShadow = true;
  canasta.add(poste);

  // ── La red ──
  const nNudos = N_RED * (FILAS_RED + 1);
  const reposo = new Float32Array(nNudos * 3);
  for (let k = 0; k <= FILAS_RED; k++) {
    const r = R_ARO - (R_ARO - R_ABAJO) * (k / FILAS_RED);
    for (let i = 0; i < N_RED; i++) {
      const a = (2 * Math.PI * (i + 0.5 * k)) / N_RED;
      const j = (k * N_RED + i) * 3;
      reposo[j] = r * Math.cos(a); reposo[j + 1] = -LARGO_RED * (k / FILAS_RED); reposo[j + 2] = r * Math.sin(a);
    }
  }
  const nudo = (k, i) => k * N_RED + (((i % N_RED) + N_RED) % N_RED);
  const hilos = [], anillos = [];
  for (let k = 0; k < FILAS_RED; k++) for (let i = 0; i < N_RED; i++) hilos.push(nudo(k, i), nudo(k + 1, i), nudo(k, i), nudo(k + 1, i - 1));
  for (let k = 1; k <= FILAS_RED; k++) for (let i = 0; i < N_RED; i++) anillos.push(nudo(k, i), nudo(k, i + 1));
  const largoReposo = (lista) => {
    const out = new Float32Array(lista.length / 2);
    for (let n = 0; n < out.length; n++) {
      const a = lista[2 * n] * 3, b = lista[2 * n + 1] * 3;
      out[n] = Math.hypot(reposo[a] - reposo[b], reposo[a + 1] - reposo[b + 1], reposo[a + 2] - reposo[b + 2]);
    }
    return out;
  };
  const largoHilo = largoReposo(hilos), largoAnillo = largoReposo(anillos);
  const pos = new Float32Array(nNudos * 3), ant = new Float32Array(nNudos * 3);
  let xCanastaSim = 0;
  const colocarRed = (x) => {
    for (let n = 0; n < nNudos; n++) {
      pos[n * 3] = ant[n * 3] = reposo[n * 3] + x;
      pos[n * 3 + 1] = ant[n * 3 + 1] = reposo[n * 3 + 1] + ALTURA_ARO;
      pos[n * 3 + 2] = ant[n * 3 + 2] = reposo[n * 3 + 2];
    }
  };
  colocarRed(0);
  const cuerdas = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0034, 0.0034, 1, 5, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.9 }),
    hilos.length / 2,
  );
  cuerdas.castShadow = true;
  cuerdas.frustumCulled = false;
  escena.add(cuerdas);

  // ── Balones ──
  const tTextura = performance.now();
  const { mapa, relieve } = texturasBalon();
  const msTextura = Math.round(performance.now() - tTextura);
  const geoBalon = new THREE.SphereGeometry(R_BALON, 40, 28);
  const matBalon = new THREE.MeshStandardMaterial({ map: mapa, bumpMap: relieve, bumpScale: 1.4, roughness: 0.62, metalness: 0 });
  const libres = [];
  const balonNuevo = () => {
    const m = libres.pop() || new THREE.Mesh(geoBalon, matBalon);
    m.castShadow = true;
    m.visible = true;
    escena.add(m);
    return m;
  };
  const soltarBalon = (m) => { escena.remove(m); libres.push(m); };
  const mano = balonNuevo();
  mano.castShadow = false;
  mano.quaternion.setFromEuler(new THREE.Euler(0.35, -0.6, 0.25));

  // ── Estado del dibujo ──
  let ancho = 1, alto = 1, H = 1, arriba = 0, dpr = 1, ratio = 1;
  let primerCuadro = true;
  let reloj = null; // ms reales del último paso de simulación
  const desplaza = new THREE.Vector3(); // cámara respecto a su sitio de tiro (vuelo, entrada, menú)
  let cuentaVista = -1;
  let ultimo = 0;
  const tiempos = [];
  const estados = new WeakMap(); // por vuelo: balón 3D, giro y, tras decidirse, su caída
  const eje = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), arribaV = new THREE.Vector3(0, 1, 0);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), escala = new THREE.Vector3(1, 1, 1);
  const objetivo = new THREE.Vector3(), entradaDesdeV = new THREE.Vector3();
  const reserva = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const vivos = new Set();

  function medir(nAncho, nAlto, nH, nArriba, nDpr) {
    ancho = nAncho; alto = nAlto; H = nH; arriba = nArriba; dpr = nDpr;
    // tope de píxeles: en pantallas grandes el 3D no necesita más de ~3 millones
    ratio = Math.min(dpr, 2, Math.sqrt(3.0e6 / (ancho * alto)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(ancho, alto, false);
    // la misma cámara que el motor: el horizonte a 0,70 del escenario, focal 1,6, sin girar (las verticales, rectas)
    const n = 0.05, f = 220, k = n / (CAMARA.focal * H);
    camara.projectionMatrix.makePerspective(
      -k * ancho / 2, k * ancho / 2,
      k * (arriba + CAMARA.horizonte * H), -k * (alto - arriba - CAMARA.horizonte * H),
      n, f,
    );
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
    foto.style.transformOrigin = `${ancho / 2}px ${arriba + CAMARA.horizonte * H}px`;
  }

  // engine → mundo, desde el sitio de tiro s
  const aMundo = (x, y, z, s, out) => out.set(x - s.x, y, s.z - z);

  function enTrayectoria(res, t, out) {
    const tr = res.tray, n = tr.length / 3;
    let k = (t - res.t0) / PASO - 1;
    if (k < 0) k = 0;
    if (k >= n - 1) return aMundo(tr[n * 3 - 3], tr[n * 3 - 2], tr[n * 3 - 1], res.aroDelTiro, out);
    const i = Math.floor(k), f = k - i, j = i * 3;
    return aMundo(tr[j] + (tr[j + 3] - tr[j]) * f, tr[j + 1] + (tr[j + 4] - tr[j + 1]) * f, tr[j + 2] + (tr[j + 5] - tr[j + 2]) * f, res.aroDelTiro, out);
  }

  // después de decidirse, el balón sigue cayendo (solo para verse): aro, tablero, poste y la red que lo frena.
  // Es función del tiempo: se integra desde que se decidió hasta t (si t vuelve atrás, se empieza otra vez).
  function empezarCaida(res) {
    const tr = res.tray, n = tr.length / 3, s = res.aroDelTiro;
    const p = aMundo(tr[n * 3 - 3], tr[n * 3 - 2], tr[n * 3 - 1], s, new THREE.Vector3());
    const pa = aMundo(tr[n * 3 - 6], tr[n * 3 - 5], tr[n * 3 - 4], s, new THREE.Vector3());
    return { p, v: p.clone().sub(pa).multiplyScalar(1 / PASO), t: res.fin };
  }
  function caidaEn(e, res, t, xc) {
    if (!e.caida || t < e.caida.t - 1e-9) e.caida = empezarCaida(res);
    for (let n = 0; e.caida.t + PASO_SIM <= t + 1e-9 && n < 1200; n++) { pasoCaida(e.caida, PASO_SIM, xc); e.caida.t += PASO_SIM; }
    return e.caida.p;
  }
  function pasoCaida(c, dt, xc) {
    const p = c.p, v = c.v;
    v.y -= 9.81 * dt;
    const zAntes = p.z;
    p.addScaledVector(v, dt);
    if (v.z < 0 && zAntes - R_BALON >= zCara && p.z - R_BALON < zCara
      && Math.abs(p.x - xc) < anchoT / 2 && p.y > TABLERO.abajo && p.y < TABLERO.arriba) { p.z = zCara + R_BALON; v.z = -v.z * 0.6; }
    // aro
    const dx = p.x - xc, dz = p.z, d = Math.hypot(dx, dz);
    const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
    const nx = dx - ux * R_ARO, ny = p.y - ALTURA_ARO, nz = dz - uz * R_ARO, dn = Math.hypot(nx, ny, nz);
    const minimo = R_BALON + 0.011;
    if (dn < minimo && dn > 1e-9) {
      const ex = nx / dn, ey = ny / dn, ez = nz / dn, emp = minimo - dn;
      p.x += ex * emp; p.y += ey * emp; p.z += ez * emp;
      const vn = v.x * ex + v.y * ey + v.z * ez;
      if (vn < 0) { v.x -= 1.55 * vn * ex; v.y -= 1.55 * vn * ey; v.z -= 1.55 * vn * ez; v.multiplyScalar(0.92); }
    }
    // poste
    const px = p.x - xc, pz = p.z - POSTE_Z, dh = Math.hypot(px, pz);
    if (p.y < ALTO_BRAZO + 0.1 && dh < R_BALON + R_POSTE && dh > 1e-9) {
      const ex = px / dh, ez = pz / dh;
      p.x = xc + ex * (R_BALON + R_POSTE); p.z = POSTE_Z + ez * (R_BALON + R_POSTE);
      const vn = v.x * ex + v.z * ez;
      if (vn < 0) { v.x -= 1.5 * vn * ex; v.z -= 1.5 * vn * ez; }
    }
    // la red lo frena y lo centra un poco
    if (p.y < ALTURA_ARO && p.y > ALTURA_ARO - LARGO_RED - 0.05 && d < R_ARO) {
      v.x = v.x * 0.985 - dx * 2.5 * dt; v.z = v.z * 0.985 - dz * 2.5 * dt; v.y *= 0.988;
    }
  }

  // ── Simulación de la red ──
  function pasoRed(dt, xc, bolas, viento, t) {
    // el cierzo también inclina la red (a rachas), así se ve hacia dónde sopla: su forma de reposo se ladea
    const g = 9.81 * dt * dt, amort = 0.992, muelle = 0.012;
    const ladeo = viento * 0.024 * (0.75 + 0.25 * Math.sin(t * 2.3) + 0.12 * Math.sin(t * 5.1));
    for (let n = 0; n < nNudos; n++) {
      const j = n * 3;
      if (n < N_RED) { // la fila de arriba va atada al aro
        pos[j] = ant[j] = reposo[j] + xc; pos[j + 1] = ant[j + 1] = reposo[j + 1] + ALTURA_ARO; pos[j + 2] = ant[j + 2] = reposo[j + 2];
        continue;
      }
      const x = pos[j], y = pos[j + 1], z = pos[j + 2];
      pos[j] += (x - ant[j]) * amort; pos[j + 1] += (y - ant[j + 1]) * amort - g; pos[j + 2] += (z - ant[j + 2]) * amort;
      ant[j] = x; ant[j + 1] = y; ant[j + 2] = z;
      // un poco de memoria de su forma, para que vuelva a su sitio sin quedarse temblando
      const fila = Math.floor(n / N_RED) / FILAS_RED;
      pos[j] += (reposo[j] + xc + ladeo * fila * Math.sqrt(fila) - pos[j]) * muelle;
      pos[j + 1] += (reposo[j + 1] + ALTURA_ARO - pos[j + 1]) * muelle; pos[j + 2] += (reposo[j + 2] - pos[j + 2]) * muelle;
    }
    const choques = () => {
      for (const b of bolas) {
        if (Math.abs(b.x - xc) > 0.5 || b.y > ALTURA_ARO + 0.2 || b.y < ALTURA_ARO - LARGO_RED - 0.2 || Math.abs(b.z) > 0.5) continue;
        const rr = R_BALON + 0.007;
        for (let n = N_RED; n < nNudos; n++) {
          const j = n * 3, dx = pos[j] - b.x, dy = pos[j + 1] - b.y, dz = pos[j + 2] - b.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr && d2 > 1e-12) { const d = Math.sqrt(d2), k = rr / d; pos[j] = b.x + dx * k; pos[j + 1] = b.y + dy * k; pos[j + 2] = b.z + dz * k; }
        }
      }
    };
    choques();
    // las cuerdas no se estiran; los anillos tampoco (así la red mantiene su forma de cono)
    const atar = (lista, largos) => {
      for (let n = 0; n < largos.length; n++) {
        const a = lista[2 * n], b = lista[2 * n + 1], ja = a * 3, jb = b * 3;
        const dx = pos[jb] - pos[ja], dy = pos[jb + 1] - pos[ja + 1], dz = pos[jb + 2] - pos[ja + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= largos[n] || d < 1e-9) continue;
        const sobra = (d - largos[n]) / d;
        const fa = a < N_RED ? 0 : b < N_RED ? 1 : 0.5, fb = 1 - fa;
        pos[ja] += dx * sobra * fa; pos[ja + 1] += dy * sobra * fa; pos[ja + 2] += dz * sobra * fa;
        pos[jb] -= dx * sobra * fb; pos[jb + 1] -= dy * sobra * fb; pos[jb + 2] -= dz * sobra * fb;
      }
    };
    for (let it = 0; it < 3; it++) { atar(hilos, largoHilo); atar(anillos, largoAnillo); }
    choques();
  }

  function pintarRed() {
    for (let n = 0; n < largoHilo.length; n++) {
      const ja = hilos[2 * n] * 3, jb = hilos[2 * n + 1] * 3;
      va.set(pos[ja], pos[ja + 1], pos[ja + 2]);
      vb.set(pos[jb], pos[jb + 1], pos[jb + 2]);
      const d = vb.sub(va);
      const l = d.length();
      q.setFromUnitVectors(arribaV, d.multiplyScalar(1 / Math.max(l, 1e-6)));
      escala.set(1, l, 1);
      va.addScaledVector(d, l / 2);
      m4.compose(va, q, escala);
      cuerdas.setMatrixAt(n, m4);
    }
    cuerdas.instanceMatrix.needsUpdate = true;
  }

  // x de la canasta en el mundo en el instante t: solo se mueve en el último nivel; al cambiar de sitio se mezcla
  const xCanasta = (vista, t) => (1 - vista.e) * (xAro(vista.a, t) - vista.a.x) + vista.e * (xAro(vista.b, t) - vista.b.x);

  const medidas = { js: 0, pintar: 0, n: 0, textura: msTextura };
  function dibujar(d) {
    const t0 = performance.now();
    const ahora = d.ahora;
    const dt = Math.min(0.1, Math.max(0, (ahora - (ultimo || ahora)) / 1000));
    ultimo = ahora;
    const enMenu = d.estado === "inicio" || d.estado === "fin";
    const vista = d.vista || { a: ARO_INICIAL, b: ARO_INICIAL, e: 1 };
    const tj = d.tj / 1000;

    // ── cámara: su sitio de tiro, y encima lo que se mueve por estética ──
    const sx = vista.a.x + (vista.b.x - vista.a.x) * vista.e, sz = vista.a.z + (vista.b.z - vista.a.z) * vista.e;
    const viento = d.estado === "juego" ? vista.a.viento + (vista.b.viento - vista.a.viento) * vista.e : 0;
    objetivo.set(0, 0, 0);
    if (!reducido) {
      if (enMenu) {
        // en el menú la cámara está un poco más atrás y respira despacio
        const t = ahora / 1000;
        // (y algo más baja, para que la canasta asome por encima del título)
        objetivo.set(0.32 * Math.sin(t * 0.31), -0.42 + 0.06 * Math.sin(t * 0.23 + 1), 1.15 + 0.22 * Math.sin(t * 0.19));
      } else if (d.estado === "juego") {
        // acompaña el balón: se acerca un poco hacia la canasta y vuelve a su sitio antes del balón siguiente
        for (const v of d.vuelos) {
          const u = (tj - v.res.t0) / Math.max(0.2, v.res.fin - v.res.t0);
          if (u > 0 && u < 1) { const b = Math.sin(Math.PI * u) ** 2; objetivo.set(0, 0.05 * b, -0.22 * b); }
        }
      }
    }
    if (d.estado === "cuenta") {
      if (cuentaVista !== d.inicioCuenta) { cuentaVista = d.inicioCuenta; entradaDesdeV.copy(desplaza); }
      const k = d.duracionCuenta > 0 ? Math.min(1, (ahora - d.inicioCuenta) / d.duracionCuenta) : 1;
      desplaza.copy(entradaDesdeV).multiplyScalar(1 - SUAVE(k));
    } else if (enMenu) {
      desplaza.lerp(objetivo, 1 - Math.exp(-dt * 1.6));
    } else {
      desplaza.copy(objetivo); // jugando, la cámara va exacta: al apuntar tiene que estar en su sitio
    }
    camara.position.set(-sx + desplaza.x, CAMARA.y + desplaza.y, sz - CAMARA.z + desplaza.z);
    camara.updateMatrixWorld();

    // la foto se mueve como algo que está a 52 m: mucho menos que la canasta
    const ox = camara.position.x, oy = camara.position.y - CAMARA.y, oz = camara.position.z - (ARO_INICIAL.z - CAMARA.z);
    const fondo = FONDO_LEJOS + oz, sF = FONDO_LEJOS / fondo, fH = CAMARA.focal * H;
    const tr = `translate3d(${(-fH * ox / fondo).toFixed(2)}px,${(fH * oy / fondo).toFixed(2)}px,0) scale(${(SOBRANTE * sF).toFixed(4)})`;
    if (foto.style.transform !== tr) foto.style.transform = tr;

    // ── simulación a paso fijo: balones que caen y red ──
    if (reloj === null || ahora - reloj > 250) reloj = ahora - PASO_SIM * 1000;
    const desfase = ahora - d.tj; // ms reales del segundo 0 de la partida
    const bolas = [];
    let pasos = 0;
    while (reloj + PASO_SIM * 1000 <= ahora && pasos < 48) {
      reloj += PASO_SIM * 1000; pasos++;
      const t = (reloj - desfase) / 1000;
      const xc = xCanasta(vista, Math.max(0, t));
      bolas.length = 0;
      for (const v of d.vuelos) {
        if (t < v.res.t0) continue;
        let e = estados.get(v);
        if (!e) { e = crearEstado(v); estados.set(v, e); }
        if (e.fuera) continue;
        bolas.push(t <= v.res.fin ? enTrayectoria(v.res, t, reserva[bolas.length % reserva.length]) : caidaEn(e, v.res, t, xc));
      }
      pasoRed(PASO_SIM, xc, bolas, viento, t);
      xCanastaSim = xc;
    }
    canasta.position.x = xCanastaSim;

    // ── balones en el aire ──
    vivos.clear();
    for (const v of d.vuelos) vivos.add(v);
    for (const v of d.vuelos) {
      let e = estados.get(v);
      if (!e) { e = crearEstado(v); estados.set(v, e); }
      if (tj < v.res.t0 || e.fuera) { e.malla.visible = false; continue; }
      const p = tj <= v.res.fin ? enTrayectoria(v.res, tj, va) : caidaEn(e, v.res, tj, xCanastaSim);
      e.malla.position.copy(p);
      e.malla.quaternion.copy(e.giro0);
      q.setFromAxisAngle(e.eje, (tj - v.res.t0) * e.vel);
      e.malla.quaternion.premultiply(q);
      // fuera de la vista o pasado un rato: se retira
      if (p.y < -1.2 || tj > v.res.fin + 3) { e.fuera = true; e.malla.visible = false; }
      else e.malla.visible = true;
    }
    for (const v of activos) if (!vivos.has(v)) { const e = estados.get(v); if (e) soltarBalon(e.malla); activos.delete(v); }

    // ── el balón en la mano: pegado al sitio de tiro (no a lo que se mueve la cámara por estética) ──
    if (d.mano) {
      mano.visible = true;
      aMundo(SALIDA.x, SALIDA.y - 0.5 * (1 - d.mano.sube) + d.mano.alza, SALIDA.z, { x: sx, z: sz }, mano.position);
    } else mano.visible = false;

    pintarRed();
    const t1 = performance.now();
    renderer.render(escena, camara);
    const t2 = performance.now();
    medidas.js += t1 - t0; medidas.pintar += t2 - t1; medidas.n++;
    if (primerCuadro) { primerCuadro = false; lienzo.style.opacity = "1"; }
    if (!calidadFija) ajustarCalidad(dt);
  }

  const activos = new Set();
  function crearEstado(v) {
    const malla = balonNuevo();
    activos.add(v);
    // gira hacia atrás (efecto de un buen tiro) sobre el eje que cruza su dirección
    const tr = v.res.tray, s = v.res.aroDelTiro;
    const p0 = aMundo(tr[0], tr[1], tr[2], s, new THREE.Vector3()), p1 = aMundo(tr[3], tr[4], tr[5], s, new THREE.Vector3());
    const dir = p1.sub(p0); dir.y = 0;
    if (dir.lengthSq() < 1e-12) dir.set(0, 0, -1);
    const e = new THREE.Vector3().crossVectors(dir.normalize(), arribaV).normalize();
    const giro0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
    return { malla, eje: e, vel: Math.abs(v.giro || 8) * 1.4, giro0, caida: null, fuera: false };
  }

  // si el móvil va justo, se baja la resolución (nunca por debajo de 1)
  function ajustarCalidad(dt) {
    if (dt <= 0 || dt > 0.25) return;
    tiempos.push(dt);
    if (tiempos.length < 90) return;
    const media = tiempos.reduce((s, x) => s + x, 0) / tiempos.length;
    tiempos.length = 0;
    if (media > 0.024 && ratio > 1) {
      ratio = Math.max(1, ratio - 0.25);
      renderer.setPixelRatio(ratio);
      renderer.setSize(ancho, alto, false);
    }
  }

  return {
    medir, dibujar,
    info: () => {
      const r = { ratio, llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, textura: medidas.textura,
        js: medidas.n ? +(medidas.js / medidas.n).toFixed(2) : 0, pintar: medidas.n ? +(medidas.pintar / medidas.n).toFixed(2) : 0 };
      medidas.js = medidas.pintar = medidas.n = 0;
      return r;
    },
  };
}

// Cielo de la tarde para los reflejos (cristal, aro): azul arriba, horizonte crema, suelo de piedra y el sol.
function texturaCielo() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#5d8fcf"); grad.addColorStop(0.4, "#b4cbe6"); grad.addColorStop(0.49, "#f1dcc3");
  grad.addColorStop(0.52, "#8d7866"); grad.addColorStop(1, "#3a3029");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  // el sol, en la dirección de la luz (detrás y a la izquierda de quien tira)
  const sol = g.createRadialGradient(210, 44, 0, 210, 44, 26);
  sol.addColorStop(0, "rgba(255,244,224,1)"); sol.addColorStop(0.25, "rgba(255,226,186,.7)"); sol.addColorStop(1, "rgba(255,210,170,0)");
  g.fillStyle = sol; g.fillRect(150, 0, 106, 100);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Franja de reflejo del cristal.
function texturaReflejo() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 150;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 256, 150);
  grad.addColorStop(0, "rgba(255,255,255,0.10)"); grad.addColorStop(0.3, "rgba(255,255,255,0.03)");
  grad.addColorStop(0.42, "rgba(255,255,255,0.0)"); grad.addColorStop(0.55, "rgba(255,255,255,0.07)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.0)"); grad.addColorStop(1, "rgba(255,255,255,0.03)");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Balón: cuero naranja con granito y las 8 costuras de un balón de baloncesto (dos círculos máximos y dos curvas).
function texturasBalon() {
  const W = 768, Ht = 384; // el balón en la mano ocupa unos 300 px de pantalla: con esto va sobrado
  const cMapa = document.createElement("canvas"); cMapa.width = W; cMapa.height = Ht;
  const cRel = document.createElement("canvas"); cRel.width = W; cRel.height = Ht;
  const gM = cMapa.getContext("2d"), gR = cRel.getContext("2d");
  const im = gM.createImageData(W, Ht), ir = gR.createImageData(W, Ht);
  const dm = im.data, dr = ir.data;
  // granito: ruido por celdas de 3 px, suavizado
  const celda = 3, cw = Math.ceil(W / celda) + 1, ch = Math.ceil(Ht / celda) + 1;
  const ruido = new Float32Array(cw * ch);
  let semilla = 12345;
  for (let i = 0; i < ruido.length; i++) { semilla = (semilla * 1103515245 + 12345) >>> 0; ruido[i] = (semilla >>> 8) / 16777216; }
  const b0 = Math.acos(0.58); // radio de las dos costuras curvas, alrededor de ±x
  const ancho = 0.026, borde = 0.012;
  for (let py = 0; py < Ht; py++) {
    const th = (Math.PI * (py + 0.5)) / Ht, st = Math.sin(th), ct = Math.cos(th);
    for (let px = 0; px < W; px++) {
      const ph = (2 * Math.PI * (px + 0.5)) / W;
      const x = -Math.cos(ph) * st, y = ct;
      const ax = Math.abs(x);
      const dist = Math.min(Math.asin(Math.min(1, Math.abs(y))), Math.asin(Math.min(1, ax)), Math.abs(Math.acos(Math.min(1, ax)) - b0));
      const costura = Math.max(0, Math.min(1, (ancho + borde - dist) / borde)); // 1 dentro de la costura
      const gx = px / celda, gy = py / celda, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const r00 = ruido[iy * cw + ix], r10 = ruido[iy * cw + ix + 1], r01 = ruido[(iy + 1) * cw + ix], r11 = ruido[(iy + 1) * cw + ix + 1];
      const n = r00 + (r10 - r00) * fx + (r01 - r00) * fy + (r00 - r10 - r01 + r11) * fx * fy;
      const k = (py * W + px) * 4;
      const luz = 0.94 + 0.12 * n;
      const R = 200 * luz, G = 88 * luz, B = 34 * luz; // cuero
      dm[k] = R + (34 - R) * costura; dm[k + 1] = G + (22 - G) * costura; dm[k + 2] = B + (16 - B) * costura; dm[k + 3] = 255;
      const alto = (0.55 + 0.3 * n) * (1 - costura) + 0.08 * costura;
      dr[k] = dr[k + 1] = dr[k + 2] = alto * 255; dr[k + 3] = 255;
    }
  }
  gM.putImageData(im, 0, 0); gR.putImageData(ir, 0, 0);
  const mapa = new THREE.CanvasTexture(cMapa); mapa.colorSpace = THREE.SRGBColorSpace; mapa.anisotropy = 4;
  const relieve = new THREE.CanvasTexture(cRel);
  return { mapa, relieve };
}
