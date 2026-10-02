import { GLASS } from "../../lib/estilos";

const ICONOS = { concierto: "🎶", teatro: "🎭", exposicion: "🖼️", mercado: "🧺", fiesta: "🎉", deporte: "⚽", infantil: "🧸", gastronomia: "🍷" };
export const iconoEvento = (c) => ICONOS[String(c || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")] || "📍";
export const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export default function TarjetaEvento({ e }) {
  return (
    <article className={`${GLASS} rounded-[1.5rem] p-4 flex gap-3`}>
      <span className="w-11 h-11 shrink-0 rounded-xl bg-white/80 ring-1 ring-slate-900/5 flex items-center justify-center text-xl">{iconoEvento(e.categoria)}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900 leading-snug">{e.titulo}</h3>
        <p className="text-sm text-slate-600 mt-0.5">{[e.hora, e.lugar, e.localidad].filter(Boolean).join(" · ")}</p>
        {e.descripcion && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{e.descripcion}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {e.precio && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100 rounded-full px-2.5 py-1">{e.precio}</span>}
          {e.fuente && <a href={e.fuente} target="_blank" rel="noopener noreferrer nofollow" className="text-xs font-medium text-slate-500 hover:text-rose-600 underline underline-offset-2">Ver fuente</a>}
        </div>
      </div>
    </article>
  );
}
