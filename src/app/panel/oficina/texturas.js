// ============ TEXTURAS DE LA OFICINA ============
// Se pintan en un lienzo al abrir la página: nada que descargar. Solo en el navegador.
import * as THREE from "three";

function lienzo(ancho, alto, pintar) {
  const c = document.createElement("canvas");
  c.width = ancho; c.height = alto;
  pintar(c.getContext("2d"), ancho, alto);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Un azar que da siempre lo mismo: la oficina no cambia de suelo al recargar
const azar = (semilla) => { let s = semilla; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

function mezcla(ctx, w, h, opacidad, r) {
  for (let i = 0; i < (w * h) / 22; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${opacidad * r()})` : `rgba(0,0,0,${opacidad * r()})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

function parquet(claro, oscuro, semilla) {
  return lienzo(512, 512, (ctx, w, h) => {
    const r = azar(semilla);
    const tablas = 8, alto = h / tablas;
    for (let f = 0; f < tablas; f++) {
      let x = -r() * 200;
      while (x < w) {
        const largo = 150 + r() * 170, k = r();
        const g = ctx.createLinearGradient(0, f * alto, 0, (f + 1) * alto);
        const a = new THREE.Color(claro).lerp(new THREE.Color(oscuro), k).getStyle();
        g.addColorStop(0, a); g.addColorStop(1, new THREE.Color(claro).lerp(new THREE.Color(oscuro), Math.min(1, k + 0.12)).getStyle());
        ctx.fillStyle = g;
        ctx.fillRect(x, f * alto, largo, alto);
        // Veta
        ctx.strokeStyle = "rgba(40,20,5,.1)";
        for (let v = 0; v < 5; v++) {
          const y = f * alto + r() * alto;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + largo * 0.3, y + r() * 6 - 3, x + largo * 0.6, y + r() * 6 - 3, x + largo, y); ctx.stroke();
        }
        ctx.fillStyle = "rgba(20,10,0,.45)";
        ctx.fillRect(x, f * alto, 1.5, alto);
        x += largo;
      }
      ctx.fillStyle = "rgba(20,10,0,.4)";
      ctx.fillRect(0, f * alto, w, 1.5);
    }
  });
}

function moqueta(base, semilla) {
  return lienzo(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const r = azar(semilla);
    mezcla(ctx, w, h, 0.09, r);
    // Losetas de moqueta
    ctx.strokeStyle = "rgba(0,0,0,.09)"; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  });
}

// Baldosa hidráulica de bar de toda la vida
function hidraulica() {
  return lienzo(256, 256, (ctx, w) => {
    const b = w / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.save(); ctx.translate(i * b, j * b);
      ctx.fillStyle = "#c9b79c"; ctx.fillRect(0, 0, b, b);
      ctx.fillStyle = "#7a3d2e";
      ctx.beginPath(); ctx.moveTo(b / 2, 8); ctx.lineTo(b - 8, b / 2); ctx.lineTo(b / 2, b - 8); ctx.lineTo(8, b / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e3d8c2";
      ctx.beginPath(); ctx.arc(b / 2, b / 2, b * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3f4d55";
      ctx.beginPath(); ctx.arc(b / 2, b / 2, b * 0.09, 0, Math.PI * 2); ctx.fill();
      for (const [x, y] of [[0, 0], [b, 0], [0, b], [b, b]]) { ctx.beginPath(); ctx.arc(x, y, b * 0.16, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = "rgba(20,10,0,.3)"; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, b, b);
      ctx.restore();
    }
  });
}

function terrazo() {
  return lienzo(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#b9b4aa"; ctx.fillRect(0, 0, w, h);
    const r = azar(77);
    const cols = ["#8f8a80", "#d8d3c8", "#6e6a62", "#c9b79c", "#a39c90"];
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      const s = 1 + r() * 5;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, s, s * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function revoco() {
  return lienzo(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#e7e1d4"; ctx.fillRect(0, 0, w, h);
    mezcla(ctx, w, h, 0.035, azar(5));
  });
}

function maderaMesa() {
  return lienzo(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#a9794b"; ctx.fillRect(0, 0, w, h);
    const r = azar(31);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? "60,30,10" : "210,170,120"},${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      const y = r() * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + r() * 16 - 8, w * 0.6, y + r() * 16 - 8, w, y); ctx.stroke();
    }
  });
}

// Lo que se ve en una pantalla: filas de resultados de una búsqueda
export function pantallaTrabajo() {
  const t = lienzo(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0f1626"; ctx.fillRect(0, 0, w, h);
    const r = azar(11);
    const cols = ["#7fa8f0", "#e9b44c", "#78d29a", "#e8e2d4", "#e8e2d4", "#e8e2d4"];
    for (let y = 6; y < h; y += 12) {
      let x = 10 + Math.floor(r() * 3) * 10;
      while (x < w - 20 && r() > 0.08) {
        const l = 10 + r() * 40;
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.globalAlpha = 0.55 + r() * 0.45;
        ctx.fillRect(x, y, l, 5);
        x += l + 6;
      }
    }
    ctx.globalAlpha = 1;
  });
  return t;
}

// El rosetón, de cristales de color: la luz de León en la pared del fondo
export function vidriera() {
  const t = lienzo(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    const colores = ["#1d3f8f", "#8f1f2a", "#1d3f8f", "#b98a24", "#1d3f8f", "#8f1f2a", "#245f7f"];
    ctx.lineWidth = 7; ctx.strokeStyle = "#17120f";
    ctx.fillStyle = "#1a1512"; ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.fill();
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      ctx.fillStyle = colores[(i * 5) % colores.length];
      ctx.beginPath(); ctx.arc(c, c, c - 8, a0, a1); ctx.arc(c, c, c * 0.62, a1, a0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      ctx.fillStyle = colores[(i * 7 + 2) % colores.length];
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c * 0.62, a0, a1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "#e9b44c"; ctx.beginPath(); ctx.arc(c, c, c * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Una mancha de luz en el suelo (bajo las lámparas) y la sombra pegada a los pies
function mancha(rgb) {
  const t = lienzo(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},.42)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

let cache = null;
export function texturas() {
  if (cache) return cache;
  cache = {
    parquet: parquet("#b98a5a", "#8a5f37", 13),
    parquetOscuro: parquet("#6f4a2c", "#4a2f1b", 29),
    moquetaAzul: moqueta("#59657a", 3),
    moquetaGris: moqueta("#6d6c70", 9),
    moquetaRoja: moqueta("#7c3b3f", 17),
    hidraulica: hidraulica(),
    terrazo: terrazo(),
    revoco: revoco(),
    madera: maderaMesa(),
    pantalla: pantallaTrabajo(),
    vidriera: vidriera(),
    luz: mancha("255,226,170"),
    sombra: mancha("0,0,0"),
  };
  return cache;
}
