"use client";
// "¿Fuiste? ¿Qué tal?" (idea 4): aparece cuando la fecha de un plan ya ha pasado.
// Cada respuesta alimenta el ranking que usa el planificador y el panel de cada negocio.
import { useState } from "react";
import { GLASS, PRESS } from "../../lib/estilos";
import { idVotante, marcarValorado } from "../../lib/cliente";

const OPCIONES = [
  { valor: "bien", emoji: "😍", texto: "Genial" },
  { valor: "mal", emoji: "😕", texto: "Regular" },
  { valor: "nofui", emoji: "🙈", texto: "No fui" },
];

const fechaBonita = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export default function Valorar({ plan, onCerrar, className = "" }) {
  const [respuestas, setRespuestas] = useState({});
  const terminado = plan.paradas.every((_, i) => respuestas[i]);

  const responder = async (indice, valor) => {
    setRespuestas((r) => ({ ...r, [indice]: valor }));
    try {
      await fetch("/api/valoracion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, indice, valor, votante: idVotante() }),
      });
    } catch {}
    if (plan.paradas.every((_, i) => i === indice || respuestas[i])) marcarValorado(plan.id);
  };

  const cerrar = () => { marcarValorado(plan.id); onCerrar?.(); };

  return (
    <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 relative overflow-hidden cz-up ${className}`} aria-labelledby="cz-valorar-titulo">
      <div aria-hidden className="absolute -top-14 -right-14 w-44 h-44 rounded-full bg-gradient-to-br from-emerald-200/60 via-sky-200/40 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Tu opinión manda</p>
          <h2 id="cz-valorar-titulo" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-snug">¿Qué tal el plan del {fechaBonita(plan.fecha)}?</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Con tu respuesta, los próximos planes salen mejores para todos.</p>
        </div>
        <button onClick={cerrar} aria-label="Ahora no" className={`${PRESS} shrink-0 w-9 h-9 rounded-full bg-slate-900/5 text-slate-500 flex items-center justify-center hover:bg-slate-900/10`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {terminado ? (
        <div className="relative text-center py-4">
          <p className="text-3xl mb-1">🦁</p>
          <p className="font-semibold text-slate-900">¡Gracias, cazurro!</p>
          <p className="text-sm text-slate-500">Lo tendremos en cuenta en los próximos planes.</p>
        </div>
      ) : (
        <ul className="relative space-y-2">
          {plan.paradas.map((p, i) => (
            <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-2.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {p.foto ? <img src={p.foto} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" /> : <span className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.titulo}</p>
                  <p className="text-xs text-slate-500">{p.hora}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 shrink-0">
                {OPCIONES.map((o) => {
                  const elegida = respuestas[i] === o.valor;
                  return (
                    <button
                      key={o.valor}
                      onClick={() => !respuestas[i] && responder(i, o.valor)}
                      disabled={Boolean(respuestas[i])}
                      aria-pressed={elegida}
                      className={`${PRESS} h-10 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 ring-1 ${elegida ? "bg-slate-900 text-white ring-slate-900" : respuestas[i] ? "bg-white/40 text-slate-400 ring-slate-900/5" : "bg-white text-slate-700 ring-slate-900/10 hover:ring-rose-200 hover:-translate-y-0.5"}`}
                    >
                      <span className={elegida ? "cz-pop" : ""}>{o.emoji}</span>{o.texto}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
