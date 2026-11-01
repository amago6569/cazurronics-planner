"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import BusinessModal from './components/BusinessModal';
import Valorar from './components/Valorar';
import AgendaFranjas from './components/AgendaFranjas';
import { webSegura, telSeguro, baliza, compartirPlan, recordarPlan, actualizarParadaRecordada, planPendienteDeValorar, registrarVisita } from '../lib/cliente';
import { GIGANTE, SERIFA, TEXTO, ETIQUETA, TOQUE, BOTON_RAYA, BOTON_ACENTO } from '../lib/estilos';

const MapSelectorDynamic = dynamic(() => import('./components/MapSelector'), { ssr: false, loading: () => <div className="h-[300px] bg-[#EEF0F3] animate-pulse" /> });

/* ─────────────────────────────────────────────────────────────
   Sistema visual "Desierto": calco de la web de White Desert con León.
   Foto a pantalla completa con rayas verticales finas y LEÓN gigante abajo,
   secciones blancas con titulares en serifa azul marino, acordeón de planes
   y pestaña lateral naranja. Solo clases de Tailwind; ninguna lógica aquí.
   ───────────────────────────────────────────────────────────── */
const INPUT = `${TEXTO} w-full bg-transparent border-0 border-b border-[#1B2541]/30 text-[#1B2541] placeholder:text-[#1B2541]/40 text-base rounded-none px-0 py-3 outline-none transition-colors duration-200 focus:border-[#1B2541]`;
const LABEL = `${ETIQUETA} flex items-center gap-2 text-[#1B2541]/70 mb-3`;

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

const SUGERENCIAS = [
  { emoji: "🍷", texto: "Tapeo por el Húmedo" },
  { emoji: "⛪", texto: "Ver monumentos" },
  { emoji: "🥘", texto: "Comer cocido maragato" },
  { emoji: "🎶", texto: "Salir de fiesta" },
  { emoji: "🌲", texto: "Plan de naturaleza" },
];

/* Acordeón "Nuestros planes" (como "Our trips" de White Desert).
   "Añadir a mi plan" mete el texto en la caja de qué te apetece. */
const PLANES_TIPO = [
  { foto: "/leon/roseton.webp", titulo: "Vidrieras y monumentos", meta: "Medio día · todo el año", texto: "Catedral, San Isidoro y el casco antiguo, con los horarios del día ya mirados.", sugerencia: "Ver monumentos" },
  { foto: "/leon/astorga.webp", titulo: "Cocido maragato", meta: "Un día · otoño e invierno", texto: "Astorga y la Maragatería: cocido al revés, Palacio de Gaudí y vuelta con la tripa llena.", sugerencia: "Comer cocido maragato" },
  { foto: "/leon/torio.webp", titulo: "Río y monte", meta: "Un día · primavera y verano", texto: "Riberas, rutas cortas y pueblos de la montaña leonesa a menos de una hora.", sugerencia: "Plan de naturaleza" },
  { foto: "/leon/botines.webp", titulo: "Tapeo por el Húmedo", meta: "Una noche · todo el año", texto: "Del Húmedo al Romántico, con su tapa en cada caña y paso por Botines.", sugerencia: "Tapeo por el Húmedo" },
  { foto: "/leon/musac.webp", titulo: "Arte y fiesta", meta: "Una tarde · fines de semana", texto: "MUSAC, conciertos, teatro y lo que haya esa noche en la agenda de León.", sugerencia: "Salir de fiesta" },
];

const VALORES = [
  { titulo: "Gratis", texto: "Sin registros ni letra pequeña." },
  { titulo: "Comercio local", texto: "Bares y tiendas de aquí, de siempre." },
  { titulo: "Cercanía", texto: "Todo dentro de tu radio, sin pegarte palizas." },
];

// Rayas verticales finas sobre las fotos (6 columnas en escritorio, 3 en móvil)
function Rayas({ color = "border-white/20" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 lg:grid-cols-6">
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`border-l ${color} ${i > 2 ? "hidden lg:block" : ""} ${i === 0 ? "border-l-0" : ""}`} />)}
    </div>
  );
}

// Rúbrica a mano bajo las etiquetas en cursiva (la "firma" de White Desert)
function Rubrica({ className = "" }) {
  return (
    <svg viewBox="0 0 120 14" className={className} fill="none" aria-hidden>
      <path d="M2 10c18-6 38-8 58-6s38 4 58-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Etiqueta({ children, className = "" }) {
  return (
    <p className={`${SERIFA} italic text-2xl sm:text-3xl text-[#E2572B] flex flex-col items-center ${className}`}>
      <span>{children}</span>
      <Rubrica className="w-24 sm:w-28 -mt-0.5" />
    </p>
  );
}

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

  // Solo visual: qué panel del acordeón "Nuestros planes" está abierto
  const [panel, setPanel] = useState(0);
  const irAlFormulario = () => document.getElementById("cz-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const elegirPlan = (texto) => { anadirSugerencia(texto); irAlFormulario(); };

  return (
    <main className={`min-h-[100dvh] bg-white text-[#1B2541] antialiased selection:bg-[#E2572B] selection:text-white ${TEXTO} ${intro === "entrando" ? 'cz-wait' : ''}`}>
      <style dangerouslySetInnerHTML={{__html: `
        .roseton-slider { -webkit-appearance: none; appearance: none; height: 1px; background: #1B2541; outline: none; }
        .roseton-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 1px solid #1B2541; cursor: grab; transition: transform .15s ease-out, background-color .15s ease-out; }
        .roseton-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.12); background: #E2572B; border-color: #E2572B; }
        .roseton-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 1px solid #1B2541; cursor: grab; }
        .roseton-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px #E2572B55; }

        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }

        @keyframes cz-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes cz-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cz-sheet { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes cz-bote { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes cz-zoom { from { transform: scale(1.08); } to { transform: scale(1); } }
        .cz-up { animation: cz-up .8s cubic-bezier(.2,.8,.2,1) both; }
        .cz-fade { animation: cz-fade .25s ease both; }
        .cz-sheet { animation: cz-sheet .45s cubic-bezier(.32,.72,0,1) both; }
        .cz-bote { animation: cz-bote 1.2s ease-in-out infinite; }
        .cz-zoom { animation: cz-zoom 2.4s cubic-bezier(.2,.8,.2,1) both; }

        /* Como en White Desert: la palabra gigante se emborrona y se va al bajar */
        @keyframes cz-niebla { to { filter: blur(18px); opacity: 0; transform: translateY(-6%); } }
        @supports (animation-timeline: view()) {
          .cz-niebla { animation: cz-niebla linear both; animation-timeline: view(); animation-range: exit 0% exit 90%; }
        }

        /* Intro: blanco, LEÓN aparece fino y se va. Toca para saltarla. */
        @keyframes cz-intro-leon { 0% { opacity: 0; letter-spacing: .3em; filter: blur(10px); } 100% { opacity: 1; letter-spacing: 0; filter: none; } }
        @keyframes cz-intro-out { to { opacity: 0; } }
        .cz-intro-leon { animation: cz-intro-leon .9s cubic-bezier(.2,.8,.2,1) both; }
        .cz-intro-txt { animation: cz-up .6s cubic-bezier(.2,.8,.2,1) .45s both; }
        .cz-intro-out { animation: cz-intro-out .5s cubic-bezier(.4,0,.2,1) both; }
        /* Mientras dura la intro, las entradas de la página esperan congeladas en su primer fotograma */
        .cz-wait .cz-up, .cz-wait .cz-zoom { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .cz-up, .cz-sheet, .cz-intro-txt, .cz-intro-leon { animation: cz-fade .4s ease both !important; }
          .cz-bote, .cz-zoom, .cz-niebla { animation: none !important; }
          .cz-intro-out { animation: cz-fade .01s reverse both !important; }
        }
      `}} />

      {/* ── Intro de bienvenida: solo al abrir la web (toca para saltar) ── */}
      {intro !== "fin" && (
        <div
          onClick={salirIntro}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget && intro === "saliendo") setIntro("fin"); }}
          className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white text-[#1B2541] ${intro === "saliendo" ? "cz-intro-out pointer-events-none" : ""}`}
        >
          <Rayas color="border-[#1B2541]/10" />
          <p className={`${GIGANTE} cz-intro-leon text-[34vw] sm:text-[20vw]`}>León</p>
          <p className={`${ETIQUETA} cz-intro-txt mt-4`}>Cazurronics</p>
        </div>
      )}

      {/* Pestaña lateral naranja (escritorio), como "How it works +" de White Desert */}
      {!estaCargando && !itinerario && (
        <button
          type="button"
          onClick={irAlFormulario}
          className={`${TOQUE} hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#E2572B] hover:bg-[#C9471F] text-white px-3 py-6 items-center gap-3 [writing-mode:vertical-rl] rotate-180 ${ETIQUETA} text-[12px]`}
        >
          <span className="rotate-90 text-base leading-none" aria-hidden>+</span> Montar mi plan
        </button>
      )}

      {estaCargando ? (
        /* ───────────────────────── CARGANDO ─────────────────────────
           Azul marino a pantalla completa, rayas finas y los pasos numerados. */
        <div className="relative min-h-[100dvh] bg-[#1B2541] text-white px-5 py-12 flex flex-col justify-center overflow-hidden" role="status" aria-live="polite">
          <Rayas color="border-white/10" />
          <div className="relative w-full max-w-md mx-auto cz-up">
            <Etiqueta className="!items-start">Un momento</Etiqueta>
            <h2 className={`${GIGANTE} mt-4 text-[24vw] sm:text-9xl`}>Montando<br />tu plan</h2>
            <ol className="mt-10 border-t border-white/20">
              {PASOS_CARGA.map((paso, i) => {
                const hecho = i < pasoCarga;
                const actual = i === pasoCarga;
                return (
                  <li key={paso.texto} className={`flex items-center gap-4 h-14 border-b border-white/20 transition-opacity duration-300 ${hecho || actual ? "opacity-100" : "opacity-40"}`}>
                    <span className={`${ETIQUETA} w-8 shrink-0 tabular-nums ${actual ? "text-[#E2572B]" : ""}`}>0{i + 1}</span>
                    <span className="flex-1 text-[15px]">{paso.texto}</span>
                    {hecho && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    {actual && <span className="w-4 h-4 shrink-0 rounded-full border border-white/30 border-t-[#E2572B] animate-spin" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : itinerario ? (
        /* ───────────────────────── RESULTADOS ───────────────────────── */
        <div className="pb-16">

          {aviso && <div className={`cz-fade fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-[#1B2541] text-white text-sm px-5 py-3`}>{aviso}</div>}

          {/* Portada del plan: la primera parada a pantalla completa y el día en gigante */}
          <section className="relative h-[78svh] min-h-[480px] overflow-hidden bg-[#1B2541] text-white">
            {itinerario[0]?.fotoOficial && <img src={itinerario[0].fotoOficial} alt="" aria-hidden className="cz-zoom absolute inset-0 w-full h-full object-cover" />}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1B2541]/50 via-transparent to-[#1B2541]/70" />
            <Rayas />

            <div className="sticky top-0 z-50 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
              <button onClick={() => { setItinerario(null); setClimaPrevision(null); }} className={`${BOTON_RAYA} border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                Volver
              </button>
              <span className={`${GIGANTE} text-lg tracking-[0.12em] leading-none`}>Cazurronics</span>
              {planId ? (
                <button onClick={compartir} aria-label="Compartir plan" className={`${BOTON_RAYA} border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
                  <span className="hidden sm:inline">Compartir</span>
                </button>
              ) : <span className="w-[86px]" aria-hidden />}
            </div>

            <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4">
              <p className={`${SERIFA} italic text-2xl sm:text-3xl cz-up first-letter:uppercase`}>{fechaLarga ? fechaLarga.toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : ""} · {itinerario.length} paradas</p>
              <h2 className={`${GIGANTE} cz-niebla mt-2 text-[27vw] lg:text-[19vw] -mx-1 whitespace-nowrap`}>{fechaLarga ? fechaLarga.toLocaleDateString("es-ES", { weekday: "long" }) : "Tu día"}</h2>
            </div>
          </section>

          <div className="relative">
            <Rayas color="border-[#1B2541]/[0.07]" />

            {/* Tiempo, compartir y consejo: tres columnas finas */}
            <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 text-center">
              <Etiqueta>Tu plan en León</Etiqueta>
              <p className={`${SERIFA} mt-6 text-[28px] sm:text-5xl leading-[1.08] uppercase max-w-4xl mx-auto`}>
                {itinerario.length} paradas pensadas para ti, dentro de tu zona y tu presupuesto.
              </p>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 border-t border-[#1B2541]/15 text-left">
                {climaPrevision && (
                  <div className="py-6 md:pr-6 border-b md:border-b-0 md:border-r border-[#1B2541]/15">
                    <p className={`${ETIQUETA} text-[#E2572B]`}>Previsión</p>
                    <p className="mt-2 text-[15px] leading-relaxed">🌤️ {climaPrevision}</p>
                  </div>
                )}
                {planId && (
                  <button onClick={compartir} className={`${TOQUE} text-left py-6 md:px-6 border-b md:border-b-0 md:border-r border-[#1B2541]/15 group`}>
                    <p className={`${ETIQUETA} text-[#E2572B]`}>Decidid en grupo</p>
                    <p className="mt-2 text-[15px] leading-relaxed">Manda el enlace y votad cada parada <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span></p>
                  </button>
                )}
                <div className="py-6 md:pl-6">
                  <p className={`${ETIQUETA} text-[#E2572B]`}>Sácale todo el jugo</p>
                  <p className="mt-2 text-[15px] leading-relaxed">Toca una parada para ver horarios y precios, asomarte con la cámara 360º o pedirme que cambie el sitio.</p>
                </div>
              </div>
            </section>

            {/* Mapa */}
            <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-8 cz-up">
              <div className="border border-[#1B2541]/15 p-1.5 bg-white">
                <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} itinerario={itinerario} />
              </div>
            </section>

            {/* La ruta: cada parada como un viaje de White Desert */}
            <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28">
              <div className="text-center">
                <Etiqueta>Toca para ver detalles</Etiqueta>
                <h3 className={`${SERIFA} mt-4 text-5xl sm:text-7xl uppercase leading-none`}>La ruta</h3>
              </div>

              <ol className="mt-12 sm:mt-16 flex flex-col gap-14 sm:gap-20">
                {itinerario.map((parada, index) => (
                  <li key={index}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirParada(parada, index)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirParada(parada, index); } }}
                      className={`${TOQUE} group grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center cursor-pointer outline-none`}
                    >
                      <div className={`md:col-span-7 relative aspect-[4/5] md:aspect-[3/2] overflow-hidden bg-[#EEF0F3] ${index % 2 ? "md:order-2" : ""}`}>
                        <img src={parada.fotoOficial} alt={parada.titulo} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                        <span className={`${GIGANTE} absolute left-4 bottom-3 text-white text-7xl sm:text-8xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]`}>{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div className={`md:col-span-5 ${index % 2 ? "md:order-1" : ""}`}>
                        <p className={`${ETIQUETA} tabular-nums text-[#1B2541]/60`}>[ {parada.hora} ]</p>
                        <h4 className={`${SERIFA} italic mt-3 text-4xl sm:text-5xl leading-[1.02]`}>{parada.titulo}</h4>
                        {parada.lugar && <p className={`${ETIQUETA} mt-3 text-[#E2572B] truncate`}>{parada.lugar}</p>}
                        <p className="mt-4 text-[15px] leading-relaxed text-[#1B2541]/80 line-clamp-4">{parada.descripcion}</p>
                        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#1B2541]/15 pt-4">
                          <span className="text-sm text-[#1B2541]/70 truncate">⭐ {parada.resenas}</span>
                          <span className={`${ETIQUETA} shrink-0 inline-flex items-center gap-2`}>Ver detalles <span className="text-base leading-none transition-transform duration-200 group-hover:rotate-90">+</span></span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Todo lo demás que ha encontrado el barrido para ese día */}
            {masEseDia.length > 0 && (
              <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-24" aria-labelledby="cz-mas-titulo">
                <div className="text-center mb-10">
                  <Etiqueta>Eventos, mercadillos y ferias</Etiqueta>
                  <h3 id="cz-mas-titulo" className={`${SERIFA} mt-4 text-4xl sm:text-6xl uppercase leading-none`}>Más cosas ese día</h3>
                </div>
                <AgendaFranjas eventos={masEseDia} mostrarCuando />
              </section>
            )}

            <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 flex justify-center">
              <button onClick={() => { setItinerario(null); setClimaPrevision(null); }} className={`${BOTON_RAYA} h-12 px-6 border-[#1B2541] hover:bg-[#1B2541] hover:text-white`}>Montar otro plan <span className="text-base leading-none" aria-hidden>+</span></button>
            </div>
          </div>

          {/* ── Hoja de detalle (desde abajo en móvil, ventana en escritorio) ── */}
          {paradaSeleccionada && (
            <div className="cz-fade fixed inset-0 bg-[#1B2541]/60 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={cerrarModal}>
              <div
                className="cz-sheet bg-white w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8"
                onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-labelledby="cz-parada-titulo"
              >
                <div aria-hidden className="sm:hidden mx-auto mb-5 h-1 w-10 rounded-full bg-[#1B2541]/20" />

                <div className="flex justify-between items-start gap-3 mb-6">
                  <div className="min-w-0">
                    <p className={`${ETIQUETA} tabular-nums text-[#E2572B]`}>
                      {indiceSeleccionado !== null && <>Parada {String(indiceSeleccionado + 1).padStart(2, "0")} · </>}[ {paradaSeleccionada.hora} ]
                    </p>
                    <h2 id="cz-parada-titulo" className={`${SERIFA} italic mt-2 text-4xl leading-[1.02]`}>{paradaSeleccionada.titulo}</h2>
                    {paradaSeleccionada.lugar && <p className={`${ETIQUETA} mt-2 text-[#1B2541]/60`}>{paradaSeleccionada.lugar}</p>}
                  </div>
                  <button type="button" autoFocus onClick={cerrarModal} aria-label="Cerrar" className={`${TOQUE} shrink-0 w-11 h-11 border border-[#1B2541]/30 hover:border-[#1B2541] flex items-center justify-center`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {paradaSeleccionada.streetView && (
                  <div className="mb-6 relative overflow-hidden">
                    <div className={`${ETIQUETA} absolute top-3 left-3 bg-white px-2.5 py-1.5 z-10 pointer-events-none`}>
                      {paradaSeleccionada.streetView.includes("embed") ? "Vista 360º · Arrastra" : "Vista exterior"}
                    </div>
                    {paradaSeleccionada.streetView.includes("embed") ? (
                      <iframe src={paradaSeleccionada.streetView} title={`Vista 360º de ${paradaSeleccionada.titulo}`} allowFullScreen loading="lazy" className="w-full h-52 sm:h-60 block"></iframe>
                    ) : (
                      <img src={paradaSeleccionada.streetView} alt={`Vista exterior de ${paradaSeleccionada.titulo}`} loading="lazy" decoding="async" className="w-full h-52 sm:h-60 object-cover block" />
                    )}
                  </div>
                )}

                <p className="text-[#1B2541]/80 text-base leading-relaxed mb-6">{paradaSeleccionada.descripcion}</p>
                {paradaSeleccionada.fuente && /^https?:\/\//.test(paradaSeleccionada.fuente) && (
                  <a href={webSegura(paradaSeleccionada.fuente)} target="_blank" rel="noopener noreferrer" className={`${ETIQUETA} -mt-2 mb-6 inline-flex items-center gap-1.5 text-[#E2572B] underline underline-offset-4`}>Ver la fuente del evento →</a>
                )}

                <dl className="border-t border-[#1B2541]/15 mb-6">
                  {[
                    { etiqueta: "Precio", valor: paradaSeleccionada.precio },
                    { etiqueta: "Horario", valor: paradaSeleccionada.horario },
                    { etiqueta: "Cómo llegar", valor: paradaSeleccionada.transporte },
                  ].map((dato) => (
                    <div key={dato.etiqueta} className="grid grid-cols-[110px_1fr] gap-3 py-3.5 border-b border-[#1B2541]/15">
                      <dt className={`${ETIQUETA} text-[#1B2541]/60 pt-0.5`}>{dato.etiqueta}</dt>
                      <dd className="text-[15px] leading-snug">{dato.valor}</dd>
                    </div>
                  ))}
                </dl>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {paradaSeleccionada.telefono !== "No disponible" ? (
                    <a href={telSeguro(paradaSeleccionada.telefono)} onClick={() => baliza("llamar", { lugarId: paradaSeleccionada.lugarId })} className={`${BOTON_ACENTO} h-12!`}>Llamar</a>
                  ) : (
                    <span className={`${ETIQUETA} h-12 flex items-center justify-center border border-dashed border-[#1B2541]/25 text-[#1B2541]/40 cursor-not-allowed`}>Sin teléfono</span>
                  )}
                  {paradaSeleccionada.web !== "No disponible" ? (
                    <a href={webSegura(paradaSeleccionada.web)} target="_blank" rel="noopener noreferrer" onClick={() => baliza("web", { lugarId: paradaSeleccionada.lugarId })} className={`${BOTON_RAYA} h-12 border-[#1B2541] hover:bg-[#1B2541] hover:text-white`}>Web</a>
                  ) : (
                    <span className={`${ETIQUETA} h-12 flex items-center justify-center border border-dashed border-[#1B2541]/25 text-[#1B2541]/40 cursor-not-allowed`}>Sin web</span>
                  )}
                </div>

                <div className="relative overflow-hidden bg-[#F4F5F7] p-4 sm:p-5">
                  <label htmlFor="cz-retoque" className={`${SERIFA} italic block text-2xl mb-2`}>¿No te convence? Te lo cambio</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input id="cz-retoque" type="text" value={instruccionRetoque} onChange={(e) => setInstruccionRetoque(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); retocarParada(); } }} placeholder="Ej: algo más barato, vegetariano…" disabled={retocando} className={`${INPUT} flex-1 min-w-0 h-12 py-0 disabled:opacity-50`} />
                    <button onClick={retocarParada} disabled={retocando || !instruccionRetoque.trim()} className={`${BOTON_RAYA} shrink-0 h-12 px-6 bg-[#1B2541] border-[#1B2541] text-white hover:bg-[#2A365A] disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {retocando && <span className="w-4 h-4 rounded-full border border-white/40 border-t-white animate-spin" aria-hidden />}
                      {retocando ? "Pensando..." : "Cambiar"}
                    </button>
                  </div>

                  {/* Espera del retoque */}
                  {retocando && (
                    <div className="cz-fade absolute inset-0 z-10 flex items-center justify-center gap-3 bg-[#F4F5F7]" role="status" aria-live="polite">
                      <span className="cz-bote text-3xl" aria-hidden>🦁</span>
                      <div className="text-left">
                        <p className={`${SERIFA} italic text-xl`}>Buscando otro sitio…</p>
                        <p className="text-xs text-[#1B2541]/70 mt-0.5">«{instruccionRetoque}»</p>
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
           Calco de White Desert: foto a pantalla completa con rayas y LEÓN gigante,
           frase en serifa, formulario, acordeón de planes, la provincia y negocios. */
        <div>

          {/* ── 1. Portada ── */}
          <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-[#1B2541] text-white">
            <picture>
              <source media="(min-width: 1024px)" srcSet="/leon/catedral-ancha.webp" />
              <img src="/leon/catedral.webp" alt="Catedral de León" fetchPriority="high" decoding="async" className="cz-zoom absolute inset-0 w-full h-full object-cover object-[50%_35%] lg:object-[50%_20%]" />
            </picture>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1B2541]/45 via-[#1B2541]/5 via-40% to-[#1B2541]/60" />
            <Rayas />

            {/* Menú: botones con raya fina a los lados y el nombre en el centro */}
            <nav aria-label="Secciones" className="absolute inset-x-0 top-0 z-10 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex items-center gap-2">
                <span aria-current="page" className={`${BOTON_RAYA} max-sm:hidden border-white bg-white text-[#1B2541]`}>Planes</span>
                <Link href="/despensa" className={`${BOTON_RAYA} border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>Despensa</Link>
                <Link href="/agenda-leon" className={`${BOTON_RAYA} max-lg:hidden border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>Agenda</Link>
              </div>
              <div className="flex flex-col items-center text-center leading-none">
                <span className="text-xl" aria-hidden>🦁</span>
                <span className={`${GIGANTE} mt-1 text-[15px] tracking-[0.2em] leading-none`}>Cazurronics</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                {/* Para negocios: visible nada más entrar */}
                <button type="button" onClick={abrirNegocios} className={`${BOTON_RAYA} border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>
                  <span className="sm:hidden">Negocios</span><span className="hidden sm:inline">¿Tienes un negocio?</span>
                </button>
                <button type="button" onClick={irAlFormulario} className={`${BOTON_RAYA} max-lg:hidden border-white/70 text-white hover:bg-white hover:text-[#1B2541]`}>Montar plan</button>
              </div>
            </nav>

            {/* Frase en cursiva a la izquierda y botón con raya a la derecha */}
            <div className="absolute inset-x-0 bottom-[calc(84px+44vw)] sm:bottom-[38vw] lg:bottom-[20vw] px-4 sm:px-6 flex items-end justify-between gap-6">
              <p className={`${SERIFA} italic text-[26px] sm:text-4xl leading-[1.05] max-w-[16ch] cz-up`} style={{ animationDelay: "120ms" }}>Tu planazo en León y provincia</p>
              <button type="button" onClick={irAlFormulario} className={`${BOTON_RAYA} max-sm:hidden h-12 px-5 border-white text-white hover:bg-white hover:text-[#1B2541] cz-up`} style={{ animationDelay: "180ms" }}>
                Montar mi plan
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden><path d="M0 0l10 6-10 6z" /></svg>
              </button>
            </div>

            {/* Palabra gigante abajo, de lado a lado */}
            <h1 className={`${GIGANTE} cz-niebla absolute inset-x-0 bottom-[84px] sm:bottom-0 text-center text-[50vw] lg:text-[27vw] leading-[0.74] translate-y-[3%]`}>
              <span className="cz-up inline-block" style={{ animationDelay: "60ms" }}>León</span>
            </h1>
          </section>

          {/* ── 2. Frase grande en serifa sobre blanco ── */}
          <section className="relative px-5 sm:px-8 py-20 sm:py-32 text-center overflow-hidden">
            <Rayas color="border-[#1B2541]/[0.07]" />
            <div className="relative max-w-5xl mx-auto">
              <Etiqueta>La tierra de los cazurros</Etiqueta>
              <p className={`${SERIFA} mt-8 text-[30px] sm:text-6xl leading-[1.04] uppercase`}>
                Dinos qué te apetece y te montamos el día: tapas, monumentos, eventos y fiesta, con el tiempo y los horarios ya mirados.
              </p>
            </div>
          </section>

          {/* ── 3. Formulario ── */}
          <section id="cz-plan" className="relative scroll-mt-4 border-t border-[#1B2541]/10 px-5 sm:px-8 pt-16 sm:pt-24 pb-36 sm:pb-24">
            <Rayas color="border-[#1B2541]/[0.07]" />
            <div className="relative max-w-6xl mx-auto">
              <div className="text-center">
                <Etiqueta>Gratis y en un minuto</Etiqueta>
                <h2 className={`${SERIFA} mt-4 text-5xl sm:text-7xl uppercase leading-none`}>Monta tu plan</h2>
              </div>

              {/* "¿Fuiste? ¿Qué tal?" si tiene un plan pasado sin valorar */}
              {pendienteValorar && <div className="mt-10 max-w-xl mx-auto"><Valorar plan={pendienteValorar} onCerrar={() => setPendienteValorar(null)} /></div>}

              <form onSubmit={generarPlan} id="cz-form" className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
                <div className="flex flex-col gap-12">
                  <div>
                    <label htmlFor="cz-apetece" className={`${SERIFA} italic block text-4xl sm:text-5xl leading-none mb-4`}>¿Qué te apetece?</label>
                    <textarea id="cz-apetece" rows="2" value={apetece} onChange={(e) => setApetece(e.target.value)} className={`${INPUT} resize-none leading-relaxed text-lg`} placeholder="Ej: Cocido, ver monumentos y luego unas cañas…"></textarea>
                    <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap snap-x">
                      {SUGERENCIAS.map((s) => (
                        <button key={s.texto} type="button" onClick={() => anadirSugerencia(s.texto)} className={`${BOTON_RAYA} snap-start shrink-0 normal-case tracking-normal text-[13px] font-normal border-[#1B2541]/25 hover:border-[#1B2541] hover:bg-[#1B2541] hover:text-white`}>
                          <span aria-hidden>{s.emoji}</span>{s.texto}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fecha */}
                  <div>
                    <label htmlFor="cz-fecha" className={LABEL}>¿Qué día?</label>
                    <div className="grid grid-cols-[1fr_1fr_1.3fr] border border-[#1B2541]/25">
                      {[{ v: hoy, t: "Hoy" }, { v: manana, t: "Mañana" }].map((op) => (
                        <button key={op.t} type="button" onClick={() => setFecha(op.v)} aria-pressed={fecha === op.v} className={`${TOQUE} h-12 border-r border-[#1B2541]/25 ${ETIQUETA} text-[12px] ${fecha === op.v ? "bg-[#1B2541] text-white" : "hover:bg-[#F4F5F7]"}`}>
                          {op.t}
                        </button>
                      ))}
                      <input id="cz-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${TEXTO} h-12 px-3 text-sm bg-transparent outline-none cursor-pointer min-w-0 focus:bg-[#F4F5F7] ${fecha && fecha !== hoy && fecha !== manana ? "bg-[#1B2541] text-white [color-scheme:dark]" : ""}`} />
                    </div>
                  </div>

                  {/* Presupuesto */}
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <label className={`${LABEL} mb-0`}>Presupuesto <span className="normal-case tracking-normal text-[#1B2541]/50">· por persona</span></label>
                      <span className={`${SERIFA} italic text-2xl tabular-nums`}>
                        {presupuestoMin === '' ? 0 : presupuestoMin}€ – {presupuestoMax === '' ? 0 : (presupuestoMax >= 300 ? "+300" : presupuestoMax)}€
                      </span>
                    </div>
                    <div className="flex items-center gap-5 mb-5">
                      <div className="relative flex items-center shrink-0 border-b border-[#1B2541]/30">
                        <span className={`${ETIQUETA} absolute left-0 text-[10px] text-[#1B2541]/50 pointer-events-none`}>Mín</span>
                        <input type="number" inputMode="numeric" aria-label="Presupuesto mínimo en euros" min="0" max="300" value={presupuestoMin} onChange={(e) => setPresupuestoMin(e.target.value === '' ? '' : Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} className="w-24 h-10 pl-9 pr-5 bg-transparent border-0 text-base text-center outline-none tabular-nums" />
                        <span className="absolute right-0 text-xs text-[#1B2541]/50 pointer-events-none">€</span>
                      </div>
                      <input type="range" min="0" max="300" step="5" value={presupuestoMin === '' ? 0 : presupuestoMin} onChange={(e) => setPresupuestoMin(Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} aria-label="Presupuesto mínimo" className="w-full cursor-pointer roseton-slider" />
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="relative flex items-center shrink-0 border-b border-[#1B2541]/30">
                        <span className={`${ETIQUETA} absolute left-0 text-[10px] text-[#1B2541]/50 pointer-events-none`}>Máx</span>
                        <input type="text" inputMode="numeric" aria-label="Presupuesto máximo en euros" value={presupuestoMax === '' ? '' : (presupuestoMax >= 300 ? "+300" : presupuestoMax)} onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (val === '') { setPresupuestoMax(''); return; } val = Number(val); if (val > 300) val = 300; setPresupuestoMax(Math.max(val, presupuestoMin === '' ? 0 : presupuestoMin)); }} className="w-24 h-10 pl-9 pr-5 bg-transparent border-0 text-base text-center outline-none tabular-nums" />
                        <span className="absolute right-0 text-xs text-[#1B2541]/50 pointer-events-none">€</span>
                      </div>
                      <input type="range" min="0" max="300" step="5" value={presupuestoMax === '' ? 0 : presupuestoMax} onChange={(e) => setPresupuestoMax(Math.max(Number(e.target.value), presupuestoMin === '' ? 0 : presupuestoMin))} aria-label="Presupuesto máximo" className="w-full cursor-pointer roseton-slider" />
                    </div>
                  </div>
                </div>

                {/* Zona */}
                <div className="flex flex-col">
                  <label className={LABEL}>Zona <span className="normal-case tracking-normal text-[#1B2541]/50">· toca el mapa</span></label>
                  <div className="border border-[#1B2541]/15 p-2 sm:p-3 bg-white [&_input[type=text]]:min-w-0 [&_button]:whitespace-nowrap [&_button]:shrink-0">
                    <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} />
                  </div>

                  {/* Botón principal: fijo abajo en móvil (zona del pulgar), en su sitio en escritorio */}
                  <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur border-t border-[#1B2541]/10 sm:static sm:z-auto sm:p-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
                    <button type="submit" className={`${BOTON_ACENTO} w-full h-14 sm:h-16 text-[13px]`}>
                      Montar mi plan
                      <span className="text-xl leading-none font-light" aria-hidden>+</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>

          {/* ── 4. Nuestros planes: acordeón horizontal ── */}
          <section className="relative border-t border-[#1B2541]/10 pt-16 sm:pt-24 pb-16 sm:pb-24" aria-labelledby="cz-planes-titulo">
            <div className="text-center px-5">
              <Etiqueta>Ideas para empezar</Etiqueta>
              <h2 id="cz-planes-titulo" className={`${SERIFA} mt-4 text-5xl sm:text-7xl uppercase leading-none`}>Nuestros planes</h2>
            </div>

            <div className="mt-12 sm:mt-16 flex flex-col lg:flex-row lg:h-[640px] gap-px bg-[#1B2541]/10 px-0 lg:px-6">
              {PLANES_TIPO.map((p, i) => {
                const abierto = panel === i;
                return (
                  <div key={p.titulo} className={`relative overflow-hidden bg-[#1B2541] text-white transition-[flex-grow,height] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${abierto ? "h-[78svh] min-h-[460px] lg:h-auto lg:grow-[6]" : "h-[76px] lg:h-auto lg:grow"} lg:basis-0`}>
                    <img src={p.foto} alt="" aria-hidden loading={i === 0 ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-700 ${abierto ? "opacity-100 scale-100" : "opacity-45 scale-105"}`} />
                    <div aria-hidden className={`absolute inset-0 bg-gradient-to-t from-[#1B2541]/85 via-[#1B2541]/20 to-transparent transition-opacity duration-700 ${abierto ? "opacity-100" : "opacity-60"}`} />

                    {/* Tira cerrada: toca para abrir */}
                    <button type="button" onClick={() => setPanel(i)} aria-expanded={abierto} className={`${TOQUE} absolute inset-0 z-10 flex items-center lg:items-end justify-between lg:justify-center px-5 lg:px-0 lg:pb-8 ${abierto ? "pointer-events-none opacity-0" : ""}`}>
                      <span className={`${SERIFA} italic text-2xl lg:[writing-mode:vertical-rl] lg:rotate-180 whitespace-nowrap`}>{p.titulo}</span>
                      <span className="text-xl font-light lg:hidden" aria-hidden>+</span>
                    </button>

                    {/* Panel abierto */}
                    <div className={`absolute inset-x-0 bottom-0 p-5 sm:p-8 transition-opacity duration-500 ${abierto ? "opacity-100 delay-200" : "opacity-0 pointer-events-none"}`}>
                      <p className={`${ETIQUETA} text-white/80`}>{p.meta}</p>
                      <h3 className={`${SERIFA} italic mt-2 text-5xl sm:text-6xl leading-[0.95]`}>{p.titulo}</h3>
                      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/85">{p.texto}</p>
                      <button type="button" onClick={() => elegirPlan(p.sugerencia)} tabIndex={abierto ? 0 : -1} className={`${BOTON_RAYA} mt-6 h-12 px-5 border-white text-white hover:bg-white hover:text-[#1B2541]`}>
                        Añadir a mi plan <span className="text-base leading-none" aria-hidden>+</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 5. Valores en cursiva, como el testimonio de White Desert ── */}
          <section className="relative px-5 sm:px-8 py-16 sm:py-24 border-t border-[#1B2541]/10" aria-label="Nuestros valores">
            <Rayas color="border-[#1B2541]/[0.07]" />
            <div className="relative max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 text-center">
              {VALORES.map((v, i) => (
                <div key={v.titulo} className={`md:px-8 ${i ? "md:border-l border-[#1B2541]/15" : ""}`}>
                  <p className={`${SERIFA} italic text-4xl`}>{v.titulo}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#1B2541]/75">{v.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 6. La provincia: foto a pantalla completa con título gigante y ficha ── */}
          <section className="relative min-h-[100svh] overflow-hidden bg-[#1B2541] text-white flex flex-col">
            <img src="/leon/puente-luna.webp" alt="Puente de Barrios de Luna" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1B2541]/55 via-transparent to-[#1B2541]/40" />
            <Rayas />
            <h2 className={`${SERIFA} relative pt-16 sm:pt-20 px-4 text-center text-[17vw] lg:text-[11vw] uppercase leading-[0.85]`}>La provincia</h2>

            {/* Ficha blanca con coordenadas */}
            <div className="relative mt-auto m-4 sm:m-8 lg:ml-auto lg:mr-16 lg:mb-16 max-w-sm bg-white text-[#1B2541] p-6 sm:p-7">
              <p className={`${ETIQUETA} tabular-nums text-[#1B2541]/60`}>[ 42° 35′ 55″ N · 5° 34′ 02″ O ]</p>
              <h3 className={`${SERIFA} italic mt-3 text-4xl leading-none`}>Despensa de León</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#1B2541]/80">¿Una morcilla buena y pan de leña cerca? Te decimos dónde comprarlo en toda la provincia.</p>
              <Link href="/despensa" className={`${BOTON_RAYA} mt-6 w-full h-12 border-[#1B2541] hover:bg-[#1B2541] hover:text-white`}>Descubrir <span aria-hidden>→</span></Link>
            </div>
          </section>

          {/* ── 7. Cazurronics Choices ── */}
          <section className="relative px-5 sm:px-8 pt-16 sm:pt-24 pb-12" aria-labelledby="cz-choices-titulo">
            <Rayas color="border-[#1B2541]/[0.07]" />
            <div className="relative max-w-6xl mx-auto">
              <div className="text-center">
                <Etiqueta>Locales destacados</Etiqueta>
                <h2 id="cz-choices-titulo" className={`${SERIFA} mt-4 text-5xl sm:text-7xl uppercase leading-none`}>Cazurronics Choices</h2>
                <p className="mt-5 text-[15px] text-[#1B2541]/75">Los locales de León que destacamos en la web y en nuestras redes.</p>
              </div>

              <div className={`mt-10 ${CAZURRONICS_CHOICES.length >= 3 ? "-mx-5 px-5 flex gap-3 overflow-x-auto no-scrollbar snap-x scroll-px-5 pb-2" : "grid grid-cols-3 gap-3 sm:gap-6"}`}>
                {(CAZURRONICS_CHOICES.length ? [...CAZURRONICS_CHOICES, null] : [null, null, null]).map((local, i) => {
                  // Hueco libre → abre el formulario de negocios; local con web → enlace
                  const Tag = local ? (local.url ? "a" : "div") : "button";
                  return (
                    <Tag
                      key={local?.nombre ?? `libre-${i}`}
                      {...(local?.url ? { href: local.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                      {...(!local ? { type: "button", onClick: abrirNegocios, "aria-label": "Tu local aquí: pide información para salir en Cazurronics Choices" } : {})}
                      className={`${CAZURRONICS_CHOICES.length >= 3 ? "shrink-0 snap-start w-[calc((100%-1.5rem)/3)]" : "w-full"} ${TOQUE} group relative block aspect-[3/4] cursor-pointer overflow-hidden ${local ? "bg-[#1B2541]" : "border border-dashed border-[#1B2541]/30 hover:border-[#E2572B]"}`}
                    >
                      {local?.foto && <img src={local.foto} alt={local.nombre} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />}
                      {local ? (
                        <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-[#1B2541]/85 to-transparent text-left">
                          <p className={`${SERIFA} italic text-xl text-white leading-tight line-clamp-2`}>{local.nombre}</p>
                          {local.categoria && <p className={`${ETIQUETA} text-[9px] text-white/80 mt-1 truncate`}>{local.categoria}{local.zona ? ` · ${local.zona}` : ""}</p>}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                          <span className={`${GIGANTE} text-5xl sm:text-7xl text-[#1B2541]/15 group-hover:text-[#E2572B] transition-colors`}>{String(i + 1).padStart(2, "0")}</span>
                          <span className={`${ETIQUETA} text-[9px] sm:text-[11px]`}>Tu local aquí</span>
                        </div>
                      )}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── 8. Negocios ── */}
          <section className="relative px-5 sm:px-8 pb-16">
            <div className="relative max-w-6xl mx-auto border-t border-b border-[#1B2541]/15 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="min-w-0">
                <p className={`${SERIFA} italic text-3xl leading-tight`}>¿Tienes un negocio en León?</p>
                <p className="text-[15px] text-[#1B2541]/75 mt-1">Sal en Cazurronics Choices y en nuestras redes.</p>
              </div>
              <BusinessModal />
            </div>
          </section>

          {/* ── 9. Pie: enlaces (ayudan a que Google encuentre la web) y nombre gigante ── */}
          <footer className="relative bg-[#1B2541] text-white overflow-hidden pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0">
            <Rayas color="border-white/10" />
            <nav aria-label="Más de León" className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-14 grid grid-cols-2 sm:grid-cols-4 gap-px">
              {[["/agenda-leon", "Agenda de León"], ["/que-hacer-en-leon", "Qué hacer en León"], ["/donde-comer-en-leon", "Dónde comer en León"], ["/despensa", "Despensa de León"]].map(([href, texto]) => (
                <Link key={href} href={href} className={`${TOQUE} ${ETIQUETA} py-4 border-t border-white/20 hover:text-[#E2572B]`}>{texto} →</Link>
              ))}
            </nav>
            <p className="relative max-w-6xl mx-auto px-5 sm:px-8 mt-6 text-[10px] text-white/50">Fotos: José Lodos Benavente (CC0, Wikimedia Commons)</p>
            <p className={`${GIGANTE} relative mt-8 text-center text-[17.4vw] leading-[0.75] translate-y-[8%] text-white/95 whitespace-nowrap`} aria-hidden>Cazurronics</p>
          </footer>
        </div>
      )}
    </main>
  );
}
