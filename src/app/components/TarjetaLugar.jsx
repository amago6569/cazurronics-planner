import { GLASS } from "../../lib/estilos";

export default function TarjetaLugar({ l, posicion }) {
  const valoradas = (l.stats?.bien || 0) + (l.stats?.mal || 0);
  return (
    <article className={`${GLASS} rounded-[1.75rem] p-2 flex flex-col`}>
      <div className="h-36 rounded-[1.4rem] overflow-hidden relative bg-slate-100">
        {l.foto && <img src={l.foto} alt={l.nombre} loading="lazy" className="w-full h-full object-cover" />}
        <span className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center ring-2 ring-white">{posicion}</span>
      </div>
      <div className="px-2.5 pt-3 pb-2">
        <h3 className="font-semibold text-slate-900 leading-snug">{l.nombre}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {[l.tipo, l.precio, l.resenas && `⭐ ${l.resenas}`].filter(Boolean).join(" · ")}
        </p>
        {valoradas > 0 && <p className="text-xs font-semibold text-emerald-700 mt-1.5">😍 {Math.round((l.stats.bien / valoradas) * 100)} % de quienes fueron lo recomiendan</p>}
      </div>
    </article>
  );
}
