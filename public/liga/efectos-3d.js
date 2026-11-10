// Efectos de las escenas 3D de la Liga Cazurra: migas y trozos que saltan, humo y destellos, polvo flotando en la luz
// y el temblor de la cámara cuando algo golpea. Es solo adorno: no sabe nada de puntos ni de motores, y con
// «reducir movimiento» se queda quieto.
//
// Pensado para un móvil normal: todos los trozos van en UNA sola malla (se pintan de una vez), el polvo en otra, y
// el humo sale de una reserva de 20 manchas que se reutilizan. Nada se crea ni se tira mientras se juega.
import * as THREE from "./vendor/three-liga.js";

const mancha = (() => { // mancha redonda y difuminada (humo, destellos, motas)
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

export function crearEfectos({ escena, reducido = false, maxTrozos = 96, maxHumo = 20 }) {
  // suerte propia (repetible; no toca nada del juego)
  let s = 12345;
  const azar = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const entre = (a, b) => a + (b - a) * azar();

  // ── Trozos: migas, virutas, nieve, piedrecillas. Una malla con muchas copias ──
  const geo = new THREE.BoxGeometry(1, 0.7, 0.85);
  const matTrozo = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const trozosMalla = new THREE.InstancedMesh(geo, matTrozo, maxTrozos);
  trozosMalla.frustumCulled = false; trozosMalla.count = 0;
  const blanco = new THREE.Color(1, 1, 1);
  for (let i = 0; i < maxTrozos; i++) trozosMalla.setColorAt(i, blanco);
  escena.add(trozosMalla);
  const T = Array.from({ length: maxTrozos }, () => ({ vida: 0, total: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 9, tam: 0.02, suelo: -1e9, giro: 0, vg: 0, color: new THREE.Color() }));
  let sigTrozo = 0;
  const pieza = new THREE.Object3D(), tinta = new THREE.Color();

  // o = { x, y, z, n, color | colores, tam: [min, max], fuerza, arriba, abre, gravedad, vida, suelo, vx, vz }
  function trozos(o) {
    if (reducido) return;
    const n = o.n || 8, cols = o.colores || [o.color ?? 0xffffff];
    for (let k = 0; k < n; k++) {
      const p = T[sigTrozo++ % maxTrozos];
      const a = azar() * Math.PI * 2, f = (o.fuerza ?? 1) * entre(0.4, 1), abre = o.abre ?? 1;
      p.x = o.x + entre(-1, 1) * (o.ancho || 0); p.y = o.y; p.z = (o.z || 0) + entre(-1, 1) * (o.fondo || 0);
      p.vx = Math.cos(a) * f * abre + (o.vx || 0); p.vz = Math.sin(a) * f * abre * 0.6 + (o.vz || 0);
      p.vy = (o.arriba ?? 1.6) * entre(0.5, 1);
      p.g = o.gravedad ?? 7; p.total = p.vida = (o.vida ?? 0.8) * entre(0.7, 1.1);
      p.tam = entre(o.tam?.[0] ?? 0.012, o.tam?.[1] ?? 0.028); p.suelo = o.suelo ?? -1e9;
      p.giro = azar() * 6; p.vg = entre(-14, 14);
      p.color.set(cols[Math.floor(azar() * cols.length)]);
    }
  }

  // ── Humo y destellos: manchas que crecen y se apagan ──
  const H = Array.from({ length: maxHumo }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mancha(), transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; escena.add(sp);
    return { sp, vida: 0, total: 1, vx: 0, vy: 0, vz: 0, t0: 0.1, t1: 0.3, op: 0.5 };
  });
  let sigHumo = 0;
  // o = { x, y, z, n, color, tam: [inicio, fin], vida, sube, abre, opacidad, luz (true = destello que suma luz) }
  function humo(o) {
    if (reducido) return;
    for (let k = 0; k < (o.n || 3); k++) {
      const h = H[sigHumo++ % maxHumo], a = azar() * Math.PI * 2, abre = (o.abre ?? 0.25) * entre(0.3, 1);
      h.sp.position.set(o.x + entre(-1, 1) * (o.ancho || 0), o.y + entre(-1, 1) * (o.altoZona || 0), o.z || 0);
      h.vx = Math.cos(a) * abre + (o.vx || 0); h.vz = Math.sin(a) * abre * 0.4; h.vy = (o.sube ?? 0.25) * entre(0.5, 1.2);
      h.total = h.vida = (o.vida ?? 0.7) * entre(0.75, 1.15);
      h.t0 = o.tam?.[0] ?? 0.08; h.t1 = (o.tam?.[1] ?? 0.3) * entre(0.8, 1.2); h.op = o.opacidad ?? 0.5;
      h.sp.material.color.set(o.color ?? 0xffffff);
      h.sp.material.blending = o.luz ? THREE.AdditiveBlending : 1; // 1 = mezcla normal
      h.sp.material.rotation = azar() * 6;
      h.sp.visible = true;
    }
  }

  // ── Motas: polvo (o lo que sea) flotando despacio en la luz. Una sola pintada ──
  let motas = null;
  // o = { n, caja: [x0, x1, y0, y1, z0, z1], color, tam, opacidad, cae, viento }
  function ponerMotas(o) {
    const n = reducido ? Math.round((o.n || 40) / 2) : o.n || 40, [x0, x1, y0, y1, z0, z1] = o.caja;
    const pos = new Float32Array(n * 3), fase = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = entre(x0, x1); pos[i * 3 + 1] = entre(y0, y1); pos[i * 3 + 2] = entre(z0, z1); fase[i] = azar() * 6.28; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const puntos = new THREE.Points(g, new THREE.PointsMaterial({ color: o.color ?? 0xfff2d8, map: mancha(), size: o.tam ?? 0.02, transparent: true, opacity: o.opacidad ?? 0.5, depthWrite: false, blending: o.luz === false ? 1 : THREE.AdditiveBlending }));
    puntos.frustumCulled = false;
    escena.add(puntos);
    motas = { puntos, pos, fase, n, caja: o.caja, cae: o.cae ?? 0.015, viento: 0, vientoBase: o.viento ?? 0.02 };
    return motas;
  }

  // ── Temblor: cada golpe suma; se va solo en un tercio de segundo ──
  let trauma = 0, reloj = 0;
  const tiembla = { x: 0, y: 0 };
  function sacudir(f = 0.4) { if (!reducido) trauma = Math.min(1, trauma + f); }

  function actualizar(dt) {
    reloj += dt;
    // temblor
    trauma = Math.max(0, trauma - dt * 2.8);
    const k = trauma * trauma;
    tiembla.x = k * (Math.sin(reloj * 71) + 0.6 * Math.sin(reloj * 113 + 1));
    tiembla.y = k * (Math.sin(reloj * 83 + 2) + 0.6 * Math.sin(reloj * 127));
    // trozos
    let vivos = 0;
    for (const p of T) {
      if (p.vida <= 0) continue;
      p.vida -= dt;
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.giro += p.vg * dt;
      if (p.y < p.suelo) { p.y = p.suelo; p.vy = -p.vy * 0.3; p.vx *= 0.5; p.vz *= 0.5; p.vg *= 0.4; }
      const u = Math.max(0, p.vida / p.total);
      pieza.position.set(p.x, p.y, p.z);
      pieza.rotation.set(p.giro, p.giro * 0.7, p.giro * 1.3);
      pieza.scale.setScalar(p.tam * Math.min(1, u * 4)); // al final se encogen hasta desaparecer
      pieza.updateMatrix();
      trozosMalla.setMatrixAt(vivos, pieza.matrix);
      trozosMalla.setColorAt(vivos, tinta.copy(p.color));
      vivos++;
    }
    if (vivos || trozosMalla.count) {
      trozosMalla.count = vivos;
      trozosMalla.instanceMatrix.needsUpdate = true;
      if (trozosMalla.instanceColor) trozosMalla.instanceColor.needsUpdate = true;
    }
    // humo
    for (const h of H) {
      if (h.vida <= 0) { if (h.sp.visible) h.sp.visible = false; continue; }
      h.vida -= dt;
      const u = 1 - Math.max(0, h.vida / h.total);
      h.sp.position.x += h.vx * dt; h.sp.position.y += h.vy * dt; h.sp.position.z += h.vz * dt;
      h.vx *= 1 - Math.min(1, dt * 2.5); h.vz *= 1 - Math.min(1, dt * 2.5);
      h.sp.scale.setScalar(h.t0 + (h.t1 - h.t0) * (1 - (1 - u) ** 2));
      h.sp.material.opacity = h.op * Math.min(1, u * 8) * (1 - u) ** 1.5;
    }
    // motas
    if (motas && !reducido) {
      const { pos, fase, n, caja } = motas, [x0, x1, y0, y1] = caja, v = motas.vientoBase + motas.viento;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        pos[j] += (v + 0.02 * Math.sin(reloj * 0.5 + fase[i])) * dt;
        pos[j + 1] += (0.012 * Math.sin(reloj * 0.37 + fase[i] * 2) - motas.cae) * dt;
        if (pos[j] > x1) pos[j] = x0; else if (pos[j] < x0) pos[j] = x1;
        if (pos[j + 1] < y0) pos[j + 1] = y1; else if (pos[j + 1] > y1) pos[j + 1] = y0;
      }
      motas.puntos.geometry.attributes.position.needsUpdate = true;
    }
  }

  return { trozos, humo, ponerMotas, sacudir, actualizar, tiembla, get motas() { return motas; } };
}
