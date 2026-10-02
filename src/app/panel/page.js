"use client";
// /panel — solo para el equipo (clave = variable de entorno PANEL_CLAVE).
// Analítica propia (idea 10), ranking de locales con su enlace privado (idea 6),
// estado del barrido de eventos (idea 3) y el rosetón colectivo de la campaña.
import { useCallback, useEffect, useState } from "react";
import Fondo from "../components/Fondo";
import { GLASS, PRESS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../lib/estilos";

const OBJETIVO_ROSETON = 500; // planes para completar el rosetón de la campaña (24 cristales)
const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);
const pct = (a, b) => (b ? `${Math.round(((a || 0) / b) * 100)} %` : "—");
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

export default function Panel() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [barriendo, setBarriendo] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [encontrados, setEncontrados] = useState(null);

  const buscar = async (e) => {
    e?.preventDefault();
    if (busqueda.trim().length < 2) { setEncontrados(null); return; }
    try {
      const r = await fetch(`/api/panel?buscar=${encodeURIComponent(busqueda.trim())}`, { headers: { "x-clave": clave }, cache: "no-store" });
      const d = await r.json();
      setEncontrados(d.exito ? d.lugares : []);
    } catch { setEncontrados([]); }
  };

  const cargar = useCallback(async (c) => {
    setError("");
    try {
      const r = await fetch("/api/panel", { headers: { "x-clave": c }, cache: "no-store" });
      let d;
      try { d = await r.json(); } catch {
        setError(r.status === 404
          ? "El servidor no tiene el panel (error 404): sube la última versión del código y vuelve a desplegar."
          : `El servidor respondió con un error ${r.status}${r.status === 504 ? " (tardó demasiado)" : ""}. Mira los logs en Vercel → Logs.`);
        setDatos(null); return;
      }
      if (!d.exito) { setError(d.mensaje || `Error ${r.status}`); setDatos(null); return; }
      setDatos(d);
      try { sessionStorage.setItem("cz-panel", c); } catch {}
    } catch { setError("No se pudo conectar"); }
  }, []);

  useEffect(() => {
    let guardada = "";
    try { guardada = sessionStorage.getItem("cz-panel") || ""; } catch {}
    if (!guardada) return;
    const t = requestAnimationFrame(() => { setClave(guardada); cargar(guardada); });
    return () => cancelAnimationFrame(t);
  }, [cargar]);

  const barrer = async () => {
    setBarriendo(true);
    try {
      await fetch("/api/panel", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ accion: "barrido" }) });
      await cargar(clave);
    } finally { setBarriendo(false); }
  };

  const copiarEnlace = async (lugar) => {
    if (!lugar.enlaceNegocio) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/negocio/${lugar.enlaceNegocio}`); setCopiado(lugar.clave); setTimeout(() => setCopiado(""), 2000); } catch {}
  };

  if (!datos) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-4">
        <Fondo />
        <form onSubmit={(e) => { e.preventDefault(); cargar(clave); }} className={`${GLASS} w-full max-w-sm rounded-[2rem] p-6 cz-up`}>
          <p className="text-3xl mb-2">🦁</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Panel del equipo</h1>
          <p className="text-sm text-slate-500 mb-5">Introduce la clave del panel (PANEL_CLAVE).</p>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave" autoFocus className="w-full bg-white/80 border border-white rounded-2xl px-4 h-12 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300 mb-3" />
          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
          <button className={`${BOTON_OSCURO} w-full h-12`}>Entrar</button>
        </form>
      </main>
    );
  }

  const { resumen, lugares, barrido, agenda, almacen } = datos;
  const t = resumen.porDia.reduce((acc, d) => { for (const [k, v] of Object.entries(d)) if (k !== "fecha") acc[k] = (acc[k] || 0) + v; return acc; }, {});
  const planesTotales = resumen.total.plan || 0;
  const progreso = Math.min(planesTotales / OBJETIVO_ROSETON, 1);
  const cristales = Math.floor(progreso * 24);
  const dias = [...resumen.porDia].reverse();
  const maxDia = Math.max(1, ...dias.map((d) => Math.max(d.visita || 0, d.plan || 0)));
  const fuentes = Object.entries(resumen.fuentes).sort((a, b) => b[1] - a[1]);
  const embudo = [
    ["Visitas", t.visita || 0], ["Planes generados", t.plan || 0], ["Planes compartidos", t.compartir || 0], ["Aperturas de enlaces", t.abre_compartido || 0],
  ];

  return (
    <main className="min-h-[100dvh] px-4 py-6 sm:px-6 text-slate-800">
      <Fondo />
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1 cz-up">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Últimos 14 días</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel <span className={TITULO_GRADIENTE}>Cazurronics</span></h1>
          </div>
          <div className="flex items-center gap-2">
            {almacen === "memoria" && <span className="text-xs font-semibold text-amber-800 bg-amber-100 ring-1 ring-amber-200 rounded-full px-3 py-1.5">⚠️ Datos en memoria: conecta Upstash en Vercel</span>}
            <button onClick={() => cargar(clave)} className={`${PRESS} h-10 px-4 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold`}>Actualizar</button>
          </div>
        </header>

        {/* KPIs + rosetón colectivo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          <section className={`${GLASS} lg:col-span-4 rounded-[2rem] p-6 flex flex-col items-center text-center cz-up`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">Rosetón colectivo</p>
            <div className="relative w-44 h-44">
              <div className="absolute inset-0 rounded-full overflow-hidden ring-[5px] ring-white shadow-[0_18px_50px_-12px_rgba(244,63,94,0.5)] bg-white">
                <img src="/roseton.png" alt="" className="absolute inset-0 w-full h-full object-cover grayscale opacity-35" />
                <img src="/roseton.png" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ WebkitMaskImage: `conic-gradient(#000 ${progreso * 360}deg, transparent 0)`, maskImage: `conic-gradient(#000 ${progreso * 360}deg, transparent 0)` }} />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-4 tabular-nums">{cristales} <span className="text-slate-400 text-xl">/ 24 cristales</span></p>
            <p className="text-sm text-slate-500">{fmt(planesTotales)} de {fmt(OBJETIVO_ROSETON)} planes · haz captura para las stories</p>
          </section>

          <section className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              ["Visitas", t.visita, "👀"], ["Planes", t.plan, "🗺️", pct(t.plan, t.visita) + " de las visitas"],
              ["Compartidos", t.compartir, "📤", pct(t.compartir, t.plan) + " de los planes"], ["Vuelven", t.vuelve, "🔁", pct(t.vuelve, t.visita) + " de las visitas"],
              ["Votos en grupo", t.voto, "👍"], ["Valoraciones", t.valoracion, "😍"],
            ].map(([nombre, valor, icono, nota]) => (
              <div key={nombre} className={`${GLASS} rounded-[1.75rem] p-4 cz-up`}>
                <p className="text-sm text-slate-500 flex items-center gap-1.5"><span>{icono}</span>{nombre}</p>
                <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">{fmt(valor)}</p>
                {nota && <p className="text-xs text-slate-500 mt-0.5">{nota}</p>}
              </div>
            ))}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Visitas y planes por día */}
          <section className={`${GLASS} lg:col-span-8 rounded-[2rem] p-5 sm:p-6 cz-up`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">Visitas y planes por día</h2>
              <div className="flex gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />Visitas</span><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />Planes</span></div>
            </div>
            <div className="flex items-end gap-1.5 sm:gap-2 h-44">
              {dias.map((d) => (
                <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.fecha}: ${d.visita || 0} visitas, ${d.plan || 0} planes`}>
                  <div className="w-full flex items-end justify-center gap-0.5 h-36">
                    <div className="w-1/2 max-w-3 rounded-t bg-sky-400/80" style={{ height: `${((d.visita || 0) / maxDia) * 100}%` }} />
                    <div className="w-1/2 max-w-3 rounded-t bg-rose-500" style={{ height: `${((d.plan || 0) / maxDia) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-full text-center tabular-nums">{Number(d.fecha.slice(8))}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Embudo */}
          <section className={`${GLASS} lg:col-span-4 rounded-[2rem] p-5 sm:p-6 cz-up`}>
            <h2 className="font-bold text-slate-900 mb-4">Embudo</h2>
            <div className="space-y-3">
              {embudo.map(([nombre, valor], i) => (
                <div key={nombre}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{nombre}</span><span className="font-semibold tabular-nums">{fmt(valor)}{i > 0 && <span className="text-slate-400 font-normal"> · {pct(valor, embudo[i - 1][1])}</span>}</span></div>
                  <div className="h-2.5 rounded-full bg-slate-900/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style={{ width: `${embudo[0][1] ? (valor / embudo[0][1]) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Fuentes de la campaña */}
          <section className={`${GLASS} lg:col-span-4 rounded-[2rem] p-5 sm:p-6 cz-up`}>
            <h2 className="font-bold text-slate-900">De dónde vienen</h2>
            <p className="text-xs text-slate-500 mb-3">Usa enlaces con <code className="bg-white/70 px-1 rounded">?ref=nombre</code> en cada pieza (QR de bares, bio, reels…)</p>
            {fuentes.length ? (
              <ul className="space-y-1.5">
                {fuentes.slice(0, 12).map(([f, n]) => (
                  <li key={f} className="flex justify-between text-sm bg-white/60 rounded-xl px-3 py-2"><span className="truncate">{f}</span><span className="font-semibold tabular-nums">{fmt(n)}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">Aún no hay visitas registradas.</p>}
          </section>

          {/* Barrido de eventos */}
          <section className={`${GLASS} lg:col-span-8 rounded-[2rem] p-5 sm:p-6 cz-up`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-bold text-slate-900">Agenda (barrido diario)</h2>
                <p className="text-xs text-slate-500">{barrido ? `Último barrido: ${new Date(barrido.fin || barrido.inicio).toLocaleString("es-ES")} · ${barrido.total ?? 0} eventos` : "Todavía no se ha hecho ningún barrido"}</p>
              </div>
              <button onClick={barrer} disabled={barriendo} className={`${BOTON_OSCURO} disabled:opacity-60`}>
                {barriendo && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {barriendo ? "Barriendo… (hasta 1 min)" : "Lanzar barrido ahora"}
              </button>
            </div>
            {barrido?.fuentes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                {Object.entries(barrido.fuentes).map(([f, r]) => (
                  <div key={f} className="min-w-0 flex items-center justify-between gap-2 text-xs bg-white/60 rounded-xl px-3 py-2">
                    <span className="truncate">{r.ok ? "✅" : "⚠️"} {f}</span>
                    <span className="shrink-0 font-semibold" title={r.error || ""}>{r.ok ? `${r.eventos} eventos` : "error"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {agenda.map((d) => (
                <div key={d.fecha} className="shrink-0 w-14 text-center bg-white/60 rounded-xl py-2">
                  <p className="text-[10px] text-slate-500">{diaCorto(d.fecha)}</p>
                  <p className="text-lg font-bold tabular-nums">{d.eventos}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Locales */}
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-slate-900">{encontrados ? `Resultados para “${busqueda}”` : "Locales que más salen en los planes"}</h2>
              <p className="text-xs text-slate-500">El botón copia el enlace privado con las estadísticas de ese local, para mandárselo.</p>
            </div>
            <form onSubmit={buscar} className="flex gap-2">
              <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); if (!e.target.value) setEncontrados(null); }} placeholder="Buscar un local…" className="w-full sm:w-56 bg-white/80 border border-white rounded-full px-4 h-10 text-sm outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300" />
              <button className={`${BOTON_OSCURO} h-10`}>Buscar</button>
            </form>
          </div>
          {encontrados && !encontrados.length && <p className="text-sm text-slate-500">Ningún local con ese nombre ha salido todavía en un plan.</p>}
          {(encontrados || lugares).length ? (
            <div className="overflow-x-auto no-scrollbar -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-xs text-slate-500"><th className="px-2 py-2 font-medium">Local</th><th className="px-2 font-medium text-right">Planes</th><th className="px-2 font-medium text-right">Fichas</th><th className="px-2 font-medium text-right">Llamadas</th><th className="px-2 font-medium text-right">Web</th><th className="px-2 font-medium text-right">😍 / 😕</th><th className="px-2" /></tr></thead>
                <tbody>
                  {(encontrados || lugares).map((l) => (
                    <tr key={l.clave} className="border-t border-slate-900/5">
                      <td className="px-2 py-2.5"><span className="font-semibold text-slate-900">{l.nombre}</span>{l.tipo && <span className="text-xs text-slate-400"> · {l.tipo}</span>}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.stats.apariciones)}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.stats.detalle)}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.stats.llamar)}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.stats.web)}</td>
                      <td className="px-2 text-right tabular-nums">{l.stats.bien} / {l.stats.mal}</td>
                      <td className="px-2 text-right">
                        {l.enlaceNegocio && <button onClick={() => copiarEnlace(l)} className={`${PRESS} h-8 px-3 rounded-full text-xs font-semibold ${copiado === l.clave ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"}`}>{copiado === l.clave ? "¡Copiado!" : "Enlace del local"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !encontrados && <p className="text-sm text-slate-500">Cuando se generen planes aparecerán aquí los locales.</p>}
        </section>
      </div>
    </main>
  );
}
