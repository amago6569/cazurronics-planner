"use client";
// /panel/oficina — solo para el equipo (clave = PANEL_CLAVE, la misma que /panel).
// La oficina de Cazurronics, de arriba abajo:
//  · El semáforo: cómo va todo en una frase, y los ajustes (letra grande, movimiento, ayuda).
//  · «Hoy te toca»: lo que espera tu OK, con botones (eventos subidos sin fuente segura, locales listos, fallos con su porqué).
//  · La reunión del equipo: propuestas con cifras reales; sí o no. «Verla en la oficina» la escenifica en el 3D.
//  · La tira del flujo: buscan → comprueban → agenda → planes → captación → tú, con las cifras de anoche.
//  · El edificio en 3D: una sala por paso del trabajo; cada empleado está donde toca según su horario real.
//    «▶ Anoche en 1 minuto» repite las últimas 24 h con sus cifras y su charla.
//  · El chat (el grupo, el jefe o cualquier empleado), el parte del día, las novedades, la bandeja y la lista de mesas.
// Se actualiza sola cada minuto mientras la tienes abierta (solo lee Redis). Ver la oficina no gasta IA.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Fondo from "../../components/Fondo";
import { GLASS, GLASS_SOFT, PRESS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../../lib/estilos";
import { LIMITE_DIA_EUROS, euros } from "../../../lib/euros";
import { CAMISAS, ESTADOS, Monigote, diaCorto, fmt, hace } from "./monigotes";
import { FichaEmpleado } from "./ficha";
import Novedades from "./novedades";
import Chat from "./chat";
import { Flujo, HoyTeToca, fallosQueTeTocan } from "./hoy";
import Reunion from "./reunion";

// three.js solo se descarga al abrir la oficina (y nunca en el servidor)
const Oficina3D = dynamic(() => import("./Oficina3D"), {
  ssr: false,
  loading: () => <div className="h-[60dvh] min-h-[400px] sm:h-[640px] rounded-[2rem] bg-white/50 ring-1 ring-white/80 grid place-items-center text-sm text-slate-500 animate-pulse">Encendiendo las luces de la oficina…</div>,
});


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
    ["📅", "en la agenda", c.agenda],
  ];
  const g = c.gasto;
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
          {g && (
            <div className={`mt-3 rounded-2xl px-3.5 py-3 ring-1 ${g.hoy > LIMITE_DIA_EUROS ? "bg-rose-50 ring-rose-200" : "bg-white/70 ring-slate-900/5"}`} aria-label="Gasto de la IA">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">💶 Gasto de la IA</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[["hoy", g.hoy], ["este mes", g.mes], ["previsión mes", g.prevision]].map(([texto, valor]) => (
                  <div key={texto}><p className="text-lg font-bold tabular-nums text-slate-900 leading-none">{euros(valor)}</p><p className="text-[11px] text-slate-500 mt-1">{texto}</p></div>
                ))}
              </div>
              <p className={`text-[11px] mt-1.5 ${g.hoy > LIMITE_DIA_EUROS ? "text-rose-700 font-semibold" : "text-slate-500"}`}>
                {g.hoy > LIMITE_DIA_EUROS ? `⚠️ Hoy ya pasa de ${euros(LIMITE_DIA_EUROS)}: te he avisado por Telegram.` : `Si un día pasa de ${euros(LIMITE_DIA_EUROS)}, te aviso por Telegram. Cambio aproximado de dólares a euros.`}
              </p>
            </div>
          )}
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
    <section id="bandeja" className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up scroll-mt-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-bold text-slate-900 text-lg">📥 Bandeja del Verificador <span className="text-slate-400 font-medium">· {lista.length}</span></h2>
      </div>
      <p className="text-xs text-slate-600 mb-4">Eventos cuya fuente no se pudo comprobar a la primera (Facebook con sesión, webs lentas…). El Verificador los vuelve a mirar en su próximo turno y los sube solo; si quieres adelantarte, decide tú.</p>
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
      ) : <p className="text-sm text-slate-500">Nada pendiente. El Verificador ya lo ha repasado todo.</p>}
    </section>
  );
}

// Cómo va todo, en una frase y un color
function Semaforo({ datos, enCursoN, alHoy }) {
  const f = datos.flujo || {};
  const tuyas = (datos.captacion?.length || 0) + fallosQueTeTocan(datos.departamentos, datos.fallanSeguido).fallos.length;
  const [color, texto] = tuyas
    ? ["bg-amber-400", `Tienes ${tuyas} ${tuyas === 1 ? "cosa" : "cosas"} para hoy`]
    : ["bg-emerald-500", "Todo en marcha: no tienes nada pendiente"];
  return (
    <button onClick={alHoy} className={`${GLASS} ${PRESS} w-full text-left rounded-[1.75rem] px-4 py-3 flex items-center gap-3 cz-up`}>
      <span className={`w-4 h-4 shrink-0 rounded-full ${color} ring-4 ring-white shadow`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-slate-900 text-[17px] leading-tight">{texto}</span>
        <span className="block text-sm text-slate-600 truncate">
          {enCursoN ? `🔴 ${enCursoN} trabajando ahora · ` : ""}{fmt(f.entran)} nuevos anoche · {fmt(f.agenda)} en la agenda{f.repesca ? ` · ${f.repesca} para repetir` : ""}
        </span>
      </span>
      {tuyas > 0 && <span className="shrink-0 text-sm font-semibold text-slate-700">Ver →</span>}
    </button>
  );
}

const AYUDA = [
  ["🟢🟠", "El semáforo de arriba", "Verde: no tienes que hacer nada. Naranja: algo espera tu sí o tu no en «Hoy te toca»."],
  ["✋", "Hoy te toca", "Lo único que necesita tu dedo: locales listos para escribirles y quien falla dos días seguidos, con el porqué. Los eventos los filtra y los sube el equipo solo."],
  ["🤝", "La reunión", "Cada día el equipo propone cosas con sus cifras: descansar si no traen nada, repetir lo que falló, un encargo para el que más trae. Dices sí o no."],
  ["🏢", "El edificio", "Cada empleado es una tarea automática de la web. En su mesa: trabajando (🔴 si es ahora mismo). En la cafetería: ya ha hecho su turno. Dormido en el sofá: se saltó el turno. En la puerta del jefe: ha fallado. 🏖️: de descanso."],
  ["🕵️", "Verificador", "Vuelve a comprobar lo que no tenía fuente segura. Lo bueno lo sube; lo falso lo tira; lo dudoso lo sube «por confirmar» y lo sigue mirando él solo hasta confirmarlo o quitarlo."],
  ["🚑", "Repesca", "Repite las búsquedas que fallaron porque Google iba lento o saturado. Gratis, dentro del cupo diario de Google."],
  ["💬", "El chat", "«Todos» es el grupo. Al jefe le puedes preguntar lo que sea («¿qué hay esta semana en Boñar?»): contesta con los datos del equipo y, si no hay nada, lo busca en ese momento. También «quita …» para sacar un evento de la web. A cada empleado le puedes preguntar «¿cómo vas?» o decirle «busca …»."],
  ["▶", "Anoche en 1 minuto", "Repite lo que pasó en las últimas 24 horas, turno a turno, con sus cifras reales."],
  ["➕", "Un empleado nuevo", "Pídeme «mete X en la oficina»: con una línea en lib/oficina.js aparece su monigote con mesa, ficha y chat."],
];
function Ayuda({ abierta, alCerrar }) {
  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={alCerrar}>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] cz-fade" />
      <div role="dialog" aria-modal="true" aria-label="Qué estoy viendo" onClick={(ev) => ev.stopPropagation()} className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto overscroll-contain rounded-[2rem] bg-white/95 backdrop-blur-2xl ring-1 ring-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] cz-sheet">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" />
        <h2 className="text-xl font-bold text-slate-900">¿Qué estoy viendo?</h2>
        <ul className="mt-3 space-y-3">
          {AYUDA.map(([icono, titulo, texto]) => (
            <li key={titulo} className="flex gap-3">
              <span className="text-2xl leading-none w-9 shrink-0 text-center" aria-hidden>{icono}</span>
              <span><b className="block text-slate-900">{titulo}</b><span className="text-[15px] text-slate-700 leading-snug">{texto}</span></span>
            </li>
          ))}
        </ul>
        <button onClick={alCerrar} className={`${PRESS} mt-5 w-full h-12 rounded-full bg-slate-900 text-white font-semibold`}>Entendido</button>
      </div>
    </div>
  );
}

export default function Oficina() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enCurso, setEnCurso] = useState(null);
  const [modo, setModoActual] = useState("3d"); // "3d" (la planta), "chat" (lo que se dicen) o "lista" (las mesas, sin 3D: va más ligera en el móvil)
  // La vista que eliges se recuerda para la próxima vez
  const setModo = (m) => { setModoActual(m); try { localStorage.setItem("cz-modo", m); } catch {} };
  const [elegido, setElegido] = useState(null);
  const [vista, setVista] = useState("todo"); // la sala que enfoca el 3D
  const [repeticion, setRepeticion] = useState(0); // > 0: «Anoche en 1 minuto» en marcha
  const [con, setCon] = useState("todos"); // la conversación abierta en el chat
  const [escena, setEscena] = useState(null); // la reunión en el 3D: { n, participantes }
  const [movimiento, setMovimiento] = useState(true); // que paseen y hablen (se apaga si el móvil pide menos movimiento)
  const [letraGrande, setLetraGrande] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const planta = useRef(null);
  const verPlanta = () => planta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const irASala = (sala) => { setModo("3d"); setVista((v) => (v === sala ? `${sala} ` : sala)); verPlanta(); };
  const repetirAnoche = () => { setModo("3d"); setVista("todo"); setRepeticion((n) => Math.abs(n) + 1); verPlanta(); };
  const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const hablarCon = (id) => { setElegido(null); setCon(id); setModo("chat"); verPlanta(); };
  const verReunion = () => {
    const r = datos?.reunion;
    if (!r?.propuestas?.length) return;
    setRepeticion((n) => -Math.abs(n));
    setModo("3d"); setVista("escaparate");
    setEscena((x) => ({ n: (x?.n || 0) + 1, participantes: [{ id: "jefe", texto: r.abre }, ...r.propuestas.map((p) => ({ id: p.quien, texto: `${p.texto} ${p.propuesta}` }))] }));
    verPlanta();
  };
  const fichaDe = (id) => setElegido(datos?.departamentos.flatMap((d) => d.empleados).find((e) => e.id === id) || null);

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
    let guardada = "", grande = false, modoGuardado = "";
    try { guardada = sessionStorage.getItem("cz-panel") || ""; grande = localStorage.getItem("cz-letra") === "1"; modoGuardado = localStorage.getItem("cz-modo") || ""; } catch {}
    const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = requestAnimationFrame(() => {
      if (grande) setLetraGrande(true);
      if (["3d", "chat", "lista"].includes(modoGuardado)) setModo(modoGuardado);
      if (quieto) setMovimiento(false);
      if (guardada) { setClave(guardada); cargar(guardada); }
    });
    return () => cancelAnimationFrame(t);
  }, [cargar]);

  // Letra grande: sube el tamaño base de toda la página (y vuelve a lo normal al salir)
  useEffect(() => {
    const html = document.documentElement;
    html.style.fontSize = letraGrande ? "115%" : "";
    try { localStorage.setItem("cz-letra", letraGrande ? "1" : "0"); } catch {}
    return () => { html.style.fontSize = ""; };
  }, [letraGrande]);

  // En directo: cada minuto mientras alguien trabaja, si la pestaña está a la vista, vuelve a leer la oficina (solo Redis, 0 €).
  // Si nadie está trabajando, cada 3 minutos basta
  const hayDatos = !!datos;
  const ocupados = datos?.enCurso?.length || 0;
  useEffect(() => {
    if (!hayDatos || !clave) return;
    const i = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/panel/oficina", { headers: { "x-clave": clave }, cache: "no-store" });
        const d = await r.json().catch(() => null);
        if (d?.exito) setDatos(d);
      } catch { /* la próxima vez */ }
    }, ocupados ? 60000 : 180000);
    return () => clearInterval(i);
  }, [hayDatos, clave, ocupados]);

  const decidir = async (id, decision) => {
    setEnCurso(id);
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const d = await r.json().catch(() => null);
      if (d?.exito || d?.mensaje === "Ya no está en la bandeja") setDatos((x) => ({ ...x, bandeja: x.bandeja.filter((e) => e.id !== id) }));
    } finally { setEnCurso(null); }
  };

  const cerrarFicha = () => setElegido(null);
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

  const pendientes = (datos.captacion?.length || 0) + fallosQueTeTocan(datos.departamentos, datos.fallanSeguido).fallos.length;
  return (
    <main className="min-h-[100dvh] px-4 pt-5 pb-28 sm:px-6 text-slate-800">
      <Fondo />
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <header className="flex items-end justify-between gap-3 px-1 cz-up">
          <div className="min-w-0">
            <Link href="/panel" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Panel</Link>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Oficina <span className={TITULO_GRADIENTE}>Cazurronics</span></h1>
            <p className="text-sm text-slate-500">{datos.jefe.cifras.equipo} empleados trabajando solos, día y noche</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setAyuda(true)} className={`${PRESS} h-11 w-11 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-base font-bold`} aria-label="¿Qué estoy viendo?">?</button>
            <button onClick={() => setLetraGrande((x) => !x)} aria-pressed={letraGrande} className={`${PRESS} h-11 w-11 rounded-full ring-1 ring-slate-900/10 text-sm font-bold ${letraGrande ? "bg-slate-900 text-white" : "bg-white/80"}`} aria-label="Letra grande">A+</button>
            <button onClick={() => cargar(clave)} className={`${PRESS} inline-flex items-center justify-center h-11 min-w-11 px-3 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold`} aria-label="Actualizar">{cargando ? "…" : <><span aria-hidden>🔄</span><span className="hidden sm:inline ml-1.5">Actualizar</span></>}</button>
          </div>
        </header>

        <Semaforo datos={datos} enCursoN={datos.enCurso?.length || 0} alHoy={() => ir("hoy")} />
        <HoyTeToca bandeja={datos.bandeja} sinConfirmar={datos.sinConfirmar || []} captacion={datos.captacion} departamentos={datos.departamentos} fallanSeguido={datos.fallanSeguido || []} flujo={datos.flujo || {}}
          clave={clave} alTerminar={() => cargar(clave)} alVerBandeja={() => ir("bandeja")} />
        <Reunion reunion={datos.reunion} porId={Object.fromEntries(datos.departamentos.flatMap((d) => d.empleados).map((e) => [e.id, e]))} clave={clave}
          alVer={verReunion} alFicha={fichaDe} alIr={(destino) => ir(destino)} alTerminar={() => cargar(clave)} />
        <Flujo flujo={datos.flujo || {}} alElegir={irASala} />

        <section ref={planta} className="space-y-3 cz-up scroll-mt-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-bold text-slate-900 text-lg">{modo === "chat" ? "El chat" : modo === "lista" ? "Las mesas" : "La oficina"}</h2>
            <div className={`${GLASS_SOFT} flex p-1 rounded-full`} role="tablist" aria-label="Cómo ver la oficina">
              {[["3d", "🏢 3D"], ["chat", "💬 Chat"], ["lista", "📋 Lista"]].map(([id, texto]) => (
                <button key={id} role="tab" aria-selected={modo === id} onClick={() => setModo(id)} className={`${PRESS} h-10 px-3.5 sm:px-4 rounded-full text-sm font-semibold ${modo === id ? "bg-slate-900 text-white" : "text-slate-600"}`}>{texto}</button>
              ))}
            </div>
          </div>
          {modo === "3d" && (
            <label className="flex items-center gap-2 px-1 text-sm text-slate-600 select-none">
              <input type="checkbox" checked={movimiento} onChange={(e) => setMovimiento(e.target.checked)} className="w-5 h-5 accent-slate-900" />
              Que paseen y hablen entre ellos
            </label>
          )}
          {modo === "3d" && (
            <Oficina3D departamentos={datos.departamentos} charla={datos.charla || []} golpes={datos.golpes || []} bandeja={datos.bandeja} flujo={datos.flujo || {}}
              alElegir={setElegido} vista={vista} setVista={setVista} repeticion={repeticion > 0 ? repeticion : 0} alAcabarRepeticion={() => setRepeticion((n) => -Math.abs(n))}
              movimiento={movimiento} reunion={escena} alAcabarReunion={() => setVista("todo")} />
          )}
          {modo === "lista" && datos.departamentos.map((d) => (
            <section key={d.id} className="space-y-3" aria-label={d.nombre}>
              <div className="px-1 flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-bold text-slate-900 text-base">{d.nombre}</h3>
                <p className="text-xs text-slate-500">{d.nota}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {d.empleados.map((e, i) => <Mesa key={e.id} e={e} i={i} departamento={d.id} alElegir={setElegido} />)}
              </div>
            </section>
          ))}
          {modo === "chat" && <Chat charla={datos.charla || []} departamentos={datos.departamentos} clave={clave} alTerminar={() => cargar(clave)} con={con} setCon={setCon} />}
        </section>

        <Despacho jefe={datos.jefe} />
        <Novedades lista={datos.novedades || []} departamentos={datos.departamentos} />
        <Bandeja lista={datos.bandeja} decidir={decidir} enCurso={enCurso} />

      </div>

      <FichaEmpleado e={elegido} jefe={datos.jefe} alCerrar={cerrarFicha} clave={clave} alTerminar={() => cargar(clave)} alHablar={hablarCon} />
      <Ayuda abierta={ayuda} alCerrar={() => setAyuda(false)} />

      {/* Lo que más se usa, al alcance del pulgar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white/85 via-white/50 to-transparent pointer-events-none">
        <div className={`${GLASS} pointer-events-auto mx-auto max-w-md grid grid-cols-4 gap-1 rounded-full p-1.5`}>
          <button onClick={() => ir("hoy")} className={`${PRESS} h-12 rounded-full bg-slate-900 text-white text-[13px] font-semibold leading-tight`}>✋ Hoy{pendientes ? ` (${pendientes})` : ""}</button>
          <button onClick={() => ir("reunion")} className={`${PRESS} h-12 rounded-full text-[13px] font-semibold text-slate-700 hover:bg-white/70`}>🤝 Reunión</button>
          <button onClick={() => { setModo("chat"); verPlanta(); }} className={`${PRESS} h-12 rounded-full text-[13px] font-semibold text-slate-700 hover:bg-white/70`}>💬 Chat</button>
          <button onClick={repetirAnoche} className={`${PRESS} h-12 rounded-full text-[13px] font-semibold text-slate-700 hover:bg-white/70`}>▶ Anoche</button>
        </div>
      </nav>
    </main>
  );
}
