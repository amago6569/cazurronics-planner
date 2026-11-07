// Canasta en la Catedral: lo que se ve y se toca. La física y los puntos salen todos de motor-canasta.js,
// el mismo archivo que usará el servidor para comprobar cada partida. Aquí solo se dibuja, se escucha el dedo y suena.
import {
  crearPartida, lanzar, resumen, xAro, proyectar, motivoInvalido, nivelDe,
  DURACION_MS, LIMITES, SALIDA, R_BALON, R_ARO, ALTURA_ARO, ARO_TABLERO, TABLERO, PASO,
} from "./motor-canasta.js";

const $ = (id) => document.getElementById(id);
const lienzo = $("lienzo");
const ctx = lienzo.getContext("2d");
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Con ratón se arrastra; con el dedo se desliza. Nunca «desde abajo del todo»: en el iPhone eso cierra la web.
const conRaton = matchMedia("(pointer: fine)").matches && !matchMedia("(pointer: coarse)").matches;
const TEXTO = conRaton
  ? { regla: "Arrastra el balón hacia arriba con el ratón. Cuanto más largo, más fuerte.", pista: "Arrastra el balón hacia arriba y suelta. Más largo, más fuerte.", corto: "Arrastra un poco más largo." }
  : { regla: "Desliza el balón hacia arriba. Cuanto más largo, más fuerte.", pista: "Desliza el balón hacia arriba y suelta. Más largo, más fuerte.", corto: "Desliza un poco más largo." };
document.getElementById("regla-gesto").textContent = TEXTO.regla;

// Avisos para lectores de pantalla (se vacía antes para que repita aunque el texto sea igual)
function anunciar(texto) {
  const a = document.getElementById("anuncio");
  a.textContent = "";
  setTimeout(() => (a.textContent = texto), 40);
}

// ── Tamaños. El juego se mide en «altos de escenario»: así el mismo deslizamiento vale lo mismo en cualquier móvil.
// En pantallas muy altas (ordenador) el escenario se queda en 940 px para que nadie tenga ventaja por tamaño.
let ancho = 0, alto = 0, H = 0, arriba = 0, dpr = 1;
function medir() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  ancho = window.innerWidth; alto = window.innerHeight;
  H = Math.min(alto, 940);
  arriba = (alto - H) / 2;
  lienzo.width = Math.round(ancho * dpr); lienzo.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const foto = $("foto");
  const quiere = ancho / alto > 1 ? "fondo-h.jpg" : "fondo-v.jpg";
  if (foto.getAttribute("src") !== quiere) foto.setAttribute("src", quiere);
  calcularPiedra();
}
// Siluetas de piedra de cada foto (fracciones del ancho y alto de la foto): la torre y, por debajo del tejado, la nave.
// Las sombras solo se pintan dentro, para que no caigan sobre el cielo.
const PIEDRA = {
  "fondo-v.jpg": { ancho: 810, alto: 1440, puntos: [[0, 0], [0.715, 0], [0.715, 0.48], [1, 0.48], [1, 1], [0, 1]] },
  "fondo-h.jpg": { ancho: 1920, alto: 1080, puntos: [[0.19, 0.13], [0.33, 0], [0.57, 0], [0.57, 0.48], [1, 0.48], [1, 1], [0.19, 1]] },
};
let siluetaPiedra = null;
function calcularPiedra() {
  const nombre = $("foto").getAttribute("src");
  const f = PIEDRA[nombre];
  if (!f) { siluetaPiedra = null; return; }
  // misma cuenta que object-fit: cover con object-position 50% 40%
  const k = Math.max(ancho / f.ancho, alto / f.alto);
  const rw = f.ancho * k, rh = f.alto * k, ox = (ancho - rw) * 0.5, oy = (alto - rh) * 0.4;
  siluetaPiedra = new Path2D();
  f.puntos.forEach(([px, py], i) => (i ? siluetaPiedra.lineTo(ox + px * rw, oy + py * rh) : siluetaPiedra.moveTo(ox + px * rw, oy + py * rh)));
  siluetaPiedra.closePath();
}
const aPantalla = (x, y, z) => {
  const p = proyectar(x, y, z);
  return { x: ancho / 2 + p.x * H, y: arriba + p.y * H, e: p.escala * H };
};

// ── Sonido (sintetizado, sin archivos) ──
let audio = null, conSonido = true;
try { conSonido = localStorage.getItem("liga-sonido") !== "no"; } catch { /* sin almacenamiento: con sonido */ }
function abrirAudio() {
  if (audio || !window.AudioContext && !window.webkitAudioContext) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function sonar(tipo, fuerza = 1) {
  if (!audio || !conSonido) return;
  if (audio.state === "suspended") audio.resume();
  const t = audio.currentTime;
  const salida = audio.createGain(); salida.connect(audio.destination);
  if (tipo === "red") { // red: ruido filtrado
    const dur = 0.32;
    const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = audio.createBufferSource(); src.buffer = buf;
    const f = audio.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 4200; f.Q.value = 0.7;
    src.connect(f); f.connect(salida); salida.gain.value = 0.5 * fuerza; src.start(t);
  } else if (tipo === "aro") { // hierro
    for (const [fr, g] of [[620, 0.22], [1310, 0.12], [2150, 0.06]]) {
      const o = audio.createOscillator(); o.frequency.value = fr; o.type = "triangle";
      const e = audio.createGain(); e.gain.setValueAtTime(g * fuerza, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(e); e.connect(salida); o.start(t); o.stop(t + 0.36);
    }
  } else if (tipo === "tablero") { // golpe sordo
    const o = audio.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    const e = audio.createGain(); e.gain.setValueAtTime(0.45 * fuerza, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(e); e.connect(salida); o.start(t); o.stop(t + 0.17);
  } else if (tipo === "tiro") {
    const o = audio.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    const e = audio.createGain(); e.gain.setValueAtTime(0.08, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(e); e.connect(salida); o.start(t); o.stop(t + 0.11);
  } else if (tipo === "pito") { // fin
    const o = audio.createOscillator(); o.type = "square"; o.frequency.value = 330;
    const e = audio.createGain(); e.gain.setValueAtTime(0.08, t); e.gain.setValueAtTime(0.08, t + 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(e); e.connect(salida); o.start(t); o.stop(t + 0.76);
  } else if (tipo === "cuenta") {
    const o = audio.createOscillator(); o.type = "sine"; o.frequency.value = fuerza > 1 ? 880 : 520;
    const e = audio.createGain(); e.gain.setValueAtTime(0.12, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(e); e.connect(salida); o.start(t); o.stop(t + 0.19);
  }
}
function pintarBotonSonido() {
  $("sonido").setAttribute("aria-pressed", String(!conSonido)); // nombre fijo «Silenciar»: pulsado = sin sonido
  $("ondas").toggleAttribute("hidden", !conSonido);
  $("tachado").toggleAttribute("hidden", conSonido);
}
$("sonido").addEventListener("click", () => {
  conSonido = !conSonido; abrirAudio(); pintarBotonSonido();
  try { localStorage.setItem("liga-sonido", conSonido ? "si" : "no"); } catch { /* da igual */ }
});
pintarBotonSonido();
const vibrar = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no hay */ } };

// ── Estado ──
let estado = "inicio"; // inicio | cuenta | juego | fin
let partida = null;
let inicioReal = 0; // performance.now() del segundo 0 de la partida
let vuelos = []; // balones en el aire
let tiros = []; // lo que se mandará al servidor
let arrastre = null; // dedo en la pantalla
let aroAnterior = null, cambioAro = 0; // para deslizar la canasta a su sitio nuevo
let redSacudida = 0; // ms en que se sacudió la red
let fallosSeguidos = 0;
let avisoDiez = false;
let tiroPendiente = null; // tiro soltado justo antes de que salga el balón: sale en cuanto está

const tiempoJuego = (ahora) => ahora - inicioReal;

// ── Dibujo ──
function aroVisible(tj) {
  // mientras el último balón no se ha decidido, la canasta sigue donde estaba
  for (const v of vuelos) if (tj < v.res.fin * 1000 + 60) return { aro: v.res.aroDelTiro, mezcla: 1 };
  if (aroAnterior && tj < cambioAro + 300) {
    const k = Math.max(0, (tj - cambioAro) / 300);
    const e = 1 - (1 - k) ** 3;
    const a = aroAnterior, b = partida.aro;
    return { aro: { ...b, z: a.z + (b.z - a.z) * e, x: a.x + (b.x - a.x) * e }, mezcla: e, quieto: true };
  }
  return { aro: partida ? partida.aro : { z: 4.2, x: 0, viento: 0, amplitud: 0, periodo: 1, fase: 0 } };
}

// Sombra suave que funciona también en Safari (que no tiene ctx.filter): se pinta la forma muy lejos, fuera de la
// pantalla, y solo se ve su sombra, desplazada justo al sitio.
function sombraSuave(forma, desenfoque, color) {
  const lejos = 10000;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = desenfoque * dpr; ctx.shadowOffsetX = lejos * dpr; ctx.shadowOffsetY = 0;
  ctx.translate(-lejos, 0);
  ctx.fillStyle = "#000";
  ctx.beginPath(); forma(); ctx.fill();
  ctx.restore();
}
// La luz viene de arriba a la izquierda: por cada metro de distancia a la fachada, la sombra se corre así
const LUZ = { x: 0.5, y: -0.7 };
const MURO = 0.2; // la fachada está 20 cm detrás del tablero (igual que en el motor)

function dibujarSombras(hx, z, balones) {
  const zt = z + ARO_TABLERO, zm = zt + MURO, mitad = TABLERO.ancho / 2;
  ctx.save();
  if (siluetaPiedra) ctx.clip(siluetaPiedra);
  // el tablero sobre la piedra
  const a = aPantalla(hx - mitad + LUZ.x * MURO, TABLERO.arriba + LUZ.y * MURO, zm);
  const b = aPantalla(hx + mitad + LUZ.x * MURO, TABLERO.abajo + LUZ.y * MURO, zm);
  sombraSuave(() => ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y), 14, "rgba(0,0,0,.42)");
  // los balones que se acercan a la fachada
  for (const bal of balones) {
    const g = zm - bal.z;
    if (g < 0 || g > 2.2) continue;
    const c = aPantalla(bal.x + LUZ.x * g, bal.y + LUZ.y * g, zm);
    const r = R_BALON * c.e * (1 + 0.35 * (g / 2.2));
    const fuerza = 0.5 * (1 - g / 2.2) * bal.alfa;
    sombraSuave(() => ctx.arc(c.x, c.y, r, 0, Math.PI * 2), 8 + 10 * (g / 2.2), `rgba(0,0,0,${fuerza.toFixed(3)})`);
  }
  ctx.restore();
}

function dibujarTablero(hx, z) {
  const zt = z + ARO_TABLERO, mitad = TABLERO.ancho / 2;
  const a = aPantalla(hx - mitad, TABLERO.arriba, zt), b = aPantalla(hx + mitad, TABLERO.abajo, zt);
  const w = b.x - a.x, h = b.y - a.y;
  // cristal
  ctx.save();
  const r = Math.max(2, w * 0.012);
  ctx.beginPath(); ctx.roundRect(a.x, a.y, w, h, r);
  const vidrio = ctx.createLinearGradient(a.x, a.y, a.x, a.y + h);
  vidrio.addColorStop(0, "rgba(225,235,242,.26)"); vidrio.addColorStop(1, "rgba(200,212,222,.14)");
  ctx.fillStyle = vidrio; ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.011); ctx.strokeStyle = "rgba(255,255,255,.88)"; ctx.stroke();
  // reflejo
  const brillo = ctx.createLinearGradient(a.x, a.y, a.x + w, a.y + h);
  brillo.addColorStop(0, "rgba(255,255,255,.18)"); brillo.addColorStop(0.45, "rgba(255,255,255,0)"); brillo.addColorStop(1, "rgba(255,255,255,.06)");
  ctx.fillStyle = brillo; ctx.fill();
  // cuadro de tiro
  const c1 = aPantalla(hx - 0.295, ALTURA_ARO + 0.45, zt), c2 = aPantalla(hx + 0.295, ALTURA_ARO + 0.02, zt);
  ctx.lineWidth = Math.max(1.5, w * 0.012); ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.strokeRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y);
  ctx.restore();
  // brazo del aro
  const p1 = aPantalla(hx, ALTURA_ARO, zt), p2 = aPantalla(hx, ALTURA_ARO, z + R_ARO);
  ctx.strokeStyle = "#b9471a"; ctx.lineWidth = Math.max(2, p1.e * 0.04); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
}

function puntosAro(hx, z, radio, y, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ ...aPantalla(hx + radio * Math.cos(t), y, z + radio * Math.sin(t)), lejos: Math.sin(t) > 0, t });
  }
  return pts;
}
function trazoAro(pts, lejos, grosor) {
  ctx.lineCap = "round";
  ctx.beginPath();
  let abierto = false;
  for (const p of pts) {
    if (p.lejos === lejos) { if (!abierto) { ctx.moveTo(p.x, p.y); abierto = true; } else ctx.lineTo(p.x, p.y); }
    else abierto = false;
  }
  ctx.strokeStyle = "rgba(20,8,4,.75)"; ctx.lineWidth = grosor + 2.5; ctx.stroke(); // borde oscuro
  ctx.strokeStyle = lejos ? "#b4421a" : "#ee6a22"; ctx.lineWidth = grosor; ctx.stroke();
}
function dibujarRed(hx, z, tj) {
  const n = 14;
  const edad = (tj - redSacudida) / 1000;
  const sac = edad >= 0 && edad < 0.6 && !reducido ? Math.sin(edad * 24) * Math.exp(-edad * 6) : 0;
  const caida = 0.42 + (edad >= 0 && edad < 0.6 ? 0.08 * Math.exp(-edad * 5) : 0);
  const abajo = R_ARO * (0.58 + sac * 0.12);
  ctx.strokeStyle = "rgba(250,248,240,.85)"; ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const top = aPantalla(hx + R_ARO * Math.cos(t), ALTURA_ARO, z + R_ARO * Math.sin(t));
    for (const d of [-0.5, 0.5]) {
      const tb = t + (d * Math.PI * 2) / n;
      const mid = aPantalla(hx + (R_ARO * 0.8) * Math.cos(tb), ALTURA_ARO - caida * 0.5, z + (R_ARO * 0.8) * Math.sin(tb));
      const bot = aPantalla(hx + abajo * Math.cos(t), ALTURA_ARO - caida, z + abajo * Math.sin(t));
      ctx.moveTo(top.x, top.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(bot.x, bot.y);
    }
  }
  ctx.stroke();
  // anillos de la red
  for (const [y, r] of [[ALTURA_ARO - caida * 0.5, R_ARO * 0.8], [ALTURA_ARO - caida, abajo]]) {
    const pts = puntosAro(hx, z, r, y, 28);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = "rgba(250,248,240,.5)"; ctx.stroke();
  }
}

function dibujarBalon(x, y, z, giro, alfa = 1) {
  const p = aPantalla(x, y, z);
  const r = R_BALON * p.e;
  ctx.save();
  ctx.globalAlpha *= alfa;
  // borde oscuro muy suave, para que se lea sobre la piedra clara
  ctx.beginPath(); ctx.arc(p.x, p.y, r + Math.max(1, r * 0.04), 0, Math.PI * 2); ctx.fillStyle = "rgba(7,6,10,.35)"; ctx.fill();
  // cuero: luz arriba a la izquierda, como la de la foto
  const g = ctx.createRadialGradient(p.x - r * 0.38, p.y - r * 0.42, r * 0.05, p.x, p.y, r * 1.02);
  g.addColorStop(0, "#f7ad6f"); g.addColorStop(0.35, "#e27a34"); g.addColorStop(0.75, "#b9561d"); g.addColorStop(1, "#6e2a0a");
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  // costuras
  ctx.save(); ctx.clip();
  ctx.translate(p.x, p.y); ctx.rotate(giro);
  ctx.strokeStyle = "rgba(38,14,4,.62)"; ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-r * 1.05, 0, r * 0.62, r * 1.05, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(r * 1.05, 0, r * 0.62, r * 1.05, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
  // brillo
  const bri = ctx.createRadialGradient(p.x - r * 0.42, p.y - r * 0.48, 0, p.x - r * 0.42, p.y - r * 0.48, r * 0.55);
  bri.addColorStop(0, "rgba(255,240,220,.35)"); bri.addColorStop(1, "rgba(255,240,220,0)");
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = bri; ctx.fill();
  ctx.restore();
  return { ...p, r };
}

// posición del balón de un vuelo en el instante tj (ms de partida)
function posicionVuelo(v, tj) {
  const tr = v.res.tray, n = tr.length / 3;
  const k = (tj / 1000 - v.res.t0) / PASO - 1;
  if (k < 0) return { x: tr[0], y: tr[1], z: tr[2], vivo: true };
  if (k < n - 1) {
    const i = Math.floor(k), f = k - i;
    return { x: tr[i * 3] + (tr[i * 3 + 3] - tr[i * 3]) * f, y: tr[i * 3 + 1] + (tr[i * 3 + 4] - tr[i * 3 + 1]) * f, z: tr[i * 3 + 2] + (tr[i * 3 + 5] - tr[i * 3 + 2]) * f, vivo: true };
  }
  // después de decidirse: sigue cayendo (por la red, más despacio) y se desvanece
  const i = n - 1;
  const vx = (tr[i * 3] - tr[i * 3 - 3]) / PASO, vy = (tr[i * 3 + 1] - tr[i * 3 - 2]) / PASO, vz = (tr[i * 3 + 2] - tr[i * 3 - 1]) / PASO;
  const s = (k - (n - 1)) * PASO;
  const freno = v.res.canasta ? 0.35 : 1;
  return {
    x: tr[i * 3] + vx * s * freno, z: tr[i * 3 + 2] + vz * s * freno,
    y: tr[i * 3 + 1] + vy * s * freno - 4.9 * s * s,
    vivo: s < (v.res.canasta ? 0.45 : 0.9), desvanece: Math.max(0, 1 - s / (v.res.canasta ? 0.45 : 0.9)),
  };
}

function dibujar(ahora) {
  ctx.clearRect(0, 0, ancho, alto);
  ctx.save();
  ctx.globalAlpha = estado === "inicio" || estado === "fin" ? 0.3 : 1;
  dibujarEscena(ahora);
  ctx.restore();
}

function dibujarEscena(ahora) {
  const tj = estado === "juego" || estado === "fin" ? tiempoJuego(ahora) : 0;
  const { aro } = aroVisible(tj);
  const hx = xAro(aro, Math.max(0, tj) / 1000);
  // balones en el aire: los que están detrás del aro se pintan antes de la red
  const balones = [];
  vuelos = vuelos.filter((v) => {
    const p = posicionVuelo(v, tj);
    if (!p.vivo) return false;
    balones.push({ ...p, giro: (tj / 1000 - v.res.t0) * v.giro, alfa: p.desvanece ?? 1 });
    return true;
  });
  dibujarSombras(hx, aro.z, balones);
  dibujarTablero(hx, aro.z);
  const pts = puntosAro(hx, aro.z, R_ARO, ALTURA_ARO);
  const grosor = Math.max(2.5, aPantalla(hx, ALTURA_ARO, aro.z).e * 0.022);
  trazoAro(pts, true, grosor);
  for (const b of balones) if (b.z > aro.z) dibujarBalon(b.x, b.y, b.z, b.giro, b.alfa);
  dibujarRed(hx, aro.z, tj);
  trazoAro(pts, false, grosor);
  for (const b of balones) if (b.z <= aro.z) dibujarBalon(b.x, b.y, b.z, b.giro, b.alfa);

  // el balón en la mano
  if ((estado === "juego" && tj >= partida.listoEn && tj <= DURACION_MS) || estado === "inicio" || estado === "cuenta") {
    const aparece = estado === "juego" ? Math.min(1, (tj - partida.listoEn) / 220) : 1;
    const sube = (1 - (1 - aparece) ** 3);
    let x = SALIDA.x, y = SALIDA.y - 0.5 * (1 - sube), z = SALIDA.z;
    if (arrastre) y += Math.min(0.06, arrastre.largo * 0.15);
    const b = dibujarBalon(x, y, z, 0, sube);
    if (arrastre) dibujarArrastre(b);
  }
}

function dibujarArrastre(b) {
  const { x0, y0, x1, y1 } = arrastre;
  const dy = y0 - y1;
  if (dy <= 4) return;
  const s = Math.min(LIMITES.s[1] / 10000, dy / H);
  const dx = x1 - x0;
  // flecha desde el balón en la misma dirección y largo que el dedo
  const ex = b.x + dx, ey = b.y - dy;
  ctx.save();
  ctx.setLineDash([2, 10]); ctx.lineCap = "round"; ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(243,234,216,.75)";
  ctx.beginPath(); ctx.moveTo(b.x, b.y - b.r); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fillStyle = "rgba(243,234,216,.95)"; ctx.fill();
  // barra de fuerza alrededor del balón
  const frac = Math.min(1, s / (LIMITES.s[1] / 10000));
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(233,180,76,.95)";
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 9, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ── Avisos flotantes ──
function aviso(texto, clase, x, y) {
  const el = document.createElement("div");
  el.className = `aviso ${clase}`; el.textContent = texto;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function avisoNivel(texto) {
  document.querySelectorAll(".nivel").forEach((e) => e.remove());
  const el = document.createElement("div"); el.className = "nivel"; el.textContent = texto;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2300);
}
// por qué ha fallado: se mira dónde pasaba el balón al bajar a la altura del aro
function porQueFallo(res) {
  if (res.muro) return "Te has pasado";
  const tr = res.tray, aro = res.aroDelTiro;
  const ev = res.eventos || [];
  let pasoTablero = Infinity;
  for (let j = 0; j < ev.length; j += 2) if (ev[j + 1] === "tablero") { pasoTablero = ev[j] - 1; break; }
  for (let i = 1; i < tr.length / 3; i++) {
    if (tr[i * 3 - 2] >= ALTURA_ARO && tr[i * 3 + 1] < ALTURA_ARO) {
      if (i > pasoTablero) return "Demasiado fuerte";
      const t = res.t0 + (i + 1) * PASO;
      const dx = tr[i * 3] - xAro(aro, t), dz = tr[i * 3 + 2] - aro.z;
      if (Math.abs(dx) < R_ARO + R_BALON && Math.abs(dz) < R_ARO + R_BALON) return res.tocoAro ? "¡Uy! Ha escupido" : "Casi";
      if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? "A la izquierda" : "A la derecha";
      return dz < 0 ? "Corto" : "Te has pasado";
    }
  }
  // no llegó a la altura del aro, o rebotó y salió
  let maxY = 0; for (let i = 1; i < tr.length; i += 3) maxY = Math.max(maxY, tr[i]);
  return maxY < ALTURA_ARO ? "Corto" : res.tocoAro ? "¡Uy! Ha escupido" : "Fuera";
}

// ── Marcadores ──
function pintarHud(tj) {
  const quedan = Math.max(0, Math.ceil((DURACION_MS - tj) / 1000));
  if (quedan === 10 && !avisoDiez) { avisoDiez = true; anunciar("Quedan 10 segundos."); }
  const t = $("tiempo");
  t.firstChild.nodeValue = `0:${String(quedan).padStart(2, "0")}`;
  t.classList.toggle("poco", quedan <= 5 && estado === "juego");
  const { aro } = aroVisible(tj);
  const vel = Math.round(Math.abs(aro.viento) * 9); // km/h orientativos
  const v = $("viento");
  if (aro.viento && estado === "juego") {
    const izq = aro.viento < 0;
    const html = `<svg viewBox="0 0 22 14" aria-hidden="true"><path d="${izq ? "M21 7H3m5-5L2 7l6 5" : "M1 7h18m-5-5 6 5-6 5"}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Cierzo ${vel} km/h`;
    if (v.dataset.html !== html) { v.innerHTML = html; v.dataset.html = html; }
    v.hidden = false;
  } else v.hidden = true;
}
function pintarPuntos(sube) {
  const b = $("puntos");
  b.textContent = partida.puntos;
  if (sube && !reducido) { b.classList.remove("sube"); void b.offsetWidth; b.classList.add("sube"); setTimeout(() => b.classList.remove("sube"), 170); }
  const r = $("racha");
  r.firstChild.nodeValue = `×${partida.racha}`;
  r.classList.toggle("si", partida.racha >= 2);
  r.setAttribute("aria-hidden", String(partida.racha < 2));
}

// ── Tirar ──
function tirar(ahora) {
  const tj = Math.round(tiempoJuego(ahora));
  const { x0, y0, x1, y1 } = arrastre;
  const dy = y0 - y1;
  if (dy < H * 0.06) { const p = $("pista"); p.textContent = TEXTO.corto; p.style.opacity = ".85"; return; }
  const s = Math.round(Math.min(LIMITES.s[1], Math.max(LIMITES.s[0], (dy / H) * 10000)));
  const a = Math.round(Math.min(LIMITES.a[1], Math.max(LIMITES.a[0], ((x1 - x0) / dy) * 10000)));
  if (tj < partida.listoEn && partida.listoEn - tj <= 450 && !tiroPendiente) {
    const listo = partida.listoEn;
    tiroPendiente = setTimeout(() => { tiroPendiente = null; if (estado === "juego") lanzarTiro({ t: listo, s, a }); }, listo - tj);
    return;
  }
  lanzarTiro({ t: tj, s, a });
}

function lanzarTiro(tiro) {
  if (motivoInvalido(partida, tiro)) return; // demasiado pronto o fuera de tiempo: no se tira
  const nivelAntes = partida.nivel;
  const res = lanzar(partida, tiro, { trayectoria: true });
  tiros.push(tiro);
  vuelos.push({ res, giro: -6 - Math.random() * 4 });
  sonar("tiro");
  $("pista").style.opacity = "0";
  programarEfectos(res, nivelAntes);
}

function programarEfectos(res, nivelAntes) {
  const enMs = (t) => Math.max(0, t * 1000 - tiempoJuego(performance.now()));
  // sonidos de los golpes, cuando pasan
  const ev = res.eventos || [];
  for (let i = 0; i < ev.length; i += 2) {
    const t = res.t0 + ev[i] * PASO;
    setTimeout(() => sonar(ev[i + 1] === "aro" ? "aro" : "tablero", 0.9), enMs(t));
  }
  setTimeout(() => {
    const aro = res.aroDelTiro;
    const pos = aPantalla(xAro(aro, res.fin), ALTURA_ARO + 0.7, aro.z);
    if (res.canasta) {
      redSacudida = res.fin * 1000;
      sonar("red", res.limpia ? 1.2 : 0.9); vibrar(res.limpia ? [12, 40, 12] : 14);
      const texto = `+${res.ganados}${res.limpia ? " LIMPIA" : ""}`;
      aviso(texto, res.limpia || res.racha >= 3 ? "oro" : "bien", pos.x, pos.y);
      if (res.racha === 3) setTimeout(() => aviso("¡En racha!", "oro", ancho / 2, pos.y + 70), 250);
      pintarPuntos(true);
      anunciar(`${res.limpia ? "Canasta limpia" : "Canasta"}. ${partida.puntos} puntos.`);
      fallosSeguidos = 0;
      aroAnterior = aro; cambioAro = res.fin * 1000 + 40;
      const nivel = { 2: "La canasta cambia de sitio", 3: "Sopla el cierzo: apunta contra el viento", 4: "¡Ahora se mueve!" }[res.subeNivel];
      if (nivel) { avisoNivel(nivel); setTimeout(() => anunciar(nivel), 900); }
    } else {
      const motivo = porQueFallo(res);
      aviso(motivo, "mal", pos.x, pos.y);
      anunciar(`Fallo. ${motivo}.`);
      pintarPuntos(false);
      fallosSeguidos++;
      if (fallosSeguidos >= 3 && nivelDe(partida.canastas) === 1) {
        const p = $("pista"); p.textContent = conRaton ? "Truco: arrastra más o menos hasta la canasta y suelta." : "Truco: desliza más o menos hasta la canasta y suelta."; p.style.opacity = ".85";
      }
    }
  }, enMs(res.fin));
}

// ── Dedo ──
function zonaValida(y) { return y > arriba + H * 0.45; }
lienzo.addEventListener("pointerdown", (e) => {
  if (estado !== "juego" || arrastre || tiroPendiente) return;
  // se puede empezar a deslizar un poco antes de que salga el balón: al soltar ya estará
  const tj = tiempoJuego(performance.now());
  if (tj < partida.listoEn - 400 || tj > DURACION_MS) return;
  if (!zonaValida(e.clientY)) return;
  lienzo.setPointerCapture(e.pointerId);
  arrastre = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, largo: 0 };
  e.preventDefault();
});
lienzo.addEventListener("pointermove", (e) => {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  arrastre.x1 = e.clientX; arrastre.y1 = e.clientY;
  arrastre.largo = Math.max(0, (arrastre.y0 - arrastre.y1) / H);
});
const soltar = (e) => {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  arrastre.x1 = e.clientX; arrastre.y1 = e.clientY;
  if (e.type === "pointerup" && estado === "juego") tirar(performance.now());
  arrastre = null;
};
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

// ── Partida ──
// Para probar: ?semilla=123 repite siempre la misma partida y ?depurar deja mirar el estado desde la consola.
// En la liga de verdad la semilla la da el servidor y esto no influye en nada.
const parametros = new URLSearchParams(location.search);
function semillaNueva() {
  const fija = Number(parametros.get("semilla"));
  if (Number.isInteger(fija) && fija > 0) return fija >>> 0;
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0];
}
if (parametros.has("depurar")) {
  window.__liga = { estado: () => ({ estado, tj: tiempoJuego(performance.now()), H, arriba, partida: partida && { listoEn: partida.listoEn, nivel: partida.nivel, aro: partida.aro, puntos: partida.puntos, canastas: partida.canastas } }) };
}
function empezar() {
  abrirAudio();
  partida = crearPartida(semillaNueva());
  vuelos = []; tiros = []; aroAnterior = null; fallosSeguidos = 0; redSacudida = -1e9; avisoDiez = false;
  if (tiroPendiente) { clearTimeout(tiroPendiente); tiroPendiente = null; }
  $("inicio").hidden = true; $("fin").hidden = true;
  $("hud").hidden = false; pintarPuntos(false);
  $("tiempo").firstChild.nodeValue = "0:40";
  const p = $("pista"); p.hidden = false; p.style.opacity = ".85"; p.textContent = TEXTO.pista;
  estado = "cuenta";
  const cuenta = $("cuenta");
  const pasos = reducido ? ["¡Ya!"] : ["3", "2", "1", "¡Ya!"];
  pasos.forEach((txt, i) => setTimeout(() => {
    cuenta.innerHTML = `<span>${txt}</span>`;
    sonar("cuenta", i === pasos.length - 1 ? 2 : 1);
    if (i === pasos.length - 1) {
      estado = "juego"; inicioReal = performance.now();
      setTimeout(() => (cuenta.innerHTML = ""), 700);
      lienzo.focus({ preventScroll: true });
      anunciar("¡Ya! Tienes 40 segundos.");
    }
  }, i * 750));
}

function terminar() {
  estado = "fin";
  arrastre = null;
  sonar("pito");
  const r = resumen(partida);
  let mejor = 0;
  try { mejor = Number(localStorage.getItem("liga-canasta-mejor") || 0); } catch { /* nada */ }
  const nuevo = r.puntos > mejor;
  if (nuevo) { try { localStorage.setItem("liga-canasta-mejor", String(r.puntos)); } catch { /* nada */ } }
  anunciar(`Se acabó el tiempo. ${r.puntos} puntos: ${r.canastas} canastas de ${r.tiros} tiros.`);
  $("fin-puntos").textContent = r.puntos;
  $("fin-canastas").textContent = `${r.canastas}/${r.tiros}`;
  $("fin-limpias").textContent = r.limpias;
  $("fin-racha").textContent = r.mejorRacha;
  const rec = $("fin-record");
  rec.textContent = nuevo && r.puntos > 0 ? "¡Tu mejor marca!" : mejor ? `Tu mejor marca: ${mejor} puntos` : "";
  rec.classList.toggle("nuevo", nuevo && r.puntos > 0);
  setTimeout(() => {
    $("hud").hidden = true; $("viento").hidden = true; $("pista").hidden = true;
    const fin = $("fin"); fin.hidden = false; fin.classList.remove("entra"); void fin.offsetWidth; fin.classList.add("entra");
    $("otra").focus({ preventScroll: true });
  }, 900);
  // para depurar y para el servidor: la partida entera cabe en esto
  window.__ultimaPartida = { ...r, semilla: partida.semilla, lista: tiros.slice() };
}

$("jugar").addEventListener("click", empezar);
$("otra").addEventListener("click", empezar);
$("compartir").addEventListener("click", async () => {
  const r = resumen(partida);
  const texto = `He metido ${r.canastas} canastas en la Catedral de León: ${r.puntos} puntos. ¿Me superas?`;
  const url = location.href.split("#")[0];
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      $("compartir").textContent = "Copiado";
      setTimeout(() => ($("compartir").textContent = "Compartir"), 1600);
    } catch { /* sin portapapeles: no hay nada más que hacer */ }
  };
  if (!navigator.share) return copiar();
  try { await navigator.share({ title: "Canasta en la Catedral", text: texto, url }); }
  catch (e) { if (e?.name !== "AbortError") copiar(); } // si lo cierra la persona, nada; si el móvil no deja, se copia
});

// ── Bucle ──
function bucle(ahora) {
  if (estado === "juego") {
    const tj = tiempoJuego(ahora);
    pintarHud(tj);
    // se acaba cuando pasa el tiempo y no queda ningún balón por decidirse (el que va en el aire al sonar, cuenta)
    if (tj >= DURACION_MS && !vuelos.some((v) => tj < v.res.fin * 1000 + 100)) terminar();
  }
  dibujar(ahora);
  requestAnimationFrame(bucle);
}
medir();
addEventListener("resize", medir);
requestAnimationFrame(bucle);
