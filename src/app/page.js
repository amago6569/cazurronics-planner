"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import BusinessModal from './components/BusinessModal';
import SelectorSeccion from './components/SelectorSeccion';
import Valorar from './components/Valorar';
import AgendaFranjas from './components/AgendaFranjas';
import { webSegura, telSeguro, baliza, compartirPlan, recordarPlan, actualizarParadaRecordada, planPendienteDeValorar, registrarVisita } from '../lib/cliente';
import { PEGATINA, PEGATINA_PEQ, PULSA, BOTON_GRANATE, BOTON_CREMA, DISPLAY } from '../lib/estilos';

const MapSelectorDynamic = dynamic(() => import('./components/MapSelector'), { ssr: false, loading: () => <div className="h-[300px] rounded-2xl bg-[#F3E3CC] animate-pulse" /> });

/* ─────────────────────────────────────────────────────────────
   Sistema visual "Pegatina": León de cine arriba (foto real a pantalla
   completa con LEÓN gigante) y debajo la app en granate, con bordes negros
   gruesos y sombra dura. Solo clases de Tailwind; ninguna lógica aquí.
   ───────────────────────────────────────────────────────────── */
const INPUT = "w-full bg-white border-2 border-[#1A1210] text-[#1A1210] placeholder:text-[#7D6F62] text-base font-medium rounded-xl px-4 py-3.5 outline-none transition-shadow duration-150 focus:shadow-[3px_3px_0_0_#7A1F2B]";
const LABEL = "flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#1A1210] mb-2";
// Colores planos para chips y tarjetas (vidrio de la Catedral, sin degradados)
const COLORES = ["bg-[#F2B33D]", "bg-[#8FC7A8]", "bg-[#F4A3A8]", "bg-[#9DB8F2]", "bg-[#F6D8A8]"];
const GIROS = ["-rotate-[1.5deg]", "rotate-[1deg]", "-rotate-[0.5deg]", "rotate-[1.5deg]", "-rotate-[1deg]"];

// Pasos que se van completando mientras /api/plan trabaja (solo visual)
const PASOS_CARGA = [
  { emoji: "🌤️", texto: "Mirando la previsión del tiempo" },
  { emoji: "🗺️", texto: "Buscando sitios dentro de tu zona" },
  { emoji: "💶", texto: "Ajustándolo a tu presupuesto" },
  { emoji: "📸", texto: "Comprobando horarios y fotos reales" },
  { emoji: "🦁", texto: "Trazando la ruta más cazurra" },
];

/* ─────────────────────────────────────────────────────────────
   CAZURRONICS CHOICES — los locales destacados (promoción).
   Puedes meter todos los que quieras: si hay más de 3, se deslizan de lado.
   Siempre queda un hueco libre "Tu local aquí" que abre el formulario.
   { nombre: "Bar Ejemplo", categoria: "Tapeo", zona: "Barrio Húmedo",
     foto: "/choices/bar-ejemplo.jpg", url: "https://..." }   ← url es opcional
   Para quitar uno, bórralo de la lista.
   ───────────────────────────────────────────────────────────── */
const CAZURRONICS_CHOICES = [];
const abrirNegocios = () => window.dispatchEvent(new Event("cz-abrir-negocios"));

function SelloChoice({ className = "" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="Sello Cazurronics Choice" role="img">
      <defs>
        <path id="cz-sello-arco" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="#7A1F2B" stroke="#1A1210" strokeWidth="3" />
      <text fill="#FFF4E6" fontSize="9" fontWeight="800" letterSpacing="1">
        <textPath href="#cz-sello-arco" textLength="216" lengthAdjust="spacing">CAZURRONICS · CHOICE · LEÓN ·</textPath>
      </text>
      <circle cx="50" cy="50" r="23" fill="#FFF4E6" stroke="#1A1210" strokeWidth="2.5" />
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
  // Escape cierra la ficha de la parada (como en el formulario de negocios)
  useEffect(() => {
    if (!paradaSeleccionada) return;
    const alPulsar = (e) => { if (e.key === "Escape") cerrarModal(); };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [paradaSeleccionada]);

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

  const fechaLarga = fecha ? new Date(`${fecha}T12:00:00`) : null;

  return (
    <main className={`min-h-[100dvh] bg-[#FFF4E6] text-[#1A1210] antialiased selection:bg-[#F2B33D] font-[family-name:var(--font-archivo)] ${intro === "entrando" ? 'cz-wait' : ''}`}>
      <style dangerouslySetInnerHTML={{__html: `
        .roseton-slider { -webkit-appearance: none; appearance: none; height: 14px; border-radius: 9999px; background: #FFF4E6; border: 2px solid #1A1210; outline: none; }
        .roseton-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 30px; height: 30px; border-radius: 50%; background: #7A1F2B; border: 2.5px solid #1A1210; box-shadow: 2px 2px 0 #1A1210; cursor: grab; transition: transform .15s ease-out; }
        .roseton-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.12); }
        .roseton-slider::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #7A1F2B; border: 2.5px solid #1A1210; box-shadow: 2px 2px 0 #1A1210; cursor: grab; }
        .roseton-slider:focus-visible { box-shadow: 0 0 0 4px #F2B33D; }

        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.7; }
        .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }

        @keyframes cz-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes cz-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cz-sheet { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes cz-spin { to { transform: rotate(360deg); } }
        @keyframes cz-bote { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .cz-up { animation: cz-up .5s cubic-bezier(.2,.8,.2,1) both; }
        .cz-fade { animation: cz-fade .25s ease both; }
        .cz-sheet { animation: cz-sheet .4s cubic-bezier(.32,.72,0,1) both; }
        .cz-bote { animation: cz-bote 1.2s ease-in-out infinite; }

        /* Intro: LEÓN entra grande sobre granate y se va. Toca para saltarla. */
        @keyframes cz-intro-leon { 0% { opacity: 0; transform: scale(1.35); filter: blur(12px); } 100% { opacity: 1; transform: none; filter: none; } }
        @keyframes cz-intro-out { to { opacity: 0; transform: translateY(-4%); } }
        .cz-intro-leon { animation: cz-intro-leon .8s cubic-bezier(.2,.8,.2,1) both; }
        .cz-intro-txt { animation: cz-up .5s cubic-bezier(.2,.8,.2,1) .45s both; }
        .cz-intro-out { animation: cz-intro-out .45s cubic-bezier(.4,0,.2,1) both; }
        /* Mientras dura la intro, las entradas de la página esperan congeladas en su primer fotograma */
        .cz-wait .cz-up { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .cz-up, .cz-sheet, .cz-intro-txt, .cz-intro-leon { animation: cz-fade .4s ease both !important; }
          .cz-bote { animation: none !important; }
          .cz-intro-out { animation: cz-fade .01s reverse both !important; }
        }
      `}} />

      {/* ── Intro de bienvenida: solo al abrir la web (toca para saltar) ── */}
      {intro !== "fin" && (
        <div
          onClick={salirIntro}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget && intro === "saliendo") setIntro("fin"); }}
          className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#7A1F2B] text-[#FFF4E6] ${intro === "saliendo" ? "cz-intro-out pointer-events-none" : ""}`}
        >
          <p className={`${DISPLAY} cz-intro-leon text-[38vw] sm:text-[24vw]`}>León</p>
          <p className="cz-intro-txt mt-3 text-lg font-extrabold tracking-[0.2em] uppercase">Cazurronics 🦁</p>
        </div>
      )}

      {estaCargando ? (
        /* ───────────────────────── CARGANDO ─────────────────────────
           Granate a pantalla completa y los pasos como pegatinas que se van marcando. */
        <div className="min-h-[100dvh] bg-[#7A1F2B] text-[#FFF4E6] px-4 py-10 flex flex-col justify-center" role="status" aria-live="polite">
          <div className="w-full max-w-md mx-auto cz-up">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#F2B33D]">Un momento</p>
            <h2 className={`${DISPLAY} mt-2 text-[22vw] sm:text-8xl`}>Montando<br />tu plan</h2>
            <ol className="mt-8 flex flex-col gap-2.5">
              {PASOS_CARGA.map((paso, i) => {
                const hecho = i < pasoCarga;
                const actual = i === pasoCarga;
                return (
                  <li
                    key={paso.texto}
                    className={`${PEGATINA_PEQ} flex items-center gap-3 rounded-xl px-3 h-14 text-[#1A1210] transition-all duration-300 ${hecho ? "bg-[#8FC7A8]" : actual ? "bg-white" : "bg-[#FFF4E6] opacity-55"}`}
                  >
                    <span className={`w-8 h-8 shrink-0 rounded-lg border-2 border-[#1A1210] flex items-center justify-center text-base ${hecho ? "bg-[#1A1210] text-white" : "bg-white"}`}>
                      {hecho ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      ) : paso.emoji}
                    </span>
                    <span className="flex-1 text-[15px] font-bold">{paso.texto}</span>
                    {actual && <span className="w-5 h-5 shrink-0 rounded-full border-[3px] border-[#1A1210]/20 border-t-[#7A1F2B] animate-spin" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : itinerario ? (
        /* ───────────────────────── RESULTADOS ───────────────────────── */
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-16 flex flex-col gap-6">

          {/* Barra superior fija */}
          <div className={`${PEGATINA_PEQ} sticky top-3 z-50 bg-[#FFF4E6] rounded-2xl pl-4 pr-2 py-2 flex items-center justify-between gap-3 cz-up`}>
            <div className="min-w-0">
              <h2 className={`${DISPLAY} text-2xl`}>Tu planazo</h2>
              <p className="text-xs font-semibold text-[#5C4F44] mt-0.5 truncate first-letter:uppercase">{fechaLarga ? fechaLarga.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : ""} · {itinerario.length} paradas</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {planId && (
                <button onClick={compartir} aria-label="Compartir plan" className={`${BOTON_CREMA} bg-white`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
                  <span className="hidden sm:inline">Compartir</span>
                </button>
              )}
              <button
                onClick={() => { setItinerario(null); setClimaPrevision(null); }}
                className={`${PEGATINA_PEQ} ${PULSA} inline-flex items-center gap-1.5 h-11 pl-3 pr-4 rounded-xl bg-[#1A1210] text-[#FFF4E6] text-sm font-bold`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                Volver
              </button>
            </div>
          </div>

          {aviso && <div className={`${PEGATINA_PEQ} cz-fade fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-[#1A1210] text-white text-sm font-bold px-4 py-2.5 rounded-xl`}>{aviso}</div>}

          {/* Portada del plan: la primera parada a toda pantalla y el día en grande */}
          <section className={`${PEGATINA} relative rounded-3xl overflow-hidden bg-[#7A1F2B] text-white min-h-[300px] sm:min-h-[360px] flex flex-col justify-end cz-up`} style={{ animationDelay: "60ms" }}>
            {itinerario[0]?.fotoOficial && <img src={itinerario[0].fotoOficial} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#1A1210]/85 via-[#1A1210]/25 to-transparent" />
            <div className="relative p-5 sm:p-7">
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#F2B33D]">Tu plan en León</p>
              <p className={`${DISPLAY} pt-[0.14em] text-[19vw] sm:text-8xl`}>{fechaLarga ? fechaLarga.toLocaleDateString("es-ES", { weekday: "long" }) : "Tu día"}</p>
              <p className="mt-2 text-base font-bold first-letter:uppercase">{fechaLarga ? fechaLarga.toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : ""} · {itinerario.length} paradas</p>
            </div>
          </section>

          {/* Mapa + tiempo, compartir y consejo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={`${PEGATINA} lg:col-span-8 rounded-3xl p-1.5 bg-white overflow-hidden cz-up`} style={{ animationDelay: "100ms" }}>
              <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} itinerario={itinerario} />
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              {climaPrevision && (
                <div className={`${PEGATINA_PEQ} rounded-2xl p-4 bg-[#9DB8F2] flex items-start gap-3 cz-up`} style={{ animationDelay: "140ms" }}>
                  <span className="w-11 h-11 shrink-0 rounded-xl bg-white border-2 border-[#1A1210] flex items-center justify-center text-2xl">🌤️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em]">Previsión</p>
                    <p className="text-[15px] font-semibold leading-snug mt-0.5">{climaPrevision}</p>
                  </div>
                </div>
              )}

              {planId && (
                <button onClick={compartir} className={`${PEGATINA_PEQ} ${PULSA} text-left rounded-2xl p-4 bg-[#F2B33D] flex items-center gap-3 cz-up`} style={{ animationDelay: "170ms" }}>
                  <span className="flex -space-x-2 shrink-0" aria-hidden>
                    {["🦁", "🐻", "🦊"].map((e, i) => <span key={e} className="w-10 h-10 rounded-full bg-white border-2 border-[#1A1210] flex items-center justify-center text-lg" style={{ zIndex: 3 - i }}>{e}</span>)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold">Decidid en grupo</span>
                    <span className="block text-sm font-medium leading-snug">Manda el enlace y votad cada parada →</span>
                  </span>
                </button>
              )}

              <div className={`${PEGATINA_PEQ} rounded-2xl p-4 bg-white cz-up`} style={{ animationDelay: "200ms" }}>
                <p className="text-base font-extrabold">💡 Sácale todo el jugo</p>
                <p className="text-sm text-[#4A3F36] leading-relaxed mt-1">
                  Toca una parada para ver <b>horarios y precios</b>, asomarte con la <b>cámara 360º</b> o <b>pedirme que cambie el sitio</b>.
                </p>
              </div>
            </div>
          </div>

          {/* Paradas: tarjetas grandes con foto, como un feed */}
          <div className="flex items-end justify-between pt-2">
            <h3 className={`${DISPLAY} text-5xl sm:text-6xl`}>La ruta</h3>
            <span className="text-xs font-bold text-[#5C4F44] pb-1">Toca para ver detalles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {itinerario.map((parada, index) => (
              <div
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => abrirParada(parada, index)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirParada(parada, index); } }}
                className={`${PEGATINA} ${PULSA} cz-up group rounded-3xl overflow-hidden bg-white flex flex-col cursor-pointer outline-none`}
                style={{ animationDelay: `${240 + index * 60}ms` }}
              >
                <div className="aspect-[4/5] md:aspect-[4/3] w-full bg-[#F3E3CC] relative overflow-hidden border-b-[2.5px] border-[#1A1210]">
                  <img src={parada.fotoOficial} alt={parada.titulo} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                  <span className={`${DISPLAY} absolute top-3 left-3 w-12 h-12 rounded-full bg-[#7A1F2B] text-white text-3xl border-[2.5px] border-[#1A1210] flex items-center justify-center pt-0.5`}>{index + 1}</span>
                  <span className={`${PEGATINA_PEQ} absolute top-3 right-3 bg-[#FFF4E6] text-sm font-extrabold px-3 py-1.5 rounded-lg tabular-nums`}>{parada.hora}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-xl font-extrabold leading-tight">{parada.titulo}</h3>
                  {parada.lugar && <p className="text-sm font-bold text-[#7A1F2B] mt-1 truncate">📍 {parada.lugar}</p>}
                  <p className="text-[15px] text-[#4A3F36] mt-2 mb-4 line-clamp-3 leading-relaxed">{parada.descripcion}</p>
                  <div className="flex justify-between items-center mt-auto gap-2">
                    <span className="text-xs font-extrabold bg-[#F2B33D] border-2 border-[#1A1210] px-2.5 py-1 rounded-lg truncate">⭐ {parada.resenas}</span>
                    <span className="shrink-0 text-sm font-extrabold text-[#7A1F2B]">Ver detalles →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Todo lo demás que ha encontrado el barrido para ese día */}
          {masEseDia.length > 0 && (
            <section className="pt-2" aria-labelledby="cz-mas-titulo">
              <div className="flex items-end justify-between mb-3">
                <h3 id="cz-mas-titulo" className={`${DISPLAY} text-4xl sm:text-5xl`}>Más cosas ese día</h3>
                <span className="hidden sm:inline text-xs font-bold text-[#5C4F44] pb-1">Eventos, mercadillos y ferias encontrados</span>
              </div>
              <AgendaFranjas eventos={masEseDia} mostrarCuando />
            </section>
          )}

          {/* ── Hoja de detalle (desde abajo en móvil, ventana en escritorio) ── */}
          {paradaSeleccionada && (
            <div className="cz-fade fixed inset-0 bg-[#1A1210]/55 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={cerrarModal}>
              <div
                className="cz-sheet bg-[#FFF4E6] border-[2.5px] border-[#1A1210] sm:shadow-[6px_6px_0_0_#1A1210] w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7"
                onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-labelledby="cz-parada-titulo"
              >
                <div aria-hidden className="sm:hidden mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#1A1210]/30" />

                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 bg-[#7A1F2B] text-white text-xs font-extrabold px-3 py-1.5 rounded-lg border-2 border-[#1A1210] mb-3">
                      {indiceSeleccionado !== null && <span>Parada {indiceSeleccionado + 1} ·</span>} {paradaSeleccionada.hora}
                    </span>
                    <h2 id="cz-parada-titulo" className="text-2xl sm:text-3xl font-extrabold leading-tight">{paradaSeleccionada.titulo}</h2>
                    {paradaSeleccionada.lugar && <p className="text-sm font-bold text-[#7A1F2B] mt-1">📍 {paradaSeleccionada.lugar}</p>}
                  </div>
                  <button type="button" autoFocus onClick={cerrarModal} aria-label="Cerrar" className={`${PEGATINA_PEQ} ${PULSA} shrink-0 w-11 h-11 rounded-xl bg-white flex items-center justify-center`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {paradaSeleccionada.streetView && (
                  <div className="mb-5 relative rounded-2xl overflow-hidden border-[2.5px] border-[#1A1210]">
                    <div className="absolute top-3 left-3 bg-[#FFF4E6] border-2 border-[#1A1210] px-2.5 py-1 rounded-lg text-[11px] font-extrabold z-10 pointer-events-none">
                      {paradaSeleccionada.streetView.includes("embed") ? "📍 Vista 360º · Arrastra" : "📍 Vista exterior"}
                    </div>
                    {paradaSeleccionada.streetView.includes("embed") ? (
                      <iframe src={paradaSeleccionada.streetView} title={`Vista 360º de ${paradaSeleccionada.titulo}`} allowFullScreen loading="lazy" className="w-full h-52 sm:h-60 block"></iframe>
                    ) : (
                      <img src={paradaSeleccionada.streetView} alt={`Vista exterior de ${paradaSeleccionada.titulo}`} loading="lazy" decoding="async" className="w-full h-52 sm:h-60 object-cover block" />
                    )}
                  </div>
                )}

                <p className="text-[#4A3F36] text-base leading-relaxed mb-5">{paradaSeleccionada.descripcion}</p>
                {paradaSeleccionada.fuente && /^https?:\/\//.test(paradaSeleccionada.fuente) && (
                  <a href={webSegura(paradaSeleccionada.fuente)} target="_blank" rel="noopener noreferrer" className="-mt-2 mb-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#7A1F2B] underline underline-offset-2">🎟️ Ver la fuente del evento</a>
                )}

                <div className="grid grid-cols-1 gap-2 mb-5">
                  {[
                    { icono: "💶", color: "bg-[#8FC7A8]", etiqueta: "Precio", valor: paradaSeleccionada.precio },
                    { icono: "🕒", color: "bg-[#9DB8F2]", etiqueta: "Horario", valor: paradaSeleccionada.horario },
                    { icono: "🚶", color: "bg-[#F4A3A8]", etiqueta: "Cómo llegar", valor: paradaSeleccionada.transporte },
                  ].map((dato) => (
                    <div key={dato.etiqueta} className="flex items-center gap-3 bg-white border-2 border-[#1A1210] rounded-xl p-3">
                      <span className={`w-10 h-10 shrink-0 rounded-lg ${dato.color} border-2 border-[#1A1210] flex items-center justify-center text-lg`}>{dato.icono}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5C4F44]">{dato.etiqueta}</p>
                        <p className="text-[15px] font-semibold leading-snug">{dato.valor}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {paradaSeleccionada.telefono !== "No disponible" ? (
                    <a href={telSeguro(paradaSeleccionada.telefono)} onClick={() => baliza("llamar", { lugarId: paradaSeleccionada.lugarId })} className={`${BOTON_GRANATE} h-12 text-base`}>📞 Llamar</a>
                  ) : (
                    <span className="h-12 flex items-center justify-center gap-2 border-2 border-dashed border-[#1A1210]/40 text-[#7D6F62] font-bold rounded-2xl cursor-not-allowed">📞 Sin teléfono</span>
                  )}
                  {paradaSeleccionada.web !== "No disponible" ? (
                    <a href={webSegura(paradaSeleccionada.web)} target="_blank" rel="noopener noreferrer" onClick={() => baliza("web", { lugarId: paradaSeleccionada.lugarId })} className={`${PEGATINA} ${PULSA} h-12 flex items-center justify-center gap-2 rounded-2xl bg-white font-extrabold`}>🌐 Web</a>
                  ) : (
                    <span className="h-12 flex items-center justify-center gap-2 border-2 border-dashed border-[#1A1210]/40 text-[#7D6F62] font-bold rounded-2xl cursor-not-allowed">🌐 Sin web</span>
                  )}
                </div>

                <div className={`${PEGATINA_PEQ} relative overflow-hidden rounded-2xl p-4 bg-[#F6D8A8]`}>
                  <label htmlFor="cz-retoque" className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] mb-3">
                    <span className="text-base">🔄</span> ¿No te convence? Te lo cambio
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input id="cz-retoque" type="text" value={instruccionRetoque} onChange={(e) => setInstruccionRetoque(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); retocarParada(); } }} placeholder="Ej: algo más barato, vegetariano…" disabled={retocando} className={`${INPUT} flex-1 min-w-0 h-12 py-0 disabled:opacity-50`} />
                    <button onClick={retocarParada} disabled={retocando || !instruccionRetoque.trim()} className={`${PEGATINA_PEQ} ${PULSA} shrink-0 h-12 px-6 rounded-xl bg-[#1A1210] text-[#FFF4E6] font-extrabold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}>
                      {retocando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                      {retocando ? "Pensando..." : "Cambiar"}
                    </button>
                  </div>

                  {/* Espera del retoque */}
                  {retocando && (
                    <div className="cz-fade absolute inset-0 z-10 flex items-center justify-center gap-3 bg-[#F6D8A8]" role="status" aria-live="polite">
                      <span className="cz-bote text-3xl" aria-hidden>🦁</span>
                      <div className="text-left">
                        <p className="text-sm font-extrabold">Buscando otro sitio…</p>
                        <p className="text-xs font-medium text-[#4A3F36] mt-0.5">«{instruccionRetoque}»</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ───────────────────────── INICIO ─────────────────────────
           Móvil: foto de León a pantalla completa con LEÓN gigante y, debajo, la app.
           Escritorio: la foto se queda fija a la izquierda y la app va a la derecha. */
        <div className="lg:grid lg:grid-cols-2">

          <section className="relative h-[86svh] min-h-[540px] lg:h-[100dvh] lg:sticky lg:top-0 overflow-hidden bg-[#1A1210] text-white">
            <img src="/leon/catedral.webp" alt="Catedral de León" fetchPriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[50%_30%]" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1A1210]/55 via-transparent via-35% to-[#1A1210]/80" />

            <div className="absolute inset-x-0 top-0 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold tracking-[0.14em] uppercase whitespace-nowrap">Cazurronics 🦁</span>
              {/* Para negocios: visible nada más entrar */}
              <button type="button" onClick={abrirNegocios} className={`${BOTON_CREMA} h-10 text-xs`}>
                <span aria-hidden>🏪</span><span className="whitespace-nowrap">¿Tienes un negocio?</span>
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-10 lg:pb-12">
              <p className="text-lg font-extrabold uppercase tracking-[0.12em] text-[#F2B33D] cz-up">Tu planazo en</p>
              <h1 className={`${DISPLAY} text-[37vw] lg:text-[16vw] -ml-1 pt-[0.16em] cz-up`} style={{ animationDelay: "60ms" }}>León</h1>
              <p className="mt-3 max-w-sm text-[17px] font-semibold leading-snug cz-up" style={{ animationDelay: "120ms" }}>
                Dinos qué te apetece y montamos la ruta: tapas, monumentos, eventos y fiesta. Con el tiempo y los horarios ya mirados.
              </p>
            </div>
            <p className="absolute right-3 bottom-2 text-[10px] font-medium text-white/60">Foto: Joselodos (CC0)</p>
          </section>

          <div className="relative z-10 -mt-6 lg:mt-0 rounded-t-[28px] lg:rounded-none bg-[#FFF4E6] border-t-[2.5px] lg:border-t-0 lg:border-l-[2.5px] border-[#1A1210] px-4 sm:px-8 pt-6 pb-36 sm:pb-12 lg:pt-10">
            <div className="w-full max-w-xl mx-auto flex flex-col gap-7">

              {/* Planes | Despensa */}
              <SelectorSeccion actual="planes" estilo="pegatina" className="cz-up" />

              {/* "¿Fuiste? ¿Qué tal?" si tiene un plan pasado sin valorar */}
              {pendienteValorar && <Valorar plan={pendienteValorar} onCerrar={() => setPendienteValorar(null)} />}

              {/* Formulario */}
              <form onSubmit={generarPlan} id="cz-form" className="flex flex-col gap-7">
                <div className="cz-up" style={{ animationDelay: "80ms" }}>
                  <label htmlFor="cz-apetece" className={`${DISPLAY} block text-[15vw] sm:text-7xl mb-4`}>¿Qué te<br />apetece?</label>
                  <textarea id="cz-apetece" rows="2" value={apetece} onChange={(e) => setApetece(e.target.value)} className={`${INPUT} ${PEGATINA_PEQ} resize-none leading-relaxed text-lg`} placeholder="Ej: Cocido, ver monumentos y luego unas cañas…"></textarea>
                  <div className="flex gap-2.5 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-2 snap-x">
                    {SUGERENCIAS.map((s, i) => (
                      <button
                        key={s.texto}
                        type="button"
                        onClick={() => anadirSugerencia(s.texto)}
                        className={`${PEGATINA_PEQ} ${PULSA} ${COLORES[i % COLORES.length]} ${GIROS[i % GIROS.length]} snap-start shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-bold`}
                      >
                        <span>{s.emoji}</span>{s.texto}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fecha */}
                <div className="cz-up" style={{ animationDelay: "120ms" }}>
                  <label htmlFor="cz-fecha" className={LABEL}><span>📅</span> ¿Qué día?</label>
                  <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2">
                    {[{ v: hoy, t: "Hoy" }, { v: manana, t: "Mañana" }].map((op) => (
                      <button
                        key={op.t}
                        type="button"
                        onClick={() => setFecha(op.v)}
                        aria-pressed={fecha === op.v}
                        className={`${PEGATINA_PEQ} ${PULSA} h-12 rounded-xl text-[15px] font-extrabold ${fecha === op.v ? "bg-[#1A1210] text-[#FFF4E6]" : "bg-white"}`}
                      >
                        {op.t}
                      </button>
                    ))}
                    <input id="cz-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${INPUT} h-12 py-0 px-3 text-sm cursor-pointer min-w-0 ${fecha && fecha !== hoy && fecha !== manana ? "bg-[#F2B33D]" : ""}`} />
                  </div>
                </div>

                {/* Presupuesto */}
                <div className={`${PEGATINA_PEQ} rounded-2xl p-4 bg-white cz-up`} style={{ animationDelay: "160ms" }}>
                  <div className="flex items-center justify-between mb-4">
                    <label className={`${LABEL} mb-0 whitespace-nowrap`}><span>💶</span> Presupuesto <span className="hidden sm:inline normal-case tracking-normal font-semibold text-[#5C4F44]">· por persona</span></label>
                    <span className="text-sm font-extrabold bg-[#F2B33D] border-2 border-[#1A1210] rounded-lg px-2.5 py-0.5 tabular-nums">
                      {presupuestoMin === '' ? 0 : presupuestoMin}€ – {presupuestoMax === '' ? 0 : (presupuestoMax >= 300 ? "+300" : presupuestoMax)}€
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex items-center shrink-0 rounded-lg overflow-hidden border-2 border-[#1A1210] bg-[#FFF4E6]">
                      <span className="absolute left-2.5 text-[11px] font-extrabold text-[#5C4F44] pointer-events-none">Mín</span>
                      <input type="number" inputMode="numeric" aria-label="Presupuesto mínimo en euros" min="0" max="300" value={presupuestoMin} onChange={(e) => setPresupuestoMin(e.target.value === '' ? '' : Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} className="w-24 h-10 pl-10 pr-6 bg-transparent border-0 text-base font-extrabold text-center outline-none focus:bg-white tabular-nums" />
                      <span className="absolute right-2.5 text-[11px] font-extrabold text-[#5C4F44] pointer-events-none">€</span>
                    </div>
                    <input type="range" min="0" max="300" step="5" value={presupuestoMin === '' ? 0 : presupuestoMin} onChange={(e) => setPresupuestoMin(Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} aria-label="Presupuesto mínimo" className="w-full cursor-pointer roseton-slider" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center shrink-0 rounded-lg overflow-hidden border-2 border-[#1A1210] bg-[#FFF4E6]">
                      <span className="absolute left-2.5 text-[11px] font-extrabold text-[#5C4F44] pointer-events-none">Máx</span>
                      <input type="text" inputMode="numeric" aria-label="Presupuesto máximo en euros" value={presupuestoMax === '' ? '' : (presupuestoMax >= 300 ? "+300" : presupuestoMax)} onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (val === '') { setPresupuestoMax(''); return; } val = Number(val); if (val > 300) val = 300; setPresupuestoMax(Math.max(val, presupuestoMin === '' ? 0 : presupuestoMin)); }} className="w-24 h-10 pl-10 pr-6 bg-transparent border-0 text-base font-extrabold text-center outline-none focus:bg-white tabular-nums" />
                      <span className="absolute right-2.5 text-[11px] font-extrabold text-[#5C4F44] pointer-events-none">€</span>
                    </div>
                    <input type="range" min="0" max="300" step="5" value={presupuestoMax === '' ? 0 : presupuestoMax} onChange={(e) => setPresupuestoMax(Math.max(Number(e.target.value), presupuestoMin === '' ? 0 : presupuestoMin))} aria-label="Presupuesto máximo" className="w-full cursor-pointer roseton-slider" />
                  </div>
                </div>

                {/* Zona */}
                <div className={`${PEGATINA_PEQ} rounded-2xl p-2.5 sm:p-4 bg-white [&_input[type=text]]:min-w-0 [&_button]:whitespace-nowrap [&_button]:shrink-0 cz-up`} style={{ animationDelay: "200ms" }}>
                  <label className={`${LABEL} mt-1 px-1.5 mb-3`}><span>📍</span> Zona <span className="normal-case tracking-normal font-semibold text-[#5C4F44]">· toca el mapa</span></label>
                  <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} />
                </div>

                {/* Botón principal: fijo abajo en móvil (zona del pulgar), en su sitio en escritorio */}
                <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#FFF4E6] border-t-2 border-[#1A1210] sm:static sm:z-auto sm:p-0 sm:border-0 sm:bg-transparent">
                  <button type="submit" className={`${BOTON_GRANATE} w-full h-16 text-xl`}>
                    Montar mi plan
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </form>

              {/* Despensa */}
              <Link href="/despensa" className={`${PEGATINA} ${PULSA} rounded-3xl p-5 bg-[#F2B33D] flex items-center gap-4`}>
                <span className="shrink-0 w-14 h-14 rounded-2xl bg-white border-[2.5px] border-[#1A1210] flex items-center justify-center text-3xl -rotate-6" aria-hidden>🧺</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold uppercase tracking-[0.14em]">Despensa de León</span>
                  <span className="block text-lg font-extrabold leading-snug mt-0.5">¿Una morcilla buena y pan de leña cerca?</span>
                  <span className="block text-sm font-medium mt-0.5">Te decimos dónde comprarlo en toda la provincia.</span>
                </span>
                <span className="shrink-0 w-10 h-10 rounded-full bg-[#1A1210] text-white flex items-center justify-center text-lg" aria-hidden>→</span>
              </Link>

              {/* Valores */}
              <section className="grid grid-cols-3 gap-2.5" aria-label="Nuestros valores">
                {VALORES.map((v, i) => (
                  <div key={v.titulo} className={`${PEGATINA_PEQ} ${COLORES[(i + 1) % COLORES.length]} rounded-2xl p-3`}>
                    <p className="text-2xl" aria-hidden>{v.emoji}</p>
                    <p className="text-sm font-extrabold mt-1">{v.titulo}</p>
                    <p className="text-xs font-medium leading-snug mt-0.5">{v.texto}</p>
                  </div>
                ))}
              </section>

              {/* Cazurronics Choices: arcos de la Catedral en colores planos */}
              <section className={`${PEGATINA} rounded-3xl p-5 bg-white`} aria-labelledby="cz-choices-titulo">
                <div className="flex items-center gap-4">
                  <SelloChoice className="w-16 h-16 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#7A1F2B]">Locales destacados</p>
                    <h2 id="cz-choices-titulo" className={`${DISPLAY} text-4xl`}>Cazurronics Choices</h2>
                  </div>
                </div>
                <p className="text-sm font-medium text-[#4A3F36] leading-snug mt-3">Los locales de León que destacamos en la web y en nuestras redes.</p>

                <div className={`mt-5 ${CAZURRONICS_CHOICES.length >= 3 ? "-mx-5 px-5 flex gap-3 overflow-x-auto no-scrollbar snap-x scroll-px-5 pb-2 pt-1" : "grid grid-cols-3 gap-3"}`}>
                  {(CAZURRONICS_CHOICES.length ? [...CAZURRONICS_CHOICES, null] : [null, null, null]).map((local, i) => {
                    // Hueco libre → abre el formulario de negocios; local con web → enlace
                    const Tag = local ? (local.url ? "a" : "div") : "button";
                    return (
                      <Tag
                        key={local?.nombre ?? `libre-${i}`}
                        {...(local?.url ? { href: local.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                        {...(!local ? { type: "button", onClick: abrirNegocios, "aria-label": "Tu local aquí: pide información para salir en Cazurronics Choices" } : {})}
                        className={`${CAZURRONICS_CHOICES.length >= 3 ? "shrink-0 snap-start w-[calc((100%-1.5rem)/3)]" : "w-full"} ${PEGATINA_PEQ} ${PULSA} relative block aspect-[3/4.2] cursor-pointer rounded-t-[999px] rounded-b-xl overflow-hidden ${COLORES[i % COLORES.length]}`}
                      >
                        {local?.foto && <img src={local.foto} alt={local.nombre} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />}
                        {local ? (
                          <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-[#1A1210]/85 to-transparent text-center">
                            <p className="text-[13px] font-extrabold text-white leading-tight line-clamp-2">{local.nombre}</p>
                            {local.categoria && <p className="text-[10px] font-semibold text-white/80 mt-0.5 truncate">{local.categoria}{local.zona ? ` · ${local.zona}` : ""}</p>}
                          </div>
                        ) : (
                          <div className="absolute inset-x-0 bottom-2.5 flex flex-col items-center gap-1">
                            <span className={`${DISPLAY} text-3xl`}>Nº {i + 1}</span>
                            <span className="text-[11px] font-extrabold bg-white border-2 border-[#1A1210] rounded-md px-1.5 py-0.5 whitespace-nowrap">Tu local aquí</span>
                          </div>
                        )}
                      </Tag>
                    );
                  })}
                </div>

                <p className="text-center text-sm font-medium text-[#4A3F36] mt-4">
                  {CAZURRONICS_CHOICES.length ? "Locales destacados por Cazurronics · " : "Hay un hueco esperando a tu local · "}
                  <button type="button" onClick={abrirNegocios} className="font-extrabold text-[#7A1F2B] underline underline-offset-2">¿Quieres uno?</button>
                </p>
              </section>

              {/* Negocios */}
              <section className={`${PEGATINA_PEQ} rounded-2xl p-4 pl-5 bg-[#F6D8A8] flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-base font-extrabold leading-snug">¿Tienes un negocio en León?</p>
                  <p className="text-sm font-medium leading-snug mt-0.5">Sal en Cazurronics Choices y en nuestras redes.</p>
                </div>
                <BusinessModal />
              </section>

              {/* Enlaces a las páginas de contenido (ayudan a que Google encuentre la web) */}
              <nav aria-label="Más de León" className="flex flex-wrap gap-2.5">
                {[["/agenda-leon", "📅 Agenda de León"], ["/que-hacer-en-leon", "✨ Qué hacer en León"], ["/donde-comer-en-leon", "🍷 Dónde comer en León"], ["/despensa", "🧺 Despensa de León"]].map(([href, texto]) => (
                  <Link key={href} href={href} className={`${BOTON_CREMA} bg-white`}>{texto}</Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
