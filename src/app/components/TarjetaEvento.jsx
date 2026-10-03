import { GLASS } from "../../lib/estilos";
import { cuandoEs, esDeVariosDias, familia, leerHora } from "../../lib/agenda";

const ICONOS = { mercado: "🧺", musica: "🎶", expo: "🖼️", escena: "🎭", fiesta: "🎉", feria: "🎪", visita: "🚶", deporte: "⚽", gastro: "🍷", infantil: "🧸" };
export const iconoEvento = (e) => ICONOS[familia(typeof e === "string" ? { categoria: e } : e)] || "📍";
export const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

// Fila de agenda: la hora a la izquierda (se lee como un horario) y el resto a la derecha
export default function TarjetaEvento({ e, mostrarCuando = false }) {
  const h = leerHora(e.hora);
  const [inicio, fin] = (h.texto || "").split("–");
  const cuando = mostrarCuando && esDeVariosDias(e) ? cuandoEs(e) : null;
  return (
    <article className={`${GLASS} rounded-[1.25rem] p-3 flex gap-3 items-start`}>
      <div className="w-[4.25rem] shrink-0 rounded-xl bg-white/80 ring-1 ring-slate-900/5 py-2 text-center">
        <div className="text-lg leading-none">{iconoEvento(e)}</div>
        {inicio ? (
          <div className="mt-1 text-[13px] font-bold text-slate-900 tabular-nums leading-tight">
            {inicio}{fin && <span className="block text-[11px] font-medium text-slate-500">a {fin}</span>}
          </div>
        ) : (
          <div className="mt-1 text-[10px] font-semibold text-slate-500 leading-tight">{h.franja === "todo" ? "Todo el día" : "Sin hora"}</div>
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="font-semibold text-slate-900 leading-snug">{e.titulo}</h3>
        {(e.lugar || e.localidad) && <p className="text-sm text-slate-600 mt-0.5 truncate">{[e.lugar, e.localidad].filter(Boolean).join(" · ")}</p>}
        {e.descripcion && <p className="text-[13px] text-slate-500 mt-1 line-clamp-2">{e.descripcion}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {cuando && <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-100 rounded-full px-2.5 py-1">{cuando}</span>}
          {e.precio && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100 rounded-full px-2.5 py-1">{e.precio}</span>}
          {e.fuente && <a href={e.fuente} target="_blank" rel="noopener noreferrer nofollow" className="text-xs font-medium text-slate-500 hover:text-rose-600 underline underline-offset-2">Ver fuente</a>}
        </div>
      </div>
    </article>
  );
}
