"use client";
// Bloque del panel: cómo va el catálogo de la Despensa y cuánto se ha gastado en Google Places este mes
import { useState } from "react";
import { GLASS, PRESS } from "../../lib/estilos";
import { productoPorId } from "../../lib/despensaProductos";
import { zonaPorId } from "../../lib/zonas";

export default function PanelDespensa({ clave, despensa, alTerminar }) {
  const [barriendo, setBarriendo] = useState(false);
  const [aviso, setAviso] = useState("");
  if (!despensa) return null;
  const { hechas, total, tiendas, places, ultimo } = despensa;

  const barrer = async () => {
    setBarriendo(true); setAviso("");
    try {
      const r = await fetch("/api/panel", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ accion: "despensa" }) });
      const d = await r.json().catch(() => null);
      setAviso(d?.informe?.saltado || (d?.exito ? "" : d?.mensaje || "No se pudo lanzar"));
      await alTerminar?.();
    } finally { setBarriendo(false); }
  };

  return (
    <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-slate-900">🧺 Despensa de León</h2>
          <p className="text-xs text-slate-500">Cada noche la IA busca tiendas de 6 combinaciones de producto y comarca. Cada consulta de la gente cuesta 0 €.</p>
        </div>
        <button onClick={barrer} disabled={barriendo} className={`${PRESS} h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60`}>{barriendo ? "Buscando… (1 min)" : "Buscar 6 más ahora"}</button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[["Combinaciones hechas", `${hechas} / ${total}`], ["Tiendas publicadas", tiendas], ["Google Places este mes", `${places.usadas} / ${places.tope}`]].map(([k, v]) => (
          <div key={k} className="bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3">
            <p className="text-xl font-bold tabular-nums text-slate-900">{v}</p>
            <p className="text-[11px] text-slate-500 leading-snug">{k}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2.5">Google regala 10.000 comprobaciones al mes. Si ya no quedase ninguna gratis, lo de este mes costaría como mucho {places.peorCasoDolares.toFixed(2)} $. Al llegar al tope, se para hasta el mes siguiente.</p>
      {aviso && <p className="text-sm font-semibold text-amber-700 mt-2">{aviso}</p>}
      {ultimo?.combinaciones?.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Última pasada · {new Date(ultimo.fin).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</summary>
          <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
            {ultimo.combinaciones.map((c, i) => (
              <li key={i}>
                {productoPorId(c.producto)?.emoji} {productoPorId(c.producto)?.nombre} · {zonaPorId(c.zona)?.corto}:{" "}
                {c.error ? <span className="text-rose-600">error ({c.error})</span> : c.sinCupo ? <span className="text-amber-700">sin cupo de Google este mes</span> : <span>{c.guardadas} de {c.encontradas} comprobadas</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
