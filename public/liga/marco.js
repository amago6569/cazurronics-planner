// Marco común de los juegos de la Liga Cazurra (todos menos la canasta, que lo lleva dentro).
// Aquí va lo que no cambia de un juego a otro: 3D o plano, foto de fondo, sonido, cuenta atrás, marcadores,
// pantalla final, compartir y la liga (semilla del servidor, intentos y envío de la partida).
// Cada juego pone su motor, su escena 3D, su dibujo en plano y cómo se maneja con el dedo.
import { crearLiga, abrirEntrada, alCambiar } from "./cuenta.js";

export const $ = (id) => document.getElementById(id);
export const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const conRaton = matchMedia("(pointer: fine)").matches && !matchMedia("(pointer: coarse)").matches;
const parametros = new URLSearchParams(location.search);
export const depurando = parametros.has("depurar");

// juego = {
//   id, nombre, duracionMs, fondo: "fondos/humedo", textoPista,
//   crearPartida(semilla), resumen(partida) → { puntos, … }, datosLiga(partida) → lo que se manda al servidor,
//   final(r) → { datos: [[título, valor] ×3], anuncio, compartir },
//   cargar3d() → import("./escena-x.js"), con crearEscena({ lienzo, contexto, foto, reducido, marco }),
//   empezar(partida), actualizar(tj) → true cuando la partida está acabada del todo,
//   dibujarPlano(ctx, tj, ahora), datos3d(tj, ahora) → lo que recibe escena.dibujar,
//   medir(medidas) (opcional), chip(tj) → html o null (opcional), sonidos: { tipo(audio, t, salida, fuerza) } (opcional)
// }
export function crearMarco(juego) {
  const lienzo = $("lienzo");
  const ctx = lienzo.getContext("2d");
  const lienzo3d = $("escena");
  const foto = $("foto");
  const m = { reducido, conRaton, ctx, lienzo, ancho: 0, alto: 0, H: 0, arriba: 0, dpr: 1, estado: "inicio", partida: null, modo: "plano" };

  // ── 3D o plano ──
  let escena3d = null, empezarAlCargar = false;
  function pasarAPlano() {
    m.modo = "plano"; escena3d = null; lienzo3d.hidden = true; foto.style.transform = "";
    medir();
    if (empezarAlCargar) { empezarAlCargar = false; empezar(); }
  }
  if (!parametros.has("plano")) {
    const contexto3d = (() => {
      try { return lienzo3d.getContext("webgl2", {
        alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: !parametros.has("forzar3d"), // sin tarjeta gráfica el 3D va a tirones: mejor plano
      }); } catch { return null; }
    })();
    if (contexto3d) {
      m.modo = "cargando";
      const plazo = setTimeout(() => { if (m.modo === "cargando") pasarAPlano(); }, 8000);
      juego.cargar3d().then(({ crearEscena }) => {
        if (m.modo !== "cargando") return;
        escena3d = crearEscena({ lienzo: lienzo3d, contexto: contexto3d, foto, reducido, marco: m });
        clearTimeout(plazo);
        m.modo = "3d";
        medir();
        if (empezarAlCargar) { empezarAlCargar = false; empezar(); }
      }).catch((e) => { console.warn("Sin 3D:", e); clearTimeout(plazo); pasarAPlano(); });
      lienzo3d.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pasarAPlano(); });
    } else lienzo3d.hidden = true;
  } else lienzo3d.hidden = true;

  // ── Tamaños: el escenario mide como mucho 940 px de alto, así nadie tiene ventaja por pantalla grande ──
  function medir() {
    m.dpr = Math.min(2, window.devicePixelRatio || 1);
    m.ancho = window.innerWidth; m.alto = window.innerHeight;
    m.H = Math.min(m.alto, 940);
    m.arriba = (m.alto - m.H) / 2;
    lienzo.width = Math.round(m.ancho * m.dpr); lienzo.height = Math.round(m.alto * m.dpr);
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    // en 3D la foto va desenfocada (está lejos y la cámara enfoca el juego); en plano, nítida
    const quiere = `${juego.fondo}-${m.ancho / m.alto > 1 ? "h" : "v"}${m.modo === "plano" ? "" : "-lejos"}.webp`;
    if (foto.getAttribute("src") !== quiere) foto.setAttribute("src", quiere);
    juego.medir?.(m);
    if (escena3d) escena3d.medir(m);
  }

  // ── Avisos ──
  m.anunciar = (texto) => { const a = $("anuncio"); a.textContent = ""; setTimeout(() => (a.textContent = texto), 40); };
  m.aviso = (texto, clase, x, y) => {
    const el = document.createElement("div");
    el.className = `aviso ${clase}`; el.textContent = texto;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  };
  m.avisoNivel = (texto) => {
    document.querySelectorAll(".nivel").forEach((e) => e.remove());
    const el = document.createElement("div"); el.className = "nivel"; el.textContent = texto;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2300);
    setTimeout(() => m.anunciar(texto), 600);
  };
  m.pista = (texto) => { const p = $("pista"); if (texto) { p.textContent = texto; p.style.opacity = ".85"; } else p.style.opacity = "0"; };
  m.vibrar = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no hay */ } };

  // ── Sonido (sintetizado, sin archivos) ──
  let audio = null, conSonido = true;
  try { conSonido = localStorage.getItem("liga-sonido") !== "no"; } catch { /* con sonido */ }
  const abrirAudio = () => {
    if (audio || !window.AudioContext && !window.webkitAudioContext) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  };
  const tono = (salida, t, { fr, a = fr, tipo = "sine", g = 0.1, dur = 0.15, retraso = 0 }) => {
    const o = audio.createOscillator(); o.type = tipo;
    o.frequency.setValueAtTime(fr, t + retraso); if (a !== fr) o.frequency.exponentialRampToValueAtTime(a, t + retraso + dur);
    const e = audio.createGain(); e.gain.setValueAtTime(0.0001, t + retraso); e.gain.exponentialRampToValueAtTime(g, t + retraso + 0.008);
    e.gain.exponentialRampToValueAtTime(0.0001, t + retraso + dur);
    o.connect(e); e.connect(salida); o.start(t + retraso); o.stop(t + retraso + dur + 0.02);
  };
  const ruido = (salida, t, { dur = 0.2, fr = 2000, q = 0.8, g = 0.3, tipo = "bandpass" }) => {
    const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = audio.createBufferSource(); src.buffer = buf;
    const f = audio.createBiquadFilter(); f.type = tipo; f.frequency.value = fr; f.Q.value = q;
    const e = audio.createGain(); e.gain.value = g;
    src.connect(f); f.connect(e); e.connect(salida); src.start(t);
  };
  const SONIDOS = {
    cuenta: (s, t, f) => tono(s, t, { fr: f > 1 ? 880 : 520, g: 0.12, dur: 0.18 }),
    pito: (s, t) => { tono(s, t, { fr: 330, tipo: "square", g: 0.07, dur: 0.75 }); },
    bien: (s, t, f) => { tono(s, t, { fr: 520 * f, a: 780 * f, g: 0.09, dur: 0.12 }); },
    oro: (s, t) => { [660, 880, 1320].forEach((fr, i) => tono(s, t, { fr, g: 0.08, dur: 0.22, retraso: i * 0.07, tipo: "triangle" })); },
    mal: (s, t) => { tono(s, t, { fr: 180, a: 90, g: 0.16, dur: 0.22, tipo: "triangle" }); },
    golpe: (s, t, f) => { tono(s, t, { fr: 160, a: 70, g: 0.3 * f, dur: 0.14 }); ruido(s, t, { dur: 0.08, fr: 900, g: 0.15 * f }); },
    soplo: (s, t, f) => ruido(s, t, { dur: 0.25, fr: 1400, q: 0.6, g: 0.18 * f }),
  };
  m.sonar = (tipo, fuerza = 1) => {
    if (!audio || !conSonido) return;
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime;
    const salida = audio.createGain(); salida.connect(audio.destination);
    const f = juego.sonidos?.[tipo] || SONIDOS[tipo];
    if (f) f(salida, t, fuerza, { tono: (o) => tono(salida, t, o), ruido: (o) => ruido(salida, t, o), audio });
  };
  function pintarBotonSonido() {
    $("sonido").setAttribute("aria-pressed", String(!conSonido));
    $("ondas").toggleAttribute("hidden", !conSonido);
    $("tachado").toggleAttribute("hidden", conSonido);
  }
  $("sonido").addEventListener("click", () => {
    conSonido = !conSonido; abrirAudio(); pintarBotonSonido();
    try { localStorage.setItem("liga-sonido", conSonido ? "si" : "no"); } catch { /* da igual */ }
  });
  pintarBotonSonido();

  // ── Reloj ──
  let inicioReal = 0, relojFijo = null;
  m.tj = (ahora = performance.now()) => (relojFijo ?? ahora - inicioReal);
  m.inicioCuenta = 0; m.duracionCuenta = 0;

  // ── Marcadores ──
  let avisoDiez = false;
  m.pintarPuntos = (puntos, sube, racha = null) => {
    const b = $("puntos");
    b.textContent = puntos;
    if (sube && !reducido) { b.classList.remove("sube"); void b.offsetWidth; b.classList.add("sube"); setTimeout(() => b.classList.remove("sube"), 170); }
    const r = $("racha");
    if (racha) { r.firstChild.nodeValue = racha.texto; r.querySelector("small").textContent = racha.sub; }
    r.classList.toggle("si", Boolean(racha));
    r.setAttribute("aria-hidden", String(!racha));
  };
  function pintarHud(tj) {
    const quedan = Math.max(0, Math.ceil((juego.duracionMs - tj) / 1000));
    if (quedan === 10 && !avisoDiez) { avisoDiez = true; m.anunciar("Quedan 10 segundos."); }
    const t = $("tiempo");
    t.firstChild.nodeValue = `0:${String(quedan).padStart(2, "0")}`;
    t.classList.toggle("poco", quedan <= 5 && m.estado === "juego");
    const chip = $("chip");
    const html = m.estado === "juego" ? juego.chip?.(tj) : null;
    if (html) { if (chip.dataset.html !== html) { chip.innerHTML = html; chip.dataset.html = html; } chip.hidden = false; }
    else chip.hidden = true;
  }

  // ── Liga ──
  const liga = crearLiga(juego.id);
  let oficial = false, empezando = false;
  const TEXTO_LIGA = {
    sin_cuenta: "De práctica: no cuenta para la liga.",
    sin_perfil: "Elige tu apodo para que cuente en la liga.",
    cerrada: "La semana está cerrada: hasta el lunes, de práctica.",
    no_toca: "Hoy este juego no puntúa en la liga: es de práctica.",
    sin_intentos: "Ya has hecho tus 3 intentos de hoy. Sigue de práctica.",
    error: "Sin conexión con la liga: jugarás de práctica.",
  };
  const ORD = (n) => `${n}.º`;
  function pintarLiga() {
    const i = liga.info, e = $("liga-estado"), b = $("liga-entrar");
    if (!i) { e.textContent = ""; b.hidden = true; return; }
    if (i.oficial) {
      const intento = 4 - i.quedan;
      e.innerHTML = `Cuenta para la liga · <b>intento ${intento} de 3</b>${i.mejor != null ? ` · tu mejor hoy: ${i.mejor}` : ""}`;
      e.classList.add("oficial");
      b.hidden = true;
      if (!empezando && !empezarAlCargar) $("jugar").textContent = "Jugar";
      $("otra").textContent = `Otro intento (${intento} de 3)`;
    } else {
      e.textContent = TEXTO_LIGA[i.motivo] || "";
      e.classList.remove("oficial");
      b.hidden = !(i.motivo === "sin_cuenta" || i.motivo === "sin_perfil");
      b.textContent = i.motivo === "sin_perfil" ? "Elegir mi apodo" : "Entrar para puntuar";
      if (!empezando && !empezarAlCargar) $("jugar").textContent = "Jugar de práctica";
      $("otra").textContent = "Otra de práctica";
    }
  }
  const prepararLiga = async () => { await liga.preparar(); pintarLiga(); };
  $("liga-entrar").addEventListener("click", async () => {
    if (await abrirEntrada({ motivo: "Para que tus partidas cuenten en el ranking." })) prepararLiga();
  });
  alCambiar(() => { if (m.estado === "inicio" || m.estado === "fin") prepararLiga(); });
  prepararLiga();

  function semillaNueva() {
    const fija = Number(parametros.get("semilla"));
    if (Number.isInteger(fija) && fija > 0) return fija >>> 0;
    const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] || 1;
  }

  // ── Empezar ──
  async function empezar() {
    if (empezando || m.estado === "cuenta" || m.estado === "juego") return;
    abrirAudio();
    if (m.modo === "cargando") { empezarAlCargar = true; $("jugar").textContent = "Cargando…"; return; }
    oficial = false;
    let semilla = null;
    if (liga.info?.oficial) {
      empezando = true;
      const boton = m.estado === "fin" ? $("otra") : $("jugar"), texto = boton.textContent;
      boton.textContent = "Preparando…"; boton.disabled = true;
      try {
        const r = await liga.empezar(true);
        oficial = r.oficial; semilla = r.semilla;
      } catch (e) {
        empezando = false; boton.disabled = false; boton.textContent = texto;
        await prepararLiga();
        $(m.estado === "fin" ? "fin-liga" : "liga-estado").textContent = e.message;
        return;
      }
      empezando = false; boton.disabled = false; boton.textContent = texto;
    }
    $("jugar").textContent = "Jugar";
    m.partida = juego.crearPartida(oficial ? semilla : semillaNueva());
    avisoDiez = false;
    juego.empezar(m.partida);
    $("inicio").hidden = true; $("fin").hidden = true; $("volver").hidden = true;
    $("hud").hidden = false; m.pintarPuntos(0, false);
    $("tiempo").firstChild.nodeValue = `0:${String(Math.round(juego.duracionMs / 1000)).padStart(2, "0")}`;
    $("pista").hidden = false; m.pista(juego.textoPista());
    m.estado = "cuenta";
    const cuenta = $("cuenta");
    const pasos = reducido ? ["¡Ya!"] : ["3", "2", "1", "¡Ya!"];
    m.inicioCuenta = performance.now(); m.duracionCuenta = (pasos.length - 1) * 750;
    pasos.forEach((txt, i) => setTimeout(() => {
      cuenta.innerHTML = `<span>${txt}</span>`;
      m.sonar("cuenta", i === pasos.length - 1 ? 2 : 1);
      if (i === pasos.length - 1) {
        m.estado = "juego"; inicioReal = performance.now();
        setTimeout(() => (cuenta.innerHTML = ""), 700);
        lienzo.focus({ preventScroll: true });
        m.anunciar(`¡Ya! Tienes ${Math.round(juego.duracionMs / 1000)} segundos.`);
      }
    }, i * 750));
  }

  // ── Terminar ──
  function terminar() {
    m.estado = "fin";
    m.sonar("pito");
    juego.alTerminar?.();
    const r = juego.resumen(m.partida);
    const clave = `liga-${juego.id}-mejor`;
    let mejor = 0;
    try { mejor = Number(localStorage.getItem(clave) || 0); } catch { /* nada */ }
    const nuevo = r.puntos > mejor;
    if (nuevo) { try { localStorage.setItem(clave, String(r.puntos)); } catch { /* nada */ } }
    const f = juego.final(r);
    m.anunciar(f.anuncio);
    $("fin-puntos").textContent = r.puntos;
    $("fin-datos").innerHTML = f.datos.map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join("");
    const rec = $("fin-record");
    rec.textContent = nuevo && r.puntos > 0 ? "¡Tu mejor marca!" : mejor ? `Tu mejor marca: ${mejor} puntos` : "";
    rec.classList.toggle("nuevo", nuevo && r.puntos > 0);
    const fl = $("fin-liga");
    fl.classList.remove("oficial");
    if (oficial) {
      fl.textContent = "Guardando en la liga…";
      liga.terminar(juego.datosLiga(m.partida)).then((res) => {
        if (res?.estado === "valida") {
          fl.classList.add("oficial");
          const pos = [res.posicionDia && `vas <b>${ORD(res.posicionDia)}</b> hoy`, res.posicionSemana && `<b>${ORD(res.posicionSemana)}</b> en la semana`].filter(Boolean).join(" y ");
          fl.innerHTML = `Guardado en la liga${pos ? `: ${pos}` : ""}.${res.quedan ? ` Te ${res.quedan === 1 ? "queda 1 intento" : `quedan ${res.quedan} intentos`}.` : " Ya no te quedan intentos hoy."}`;
        } else if (res?.estado === "rechazada") fl.textContent = res.motivo;
        else fl.textContent = `${res?.error || "No se pudo guardar."} Lo volveremos a intentar al abrir la liga.`;
        prepararLiga();
      });
    } else fl.textContent = liga.info && !liga.info.oficial ? TEXTO_LIGA[liga.info.motivo] || "" : "";
    setTimeout(() => {
      $("volver").hidden = false;
      $("hud").hidden = true; $("chip").hidden = true; $("pista").hidden = true;
      const fin = $("fin"); fin.hidden = false; fin.classList.remove("entra"); void fin.offsetWidth; fin.classList.add("entra");
      $("otra").focus({ preventScroll: true });
    }, 900);
    m.compartir = f.compartir;
    window.__ultimaPartida = { ...r, semilla: m.partida.semilla, datos: juego.datosLiga(m.partida) };
  }

  $("jugar").addEventListener("click", empezar);
  $("otra").addEventListener("click", empezar);
  $("compartir").addEventListener("click", async () => {
    const texto = m.compartir || juego.nombre;
    const url = location.href.split(/[?#]/)[0];
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(`${texto} ${url}`);
        $("compartir").textContent = "Copiado";
        setTimeout(() => ($("compartir").textContent = "Compartir"), 1600);
      } catch { /* sin portapapeles */ }
    };
    if (!navigator.share) return copiar();
    try { await navigator.share({ title: juego.nombre, text: texto, url }); }
    catch (e) { if (e?.name !== "AbortError") copiar(); }
  });

  if (depurando) {
    window.__liga = {
      congelar: (ms) => { relojFijo = ms; }, soltar: () => { inicioReal = performance.now() - relojFijo; relojFijo = null; },
      estado: () => ({ estado: m.estado, modo: m.modo, tj: m.tj(), H: m.H, puntos: m.partida?.puntos, escena: escena3d?.info?.() }),
      marco: m,
    };
  }

  // ── Bucle ──
  let capaSucia = true;
  function bucle(ahora) {
    const tj = m.estado === "juego" || m.estado === "fin" ? m.tj(ahora) : 0;
    if (m.estado === "juego") {
      pintarHud(tj);
      if (juego.actualizar(tj)) terminar();
    }
    if (m.modo === "3d") {
      escena3d.dibujar({ estado: m.estado, ahora, tj, inicioCuenta: m.inicioCuenta, duracionCuenta: m.duracionCuenta, ...juego.datos3d(tj, ahora) });
      // encima, en plano, lo que el juego quiera (guías del dedo)
      if (capaSucia) { ctx.clearRect(0, 0, m.ancho, m.alto); capaSucia = false; }
      if (juego.dibujarEncima?.(ctx, tj, ahora)) capaSucia = true;
    } else {
      ctx.clearRect(0, 0, m.ancho, m.alto);
      if (m.modo !== "cargando") {
        ctx.save();
        ctx.globalAlpha = m.estado === "inicio" || m.estado === "fin" ? 0.35 : 1;
        juego.dibujarPlano(ctx, tj, ahora);
        ctx.restore();
        juego.dibujarEncima?.(ctx, tj, ahora);
      }
    }
    requestAnimationFrame(bucle);
  }
  m.arrancar = () => { medir(); addEventListener("resize", medir); requestAnimationFrame(bucle); };
  return m;
}

// ── Utilidades para las escenas 3D ──

// Suerte reproducible para lo que solo se ve (formas, texturas), sin tocar la del motor
export function suerteVisual(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
