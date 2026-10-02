"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import BusinessModal from './components/BusinessModal';
import Valorar from './components/Valorar';
import TarjetaEvento from './components/TarjetaEvento';
import { baliza, compartirPlan, recordarPlan, actualizarParadaRecordada, planPendienteDeValorar, registrarVisita } from '../lib/cliente';

const MapSelectorDynamic = dynamic(() => import('./components/MapSelector'), { ssr: false });

/* ─────────────────────────────────────────────────────────────
   Sistema visual "Vidriera": cristal sobre León desenfocado.
   Solo clases de Tailwind reutilizables; ninguna lógica aquí.
   ───────────────────────────────────────────────────────────── */
const GLASS = "bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]";
const GLASS_SOFT = "bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]";
const INPUT = "w-full bg-white/75 border border-white text-slate-800 placeholder:text-slate-400 text-[15px] font-medium rounded-2xl px-4 py-3.5 outline-none ring-1 ring-slate-900/5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:ring-2 focus:ring-rose-300/70 focus:shadow-[0_0_0_6px_rgba(251,113,133,0.12)]";
const LABEL = "flex items-center gap-2 text-[13px] font-semibold text-slate-700 mb-2 px-1";
const PRESS = "transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.97]";

// Pasos que se van completando mientras /api/plan trabaja (solo visual)
const PASOS_CARGA = [
  { emoji: "🌤️", texto: "Mirando la previsión del tiempo" },
  { emoji: "🗺️", texto: "Buscando sitios dentro de tu zona" },
  { emoji: "💶", texto: "Ajustándolo a tu presupuesto" },
  { emoji: "📸", texto: "Comprobando horarios y fotos reales" },
  { emoji: "🦁", texto: "Trazando la ruta más cazurra" },
];

/* ─────────────────────────────────────────────────────────────
   CAZURRONICS CHOICES — los locales destacados.
   Mientras esté vacío se muestran las vidrieras "apagadas".
   Para añadir uno, mete un objeto así (máx. 3 se ven a la vez):
   { nombre: "Bar Ejemplo", categoria: "Tapeo", zona: "Barrio Húmedo",
     foto: "/choices/bar-ejemplo.jpg", frase: "La mejor morcilla de León",
     url: "https://..." }   ← url es opcional
   ───────────────────────────────────────────────────────────── */
const CAZURRONICS_CHOICES = [];

// Colores de cada vidriera (inspirados en el rosetón de la Catedral)
const VIDRIERAS = [
  "radial-gradient(circle at 50% 28%, #fef3c7 0 9%, transparent 10%), conic-gradient(from 210deg at 50% 62%, #fb7185, #f97316, #fde68a, #f43f5e, #fb923c, #fb7185)",
  "radial-gradient(circle at 50% 28%, #e0f2fe 0 9%, transparent 10%), conic-gradient(from 180deg at 50% 62%, #38bdf8, #6366f1, #a78bfa, #0ea5e9, #818cf8, #38bdf8)",
  "radial-gradient(circle at 50% 28%, #fef9c3 0 9%, transparent 10%), conic-gradient(from 240deg at 50% 62%, #34d399, #14b8a6, #facc15, #10b981, #a3e635, #34d399)",
];
const PLOMO = "linear-gradient(90deg, transparent calc(50% - 1px), rgba(255,255,255,.95) calc(50% - 1px), rgba(255,255,255,.95) calc(50% + 1px), transparent calc(50% + 1px)), repeating-linear-gradient(0deg, transparent 0 26px, rgba(255,255,255,.85) 26px 28px), linear-gradient(90deg, transparent calc(25% - 1px), rgba(255,255,255,.6) calc(25% - 1px), rgba(255,255,255,.6) calc(25% + 1px), transparent calc(25% + 1px), transparent calc(75% - 1px), rgba(255,255,255,.6) calc(75% - 1px), rgba(255,255,255,.6) calc(75% + 1px), transparent calc(75% + 1px))";

function SelloChoice({ className = "" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="Sello Cazurronics Choice" role="img">
      <defs>
        <path id="cz-sello-arco" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
        <linearGradient id="cz-sello-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#cz-sello-grad)" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeDasharray="1.5 3" />
      <text fill="#fff" fontSize="9" fontWeight="700" letterSpacing="1">
        <textPath href="#cz-sello-arco" textLength="216" lengthAdjust="spacing">CAZURRONICS · CHOICE · LEÓN ·</textPath>
      </text>
      <circle cx="50" cy="50" r="23" fill="#fff" />
      <text x="50" y="58.5" textAnchor="middle" fontSize="23">🦁</text>
    </svg>
  );
}

const SUGERENCIAS = [
  { emoji: "🍷", texto: "Tapeo por el Húmedo" },
  { emoji: "⛪", texto: "Ver monumentos" },
  { emoji: "🥘", texto: "Comer cocido maragato" },
  { emoji: "🎶", texto: "Salir de fiesta" },
  { emoji: "🌲", texto: "Plan de naturaleza" },
];

const VALORES = [
  { emoji: "✨", titulo: "Gratis", texto: "Sin registros ni letra pequeña." },
  { emoji: "🏪", titulo: "Comercio local", texto: "Bares y tiendas de aquí, de siempre." },
  { emoji: "📍", titulo: "Cercanía", texto: "Todo dentro de tu radio, sin pegarte palizas." },
];

const fechaISO = (offsetDias) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Home() {
  const [estaCargando, setEstaCargando] = useState(false);
  const [itinerario, setItinerario] = useState(null);
  const [paradaSeleccionada, setParadaSeleccionada] = useState(null);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(null);
  const [climaPrevision, setClimaPrevision] = useState(null);
  const [instruccionRetoque, setInstruccionRetoque] = useState("");
  const [retocando, setRetocando] = useState(false);

  const [fecha, setFecha] = useState("");
  const [apetece, setApetece] = useState("");
  const [presupuestoMin, setPresupuestoMin] = useState(10);
  const [presupuestoMax, setPresupuestoMax] = useState(50);
  const [distancia, setDistancia] = useState(15);
  const [centroMapa, setCentroMapa] = useState([42.5987, -5.5671]);

  // NUEVO: plan guardado (para compartir/votar), aviso de "enlace copiado" y valoración pendiente
  const [planId, setPlanId] = useState(null);
  const [masEseDia, setMasEseDia] = useState([]);
  const [aviso, setAviso] = useState("");
  const [pendienteValorar, setPendienteValorar] = useState(null);
  useEffect(() => {
    registrarVisita();
    // en el siguiente fotograma: localStorage solo existe en el navegador
    const t = requestAnimationFrame(() => setPendienteValorar(planPendienteDeValorar()));
    return () => cancelAnimationFrame(t);
  }, []);

  const compartir = async () => {
    if (!planId) return;
    const r = await compartirPlan(planId);
    if (r === "copiado") { setAviso("Enlace copiado. ¡Pásalo al grupo!"); setTimeout(() => setAviso(""), 2500); }
  };
  const abrirParada = (parada, index) => {
    setParadaSeleccionada(parada); setIndiceSeleccionado(index);
    baliza("detalle", { lugarId: parada.lugarId });
  };

  // Solo visual: avanza los pasos de la pantalla de carga (se queda en el último)
  const [pasoCarga, setPasoCarga] = useState(0);
  useEffect(() => {
    if (!estaCargando) return;
    const id = setInterval(() => setPasoCarga((p) => Math.min(p + 1, PASOS_CARGA.length - 1)), 2600);
    return () => { clearInterval(id); setPasoCarga(0); };
  }, [estaCargando]);

  // Solo visual: intro de bienvenida (rosetón + león) al abrir la web.
  // "entrando" → "saliendo" (fade out) → "fin" (se desmonta). Se salta con un toque.
  const [intro, setIntro] = useState("entrando");
  const salirIntro = () => setIntro((f) => (f === "entrando" ? "saliendo" : f));
  useEffect(() => {
    const t = setTimeout(() => setIntro((f) => (f === "entrando" ? "saliendo" : f)), 1700);
    return () => clearTimeout(t);
  }, []);

  const generarPlan = async (e) => {
    if (e) e.preventDefault();
    if (!fecha) { alert("¡Necesito una fecha!"); return; }
    setEstaCargando(true); setItinerario(null); setParadaSeleccionada(null); setClimaPrevision(null); setPlanId(null); setMasEseDia([]);

    // Aseguramos que si dejaron la caja vacía, se envíe un 0 (o un 1 en la distancia)
    const minSeguro = presupuestoMin === "" ? 0 : Number(presupuestoMin);
    const maxSeguro = presupuestoMax === "" ? 0 : Number(presupuestoMax);
    const radioSeguro = distancia === "" ? 1 : Number(distancia);

    try {
      const respuesta = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, apetece, presupuestoMin: minSeguro, presupuestoMax: maxSeguro, radio: radioSeguro, lat: centroMapa[0], lon: centroMapa[1] })
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        setItinerario(datos.plan); setClimaPrevision(datos.prevision || null);
        setPlanId(datos.planId || null); recordarPlan(datos.planId, fecha, datos.plan); setMasEseDia(datos.masEseDia || []);
      } else { alert("🚨 Error: " + datos.mensaje); }
    } catch (error) { alert("Error de conexión."); } finally { setEstaCargando(false); }
  };

  const retocarParada = async () => {
    if (!instruccionRetoque.trim() || indiceSeleccionado === null) return;
    setRetocando(true);

    const minSeguro = presupuestoMin === "" ? 0 : Number(presupuestoMin);
    const maxSeguro = presupuestoMax === "" ? 0 : Number(presupuestoMax);
    const radioSeguro = distancia === "" ? 1 : Number(distancia);

    try {
      const respuesta = await fetch('/api/retocar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerarioActual: itinerario, indice: indiceSeleccionado, instruccion: instruccionRetoque, fecha, presupuestoMin: minSeguro, presupuestoMax: maxSeguro, radio: radioSeguro, lat: centroMapa[0], lon: centroMapa[1], planId })
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        actualizarParadaRecordada(planId, indiceSeleccionado, datos.parada);
        const nuevoItinerario = [...itinerario];
        nuevoItinerario[indiceSeleccionado] = datos.parada;
        setItinerario(nuevoItinerario); setParadaSeleccionada(datos.parada); setInstruccionRetoque("");
      } else { alert("🚨 " + datos.mensaje); }
    } catch (error) { alert("Error al intentar cambiar sitio."); } finally { setRetocando(false); }
  };

  const cerrarModal = () => { setParadaSeleccionada(null); setIndiceSeleccionado(null); setInstruccionRetoque(""); };

  const anadirSugerencia = (texto) => {
    setApetece((prev) => {
      const limpio = prev.trim();
      if (!limpio) return texto;
      if (limpio.toLowerCase().includes(texto.toLowerCase())) return prev;
      return `${limpio}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
    });
  };

  const hoy = fechaISO(0);
  const manana = fechaISO(1);

  return (
    <main
      className={`min-h-[100dvh] flex flex-col items-center px-4 pt-6 pb-36 sm:px-6 sm:py-10 relative text-slate-800 antialiased selection:bg-rose-200/70 ${itinerario ? 'justify-start' : 'justify-center'} ${intro === "entrando" ? 'cz-wait' : ''}`}
      style={{ cursor: "url('/leon.png'), auto" }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .roseton-slider { -webkit-appearance: none; appearance: none; height: 10px; border-radius: 9999px; background: linear-gradient(90deg, rgba(251,113,133,.35), rgba(251,146,60,.35), rgba(56,189,248,.35)); box-shadow: inset 0 1px 2px rgba(15,23,42,.12), 0 1px 0 rgba(255,255,255,.9); outline: none; }
        .roseton-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 34px; height: 34px; background-image: url('/roseton.png'); background-size: 170%; background-repeat: no-repeat; background-position: center; cursor: grab; border: 2px solid rgba(255,255,255,.95); border-radius: 50%; filter: drop-shadow(0px 6px 12px rgba(15,23,42,0.25)); transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .roseton-slider::-webkit-slider-thumb:hover { transform: scale(1.12) rotate(20deg); }
        .roseton-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.18) rotate(45deg); }
        .roseton-slider::-moz-range-thumb { width: 34px; height: 34px; background-image: url('/roseton.png'); background-size: 170%; background-repeat: no-repeat; background-position: center; cursor: grab; border: 2px solid rgba(255,255,255,.95); border-radius: 50%; background-color: transparent; filter: drop-shadow(0px 6px 12px rgba(15,23,42,0.25)); transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .roseton-slider::-moz-range-thumb:hover { transform: scale(1.12) rotate(20deg); }

        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.5; transition: opacity .2s; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 0.9; }
        .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }

        @keyframes cz-up { from { opacity: 0; transform: translateY(18px) scale(.985); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes cz-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cz-sheet { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        @keyframes cz-shimmer { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(220%) skewX(-20deg); } }
        @keyframes cz-float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(-3deg); } }
        @keyframes cz-spin { to { transform: rotate(360deg); } }
        @keyframes cz-swap { 0% { opacity: 0; transform: translateY(6px); } 15%,85% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-6px); } }

        .cz-up { animation: cz-up .7s cubic-bezier(.2,.8,.2,1) both; }
        .cz-fade { animation: cz-fade .35s ease both; }
        .cz-sheet { animation: cz-sheet .5s cubic-bezier(.2,.8,.2,1) both; }
        .cz-float { animation: cz-float 4s ease-in-out infinite; }
        .cz-spin { animation: cz-spin 8s linear infinite; }
        .cz-swap { animation: cz-swap 2.2s ease both; }
        .cz-sheen::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-120%) skewX(-20deg); pointer-events: none; }
        .cz-sheen:hover::after { animation: cz-shimmer 1s ease; }

        /* Intro: el rosetón entra girando, el león salta dentro y aparece la marca */
        @keyframes cz-intro-roseton { 0% { opacity: 0; transform: scale(.4) rotate(-140deg); } 70% { opacity: 1; transform: scale(1.04) rotate(8deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes cz-intro-leon { 0% { opacity: 0; transform: scale(.2) translateY(20px); } 60% { opacity: 1; transform: scale(1.18) translateY(-4px); } 100% { opacity: 1; transform: none; } }
        @keyframes cz-intro-halo { 0% { opacity: 0; transform: scale(.6); } 40% { opacity: .9; } 100% { opacity: 0; transform: scale(1.9); } }
        @keyframes cz-intro-out { to { opacity: 0; transform: scale(1.06); filter: blur(10px); } }
        .cz-intro-roseton { animation: cz-intro-roseton 1.1s cubic-bezier(.2,.8,.2,1) both; }
        .cz-intro-leon { animation: cz-intro-leon .7s cubic-bezier(.3,1.4,.5,1) .45s both; }
        .cz-intro-halo { animation: cz-intro-halo 1.2s ease-out .55s both; }
        .cz-intro-out { animation: cz-intro-out .55s cubic-bezier(.4,0,.2,1) both; }
        .cz-intro-txt { animation: cz-up .7s cubic-bezier(.2,.8,.2,1) both; }
        /* Mientras dura la intro, las entradas de la página esperan congeladas en su primer fotograma */
        .cz-wait .cz-up { animation-play-state: paused; }

        /* La vidriera se colorea en abanico mientras se genera el plan */
        @property --cz-p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
        @keyframes cz-colorea { from { --cz-p: 0%; } to { --cz-p: 96%; } }
        @keyframes cz-fade-out { to { opacity: 0; } }
        .cz-colorea { -webkit-mask-image: conic-gradient(#000 var(--cz-p), transparent var(--cz-p)); mask-image: conic-gradient(#000 var(--cz-p), transparent var(--cz-p)); animation: cz-colorea 24s cubic-bezier(.2,.55,.35,1) forwards; }
        .cz-spin-lento { animation: cz-spin 18s linear infinite; }

        /* Si el sistema pide "reducir movimiento" (p. ej. Windows con los efectos de animación apagados)
           no apagamos nada del todo: lo decorativo pasa a fundidos suaves y la carga sigue girando,
           porque es lo que te dice que la web está trabajando. */
        @media (prefers-reduced-motion: reduce) {
          .cz-up, .cz-sheet, .cz-intro-txt, .cz-intro-roseton, .cz-intro-leon { animation: cz-fade .5s ease both !important; }
          .cz-float, .cz-swap, .cz-sheen:hover::after, .cz-intro-halo { animation: none !important; }
          .cz-intro-out { animation: cz-fade-out .4s ease both !important; }
          .cz-spin, .cz-spin-lento { animation-duration: 30s; }
        }
      `}} />

      {/* ── Atmósfera: tu ilustración de León desenfocada + auroras de vidriera ── */}
      <div aria-hidden className="fixed inset-0 -z-30 bg-[#fdf6ef]" />
      <div aria-hidden className="fixed inset-0 -z-20 bg-[url('/fondo.jpg')] bg-cover bg-center scale-110 blur-xl opacity-90 saturate-150" />
      <div aria-hidden className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[55vw] h-[55vw] max-w-[640px] max-h-[640px] rounded-full bg-rose-300/40 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-sky-300/35 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[45vw] h-[45vw] max-w-[520px] max-h-[520px] rounded-full bg-amber-200/45 blur-3xl" />
      </div>
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-white/35 via-white/10 to-white/45 pointer-events-none" />

      {/* ── Intro de bienvenida: solo al abrir la web (toca para saltar) ── */}
      {intro !== "fin" && (
        <div
          onClick={salirIntro}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget && intro === "saliendo") setIntro("fin"); }}
          className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#fdf6ef]/95 backdrop-blur-2xl ${intro === "saliendo" ? "cz-intro-out pointer-events-none" : ""}`}
        >
          <div className="relative w-36 h-36 sm:w-44 sm:h-44">
            <div aria-hidden className="cz-intro-halo absolute inset-0 rounded-full bg-gradient-to-br from-rose-300 via-amber-200 to-sky-300 blur-xl" />
            <div className="cz-intro-roseton absolute inset-0 rounded-full overflow-hidden ring-4 ring-white shadow-[0_20px_60px_-12px_rgba(244,63,94,0.55)]">
              <img src="/roseton.png" alt="" aria-hidden className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="cz-intro-leon text-6xl sm:text-7xl drop-shadow-[0_8px_14px_rgba(0,0,0,0.3)]">🦁</span>
            </div>
          </div>
          <p className="cz-intro-txt mt-7 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" style={{ animationDelay: "650ms" }}>
            Cazurronics <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">Planner</span>
          </p>
          <p className="cz-intro-txt mt-1.5 text-sm font-medium text-slate-500" style={{ animationDelay: "800ms" }}>Tu planazo en León</p>
        </div>
      )}

      {estaCargando ? (
        /* ───────────────────────── CARGANDO ─────────────────────────
           El rosetón gira y su vidriera se va coloreando como una barra de progreso,
           con el león dentro. Debajo, los pasos se van marcando uno a uno. */
        <div className="w-full max-w-md my-auto cz-up" role="status" aria-live="polite">
          <div className={`${GLASS} rounded-[2.25rem] px-6 pt-9 pb-6 sm:px-9 sm:pt-10 text-center relative overflow-hidden`}>
            <div className="relative mx-auto mb-7 w-40 h-40 sm:w-44 sm:h-44">
              <div aria-hidden className="absolute -inset-5 rounded-full bg-gradient-to-br from-rose-300/70 via-amber-200/70 to-sky-300/70 blur-2xl animate-pulse" />
              <div className="cz-spin-lento absolute inset-0 rounded-full overflow-hidden ring-[5px] ring-white shadow-[0_18px_50px_-12px_rgba(244,63,94,0.55)] bg-white">
                <img src="/roseton.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover grayscale opacity-35" />
                <img src="/roseton.png" alt="" aria-hidden className="cz-colorea absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full bg-white/85 backdrop-blur-sm ring-1 ring-white shadow-[0_8px_24px_-6px_rgba(15,23,42,0.35)] flex items-center justify-center">
                  <span className="cz-float text-4xl sm:text-5xl">🦁</span>
                </span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Creando tu plan maestro</h2>
            <p className="text-slate-500 text-sm mt-1.5">Tu vidriera se va coloreando…</p>

            <ol className="mt-7 space-y-1.5 text-left">
              {PASOS_CARGA.map((paso, i) => {
                const hecho = i < pasoCarga;
                const actual = i === pasoCarga;
                return (
                  <li
                    key={paso.texto}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-500 ${actual ? "bg-white/80 ring-1 ring-rose-100 shadow-[0_6px_18px_-8px_rgba(244,63,94,0.35)]" : ""} ${!hecho && !actual ? "opacity-45" : ""}`}
                  >
                    <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-base transition-all duration-500 ${hecho ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)]" : "bg-white/80 ring-1 ring-slate-900/5"}`}>
                      {hecho ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      ) : paso.emoji}
                    </span>
                    <span className={`flex-1 text-[14px] font-medium ${hecho ? "text-slate-500" : "text-slate-800"}`}>{paso.texto}</span>
                    {actual && <span className="w-4 h-4 shrink-0 rounded-full border-2 border-rose-200 border-t-rose-500 animate-spin" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : itinerario ? (
        /* ───────────────────────── RESULTADOS ───────────────────────── */
        <div className="relative z-10 w-full max-w-6xl flex flex-col gap-5 sm:gap-6">

          {/* Barra superior flotante */}
          <div className={`${GLASS} sticky top-3 z-50 rounded-full pl-5 pr-2 py-2 flex items-center justify-between gap-3 cz-up`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl shrink-0">🦁</span>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-none bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">Tu Planazo</h2>
                <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 truncate">{itinerario.length} paradas · {fecha}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
            {planId && (
              <button onClick={compartir} aria-label="Compartir plan" className={`${PRESS} shrink-0 flex items-center gap-1.5 bg-white/80 text-slate-800 ring-1 ring-slate-900/10 text-sm font-semibold px-3.5 h-11 rounded-full hover:bg-white`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
                <span className="hidden sm:inline">Compartir</span>
              </button>
            )}
            <button
              onClick={() => { setItinerario(null); setClimaPrevision(null); }}
              className={`${PRESS} shrink-0 flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold pl-3.5 pr-4 h-11 rounded-full shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:shadow-[0_12px_28px_-6px_rgba(15,23,42,0.55)]`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              Volver
            </button>
            </div>
          </div>

          {aviso && <div className="cz-fade fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg">{aviso}</div>}

          {/* Bento superior: mapa + tiempo/consejo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className={`${GLASS} lg:col-span-8 rounded-[2rem] p-2.5 cz-up`} style={{ animationDelay: "80ms" }}>
              <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} itinerario={itinerario} />
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5">
              {climaPrevision && (
                <div className={`${GLASS} rounded-[2rem] p-5 flex items-start gap-4 cz-up`} style={{ animationDelay: "140ms" }}>
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-2xl shadow-[0_8px_20px_-6px_rgba(14,165,233,0.6)]">🌤️</div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-600 mb-1">Previsión</p>
                    <p className="text-[15px] font-medium text-slate-700 leading-snug">{climaPrevision}</p>
                    <p className="text-xs text-slate-500 mt-1.5">Plan adaptado al tiempo</p>
                  </div>
                </div>
              )}

              {planId && (
                <button onClick={compartir} className={`${GLASS} group text-left rounded-[2rem] p-5 relative overflow-hidden cz-up transition-all duration-500 hover:-translate-y-1 hover:bg-white/70`} style={{ animationDelay: "170ms" }}>
                  <div aria-hidden className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-gradient-to-br from-emerald-200/60 to-sky-200/40 blur-2xl" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex -space-x-2 shrink-0" aria-hidden>
                      {["🦁", "🐻", "🦊"].map((e, i) => <span key={e} className="w-10 h-10 rounded-full bg-white ring-2 ring-white shadow-sm flex items-center justify-center text-lg" style={{ zIndex: 3 - i }}>{e}</span>)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-slate-900">Decidid en grupo</p>
                      <p className="text-sm text-slate-600 leading-snug">Manda el enlace y votad cada parada. <span className="font-semibold text-rose-500 group-hover:underline">Compartir →</span></p>
                    </div>
                  </div>
                </button>
              )}

              <div className={`${GLASS} rounded-[2rem] p-5 flex-1 relative overflow-hidden cz-up`} style={{ animationDelay: "200ms" }}>
                <div aria-hidden className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-300/40 to-fuchsia-300/30 blur-2xl" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-2xl shadow-[0_8px_20px_-6px_rgba(99,102,241,0.6)] mb-4">💡</div>
                  <p className="text-[15px] font-semibold text-slate-900 mb-1.5">¡Sácale todo el jugo al plan!</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Toca cualquier tarjeta para ver <b className="font-semibold text-slate-800">horarios y precios</b>, asomarte con la <b className="font-semibold text-slate-800">cámara 360º</b> o <b className="font-semibold text-slate-800">pedirme que cambie el sitio</b> si no te convence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Paradas */}
          <div className="flex items-end justify-between px-1 pt-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">La ruta</h3>
            <span className="text-xs font-medium text-slate-500">Toca para ver detalles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {itinerario.map((parada, index) => (
              <div
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => abrirParada(parada, index)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirParada(parada, index); } }}
                className={`${GLASS} cz-up group rounded-[2rem] p-2 flex flex-col cursor-pointer outline-none transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1.5 hover:bg-white/70 hover:shadow-[0_30px_60px_-18px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] focus-visible:ring-4 focus-visible:ring-rose-300/60 active:scale-[0.985]`}
                style={{ animationDelay: `${260 + index * 70}ms` }}
              >
                <div className="h-48 sm:h-52 w-full rounded-[1.6rem] bg-slate-100 relative overflow-hidden">
                  <img src={parada.fotoOficial} alt={parada.titulo} className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.06]" />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center ring-[3px] ring-white shadow-[0_6px_16px_-4px_rgba(244,63,94,0.6)]">
                    {index + 1}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/85 backdrop-blur-md text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-[0_4px_12px_-2px_rgba(0,0,0,0.2)] flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {parada.hora}
                  </div>
                </div>

                <div className="px-3.5 pt-4 pb-3 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold tracking-tight text-slate-900 leading-snug mb-1.5">{parada.titulo}</h3>
                  <p className="text-slate-600 text-sm mb-4 line-clamp-3 leading-relaxed">{parada.descripcion}</p>
                  <div className="flex justify-between items-center mt-auto pt-3 border-t border-slate-900/5">
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-2.5 py-1.5 rounded-full">⭐ {parada.resenas}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-rose-500 transition-all duration-300 group-hover:gap-2">
                      Ver detalles
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* NUEVO: todo lo demás que ha encontrado el barrido para ese día */}
          {masEseDia.length > 0 && (
            <section className="pt-2" aria-labelledby="cz-mas-titulo">
              <div className="flex items-end justify-between px-1 mb-3">
                <h3 id="cz-mas-titulo" className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Más cosas ese día</h3>
                <span className="hidden sm:inline text-xs font-medium text-slate-500">Eventos, mercadillos y ferias encontrados</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {masEseDia.map((e, i) => <TarjetaEvento key={`${i}-${e.titulo}`} e={e} />)}
              </div>
            </section>
          )}

          {/* ── Hoja de detalle (bottom sheet en móvil, modal en escritorio) ── */}
          {paradaSeleccionada && (
            <div className="cz-fade fixed inset-0 bg-slate-900/35 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={cerrarModal}>
              <div
                className="cz-sheet bg-white/90 backdrop-blur-2xl backdrop-saturate-150 border border-white/80 shadow-[0_-10px_60px_-10px_rgba(15,23,42,0.35)] sm:shadow-[0_40px_80px_-20px_rgba(15,23,42,0.45)] w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[2rem] sm:rounded-[2rem] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7"
                onClick={e => e.stopPropagation()}
              >
                <div aria-hidden className="sm:hidden mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />

                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-100 to-orange-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                      {indiceSeleccionado !== null && <span className="font-bold">Parada {indiceSeleccionado + 1} ·</span>} {paradaSeleccionada.hora}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">{paradaSeleccionada.titulo}</h2>
                  </div>
                  <button onClick={cerrarModal} aria-label="Cerrar" className={`${PRESS} shrink-0 w-11 h-11 rounded-full bg-slate-900/5 text-slate-500 flex items-center justify-center hover:bg-slate-900/10 hover:text-slate-900 hover:rotate-90`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {paradaSeleccionada.streetView && (
                  <div className="mb-5 relative rounded-[1.5rem] overflow-hidden ring-1 ring-slate-900/5 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.3)]">
                    <div className="absolute top-3 left-3 bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-700 z-10 pointer-events-none shadow-sm">
                      {paradaSeleccionada.streetView.includes("embed") ? "📍 Vista 360º · Arrastra" : "📍 Vista exterior"}
                    </div>
                    {paradaSeleccionada.streetView.includes("embed") ? (
                      <iframe src={paradaSeleccionada.streetView} allowFullScreen loading="lazy" className="w-full h-52 sm:h-60 block"></iframe>
                    ) : (
                      <img src={paradaSeleccionada.streetView} alt="Street View" className="w-full h-52 sm:h-60 object-cover block" />
                    )}
                  </div>
                )}

                <p className="text-slate-600 text-[15px] leading-relaxed mb-5">{paradaSeleccionada.descripcion}</p>
                {paradaSeleccionada.fuente && /^https?:\/\//.test(paradaSeleccionada.fuente) && (
                  <a href={paradaSeleccionada.fuente} target="_blank" rel="noopener noreferrer" className="-mt-2 mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500 hover:underline">🎟️ Ver la fuente del evento</a>
                )}

                <div className="grid grid-cols-1 gap-2 mb-5">
                  {[
                    { icono: "💶", color: "from-emerald-300 to-emerald-500", etiqueta: "Precio", valor: paradaSeleccionada.precio },
                    { icono: "🕒", color: "from-sky-300 to-sky-500", etiqueta: "Horario", valor: paradaSeleccionada.horario },
                    { icono: "🚶", color: "from-violet-300 to-violet-500", etiqueta: "Cómo llegar", valor: paradaSeleccionada.transporte },
                  ].map((dato) => (
                    <div key={dato.etiqueta} className="flex items-center gap-3 bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3">
                      <span className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${dato.color} flex items-center justify-center text-lg shadow-sm`}>{dato.icono}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{dato.etiqueta}</p>
                        <p className="text-[15px] font-medium text-slate-800 leading-snug">{dato.valor}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {paradaSeleccionada.telefono !== "No disponible" ? (
                    <a href={`tel:${paradaSeleccionada.telefono}`} onClick={() => baliza("llamar", { lugarId: paradaSeleccionada.lugarId })} className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold rounded-2xl shadow-[0_10px_24px_-8px_rgba(15,23,42,0.55)] hover:bg-slate-800 hover:-translate-y-0.5`}>📞 Llamar</a>
                  ) : (
                    <span className="h-12 flex items-center justify-center gap-2 bg-slate-900/5 text-slate-400 font-semibold rounded-2xl cursor-not-allowed">📞 Sin teléfono</span>
                  )}
                  {paradaSeleccionada.web !== "No disponible" ? (
                    <a href={paradaSeleccionada.web} target="_blank" rel="noopener noreferrer" onClick={() => baliza("web", { lugarId: paradaSeleccionada.lugarId })} className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-white text-rose-500 font-semibold rounded-2xl ring-1 ring-rose-200 hover:bg-rose-50 hover:-translate-y-0.5`}>🌐 Web</a>
                  ) : (
                    <span className="h-12 flex items-center justify-center gap-2 bg-slate-900/5 text-slate-400 font-semibold rounded-2xl cursor-not-allowed">🌐 Sin web</span>
                  )}
                </div>

                <div className="relative overflow-hidden rounded-[1.5rem] p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-violet-50 to-sky-50 ring-1 ring-indigo-100">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-500 mb-3">
                    <span className="text-base">🔄</span> ¿No te convence? Te lo cambio
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={instruccionRetoque} onChange={(e) => setInstruccionRetoque(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); retocarParada(); } }} placeholder="Ej: algo más barato, vegetariano…" disabled={retocando} className="flex-1 min-w-0 bg-white border border-white text-slate-800 placeholder:text-slate-400 text-[15px] font-medium rounded-2xl px-4 h-12 outline-none ring-1 ring-indigo-100 disabled:opacity-50 focus:ring-2 focus:ring-indigo-300 focus:shadow-[0_0_0_6px_rgba(99,102,241,0.12)] transition-all duration-300" />
                    <button onClick={retocarParada} disabled={retocando || !instruccionRetoque.trim()} className={`${PRESS} cz-sheen relative overflow-hidden shrink-0 h-12 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow-[0_10px_24px_-8px_rgba(99,102,241,0.7)] hover:shadow-[0_14px_30px_-8px_rgba(99,102,241,0.8)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-2`}>
                      {retocando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                      {retocando ? "Pensando..." : "Cambiar"}
                    </button>
                  </div>

                  {/* Espera del retoque: mini rosetón girando con el león dentro */}
                  {retocando && (
                    <div className="cz-fade absolute inset-0 z-10 flex items-center justify-center gap-4 bg-white/75 backdrop-blur-md" role="status" aria-live="polite">
                      <div className="relative w-14 h-14 shrink-0">
                        <img src="/roseton.png" alt="" aria-hidden className="cz-spin absolute inset-0 w-full h-full object-cover rounded-full ring-2 ring-white shadow-[0_8px_20px_-6px_rgba(99,102,241,0.5)]" />
                        <span className="cz-float absolute inset-0 flex items-center justify-center text-2xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]">🦁</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">Buscando otro sitio…</p>
                        <p className="text-xs text-slate-500 mt-0.5">«{instruccionRetoque}»</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ───────────────────────── INICIO (Bento) ───────────────────────── */
        <div className="relative z-10 w-full max-w-6xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

          {/* NUEVO: "¿Fuiste? ¿Qué tal?" si tiene un plan pasado sin valorar */}
          {pendienteValorar && (
            <div className="order-first lg:col-span-12">
              <Valorar plan={pendienteValorar} onCerrar={() => setPendienteValorar(null)} />
            </div>
          )}

          {/* Hero */}
          <section className={`${GLASS} group order-1 lg:col-span-5 rounded-[2.25rem] p-6 sm:p-8 relative overflow-hidden cz-up`}>
            <img src="/roseton.png" alt="" aria-hidden className="pointer-events-none transition-[rotate] duration-[2500ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-90 absolute -right-20 -top-20 w-64 h-64 object-cover rounded-full opacity-[0.18]" />
            <div className="relative">
              <span className={`${GLASS_SOFT} inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 text-xs font-semibold text-slate-700 mb-6`}>
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 flex items-center justify-center text-[13px] shadow-sm">🦁</span>
                Cazurronics Planner
              </span>
              <h1 className="text-[2.6rem] leading-[1.02] sm:text-5xl lg:text-[3.4rem] font-bold tracking-[-0.035em] text-slate-900">
                Tu planazo<br />en León,{" "}
                <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">sin pensar.</span>
              </h1>
              <p className="mt-4 text-[15px] sm:text-base text-slate-600 leading-relaxed max-w-sm">
                Dinos qué te apetece y montamos la ruta perfecta: tapas, monumentos, eventos y fiesta. Con el tiempo y los horarios ya mirados.
              </p>
            </div>
          </section>

          {/* Formulario */}
          <form onSubmit={generarPlan} className="order-2 lg:col-span-7 lg:row-span-4">
            <div className={`${GLASS} rounded-[2.25rem] p-5 sm:p-7 cz-up`} style={{ animationDelay: "90ms" }}>
              <div className="flex items-center justify-between mb-6 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">El plan perfecto</p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">Cuéntame tu día</h2>
                </div>
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white/60 ring-1 ring-slate-900/5 rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> IA lista
                </span>
              </div>

              <div className="space-y-5">
                {/* Fecha */}
                <div>
                  <label htmlFor="cz-fecha" className={LABEL}><span>📅</span> ¿Qué día es el plan?</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input id="cz-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${INPUT} cursor-pointer sm:flex-1`} />
                    <div className="grid grid-cols-2 gap-2 sm:w-auto">
                      {[{ v: hoy, t: "Hoy" }, { v: manana, t: "Mañana" }].map((op) => (
                        <button
                          key={op.t}
                          type="button"
                          onClick={() => setFecha(op.v)}
                          className={`${PRESS} h-12 sm:h-auto sm:px-5 rounded-2xl text-sm font-semibold ring-1 ${fecha === op.v ? "bg-slate-900 text-white ring-slate-900 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)]" : "bg-white/60 text-slate-700 ring-slate-900/5 hover:bg-white"}`}
                        >
                          {op.t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Apetece */}
                <div>
                  <label htmlFor="cz-apetece" className={LABEL}><span>🌮</span> ¿Qué te apetece?</label>
                  <textarea id="cz-apetece" rows="2" value={apetece} onChange={(e) => setApetece(e.target.value)} className={`${INPUT} resize-none leading-relaxed`} placeholder="Ej: Cocido, ver monumentos y luego unas cañas…"></textarea>
                  <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 snap-x">
                    {SUGERENCIAS.map((s) => (
                      <button
                        key={s.texto}
                        type="button"
                        onClick={() => anadirSugerencia(s.texto)}
                        className={`${PRESS} snap-start shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/60 ring-1 ring-slate-900/5 text-[13px] font-medium text-slate-700 hover:bg-white hover:ring-rose-200 hover:text-rose-600 hover:-translate-y-0.5`}
                      >
                        <span>{s.emoji}</span>{s.texto}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Presupuesto */}
                <div className="rounded-[1.75rem] p-4 sm:p-5 bg-gradient-to-br from-white/60 to-rose-50/50 ring-1 ring-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 whitespace-nowrap"><span>💶</span> Presupuesto <span className="hidden sm:inline font-normal text-slate-400">· por persona</span></label>
                    <span className="text-xs font-semibold text-rose-500 bg-white/80 ring-1 ring-rose-100 rounded-full px-2.5 py-1 tabular-nums">
                      {presupuestoMin === '' ? 0 : presupuestoMin}€ – {presupuestoMax === '' ? 0 : (presupuestoMax >= 300 ? "+300" : presupuestoMax)}€
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex items-center shrink-0 rounded-xl overflow-hidden ring-1 ring-slate-900/5 bg-white shadow-sm">
                      <span className="absolute left-3 text-[11px] font-semibold text-slate-400 pointer-events-none">Mín</span>
                      <input type="number" min="0" max="300" value={presupuestoMin} onChange={(e) => setPresupuestoMin(e.target.value === '' ? '' : Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} className="w-24 h-10 pl-10 pr-6 bg-transparent border-0 text-sm font-semibold text-slate-800 text-center outline-none focus:bg-rose-50/60 transition-colors tabular-nums" />
                      <span className="absolute right-3 text-[11px] font-semibold text-slate-400 pointer-events-none">€</span>
                    </div>
                    <input type="range" min="0" max="300" step="5" value={presupuestoMin === '' ? 0 : presupuestoMin} onChange={(e) => setPresupuestoMin(Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} aria-label="Presupuesto mínimo" className="w-full cursor-pointer roseton-slider" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center shrink-0 rounded-xl overflow-hidden ring-1 ring-slate-900/5 bg-white shadow-sm">
                      <span className="absolute left-3 text-[11px] font-semibold text-slate-400 pointer-events-none">Máx</span>
                      <input type="text" value={presupuestoMax === '' ? '' : (presupuestoMax >= 300 ? "+300" : presupuestoMax)} onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (val === '') { setPresupuestoMax(''); return; } val = Number(val); if (val > 300) val = 300; setPresupuestoMax(Math.max(val, presupuestoMin === '' ? 0 : presupuestoMin)); }} className="w-24 h-10 pl-10 pr-6 bg-transparent border-0 text-sm font-semibold text-slate-800 text-center outline-none focus:bg-rose-50/60 transition-colors tabular-nums" />
                      <span className="absolute right-3 text-[11px] font-semibold text-slate-400 pointer-events-none">€</span>
                    </div>
                    <input type="range" min="0" max="300" step="5" value={presupuestoMax === '' ? 0 : presupuestoMax} onChange={(e) => setPresupuestoMax(Math.max(Number(e.target.value), presupuestoMin === '' ? 0 : presupuestoMin))} aria-label="Presupuesto máximo" className="w-full cursor-pointer roseton-slider" />
                  </div>
                </div>

                {/* Zona */}
                <div className="rounded-[1.75rem] p-2.5 sm:p-4 [&_input[type=text]]:min-w-0 [&_button]:whitespace-nowrap [&_button]:shrink-0 bg-gradient-to-br from-white/60 to-sky-50/50 ring-1 ring-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <label className={`${LABEL} mt-1 mb-3`}><span>📍</span> Zona de búsqueda <span className="font-normal text-slate-400">· toca el mapa</span></label>
                  <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} />
                </div>
              </div>
            </div>

            {/* CTA: flotante en móvil (zona del pulgar), integrado en escritorio.
                Va fuera del contenedor de cristal: backdrop-filter rompería el "fixed". */}
            <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#fdf6ef] via-[#fdf6ef]/85 to-transparent sm:static sm:z-auto sm:p-0 sm:pt-4 sm:bg-none">
              <button
                type="submit"
                className={`${PRESS} cz-sheen group relative overflow-hidden w-full h-14 sm:h-16 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white text-lg font-bold tracking-tight shadow-[0_14px_36px_-10px_rgba(244,63,94,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] hover:shadow-[0_20px_44px_-10px_rgba(244,63,94,0.75),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105 flex items-center justify-center gap-2.5`}
              >
                <span className="text-xl transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">✨</span>
                ¡Descubrir el plan!
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </button>
            </div>
          </form>

          {/* Valores: carrusel con snap en móvil, celdas bento en escritorio */}
          <section className="order-3 lg:col-span-5 cz-up" style={{ animationDelay: "160ms" }} aria-label="Nuestros valores">
            <div className="flex lg:grid lg:grid-cols-3 gap-3 overflow-x-auto lg:overflow-visible no-scrollbar snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0 pb-3">
              {VALORES.map((v) => (
                <div key={v.titulo} className={`${GLASS} snap-start shrink-0 w-[70%] sm:w-[45%] lg:w-auto rounded-[1.75rem] p-4 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:bg-white/70`}>
                  <div className="w-10 h-10 rounded-xl bg-white/80 ring-1 ring-slate-900/5 flex items-center justify-center text-xl shadow-sm mb-3">{v.emoji}</div>
                  <p className="text-sm font-bold text-slate-900">{v.titulo}</p>
                  <p className="text-xs text-slate-500 leading-snug mt-1">{v.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Cazurronics Choices: tres vidrieras góticas que se "encienden" con cada local destacado */}
          <section className={`${GLASS} group/choices order-4 lg:col-span-5 rounded-[2.25rem] p-5 sm:p-6 relative overflow-hidden cz-up`} style={{ animationDelay: "220ms" }} aria-labelledby="cz-choices-titulo">
            <div aria-hidden className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br from-amber-200/50 via-rose-200/40 to-transparent blur-2xl" />
            <div className="relative flex items-center gap-4">
              <SelloChoice className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] shrink-0 drop-shadow-[0_8px_16px_rgba(244,63,94,0.35)] transition-transform duration-[1200ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover/choices:rotate-[30deg]" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Selección de la casa</p>
                <h2 id="cz-choices-titulo" className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">Cazurronics Choices</h2>
                <p className="text-[13px] text-slate-500 leading-snug mt-0.5">Los sitios de León que nos han enamorado.</p>
              </div>
            </div>

            <div className="relative grid grid-cols-3 gap-2.5 sm:gap-3 mt-5">
              {(CAZURRONICS_CHOICES.length ? CAZURRONICS_CHOICES.slice(0, 3) : [null, null, null]).map((local, i) => {
                const Tag = local?.url ? "a" : "div";
                return (
                  <Tag
                    key={local?.nombre ?? i}
                    {...(local?.url ? { href: local.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group/arco relative block aspect-[3/4.2] rounded-t-[999px] rounded-b-[1.25rem] overflow-hidden bg-white/50 ring-1 ring-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:shadow-[0_22px_40px_-14px_rgba(244,63,94,0.45)]"
                  >
                    {local?.foto && <img src={local.foto} alt={local.nombre} className="absolute inset-0 w-full h-full object-cover" />}
                    {/* El cristal: apagado si el hueco está libre, translúcido sobre la foto si hay local */}
                    <div
                      aria-hidden
                      className={`absolute inset-0 transition-all duration-700 ${local ? "opacity-30 mix-blend-color" : "opacity-40 saturate-[.6] group-hover/arco:opacity-90 group-hover/arco:saturate-150"}`}
                      style={{ background: VIDRIERAS[i % VIDRIERAS.length] }}
                    />
                    {/* Las tiras de plomo de la vidriera */}
                    <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: PLOMO }} />
                    <div aria-hidden className="absolute inset-[5px] rounded-t-[999px] rounded-b-[1rem] ring-1 ring-white/80" />

                    {local ? (
                      <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent text-center">
                        <p className="text-[12px] sm:text-[13px] font-bold text-white leading-tight line-clamp-2">{local.nombre}</p>
                        {local.categoria && <p className="text-[10px] font-medium text-white/75 mt-0.5 truncate">{local.categoria}{local.zona ? ` · ${local.zona}` : ""}</p>}
                      </div>
                    ) : (
                      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500/90 tabular-nums">Nº {i + 1}</span>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 bg-white/85 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm whitespace-nowrap">Próximamente</span>
                      </div>
                    )}
                  </Tag>
                );
              })}
            </div>

            <p className="relative text-center text-xs text-slate-500 mt-4">
              {CAZURRONICS_CHOICES.length ? "Elegidos a mano por el equipo cazurro" : "Estamos eligiendo a mano los primeros. Muy pronto, aquí."}
            </p>
          </section>

          {/* Negocios */}
          <section className={`${GLASS_SOFT} order-5 lg:col-span-5 rounded-[1.75rem] p-4 pl-5 flex items-center justify-between gap-3 cz-up`} style={{ animationDelay: "280ms" }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug">¿Tienes un negocio en León?</p>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">Consigue el sello y aparece en los planes.</p>
            </div>
            <BusinessModal />
          </section>

          {/* NUEVO: enlaces a las páginas de contenido (ayudan a que Google encuentre la web) */}
          <nav aria-label="Más de León" className="order-6 lg:col-span-12 flex flex-wrap items-center justify-center gap-2 pt-1 cz-up" style={{ animationDelay: "320ms" }}>
            {[["/agenda-leon", "📅 Agenda de León"], ["/que-hacer-en-leon", "✨ Qué hacer en León"], ["/donde-comer-en-leon", "🍷 Dónde comer en León"]].map(([href, texto]) => (
              <Link key={href} href={href} className={`${PRESS} h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600`}>{texto}</Link>
            ))}
          </nav>
        </div>
      )}
    </main>
  );
}
