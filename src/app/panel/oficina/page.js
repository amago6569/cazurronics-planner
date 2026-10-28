"use client";
// /panel/oficina — solo para el equipo (clave = PANEL_CLAVE, la misma que /panel).
// La oficina de Cazurronics: cada tarea automática es un empleado con su mesa. Si ha cumplido su turno teclea,
// si se lo ha saltado se queda dormido y si ha fallado le sale humo. El jefe da el parte del día y te deja
// en la bandeja los eventos que nadie ha podido comprobar, para que decidas tú. No gasta IA: solo lee datos.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Fondo from "../../components/Fondo";
import { GLASS, GLASS_SOFT, PRESS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../../lib/estilos";
import { CAMISAS, ESTADOS, Monigote, diaCorto, fmt, hace } from "./monigotes";
import Oficina3D, { FichaEmpleado } from "./Oficina3D";
import Novedades from "./novedades";


function Mesa({ e, i, departamento, alElegir }) {
  const est = ESTADOS[e.estado] || ESTADOS.nuevo;
  const p = e.parte;
  const colores = CAMISAS[departamento] || CAMISAS.agenda;
  const cifras = p && (p.busquedas != null
    ? [`${fmt(p.eventos)} encontrados`, p.descartados ? `${fmt(p.descartados)} sin fuente` : null, p.errores ? `${p.errores} fallos` : null].filter(Boolean).join(" · ")
    : p.texto);
  return (
    <button type="button" onClick={() => alElegir(e)} className={`${GLASS} ${PRESS} text-left group rounded-[1.75rem] p-3 sm:p-4 flex flex-col transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:shadow-[0_22px_50px_-18px_rgba(15,23,42,0.35)] cz-up`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
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
        {e.encargos?.length > 0 && <p className="text-[11px] font-semibold text-amber-600">📝 {e.encargos.length} {e.encargos.length === 1 ? "encargo pendiente" : "encargos pendientes"}</p>}
      </div>
    </button>
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
  const [modo, setModo] = useState("3d"); // "3d" (la planta) o "lista" (las mesas en tarjetas)
  const [elegido, setElegido] = useState(null);

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

        <section className="space-y-3 cz-up">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-bold text-slate-900 text-lg">La planta</h2>
            <div className={`${GLASS_SOFT} flex p-1 rounded-full`}>
              {[["3d", "🏢 3D"], ["lista", "📋 Lista"]].map(([id, texto]) => (
                <button key={id} onClick={() => setModo(id)} className={`${PRESS} h-9 px-4 rounded-full text-sm font-semibold ${modo === id ? "bg-slate-900 text-white" : "text-slate-600"}`}>{texto}</button>
              ))}
            </div>
          </div>
          {modo === "3d" && <Oficina3D departamentos={datos.departamentos} jefe={datos.jefe} alElegir={setElegido} />}
        </section>

        <Despacho jefe={datos.jefe} />
        <Novedades lista={datos.novedades || []} departamentos={datos.departamentos} />
        <Bandeja lista={datos.bandeja} decidir={decidir} enCurso={enCurso} />

        {modo === "lista" && datos.departamentos.map((d) => (
          <section key={d.id} className="space-y-3">
            <div className="px-1 flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-bold text-slate-900 text-lg">{d.nombre}</h2>
              <p className="text-xs text-slate-500">{d.nota}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {d.empleados.map((e, i) => <Mesa key={e.id} e={e} i={i} departamento={d.id} alElegir={setElegido} />)}
            </div>
          </section>
        ))}
      </div>

      <FichaEmpleado e={elegido} jefe={datos.jefe} alCerrar={() => setElegido(null)} clave={clave} alTerminar={() => cargar(clave)} />

      {/* En el móvil, actualizar queda al alcance del pulgar */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white/80 to-transparent">
        <button onClick={() => cargar(clave)} className={`${BOTON_OSCURO} w-full h-12`}>{cargando ? "Actualizando…" : "🔄 Actualizar la oficina"}</button>
      </div>
    </main>
  );
}
