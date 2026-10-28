"use client";
// /panel/oficina — solo para el equipo (clave = PANEL_CLAVE, la misma que /panel).
// La oficina de Cazurronics: cada tarea automática es un empleado con su mesa. Si ha cumplido su turno teclea,
// si se lo ha saltado se queda dormido y si ha fallado le sale humo. El jefe da el parte del día y te deja
// en la bandeja los eventos que nadie ha podido comprobar, para que decidas tú. No gasta IA: solo lee datos.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Fondo from "../../components/Fondo";
import { GLASS, GLASS_SOFT, PRESS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../../lib/estilos";

const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);
const PIELES = ["#f6d2b8", "#e9b894", "#c98e66", "#f3c9a5", "#8d5a3b", "#fbe0c8"];
const PELOS = ["#2b1d14", "#6b3f1d", "#c8902e", "#1f2937", "#9a3412", "#57534e", "#b45309"];
const CAMISAS = { agenda: ["#f43f5e", "#fb7185", "#e11d48"], territorio: ["#0ea5e9", "#38bdf8", "#0284c7"], despensa: ["#f59e0b", "#fbbf24", "#d97706"], negocio: ["#8b5cf6", "#a78bfa", "#7c3aed"] };
const ESTADOS = {
  ok: { texto: "Al día", punto: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  tarde: { texto: "Con retraso", punto: "bg-amber-500", pill: "bg-amber-50 text-amber-800 ring-amber-200" },
  error: { texto: "Con fallos", punto: "bg-rose-500", pill: "bg-rose-50 text-rose-700 ring-rose-200" },
  nuevo: { texto: "Aún no ha trabajado", punto: "bg-slate-300", pill: "bg-white/70 text-slate-500 ring-slate-200" },
};

function hace(fecha) {
  if (!fecha) return "todavía no";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(fecha)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

// El monigote en su mesa. estado: ok (teclea) · tarde (duerme) · error (humo) · nuevo (silla vacía, a medias)
function Monigote({ estado = "ok", semilla = 0, camisa = "#f43f5e", emoji = "💻", jefe = false, className = "" }) {
  const piel = PIELES[semilla % PIELES.length];
  const pelo = PELOS[(semilla * 3 + 1) % PELOS.length];
  const duerme = estado === "tarde";
  const teclea = estado === "ok";
  return (
    <svg viewBox="0 0 120 92" className={className} role="img" aria-label={ESTADOS[estado]?.texto}>
      <ellipse cx="60" cy="86" rx="46" ry="5" fill="rgba(15,23,42,0.08)" />
      {/* silla */}
      <rect x="34" y="20" width="52" height="46" rx="14" fill="rgba(15,23,42,0.10)" />
      {/* persona */}
      <g opacity={estado === "nuevo" ? 0.35 : 1}>
        <g className={duerme ? "" : "cz-respira"}>
          <rect x="40" y="44" width="40" height="23" rx="11" fill={camisa} />
          {jefe && <path d="M60 46 l-3.5 5 3.5 12 3.5-12z" fill="#0f172a" />}
          {jefe && <path d="M54 44 l6 5 6-5" fill="#fff" />}
          <g transform={duerme ? "rotate(14 60 34)" : undefined}>
            <circle cx="60" cy="31" r="13" fill={piel} />
            <path d={semilla % 2 ? "M47 29 q1-14 13-14 q12 0 13 14 q-6-7-13-7 q-7 0-13 7z" : "M47 30 q0-15 13-15 q13 0 13 15 q-3-4-6-5 q-7 3-20 5z"} fill={pelo} />
            {duerme ? (
              <><path d="M53.5 33 q2 1.6 4 0" stroke="#334155" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M62.5 33 q2 1.6 4 0" stroke="#334155" strokeWidth="1.4" fill="none" strokeLinecap="round" /></>
            ) : (
              <><circle cx="55.5" cy="32" r="1.5" fill="#1e293b" /><circle cx="64.5" cy="32" r="1.5" fill="#1e293b" /></>
            )}
            {estado === "error"
              ? <path d="M56 38.5 q4-2.4 8 0" stroke="#9f1239" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              : <path d="M56.5 37.5 q3.5 2.6 7 0" stroke="#9a3412" strokeWidth="1.4" fill="none" strokeLinecap="round" />}
            <circle cx="52" cy="36" r="2" fill="#fb7185" opacity=".25" />
            <circle cx="68" cy="36" r="2" fill="#fb7185" opacity=".25" />
          </g>
        </g>
        {/* manos sobre el teclado */}
        <rect x="37" y="58" width="12" height="7" rx="3.5" fill={piel} className={teclea ? "cz-teclea" : ""} />
        <rect x="71" y="58" width="12" height="7" rx="3.5" fill={piel} className={teclea ? "cz-teclea-2" : ""} />
      </g>
      {/* mesa */}
      <rect x="10" y="63" width="100" height="7" rx="3.5" fill="#fff" stroke="rgba(15,23,42,0.08)" />
      <rect x="18" y="70" width="5" height="14" rx="2" fill="rgba(15,23,42,0.14)" />
      <rect x="97" y="70" width="5" height="14" rx="2" fill="rgba(15,23,42,0.14)" />
      {/* portátil visto por detrás, con la pegatina del puesto */}
      <path d="M44 63 L48 45 H72 L76 63 Z" fill={estado === "error" ? "#fecdd3" : "#e2e8f0"} stroke="rgba(15,23,42,0.12)" />
      {teclea && <path d="M48 45 H72" stroke="#7dd3fc" strokeWidth="1.6" className="cz-brillo" />}
      <text x="60" y="58.5" textAnchor="middle" fontSize="10">{emoji}</text>
      {jefe && <><rect x="86" y="54" width="9" height="9" rx="2" fill="#fff" stroke="rgba(15,23,42,0.15)" /><path d="M95 56.5 q3 0 3 2.5 q0 2.5-3 2.5" stroke="rgba(15,23,42,0.25)" fill="none" /></>}
      {/* lo que le pasa */}
      {duerme && <><text x="78" y="28" fontSize="9" className="cz-zzz" fill="#64748b">z</text><text x="85" y="21" fontSize="11" className="cz-zzz" style={{ animationDelay: ".8s" }} fill="#64748b">z</text></>}
      {estado === "error" && <><circle cx="76" cy="44" r="4" fill="#94a3b8" className="cz-humo" /><circle cx="81" cy="40" r="4.5" fill="#fda4af" className="cz-humo" style={{ animationDelay: ".6s" }} /><text x="76" y="24" fontSize="10">❗</text></>}
    </svg>
  );
}

function Mesa({ e, i, departamento }) {
  const est = ESTADOS[e.estado] || ESTADOS.nuevo;
  const p = e.parte;
  const colores = CAMISAS[departamento] || CAMISAS.agenda;
  const cifras = p && (p.busquedas != null
    ? [`${fmt(p.eventos)} encontrados`, p.descartados ? `${fmt(p.descartados)} sin fuente` : null, p.errores ? `${p.errores} fallos` : null].filter(Boolean).join(" · ")
    : p.texto);
  return (
    <article className={`${GLASS} group rounded-[1.75rem] p-3 sm:p-4 flex flex-col transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:shadow-[0_22px_50px_-18px_rgba(15,23,42,0.35)] cz-up`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
      <div className="relative rounded-2xl bg-gradient-to-b from-white/70 to-white/20 ring-1 ring-white/80 overflow-hidden">
        <span className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${est.pill}`}>
          <i className={`w-1.5 h-1.5 rounded-full ${est.punto}`} />{est.texto}
        </span>
        <Monigote estado={e.estado} semilla={i + departamento.length} camisa={colores[i % colores.length]} emoji={e.emoji} className="w-full h-auto pt-4 transition-transform duration-500 group-hover:scale-[1.04]" />
      </div>
      <div className="mt-3 min-w-0 flex-1 flex flex-col">
        <h3 className="font-bold text-slate-900 leading-tight text-[15px]">{e.nombre}</h3>
        <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">{e.puesto}</p>
        <div className="mt-auto pt-2.5 space-y-1">
          {cifras && <p className="text-xs font-semibold text-slate-700 tabular-nums">{cifras}</p>}
          {p?.error && <p className="text-[11px] text-rose-600 line-clamp-2">{p.error}</p>}
          <p className="text-[11px] text-slate-400">🕒 {e.horario} · último turno {hace(p?.fin)}</p>
        </div>
      </div>
    </article>
  );
}

function Despacho({ jefe }) {
  const c = jefe.cifras;
  const chips = [
    ["👥", "equipo", c.equipo], ["🟢", "al día", c.alDia], ["💤", "con retraso", c.tarde], ["🔥", "con fallos", c.error],
    ["📅", "en la agenda", c.agenda], ...(c.gastoMes != null ? [["💶", "IA este mes", `~${(c.gastoMes * 0.92).toFixed(2).replace(".", ",")} €`]] : []),
  ];
  return (
    <section className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up overflow-hidden relative`}>
      <div aria-hidden className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-rose-300/40 via-orange-200/30 to-amber-200/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
        <div className="shrink-0 w-40 sm:w-48 mx-auto sm:mx-0">
          <Monigote estado="ok" semilla={2} camisa="#0f172a" emoji="👔" jefe className="w-full h-auto" />
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 -mt-1">El jefe</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative bg-white/85 rounded-3xl rounded-tl-md sm:rounded-tl-3xl sm:rounded-bl-md p-4 ring-1 ring-slate-900/5 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.3)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500 mb-1.5">Parte del día</p>
            <ul className="space-y-1.5 text-[15px] leading-snug text-slate-700">
              {jefe.lineas.map((l) => <li key={l}>{l}</li>)}
            </ul>
            {jefe.ronda && <p className="text-[11px] text-slate-400 mt-2">Última ronda del jefe {hace(jefe.ronda)}</p>}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1 pb-1">
            {chips.map(([icono, texto, valor]) => (
              <div key={texto} className={`${GLASS_SOFT} shrink-0 rounded-2xl px-3 py-2`}>
                <p className="text-lg font-bold tabular-nums text-slate-900 leading-none">{typeof valor === "number" ? fmt(valor) : valor}</p>
                <p className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">{icono} {texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Bandeja({ lista, decidir, enCurso }) {
  return (
    <section className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-bold text-slate-900 text-lg">📥 Bandeja del jefe <span className="text-slate-400 font-medium">· {lista.length}</span></h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Eventos que el equipo encontró pero cuya fuente no se pudo comprobar (Facebook con sesión, webs lentas…). Ábrela, y si es real, súbelo.</p>
      {lista.length ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {lista.map((e) => (
            <li key={e.id} className="bg-white/75 ring-1 ring-slate-900/5 rounded-2xl p-3.5 flex flex-col gap-2 cz-fade">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wide">{diaCorto(e.fecha)}{e.hora ? ` · ${e.hora}` : ""}</p>
                <p className="font-semibold text-slate-900 leading-snug">{e.titulo}</p>
                <p className="text-xs text-slate-500">{[e.lugar, e.localidad, e.precio].filter(Boolean).join(" · ")}</p>
                <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-600 hover:underline underline-offset-2 break-all line-clamp-1">🔗 {e.fuente}</a>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decidir(e.id, "subir")} disabled={!!enCurso} className={`${PRESS} flex-1 h-11 rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] hover:brightness-105 disabled:opacity-50`}>{enCurso === e.id ? "…" : "✅ Subir"}</button>
                <button onClick={() => decidir(e.id, "tirar")} disabled={!!enCurso} className={`${PRESS} flex-1 h-11 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50`}>✖ Tirar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">Nada pendiente. Todo lo que ha entrado tenía una fuente comprobada.</p>}
    </section>
  );
}

export default function Oficina() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enCurso, setEnCurso] = useState(null);

  const cargar = useCallback(async (c) => {
    setError(""); setCargando(true);
    try {
      const r = await fetch("/api/panel/oficina", { headers: { "x-clave": c }, cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!d?.exito) { setError(d?.mensaje || `Error ${r.status}`); setDatos(null); return; }
      setDatos(d);
      try { sessionStorage.setItem("cz-panel", c); } catch {}
    } catch { setError("No se pudo conectar"); } finally { setCargando(false); }
  }, []);

  useEffect(() => {
    let guardada = "";
    try { guardada = sessionStorage.getItem("cz-panel") || ""; } catch {}
    if (!guardada) return;
    const t = requestAnimationFrame(() => { setClave(guardada); cargar(guardada); });
    return () => cancelAnimationFrame(t);
  }, [cargar]);

  const decidir = async (id, decision) => {
    setEnCurso(id);
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const d = await r.json().catch(() => null);
      if (d?.exito || d?.mensaje === "Ya no está en la bandeja") setDatos((x) => ({ ...x, bandeja: x.bandeja.filter((e) => e.id !== id) }));
    } finally { setEnCurso(null); }
  };

  if (!datos) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-4">
        <Fondo />
        <form onSubmit={(e) => { e.preventDefault(); cargar(clave); }} className={`${GLASS} w-full max-w-sm rounded-[2rem] p-6 cz-up`}>
          <p className="text-3xl mb-2">🏢</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">La oficina</h1>
          <p className="text-sm text-slate-500 mb-5">La misma clave que el panel (PANEL_CLAVE).</p>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave" autoFocus className="w-full bg-white/80 border border-white rounded-2xl px-4 h-12 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300 mb-3" />
          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
          <button disabled={cargando} className={`${BOTON_OSCURO} w-full h-12 disabled:opacity-60`}>{cargando ? "Entrando…" : "Entrar"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-4 pt-5 pb-28 sm:px-6 sm:pb-10 text-slate-800">
      <Fondo />
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <header className="flex items-end justify-between gap-3 px-1 cz-up">
          <div className="min-w-0">
            <Link href="/panel" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Panel</Link>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Oficina <span className={TITULO_GRADIENTE}>Cazurronics</span></h1>
            <p className="text-sm text-slate-500">{datos.jefe.cifras.equipo} empleados trabajando solos, día y noche</p>
          </div>
          <button onClick={() => cargar(clave)} className={`${PRESS} hidden sm:inline-flex items-center h-10 px-4 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold`}>{cargando ? "Actualizando…" : "Actualizar"}</button>
        </header>

        <Despacho jefe={datos.jefe} />
        <Bandeja lista={datos.bandeja} decidir={decidir} enCurso={enCurso} />

        {datos.departamentos.map((d) => (
          <section key={d.id} className="space-y-3">
            <div className="px-1 flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-bold text-slate-900 text-lg">{d.nombre}</h2>
              <p className="text-xs text-slate-500">{d.nota}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {d.empleados.map((e, i) => <Mesa key={e.id} e={e} i={i} departamento={d.id} />)}
            </div>
          </section>
        ))}
      </div>

      {/* En el móvil, actualizar queda al alcance del pulgar */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white/80 to-transparent">
        <button onClick={() => cargar(clave)} className={`${BOTON_OSCURO} w-full h-12`}>{cargando ? "Actualizando…" : "🔄 Actualizar la oficina"}</button>
      </div>
    </main>
  );
}
