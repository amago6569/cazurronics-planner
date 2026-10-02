"use client";
// Página de un plan compartido (/plan/ID) — ideas 1 y 2.
// Cualquiera con el enlace ve el plan, el mapa y puede votar cada parada para decidir en grupo.
// Los votos se refrescan solos cada pocos segundos.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Fondo from "./Fondo";
import Valorar from "./Valorar";
import TarjetaEvento from "./TarjetaEvento";
import { GLASS, PRESS, BOTON_OSCURO, BOTON_CTA, TITULO_GRADIENTE } from "../../lib/estilos";
import { baliza, compartirPlan, idVotante, registrarVisita } from "../../lib/cliente";

const MapSelectorDynamic = dynamic(() => import("./MapSelector"), { ssr: false });
const nada = () => {};
const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export default function PlanCompartido({ inicial }) {
  const [plan, setPlan] = useState(inicial);
  const [votos, setVotos] = useState({ porParada: inicial.itinerario.map(() => ({ arriba: 0, abajo: 0 })), mios: inicial.itinerario.map(() => 0), participantes: 0 });
  const [abierta, setAbierta] = useState(null);
  const [aviso, setAviso] = useState("");
  const [valorar, setValorar] = useState(false);

  // Visita + votos en "directo" (cada 8 s mientras la pestaña está visible)
  useEffect(() => {
    registrarVisita();
    baliza("abre_compartido");
    const votante = idVotante();
    let vivo = true;
    const cargar = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/planes/${inicial.id}?votante=${votante}`, { cache: "no-store" });
        const d = await r.json();
        if (vivo && d.exito) { setVotos(d.votos); setPlan(d.plan); }
      } catch {}
    };
    cargar();
    const t = setInterval(cargar, 8000);
    return () => { vivo = false; clearInterval(t); };
  }, [inicial.id]);

  // Si la fecha del plan ya pasó, preguntamos qué tal (una vez por persona)
  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    let yaValorado = false;
    try { yaValorado = (JSON.parse(localStorage.getItem("cz-planes") || "[]").find((p) => p.id === inicial.id) || {}).valorado; } catch {}
    if (inicial.fecha >= hoy || yaValorado) return;
    // (en el siguiente fotograma: localStorage solo existe en el navegador)
    const t = requestAnimationFrame(() => setValorar(true));
    return () => cancelAnimationFrame(t);
  }, [inicial.id, inicial.fecha]);

  const votar = async (indice, voto) => {
    const nuevo = votos.mios[indice] === voto ? 0 : voto; // pulsar otra vez = quitar el voto
    // respuesta inmediata en pantalla; el servidor confirma después
    setVotos((v) => {
      const porParada = v.porParada.map((p) => ({ ...p }));
      const antes = v.mios[indice];
      if (antes === 1) porParada[indice].arriba--; if (antes === -1) porParada[indice].abajo--;
      if (nuevo === 1) porParada[indice].arriba++; if (nuevo === -1) porParada[indice].abajo++;
      const mios = [...v.mios]; mios[indice] = nuevo;
      return { ...v, porParada, mios };
    });
    try {
      const r = await fetch(`/api/planes/${plan.id}/votar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indice, voto: nuevo, votante: idVotante() }),
      });
      const d = await r.json();
      if (d.exito) setVotos(d.votos);
    } catch {}
  };

  const compartir = async () => {
    const r = await compartirPlan(plan.id, "Vota las paradas de nuestro plan en León 🦁");
    if (r === "copiado") { setAviso("Enlace copiado. ¡Pásalo al grupo!"); setTimeout(() => setAviso(""), 2500); }
  };

  const abrir = (i) => { setAbierta(i); baliza("detalle", { lugarId: plan.itinerario[i]?.lugarId }); };
  const parada = abierta !== null ? plan.itinerario[abierta] : null;

  // La parada con más apoyo neto del grupo
  const netos = votos.porParada.map((p) => p.arriba - p.abajo);
  const maxNeto = Math.max(...netos);
  const favorita = maxNeto > 0 ? netos.indexOf(maxNeto) : -1;

  return (
    <main className="min-h-[100dvh] px-4 pt-4 pb-16 sm:px-6 sm:pt-6 text-slate-800 antialiased">
      <Fondo />
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 sm:gap-5">

        {/* Barra superior */}
        <header className={`${GLASS} sticky top-3 z-50 rounded-full pl-4 pr-2 py-2 flex items-center justify-between gap-2 cz-up`}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">🦁</span>
            <span className="min-w-0">
              <span className={`block text-base sm:text-lg font-bold tracking-tight leading-none ${TITULO_GRADIENTE}`}>Plan en {plan.zona || "León"}</span>
              <span className="block text-[11px] sm:text-xs font-medium text-slate-500 mt-1 truncate first-letter:uppercase">{fechaCorta(plan.fecha)} · {plan.itinerario.length} paradas</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={compartir} className={`${BOTON_OSCURO} px-3.5`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
              <span className="hidden sm:inline">Compartir</span>
            </button>
          </div>
        </header>

        {aviso && <div className="cz-fade fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg">{aviso}</div>}

        {/* Decidir en grupo */}
        <section className={`${GLASS} rounded-[2rem] p-5 flex flex-col sm:flex-row sm:items-center gap-4 cz-up`} style={{ animationDelay: "60ms" }}>
          <div className="flex -space-x-2 shrink-0" aria-hidden>
            {["🦁", "🐻", "🦊"].map((e, i) => <span key={e} className="w-11 h-11 rounded-full bg-white ring-2 ring-white shadow-sm flex items-center justify-center text-xl" style={{ zIndex: 3 - i }}>{e}</span>)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-slate-900">Decidid en grupo</p>
            <p className="text-sm text-slate-600 leading-snug">Vota 👍 o 👎 en cada parada. Los votos de todos los que tienen el enlace se ven aquí al momento.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-sm font-semibold text-slate-700 bg-white/70 ring-1 ring-slate-900/5 rounded-full px-3.5 h-10">
            <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" /></span>
            {votos.participantes} {votos.participantes === 1 ? "persona ha votado" : "personas han votado"}
          </div>
        </section>

        {valorar && <Valorar plan={{ id: plan.id, fecha: plan.fecha, paradas: plan.itinerario.map((p) => ({ titulo: p.titulo, hora: p.hora, foto: p.fotoOficial })) }} onCerrar={() => setValorar(false)} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          <div className={`${GLASS} lg:col-span-8 rounded-[2rem] p-2.5 cz-up`} style={{ animationDelay: "120ms" }}>
            <MapSelectorDynamic radiusKm={plan.radio || 15} setRadiusKm={nada} center={plan.centro || [42.5987, -5.5671]} setCenter={nada} itinerario={plan.itinerario} />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5">
            {plan.prevision && (
              <div className={`${GLASS} rounded-[2rem] p-5 flex items-start gap-4 cz-up`} style={{ animationDelay: "160ms" }}>
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-2xl shadow-[0_8px_20px_-6px_rgba(14,165,233,0.6)]">🌤️</div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-600 mb-1">Previsión</p>
                  <p className="text-[15px] font-medium text-slate-700 leading-snug">{plan.prevision}</p>
                </div>
              </div>
            )}
            {plan.apetece && (
              <div className={`${GLASS} rounded-[2rem] p-5 flex-1 cz-up`} style={{ animationDelay: "200ms" }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500 mb-1.5">Lo que pidió</p>
                <p className="text-[15px] text-slate-700 leading-relaxed">“{plan.apetece}”</p>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 px-1 pt-1">La ruta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {plan.itinerario.map((p, i) => {
            const v = votos.porParada[i] || { arriba: 0, abajo: 0 };
            const mio = votos.mios[i] || 0;
            return (
              <article key={`${i}-${p.titulo}`} className={`${GLASS} cz-up group rounded-[2rem] p-2 flex flex-col transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1.5 hover:bg-white/70 ${favorita === i ? "ring-2 ring-amber-300" : ""}`} style={{ animationDelay: `${240 + i * 70}ms` }}>
                <button onClick={() => abrir(i)} className="text-left outline-none focus-visible:ring-4 focus-visible:ring-rose-300/60 rounded-[1.6rem]">
                  <div className="h-44 sm:h-48 w-full rounded-[1.6rem] bg-slate-100 relative overflow-hidden">
                    <img src={p.fotoOficial} alt={p.titulo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center ring-[3px] ring-white">{i + 1}</span>
                    <span className="absolute top-3 right-3 bg-white/85 backdrop-blur-md text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full">{p.hora}</span>
                    {favorita === i && <span className="absolute bottom-3 left-3 bg-amber-300 text-amber-950 text-xs font-bold px-3 py-1.5 rounded-full shadow">⭐ Favorita del grupo</span>}
                  </div>
                  <div className="px-3 pt-3.5">
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 leading-snug">{p.titulo}</h3>
                    <p className="text-slate-600 text-sm mt-1 line-clamp-2 leading-relaxed">{p.descripcion}</p>
                  </div>
                </button>
                <div className="px-3 pb-2 pt-3 mt-auto flex items-center gap-2">
                  <button onClick={() => votar(i, 1)} aria-pressed={mio === 1} aria-label="Me gusta esta parada" className={`${PRESS} flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ring-1 ${mio === 1 ? "bg-emerald-500 text-white ring-emerald-500 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.7)]" : "bg-white/80 text-slate-700 ring-slate-900/10 hover:ring-emerald-300"}`}>
                    <span key={`a${mio}`} className={mio === 1 ? "cz-pop" : ""}>👍</span> {v.arriba}
                  </button>
                  <button onClick={() => votar(i, -1)} aria-pressed={mio === -1} aria-label="No me convence esta parada" className={`${PRESS} flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ring-1 ${mio === -1 ? "bg-rose-500 text-white ring-rose-500 shadow-[0_6px_16px_-6px_rgba(244,63,94,0.7)]" : "bg-white/80 text-slate-700 ring-slate-900/10 hover:ring-rose-300"}`}>
                    <span key={`b${mio}`} className={mio === -1 ? "cz-pop" : ""}>👎</span> {v.abajo}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {(plan.masEseDia || []).length > 0 && (
            <section className="pt-2" aria-labelledby="cz-mas-titulo">
              <div className="flex items-end justify-between px-1 mb-3">
                <h3 id="cz-mas-titulo" className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Más cosas ese día</h3>
                <span className="hidden sm:inline text-xs font-medium text-slate-500">Eventos, mercadillos y ferias encontrados</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(plan.masEseDia || []).map((e, i) => <TarjetaEvento key={`${i}-${e.titulo}`} e={e} />)}
              </div>
            </section>
          )}

        {/* Bucle viral: quien recibe el enlace se monta el suyo */}
        <section className={`${GLASS} rounded-[2.25rem] p-6 sm:p-8 text-center relative overflow-hidden cz-up mt-2`}>
          <img src="/roseton.png" alt="" aria-hidden className="pointer-events-none absolute -right-16 -bottom-16 w-56 h-56 object-cover rounded-full opacity-20" />
          <p className="relative text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">¿Y tu plan, <span className={TITULO_GRADIENTE}>cazurro</span>?</p>
          <p className="relative text-slate-600 mt-2 mb-5">Dime qué te apetece y te monto el tuyo en menos de un minuto. Gratis.</p>
          <Link href="/?ref=plan-compartido" className={`${BOTON_CTA} relative`}>✨ Crear mi plan</Link>
        </section>
      </div>

      {/* Ficha de la parada */}
      {parada && (
        <div className="cz-fade fixed inset-0 bg-slate-900/35 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={() => setAbierta(null)}>
          <div role="dialog" aria-modal="true" className="cz-sheet bg-white/90 backdrop-blur-2xl border border-white/80 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto no-scrollbar rounded-t-[2rem] sm:rounded-[2rem] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7 shadow-[0_-10px_60px_-10px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div aria-hidden className="sm:hidden mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="flex justify-between items-start gap-3 mb-4">
              <div>
                <span className="inline-block bg-gradient-to-r from-rose-100 to-orange-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-2">Parada {abierta + 1} · {parada.hora}</span>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">{parada.titulo}</h2>
              </div>
              <button onClick={() => setAbierta(null)} aria-label="Cerrar" className={`${PRESS} shrink-0 w-11 h-11 rounded-full bg-slate-900/5 text-slate-500 flex items-center justify-center hover:bg-slate-900/10`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <img src={parada.fotoOficial} alt={parada.titulo} className="w-full h-48 object-cover rounded-[1.5rem] mb-4" />
            <p className="text-slate-600 text-[15px] leading-relaxed mb-4">{parada.descripcion}</p>
            {parada.fuente && /^https?:\/\//.test(parada.fuente) && (
                  <a href={parada.fuente} target="_blank" rel="noopener noreferrer" className="-mt-2 mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500 hover:underline">🎟️ Ver la fuente del evento</a>
                )}
            <div className="grid gap-2 mb-4">
              {[["💶", "Precio", parada.precio], ["🕒", "Horario", parada.horario], ["🚶", "Cómo llegar", parada.transporte], ["⭐", "Reseñas", parada.resenas]].filter(([, , v]) => v).map(([ic, et, val]) => (
                <div key={et} className="flex items-center gap-3 bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center">{ic}</span>
                  <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{et}</p><p className="text-sm font-medium text-slate-800">{val}</p></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {parada.telefono && parada.telefono !== "No disponible" ? (
                <a href={`tel:${parada.telefono}`} onClick={() => baliza("llamar", { lugarId: parada.lugarId })} className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold rounded-2xl`}>📞 Llamar</a>
              ) : <span className="h-12 flex items-center justify-center bg-slate-900/5 text-slate-400 font-semibold rounded-2xl">📞 Sin teléfono</span>}
              {parada.web && parada.web !== "No disponible" ? (
                <a href={parada.web} target="_blank" rel="noopener noreferrer" onClick={() => baliza("web", { lugarId: parada.lugarId })} className={`${PRESS} h-12 flex items-center justify-center gap-2 bg-white text-rose-500 font-semibold rounded-2xl ring-1 ring-rose-200`}>🌐 Web</a>
              ) : <span className="h-12 flex items-center justify-center bg-slate-900/5 text-slate-400 font-semibold rounded-2xl">🌐 Sin web</span>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
