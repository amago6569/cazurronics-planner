"use client";
// /panel — solo para el equipo (clave = variable de entorno PANEL_CLAVE).
// Analítica propia (idea 10), ranking de locales con su enlace privado (idea 6),
// estado del barrido de eventos (idea 3) y el rosetón colectivo de la campaña.
import { useCallback, useEffect, useState } from "react";
import Fondo from "../components/Fondo";
import Captacion from "../components/Captacion";
import { GLASS, PRESS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../lib/estilos";

const OBJETIVO_ROSETON = 500; // planes para completar el rosetón de la campaña (24 cristales)
const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);
const pct = (a, b) => (b ? `${Math.round(((a || 0) / b) * 100)} %` : "—");
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

export default function Panel() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [barriendo, setBarriendo] = useState(null); // null = parado; { tipo, hecho, total } mientras barre
  const [copiado, setCopiado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [encontrados, setEncontrados] = useState(null);
  const [finde, setFinde] = useState(null); // resumen del finde (textos + imágenes)
  const [copiadoFinde, setCopiadoFinde] = useState("");
  const [avisoBarrido, setAvisoBarrido] = useState(""); // por qué un barrido no ha gastado búsquedas
  const [reinicio, setReinicio] = useState(""); // "" | "seguro" | "haciendo" | "hecho" | "error"

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

  // Cada barrido va por tramos, uno detrás de otro, para que cada uno quepa en el minuto de Vercel
  const BARRIDOS = {
    diario: { texto: "Barrido diario", ids: ["d0", "d1", "d2", "d3", "d4", "d5"] },
    novedades: { texto: "Novedades", ids: ["r"] },
    gordo: { texto: "Barrido gordo", ids: ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7"] },
  };
  const barrer = async (tipo) => {
    const { ids } = BARRIDOS[tipo];
    setAvisoBarrido("");
    let saltados = 0, horas = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        setBarriendo({ tipo, hecho: i, total: ids.length });
        const r = await fetch("/api/panel", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ accion: "barrido", tramo: ids[i] }) }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        if (d?.saltado) { saltados++; horas = Math.max(horas, d.horas || 1); }
      }
      await cargar(clave);
      if (saltados) setAvisoBarrido(saltados === ids.length
        ? `Ya estaba hecho hace poco (hace unas ${horas} h): no se ha repetido para no gastar búsquedas de Google.`
        : `${saltados} de ${ids.length} partes ya estaban hechas hace poco y se han saltado para no gastar búsquedas de Google.`);
    } finally { setBarriendo(null); }
  };

  // Empezar de cero las estadísticas de locales (hay que confirmarlo con un segundo clic)
  const reiniciarLocales = async () => {
    setReinicio("haciendo");
    try {
      const r = await fetch("/api/panel", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ accion: "reiniciar-locales" }) });
      const d = await r.json().catch(() => null);
      if (d?.exito) { await cargar(clave); setReinicio("hecho"); } else setReinicio("error");
    } catch { setReinicio("error"); }
  };

  const copiarEnlace = async (lugar) => {
    if (!lugar.enlaceNegocio) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/negocio/${lugar.enlaceNegocio}`); setCopiado(lugar.clave); setTimeout(() => setCopiado(""), 2000); } catch {}
  };

  // El resumen del finde se carga cuando ya has entrado en el panel
  useEffect(() => {
    if (!datos || finde) return;
    let vivo = true;
    fetch("/api/finde", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (vivo && d.exito) setFinde(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [datos, finde]);

  const copiarTexto = async (id, texto) => {
    try { await navigator.clipboard.writeText(texto); setCopiadoFinde(id); setTimeout(() => setCopiadoFinde(""), 2000); } catch {}
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

  const { resumen, lugares, barrido, agenda, almacen, solicitudes = [] } = datos;
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
                <h2 className="font-bold text-slate-900">Agenda (barridos automáticos)</h2>
                <p className="text-xs text-slate-500">{barrido ? `Última pasada: ${new Date(barrido.fin || barrido.inicio).toLocaleString("es-ES")} · ${barrido.total ?? 0} planes en la agenda${barrido.descartados ? ` · ${barrido.descartados} descartados por fuente falsa` : ""}` : "Todavía no se ha hecho ningún barrido"}</p>
              </div>
            </div>
            {/* Lanzar a mano (los crons lo hacen solos: diario de madrugada, novedades a mediodía y tarde, gordo cada domingo; si ya se hizo hace poco, no se repite) */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(BARRIDOS).map(([tipo, b]) => {
                const activo = barriendo?.tipo === tipo;
                return (
                  <button key={tipo} onClick={() => barrer(tipo)} disabled={!!barriendo} className={`${BOTON_OSCURO} disabled:opacity-60 ${tipo === "gordo" ? "!bg-gradient-to-r from-rose-500 to-orange-500" : ""}`}>
                    {activo && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                    {activo ? `${b.texto}: ${barriendo.hecho + 1}/${barriendo.total}…` : `${b.texto} (${b.ids.length === 1 ? "1 min" : `~${b.ids.length} min`})`}
                  </button>
                );
              })}
            </div>
            {avisoBarrido && <p className="text-xs text-amber-700 bg-amber-50/80 rounded-xl px-3 py-2 mb-4">{avisoBarrido}</p>}
            {barrido?.tramos && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                {barrido.tramos.map((t) => (
                  <div key={t.tramo} className="min-w-0 flex items-center justify-between gap-2 text-xs bg-white/60 rounded-xl px-3 py-2">
                    <span className="truncate">{t.fin ? (t.errores ? "⚠️" : "✅") : "⏳"} {t.nombre}</span>
                    <span className="shrink-0 font-semibold tabular-nums" title={t.fin ? new Date(t.fin).toLocaleString("es-ES") : "aún no se ha hecho"}>
                      {t.fin ? `${t.eventos} · +${t.nuevos ?? 0} nuevos${t.descartados ? ` · −${t.descartados}` : ""}` : "pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {barrido?.fuentes && Object.keys(barrido.fuentes).length > 0 && (
              <details className="mb-4 text-xs">
                <summary className="cursor-pointer text-amber-700 font-semibold">⚠️ {Object.keys(barrido.fuentes).length} búsquedas fallaron en la última pasada</summary>
                <ul className="mt-2 space-y-1">
                  {Object.entries(barrido.fuentes).map(([f, r]) => <li key={f} className="bg-white/60 rounded-xl px-3 py-2"><b>{f}</b>: {r.error}</li>)}
                </ul>
              </details>
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

        {/* Resumen del finde: texto listo para WhatsApp e Instagram + imágenes del carrusel */}
        {finde && (
          <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="font-bold text-slate-900">📣 Resumen del finde <span className="text-slate-400 font-medium">· {finde.rango}</span></h2>
              <a href="/finde" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-rose-600 hover:underline underline-offset-2">Ver la página</a>
            </div>
            {finde.hayContenido ? (
              <div className="grid lg:grid-cols-2 gap-4">
                {[["wa", "💬 WhatsApp", finde.whatsapp], ["ig", "📸 Instagram (pie de foto)", finde.instagram]].map(([id, titulo, texto]) => (
                  <div key={id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
                      <button onClick={() => copiarTexto(id, texto)} className={`${PRESS} h-8 px-3 rounded-full text-xs font-semibold ${copiadoFinde === id ? "bg-emerald-500 text-white" : "bg-white/80 ring-1 ring-slate-900/10 text-slate-700"}`}>{copiadoFinde === id ? "¡Copiado!" : "Copiar"}</button>
                    </div>
                    <textarea readOnly value={texto} rows={12} className="w-full bg-white/70 rounded-2xl ring-1 ring-slate-900/5 p-3 text-[13px] leading-relaxed text-slate-700 outline-none resize-y" />
                  </div>
                ))}
                <div className="lg:col-span-2">
                  <p className="text-sm font-semibold text-slate-700 mb-1.5">🖼️ Carrusel ({finde.imagenes.length} imágenes) · toca una para abrirla y guardarla</p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {finde.imagenes.map((_, i) => (
                      <a key={i} href={`/api/finde/imagen?n=${i + 1}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/finde/imagen?n=${i + 1}`} alt={`Diapositiva ${i + 1}`} className="h-56 w-auto rounded-2xl ring-1 ring-slate-900/10" />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Para historias (vertical): {finde.historias.map((_, i) => <a key={i} href={`/api/finde/imagen?n=${i + 1}&f=historia`} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600 hover:underline underline-offset-2 mr-2">{i + 1}</a>)}</p>
                </div>
              </div>
            ) : <p className="text-sm text-slate-500">Todavía no hay agenda cerrada para el próximo finde: lanza el barrido diario y vuelve a mirar.</p>}
          </section>
        )}

        {/* Captación: locales que ya rinden en la web, listos para escribirles (el envío lo haces tú) */}
        <Captacion clave={clave} />

        {/* Solicitudes de negocios (copia de seguridad del formulario "Destácalo") */}
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="font-bold text-slate-900">Negocios que quieren hablar contigo <span className="text-slate-400 font-medium">· {solicitudes.length}</span></h2>
            <p className="text-xs text-slate-500">Llegan desde el botón “Destácalo” de la portada. También van a tu Google Sheet si el Apps Script responde.</p>
          </div>
          {solicitudes.length ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {solicitudes.map((s, i) => (
                <li key={`${s.fecha}-${i}`} className="bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900 leading-snug">{s.nombreLocal}</p>
                    <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{new Date(s.fecha).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                    {s.email && <a href={`mailto:${s.email}`} className="text-rose-600 hover:underline break-all">✉️ {s.email}</a>}
                    {s.telefono && <a href={`tel:${s.telefono}`} className="text-rose-600 hover:underline">📞 {s.telefono}</a>}
                    {s.telefono && <a href={`https://wa.me/${s.telefono.replace(/\D/g, "").replace(/^(?!34)(\d{9})$/, "34$1")}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">WhatsApp</a>}
                  </div>
                  {s.mensaje && <p className="text-[13px] text-slate-600 mt-1.5 whitespace-pre-line">{s.mensaje}</p>}
                  {!s.enviadoAlSheet && <p className="text-[11px] text-amber-700 mt-1.5">⚠️ Esta no llegó al Google Sheet: revisa NEXT_PUBLIC_GAS_BUSINESS_URL en Vercel</p>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Todavía no ha escrito ningún negocio.</p>}
        </section>

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
          <div className="mt-4 pt-3 border-t border-slate-900/5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
            <span className="min-w-0 flex-1">Los números son acumulados desde el lanzamiento: incluyen planes de prueba y datos anteriores a esta versión. Solo cuentan locales reales.</span>
            {reinicio === "seguro" ? (
              <>
                <span className="w-full sm:w-auto font-semibold text-rose-600">¿Seguro? Se borran apariciones, fichas, llamadas y valoraciones de todos los locales.</span>
                <button onClick={reiniciarLocales} className={`${PRESS} h-8 px-3 rounded-full text-xs font-semibold bg-rose-500 text-white`}>Sí, empezar de cero</button>
                <button onClick={() => setReinicio("")} className={`${PRESS} h-8 px-3 rounded-full text-xs font-semibold bg-white/80 text-slate-600 ring-1 ring-slate-900/10`}>Cancelar</button>
              </>
            ) : (
              <button onClick={() => setReinicio("seguro")} disabled={reinicio === "haciendo"} className={`${PRESS} h-8 px-3 rounded-full text-xs font-semibold bg-white/80 text-slate-600 ring-1 ring-slate-900/10 disabled:opacity-60`}>{reinicio === "haciendo" ? "Borrando…" : "Empezar estadísticas de cero"}</button>
            )}
            {reinicio === "hecho" && <span className="w-full font-semibold text-emerald-600">✅ Hecho: las estadísticas de locales empiezan de cero.</span>}
            {reinicio === "error" && <span className="w-full font-semibold text-rose-600">No se pudo borrar. Inténtalo otra vez.</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
