"use client";
// La ficha que sale al tocar un empleado (en la oficina 3D o en la lista): su último turno y tus órdenes.
import { PRESS } from "../../../lib/estilos";
import { ESTADOS, fmt, hace } from "./monigotes";
import Ordenes from "./ordenes";

// La ficha que sale al tocar un monigote
export function FichaEmpleado({ e, jefe, alCerrar, clave, alTerminar }) {
  if (!e) return null;
  const est = ESTADOS[e.estado] || ESTADOS.ok;
  const p = e.parte;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={alCerrar}>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] cz-fade" />
      <div onClick={(ev) => ev.stopPropagation()} className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[2rem] bg-white/90 backdrop-blur-2xl ring-1 ring-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] cz-sheet">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" />
        {e.jefe ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">👔 El jefe</p>
            <ul className="mt-2 space-y-1.5 text-[15px] leading-snug text-slate-700">{jefe.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="text-4xl leading-none">{e.emoji}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">{e.nombre}</h3>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${est.pill}`}><i className={`w-1.5 h-1.5 rounded-full ${est.punto}`} />{est.texto}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-3">{e.puesto}</p>
            {p?.busquedas != null ? (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[["Encontrados", p.eventos], ["Sin fuente", p.descartados], ["Búsquedas", p.busquedas]].map(([t, n]) => (
                  <div key={t} className="rounded-2xl bg-slate-50 ring-1 ring-slate-900/5 p-3 text-center"><p className="text-xl font-bold tabular-nums text-slate-900">{fmt(n)}</p><p className="text-[11px] text-slate-500">{t}</p></div>
                ))}
              </div>
            ) : p?.texto && <p className="mt-3 text-sm font-semibold text-slate-800">{p.texto}</p>}
            {p?.error && <p className="mt-3 text-xs text-rose-600">{p.error}</p>}
            {e.rinde?.busquedas > 0 && (
              <p className="mt-3 text-xs text-slate-600 bg-slate-50 ring-1 ring-slate-900/5 rounded-xl px-3 py-2">
                📈 Últimos {e.rinde.dias} {e.rinde.dias === 1 ? "día" : "días"}: {fmt(e.rinde.busquedas)} búsquedas y <b>{fmt(e.rinde.nuevos)} eventos nuevos</b>
                {e.rinde.porBusqueda != null ? ` (${String(e.rinde.porBusqueda).replace(".", ",")} por búsqueda)` : ""}.
              </p>
            )}
            <p className="text-xs text-slate-400 mt-4">🕒 {e.horario} · último turno {hace(p?.fin)}</p>
            {e.ordenes && <Ordenes key={e.id} e={e} clave={clave} alTerminar={alTerminar} />}
          </>
        )}
        <button onClick={alCerrar} className={`${PRESS} mt-5 w-full h-12 rounded-full bg-slate-900 text-white font-semibold`}>Cerrar</button>
      </div>
    </div>
  );
}
