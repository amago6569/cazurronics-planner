"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import BusinessModal from './components/BusinessModal';

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

const FRASES_CARGA = [
  "Mirando la previsión del tiempo…",
  "Buscando el mejor tapeo del Húmedo…",
  "Preguntando a los del Barrio Romántico…",
  "Comprobando horarios y fotos reales…",
  "Trazando la ruta más cazurra posible…",
];

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

  // Solo visual: rota los mensajes de la pantalla de carga
  const [fraseCarga, setFraseCarga] = useState(0);
  useEffect(() => {
    if (!estaCargando) return;
    const id = setInterval(() => setFraseCarga((f) => (f + 1) % FRASES_CARGA.length), 2200);
    return () => clearInterval(id);
  }, [estaCargando]);

  // Solo visual: intro de bienvenida (rosetón + león) al abrir la web.
  // "entrando" → "saliendo" (fade out) → "fin" (se desmonta). Se salta con un toque.
  const [intro, setIntro] = useState("entrando");
  const salirIntro = () => {
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIntro((f) => (f === "entrando" ? (reducir ? "fin" : "saliendo") : f));
  };
  useEffect(() => {
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setIntro((f) => (f === "entrando" ? (reducir ? "fin" : "saliendo") : f)), reducir ? 0 : 1700);
    return () => clearTimeout(t);
  }, []);

  const generarPlan = async (e) => {
    if (e) e.preventDefault();
    if (!fecha) { alert("¡Necesito una fecha!"); return; }
    setEstaCargando(true); setItinerario(null); setParadaSeleccionada(null); setClimaPrevision(null);

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
        body: JSON.stringify({ itinerarioActual: itinerario, indice: indiceSeleccionado, instruccion: instruccionRetoque, fecha, presupuestoMin: minSeguro, presupuestoMax: maxSeguro, radio: radioSeguro, lat: centroMapa[0], lon: centroMapa[1] })
      });
      const datos = await respuesta.json();
      if (datos.exito) {
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
        @keyframes cz-skeleton { from { background-position: 200% 0; } to { background-position: -200% 0; } }

        .cz-up { animation: cz-up .7s cubic-bezier(.2,.8,.2,1) both; }
        .cz-fade { animation: cz-fade .35s ease both; }
        .cz-sheet { animation: cz-sheet .5s cubic-bezier(.2,.8,.2,1) both; }
        .cz-float { animation: cz-float 4s ease-in-out infinite; }
        .cz-spin { animation: cz-spin 8s linear infinite; }
        .cz-swap { animation: cz-swap 2.2s ease both; }
        .cz-sheen::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-120%) skewX(-20deg); pointer-events: none; }
        .cz-sheen:hover::after { animation: cz-shimmer 1s ease; }
        .cz-skeleton { background: linear-gradient(90deg, rgba(15,23,42,.06) 25%, rgba(15,23,42,.13) 50%, rgba(15,23,42,.06) 75%); background-size: 200% 100%; animation: cz-skeleton 1.6s linear infinite; }

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

        @media (prefers-reduced-motion: reduce) {
          .cz-up, .cz-fade, .cz-sheet, .cz-float, .cz-spin, .cz-swap, .cz-skeleton, .cz-sheen:hover::after,
          .cz-intro-roseton, .cz-intro-leon, .cz-intro-halo, .cz-intro-out, .cz-intro-txt { animation: none !important; }
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
        /* ───────────────────────── CARGANDO ───────────────────────── */
        <div className="w-full max-w-md my-auto cz-up">
          <div className={`${GLASS} rounded-[2.25rem] p-8 sm:p-10 text-center relative overflow-hidden`}>
            <div className="relative mx-auto mb-7 w-28 h-28">
              <div aria-hidden className="absolute -inset-3 rounded-full bg-gradient-to-br from-rose-300/60 via-amber-200/60 to-sky-300/60 blur-xl animate-pulse" />
              <img src="/roseton.png" alt="" aria-hidden className="cz-spin absolute inset-0 w-full h-full object-cover rounded-full opacity-90" />
              <div className="absolute inset-0 rounded-full ring-4 ring-white/80 shadow-[0_12px_40px_-8px_rgba(251,113,133,0.55)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="cz-float text-5xl drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]">🦁</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">Creando tu plan maestro</h2>
            <p key={fraseCarga} className="cz-swap text-slate-500 font-medium text-[15px] h-6">{FRASES_CARGA[fraseCarga]}</p>

            <div className="mt-8 space-y-3 text-left" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 bg-white/40 rounded-2xl p-3 border border-white/60">
                  <div className="cz-skeleton w-12 h-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="cz-skeleton h-3 rounded-full" style={{ width: `${80 - i * 15}%` }} />
                    <div className="cz-skeleton h-2.5 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
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
            <button
              onClick={() => { setItinerario(null); setClimaPrevision(null); }}
              className={`${PRESS} shrink-0 flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold pl-3.5 pr-4 h-11 rounded-full shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:shadow-[0_12px_28px_-6px_rgba(15,23,42,0.55)]`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              Volver
            </button>
          </div>

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
                onClick={() => { setParadaSeleccionada(parada); setIndiceSeleccionado(index); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setParadaSeleccionada(parada); setIndiceSeleccionado(index); } }}
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
                    <a href={`tel:${paradaSeleccionada.telefono}`} className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold rounded-2xl shadow-[0_10px_24px_-8px_rgba(15,23,42,0.55)] hover:bg-slate-800 hover:-translate-y-0.5`}>📞 Llamar</a>
                  ) : (
                    <span className="h-12 flex items-center justify-center gap-2 bg-slate-900/5 text-slate-400 font-semibold rounded-2xl cursor-not-allowed">📞 Sin teléfono</span>
                  )}
                  {paradaSeleccionada.web !== "No disponible" ? (
                    <a href={paradaSeleccionada.web} target="_blank" rel="noopener noreferrer" className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-white text-rose-500 font-semibold rounded-2xl ring-1 ring-rose-200 hover:bg-rose-50 hover:-translate-y-0.5`}>🌐 Web</a>
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
          <form onSubmit={generarPlan} className="order-2 lg:col-span-7 lg:row-span-3">
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

          {/* Negocios */}
          <section className={`${GLASS_SOFT} order-4 lg:col-span-5 rounded-[1.75rem] px-5 py-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-between gap-1 cz-up`} style={{ animationDelay: "220ms" }}>
            <p className="text-sm text-slate-600 text-center sm:text-left lg:text-center xl:text-left">
              <span className="font-semibold text-slate-800">Hecho en León</span>, para la gente de León.
            </p>
            <BusinessModal />
          </section>
        </div>
      )}
    </main>
  );
}
