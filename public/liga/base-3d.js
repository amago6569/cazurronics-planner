// Base común de las escenas 3D de la Liga Cazurra (todas menos la canasta, que lleva la suya).
//
// Idea: el juego se juega en un plano (z = 0) que se ve en la pantalla exactamente igual que en el dibujo plano.
// La cámara está a D unidades delante de ese plano, a la altura yc, sin girar (las verticales, rectas), y su
// proyección está hecha para que un punto (x, y, 0) caiga en el píxel (cx + k·x, yPlano − k·y). Así el dedo y el 3D
// coinciden al píxel, y lo que está delante o detrás del plano da la profundidad.
// La foto del sitio va detrás (una imagen de la web, bajo este lienzo transparente), desenfocada, y se mueve mucho
// menos que lo de delante cuando la cámara se mueve: eso da la sensación de distancia.
import * as THREE from "./vendor/three-liga.js";
import { crearEfectos } from "./efectos-3d.js";

export { THREE };
export const SUAVE = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const SOBRANTE = 1.12; // la foto se pinta un 12 % más grande para que, al moverse, nunca se le vean los bordes

export function crearBase({ lienzo, contexto, foto, reducido = false, cielo, lejos = 40, sombras = true }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, context: contexto });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = sombras;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromEquirectangular(texturaCielo(cielo)).texture;
  escena.environmentIntensity = cielo?.intensidad ?? 0.7;

  let ancho = 1, alto = 1, ratio = 1, dpr = 1;
  const plano = { cx: 0, yPlano: 0, k: 100, D: 6, yc: 1 };
  let primerCuadro = true;
  const tiempos = [];
  let ultimo = 0;
  const desplaza = new THREE.Vector3(), objetivo = new THREE.Vector3(), desde = new THREE.Vector3();
  let cuentaVista = -1;
  // efectos (migas, humo, polvo, temblor) y la cámara «viva» mientras se juega
  const efectos = crearEfectos({ escena, reducido });
  let vivo = 0; // 0 en el menú, 1 jugando: cuánto se mece la cámara
  const mece = { x: 0, y: 0 };
  let cxAhora = NaN, yOjoAhora = NaN;

  // La proyección, con el punto de fuga donde haga falta. Si la cámara se aparta (ox, oy) y el punto de fuga se
  // corre lo mismo en píxeles, el plano del juego (z = 0) NO se mueve en la pantalla: el dedo sigue coincidiendo,
  // y lo que está delante o detrás se desplaza un poco, como al mover la cabeza delante de una ventana.
  function proyectar(cx, yOjo) {
    if (cx === cxAhora && yOjo === yOjoAhora) return;
    cxAhora = cx; yOjoAhora = yOjo;
    const n = 0.05, f = 400, fpx = plano.k * plano.D;
    camara.projectionMatrix.makePerspective(-n * cx / fpx, n * (ancho - cx) / fpx, n * yOjo / fpx, -n * (alto - yOjo) / fpx, n, f);
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
  }

  // m: medidas del marco. vista: { cx, yPlano, k, D, yc } (píxeles, unidades del juego)
  function medir(m, vista) {
    ancho = m.ancho; alto = m.alto; dpr = window.devicePixelRatio || 1;
    Object.assign(plano, vista);
    ratio = Math.min(dpr, 2, Math.sqrt(3.0e6 / (ancho * alto))); // en pantallas grandes no hace falta más
    renderer.setPixelRatio(ratio);
    renderer.setSize(ancho, alto, false);
    const yOjo = plano.yPlano - plano.k * plano.yc;
    cxAhora = NaN; proyectar(plano.cx, yOjo);
    foto.style.transformOrigin = `${plano.cx}px ${yOjo}px`;
  }

  // Cámara: en el menú respira despacio un poco más atrás; en la cuenta atrás vuelve a su sitio; jugando, quieta
  // (tiene que coincidir con el dedo). «menu» = { x, y, z } de cuánto se aparta en el menú.
  // «extra» = { x, y, z }: lo que el juego mueve la cámara a propósito (por ejemplo, subir con la torre)
  function moverCamara(d, menu = { x: 0.25, y: 0.15, z: 0.9 }, dt = 0.016, extra = null) {
    const enMenu = d.estado === "inicio" || d.estado === "fin";
    objetivo.set(0, 0, 0);
    if (enMenu && !reducido) {
      const t = d.ahora / 1000;
      objetivo.set(menu.x * Math.sin(t * 0.31), menu.y * Math.sin(t * 0.23 + 1), menu.z * (1 + 0.2 * Math.sin(t * 0.19)));
    }
    if (d.estado === "cuenta") {
      if (cuentaVista !== d.inicioCuenta) { cuentaVista = d.inicioCuenta; desde.copy(desplaza); }
      const k = d.duracionCuenta > 0 ? Math.min(1, (d.ahora - d.inicioCuenta) / d.duracionCuenta) : 1;
      desplaza.copy(desde).multiplyScalar(1 - SUAVE(k));
    } else if (enMenu) desplaza.lerp(objetivo, 1 - Math.exp(-dt * 1.6));
    else desplaza.set(0, 0, 0);
    // jugando, la cámara se mece muy despacio (sin mover el plano del juego) y tiembla un instante con los golpes
    vivo += ((d.estado === "juego" && !reducido ? 1 : 0) - vivo) * Math.min(1, dt * 2);
    const t = d.ahora / 1000, amp = 0.012 * plano.D * vivo;
    mece.x = amp * (Math.sin(t * 0.43) + 0.4 * Math.sin(t * 0.97 + 1)) + (extra?.mx || 0) * vivo;
    mece.y = amp * 0.45 * Math.sin(t * 0.37 + 2);
    proyectar(plano.cx + plano.k * mece.x, plano.yPlano - plano.k * plano.yc - plano.k * mece.y);
    const golpe = 0.0022 * plano.D;
    const ex = (extra?.x || 0) + mece.x + efectos.tiembla.x * golpe, ey = (extra?.y || 0) + mece.y + efectos.tiembla.y * golpe, ez = extra?.z || 0;
    camara.position.set(desplaza.x + ex, plano.yc + desplaza.y + ey, plano.D + desplaza.z + ez);
    camara.updateMatrixWorld();
    // la foto, como algo que está a «lejos» unidades
    const ox = desplaza.x + ex, oy = desplaza.y + ey, L = lejos + desplaza.z + ez, s = lejos / L, fpx = plano.k * plano.D;
    // (sin pasarse: la foto solo tiene un 12 % de sobra por los bordes)
    const tope = (v, m) => Math.max(-m, Math.min(m, v));
    const tx = tope(-fpx * ox / L, ancho * 0.05), ty = tope(fpx * oy / L, alto * 0.05);
    // el fondo también respira: se acerca un pelo y vuelve, muy despacio
    const respira = reducido ? 1 : 1 + 0.004 * (1 + Math.sin(t * 0.21));
    const tr = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${(SOBRANTE * s * respira).toFixed(4)})`;
    if (foto.style.transform !== tr) foto.style.transform = tr;
  }

  function pintar(ahora) {
    const dt = Math.min(0.1, Math.max(0, (ahora - (ultimo || ahora)) / 1000));
    ultimo = ahora;
    efectos.actualizar(dt);
    renderer.render(escena, camara);
    if (primerCuadro) { primerCuadro = false; lienzo.style.opacity = "1"; }
    // si el móvil va justo, se baja la resolución (nunca por debajo de 1)
    if (dt > 0 && dt <= 0.25) {
      tiempos.push(dt);
      if (tiempos.length >= 90) {
        const media = tiempos.reduce((s, x) => s + x, 0) / tiempos.length;
        tiempos.length = 0;
        if (media > 0.024 && ratio > 1) { ratio = Math.max(1, ratio - 0.25); renderer.setPixelRatio(ratio); renderer.setSize(ancho, alto, false); }
      }
    }
    return dt;
  }

  // de la pantalla al plano z = 0 (para colocar cosas donde está el dedo)
  const aPlano = (px, py) => ({ x: (px - plano.cx) / plano.k, y: (plano.yPlano - py) / plano.k });

  return {
    THREE, renderer, escena, camara, medir, moverCamara, pintar, aPlano, plano, efectos,
    info: () => ({ ratio, llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles }),
  };
}

// Cielo para los reflejos: degradado de arriba a abajo y unas luces (manchas) donde se quiera.
// cielo = { colores: [[0, "#…"], [0.5, "#…"], …], luces: [{ x, y, r, color }] } con x, y entre 0 y 1
export function texturaCielo(cielo = {}) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  for (const [p, col] of cielo.colores || [[0, "#5d8fcf"], [0.48, "#e8d8c4"], [0.52, "#7d6a5a"], [1, "#2e2620"]]) grad.addColorStop(p, col);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  for (const l of cielo.luces || []) {
    const r = g.createRadialGradient(l.x * 256, l.y * 128, 0, l.x * 256, l.y * 128, l.r * 256);
    r.addColorStop(0, l.color); r.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "lighter";
    g.fillStyle = r; g.fillRect(0, 0, 256, 128);
    g.globalCompositeOperation = "source-over";
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Textura hecha a mano: pinta(g, w, h) dibuja en un lienzo y se devuelve como textura (en color o de datos)
export function textura(w, h, pinta, { color = true, repetir = false } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  pinta(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

// Ruido suave por celdas (para granito, migas, vetas…). Devuelve f(x, y) entre 0 y 1, repetible.
export function ruido2d(semilla = 1, celda = 8, w = 256, h = 256) {
  const cw = Math.ceil(w / celda) + 2, ch = Math.ceil(h / celda) + 2;
  const v = new Float32Array(cw * ch);
  let s = semilla >>> 0;
  for (let i = 0; i < v.length; i++) { s = (s * 1103515245 + 12345) >>> 0; v[i] = (s >>> 8) / 16777216; }
  return (x, y) => {
    const gx = x / celda, gy = y / celda, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = v[(iy % (ch - 1)) * cw + (ix % (cw - 1))], b = v[(iy % (ch - 1)) * cw + (ix % (cw - 1)) + 1];
    const c = v[((iy + 1) % (ch - 1)) * cw + (ix % (cw - 1))], d = v[((iy + 1) % (ch - 1)) * cw + (ix % (cw - 1)) + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
