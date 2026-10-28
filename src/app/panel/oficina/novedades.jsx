"use client";
// 🆕 Novedades: todo lo que ha entrado en la web en los últimos 7 días (eventos y tiendas), con quién lo encontró.
import { useMemo, useState } from "react";
import { GLASS, PRESS } from "../../../lib/estilos";
import { diaCorto, fmt } from "./monigotes";

const FILTROS = [["todo", "Todo"], ["evento", "📅 Eventos"], ["tienda", "🏪 Tiendas"]];
const diaDe = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

function cuandoDia(dia, hoy, ayer) {
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export default function Novedades({ lista = [], departamentos = [] }) {
  const [filtro, setFiltro] = useState("todo");
  const [cuantas, setCuantas] = useState(30);
  const empleados = useMemo(() => Object.fromEntries(departamentos.flatMap((d) => d.empleados).map((e) => [e.id, e])), [departamentos]);
  const [ahora] = useState(() => Date.now()); // la página se recarga entera al actualizar
  const hoy = diaDe(ahora), ayer = diaDe(ahora - 86400000);
  const deHoy = lista.filter((n) => diaDe(n.cuando) === hoy);
  const visibles = lista.filter((n) => filtro === "todo" || n.tipo === filtro);
  const grupos = [];
  for (const n of visibles.slice(0, cuantas)) {
    const dia = diaDe(n.cuando);
    if (grupos.at(-1)?.dia !== dia) grupos.push({ dia, cosas: [] });
    grupos.at(-1).cosas.push(n);
  }
  const quien = (id) => (id === "bandeja" ? "👔 Tú, desde la bandeja" : empleados[id] ? `${empleados[id].emoji} ${empleados[id].nombre}` : id === "junta" ? "🏛️ Datos de la Junta" : null);

  return (
    <section className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-slate-900 text-lg">🆕 Novedades</h2>
        <p className="text-xs text-slate-500">Últimos 7 días</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[["Hoy", deHoy.length], ["Eventos hoy", deHoy.filter((n) => n.tipo === "evento").length], ["Tiendas hoy", deHoy.filter((n) => n.tipo === "tienda").length]].map(([t, n]) => (
          <div key={t} className="rounded-2xl bg-white/70 ring-1 ring-slate-900/5 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-slate-900">{fmt(n)}</p>
            <p className="text-[11px] text-slate-500">{t}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {FILTROS.map(([id, texto]) => (
          <button key={id} onClick={() => { setFiltro(id); setCuantas(30); }} className={`${PRESS} shrink-0 h-9 px-4 rounded-full text-sm font-semibold ${filtro === id ? "bg-slate-900 text-white" : "bg-white/70 ring-1 ring-slate-900/10 text-slate-600"}`}>{texto}</button>
        ))}
      </div>

      {grupos.length ? (
        <div className="mt-4 space-y-4">
          {grupos.map((g) => (
            <div key={g.dia}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500 mb-2 first-letter:uppercase">{cuandoDia(g.dia, hoy, ayer)}</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {g.cosas.map((n, i) => (
                  <li key={`${n.titulo}${n.cuando}${i}`} className="bg-white/75 ring-1 ring-slate-900/5 rounded-2xl p-3 flex gap-3 cz-fade">
                    <span className="text-2xl leading-none mt-0.5">{n.tipo === "tienda" ? "🏪" : "📅"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 leading-snug">{n.titulo}</p>
                      <p className="text-xs text-slate-500">
                        {n.tipo === "evento"
                          ? [n.fecha && diaCorto(n.fecha), n.lugar, n.localidad].filter(Boolean).join(" · ")
                          : [n.producto, n.localidad].filter(Boolean).join(" · ")}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 mt-1">
                        {quien(n.quien) && <span className="text-[11px] font-semibold text-slate-600">{quien(n.quien)}</span>}
                        {n.fuente && <a href={n.fuente} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-sky-600 hover:underline underline-offset-2">🔗 Fuente</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {visibles.length > cuantas && (
            <button onClick={() => setCuantas((c) => c + 30)} className={`${PRESS} w-full h-11 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold text-slate-700`}>
              Ver {Math.min(30, visibles.length - cuantas)} más de {fmt(visibles.length)}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 mt-4">Aún no ha entrado nada nuevo. En cuanto el equipo encuentre algo, saldrá aquí.</p>
      )}
    </section>
  );
}
