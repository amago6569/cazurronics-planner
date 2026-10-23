"use client";
// Bloque del panel: cómo va el catálogo de la Despensa y cuánto se ha gastado en Google Places este mes
import { useState } from "react";
import { GLASS, PRESS } from "../../lib/estilos";
import { productoPorId } from "../../lib/despensaProductos";
import { zonaPorId } from "../../lib/zonas";

export default function PanelDespensa({ clave, despensa, alTerminar }) {
  const [barriendo, setBarriendo] = useState(false);
  const [barriendoG, setBarriendoG] = useState(false);
  const [aviso, setAviso] = useState("");
  if (!despensa) return null;
  const { hechas, total, tiendas, places, ultimo, peticiones, google, mercadillos } = despensa;

  const lanzar = async (accion, setOcupado) => {
    setOcupado(true); setAviso("");
    try {
      const r = await fetch("/api/panel", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ accion }) });
      const d = await r.json().catch(() => null);
      setAviso(d?.informe?.saltado || d?.informe?.error || (d?.exito ? "" : d?.mensaje || "No se pudo lanzar"));
      await alTerminar?.();
    } finally { setOcupado(false); }
  };
  const barrer = () => lanzar("despensa", setBarriendo);
  const barrerG = () => lanzar("despensa-tiendas", setBarriendoG);

  return (
    <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-slate-900">🧺 Despensa de León</h2>
          <p className="text-xs text-slate-500">Cada noche la IA busca tiendas de 6 combinaciones de producto y comarca. Cada consulta de la gente cuesta 0 €.</p>
        </div>
        <button onClick={barrer} disabled={barriendo} className={`${PRESS} h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60`}>{barriendo ? "Buscando… (1 min)" : "Buscar 6 más ahora"}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[["Combinaciones hechas", `${hechas} / ${total}`], ["Tiendas publicadas", tiendas], ["Google con nota este mes", `${places.usadas} / ${places.tope}`], ["Google sin nota este mes", `${places.usadasPro ?? 0} / ${places.topePro ?? 0}`]].map(([k, v]) => (
          <div key={k} className="bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3">
            <p className="text-xl font-bold tabular-nums text-slate-900">{v}</p>
            <p className="text-[11px] text-slate-500 leading-snug">{k}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2.5">Google regala 1.000 comprobaciones con nota y 5.000 sin nota al mes. Si ya no quedase ninguna gratis, lo de este mes costaría como mucho {places.peorCasoDolares.toFixed(2)} $. Al llegar a los dos topes, se para hasta el mes siguiente.</p>
      {aviso && <p className="text-sm font-semibold text-amber-700 mt-2">{aviso}</p>}
      {google && (
        <div className="mt-3 bg-white/60 ring-1 ring-slate-900/5 rounded-2xl p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">🗺️ Todas las tiendas de la provincia (Google Maps)</p>
              <p className="text-xs text-slate-500">Cuadrícula a cuadrícula, dos pasadas cada noche, y los mercadillos de una comarca. Se renueva cada 30 días.</p>
            </div>
            <button onClick={barrerG} disabled={barriendoG} className={`${PRESS} h-9 px-3.5 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-800 text-sm font-semibold disabled:opacity-60`}>{barriendoG ? "Barriendo… (1 min)" : "Barrer tiendas ahora"}</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {[["Tiendas", `${google.tiendas} (${google.conNota} con nota)`], ["Búsquedas pendientes", `${google.pendientes}`], ["Google con nota este mes", `${google.google.conNota} / ${google.google.topeNota}`], ["Google sin nota este mes", `${google.google.sinNota} / ${google.google.tope}`]].map(([k, v]) => (
              <div key={k} className="bg-white/70 ring-1 ring-slate-900/5 rounded-xl p-2.5">
                <p className="text-base font-bold tabular-nums text-slate-900">{v}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{k}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Google regala 1.000 búsquedas con nota y 5.000 sin nota al mes. Si no regalase ninguna, lo de este mes costaría como mucho {google.google.peorCasoDolares.toFixed(2)} $.{mercadillos ? ` Mercadillos: ${mercadillos.total} en ${mercadillos.comarcas} de ${mercadillos.de} comarcas.` : ""}</p>
          {google.porCategoria?.some((c) => c.n) && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {google.porCategoria.map((c) => <li key={c.id} className="h-7 px-2.5 inline-flex items-center rounded-full text-xs font-medium bg-slate-100 text-slate-700">{c.nombre} · {c.n}</li>)}
            </ul>
          )}
          {google.ultimo && (
            <p className="text-xs text-slate-500 mt-2">
              Última pasada · {new Date(google.ultimo.fin).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: {google.ultimo.nada || `${google.ultimo.tareas} búsquedas, ${google.ultimo.llamadas} llamadas, ${google.ultimo.tiendas} tiendas${google.ultimo.fuera ? `, ${google.ultimo.fuera} cuadrículas fuera de la provincia` : ""}`}
              {google.ultimo.sinCupo && <span className="text-amber-700"> · parada por tope o bloqueo de Google</span>}
              {google.ultimo.error && <span className="text-rose-600"> · error: {google.ultimo.error}</span>}
            </p>
          )}
        </div>
      )}
      {peticiones && (
        <div className="mt-3 bg-white/60 ring-1 ring-slate-900/5 rounded-2xl p-3">
          <p className="text-sm font-semibold text-slate-800">🔎 Lo que pide la gente</p>
          <p className="text-xs text-slate-500">{peticiones.busquedas} búsquedas escritas. Lo que no teníamos se busca por la noche ({peticiones.pendientes} en cola).</p>
          {peticiones.ultimas?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {peticiones.ultimas.map((p, i) => (
                <li key={i} className={`h-7 px-2.5 inline-flex items-center rounded-full text-xs font-medium ${p.hecha ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{p.texto} · {zonaPorId(p.zona)?.corto}{p.hecha ? " ✓" : ""}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {ultimo?.combinaciones?.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Última pasada · {new Date(ultimo.fin).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</summary>
          <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
            {ultimo.combinaciones.map((c, i) => (
              <li key={i}>
                {c.peticion ? `🔎 «${c.peticion}»` : `${productoPorId(c.producto)?.emoji} ${productoPorId(c.producto)?.nombre}`} · {zonaPorId(c.zona)?.corto}:{" "}
                {c.error ? <span className="text-rose-600">error ({c.error})</span> : c.sinCupo ? <span className="text-amber-700">sin cupo de Google este mes</span> : <span>{c.guardadas} de {c.encontradas} comprobadas</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
