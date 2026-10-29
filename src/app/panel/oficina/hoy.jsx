"use client";
// Lo primero que ves en la oficina:
//  · «Hoy te toca»: lo que espera tu OK, con sus botones (eventos dudosos, locales listos para escribirles y
//    empleados que han fallado). Funciona sin el 3D.
//  · La tira del flujo: el trabajo de anoche paso a paso, con números reales. Tocar un paso lleva a su sala.
import { useState } from "react";
import { GLASS, GLASS_SOFT, PRESS } from "../../../lib/estilos";
import { diaCorto, fmt } from "./monigotes";

const MAX_BANDEJA = 3;

function Tarjeta({ icono, titulo, children, tono = "bg-white/80" }) {
  return (
    <li className={`${tono} ring-1 ring-slate-900/5 rounded-2xl p-3.5 flex flex-col gap-2 cz-fade w-[85%] shrink-0 snap-start md:w-auto`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{icono} {titulo}</p>
      {children}
    </li>
  );
}

function Local({ l, clave, alQuitar }) {
  const [texto, setTexto] = useState(l.texto);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [indicacion, setIndicacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const pedir = async (cuerpo) => {
    setOcupado(true); setAviso("");
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ local: l.clave, ...cuerpo }) });
      return await r.json().catch(() => null);
    } catch { return null; } finally { setOcupado(false); }
  };
  // ✅: copia el mensaje, abre Instagram o Gmail (lo envías tú) y lo apunta como enviado
  const enviar = async () => {
    try { await navigator.clipboard?.writeText(texto); } catch {}
    const d = await pedir({ accion: l.recordar ? "recordado" : "enviado" });
    if (d?.exito) alQuitar(`${l.nombre}: apuntado. Mensaje copiado; si no contesta, te lo recuerdo en 7 días.`);
    else setAviso(d?.mensaje || "No se ha podido apuntar.");
  };
  const no = async () => {
    const d = await pedir({ accion: "no" });
    if (d?.exito) alQuitar(`${l.nombre}: no se le escribe.`);
    else setAviso(d?.mensaje || "No se ha podido apuntar.");
  };
  const cambiar = async (ev) => {
    ev.preventDefault();
    if (indicacion.trim().length < 3) return;
    const d = await pedir({ accion: "cambiar", texto: indicacion.trim() });
    if (d?.exito) { setTexto(d.texto); setEditando(false); setIndicacion(""); setAbierto(true); }
    else setAviso(d?.mensaje || "No se ha podido cambiar.");
  };
  return (
    <Tarjeta icono={l.recordar ? "⏰" : "🎯"} titulo={l.recordar ? "Recordatorio (no contestó en 7 días)" : "Local listo para escribirle"}>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 leading-snug">{l.nombre}{l.tipo ? <span className="font-normal text-slate-500"> · {l.tipo}</span> : null}</p>
        <p className="text-xs text-slate-500">Sale {fmt(l.apariciones)} veces en planes · {fmt(l.fichas)} fichas abiertas · {l.via || "⚠️ sin Instagram ni correo"}</p>
      </div>
      <button type="button" onClick={() => setAbierto((x) => !x)} className="text-left rounded-xl bg-slate-50 ring-1 ring-slate-900/5 px-3 py-2 text-[13px] leading-snug text-slate-700 whitespace-pre-line">
        <span className={abierto ? "" : "line-clamp-3"}>{texto}</span>
        <span className="block mt-1 text-[11px] font-semibold text-sky-600">{abierto ? "Ver menos" : "Ver el mensaje entero"}</span>
      </button>
      {editando && (
        <form onSubmit={cambiar} className="flex gap-2">
          <input value={indicacion} onChange={(e) => setIndicacion(e.target.value.slice(0, 300))} autoFocus placeholder="«más corto», «tutéales»…" className="flex-1 min-w-0 h-11 rounded-full bg-white px-4 text-sm outline-none ring-1 ring-slate-900/10 focus:ring-2 focus:ring-rose-300" />
          <button disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-50`}>{ocupado ? "…" : "Cambiar"}</button>
        </form>
      )}
      {aviso && <p className="text-xs text-rose-600">{aviso}</p>}
      <div className="flex gap-2 mt-auto">
        {l.enlace ? (
          <a href={l.enlace} target="_blank" rel="noopener noreferrer" onClick={enviar} className={`${PRESS} flex-1 h-11 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] ${ocupado ? "pointer-events-none opacity-50" : ""}`}>✅ Enviar</a>
        ) : (
          <a href="/panel#captacion" className={`${PRESS} flex-1 h-11 inline-flex items-center justify-center rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold`}>Apuntar contacto</a>
        )}
        <button onClick={() => setEditando((x) => !x)} disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`} aria-label="Cambiar el mensaje">✏️</button>
        <button onClick={no} disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`} aria-label="No escribirle">✖</button>
      </div>
      {l.enlace && <p className="text-[11px] text-slate-400">Al pulsar ✅ se copia el mensaje y se abre {l.via?.startsWith("Instagram") ? "Instagram" : "Gmail"}. Lo envías tú.</p>}
    </Tarjeta>
  );
}

function Fallo({ e, clave, alTerminar }) {
  const [estado, setEstado] = useState("");
  const repetir = async () => {
    setEstado("trabajando");
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ empleado: e.id, accion: "trabajar" }) });
      const d = await r.json().catch(() => null);
      setEstado(d?.exito ? `Hecho: ${d.parte?.nuevos ?? 0} nuevos.` : d?.mensaje || "No se ha podido.");
      if (d?.exito) alTerminar?.();
    } catch { setEstado("No se ha podido conectar."); }
  };
  const p = e.parte || {};
  return (
    <Tarjeta icono="🔥" titulo="Ha fallado" tono="bg-rose-50/90">
      <p className="font-semibold text-slate-900 leading-snug">{e.emoji} {e.nombre}</p>
      <p className="text-xs text-slate-600">{p.busquedas ? `Fallaron ${p.errores} de sus ${p.busquedas} búsquedas (suele ser una web lenta).` : p.error || "Su último turno no salió bien."}</p>
      {e.ordenes ? (
        <button onClick={repetir} disabled={!!estado} className={`${PRESS} mt-auto h-11 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60`}>
          {estado === "trabajando" ? "Trabajando… (hasta 1 min)" : estado || "🔁 Repetir su turno ahora"}
        </button>
      ) : <p className="text-[11px] text-slate-500">Lo repite solo en su próximo turno.</p>}
    </Tarjeta>
  );
}

export function HoyTeToca({ bandeja, captacion = [], departamentos, flujo, decidir, enCurso, clave, alTerminar, alVerBandeja }) {
  const [quitados, setQuitados] = useState([]);
  const [aviso, setAviso] = useState("");
  const locales = captacion.filter((l) => !quitados.includes(l.clave));
  const fallos = departamentos.flatMap((d) => d.empleados).filter((e) => e.estado === "error");
  const total = bandeja.length + locales.length + fallos.length;
  return (
    <section id="hoy" className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up scroll-mt-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-slate-900 text-lg">✋ Hoy te toca {total > 0 && <span className="text-slate-400 font-medium">· {total}</span>}</h2>
        {total > 1 && <span className="md:hidden text-[11px] text-slate-400">Desliza →</span>}
      </div>
      {aviso && <p className="mt-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {total === 0 ? (
        <p className="mt-2 text-[15px] text-slate-700">✅ Nada pendiente. {flujo.entran ? `Anoche entraron ${fmt(flujo.entran)} eventos nuevos` : "Anoche no entró nada nuevo"} y hay {fmt(flujo.agenda)} en la agenda.</p>
      ) : (
        <ul className="mt-3 -mx-4 px-4 flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory md:mx-0 md:px-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible">
          {bandeja.slice(0, MAX_BANDEJA).map((e) => (
            <Tarjeta key={e.id} icono="📥" titulo="Evento sin fuente comprobada">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wide">{diaCorto(e.fecha)}{e.hora ? ` · ${e.hora}` : ""}</p>
                <p className="font-semibold text-slate-900 leading-snug">{e.titulo}</p>
                <p className="text-xs text-slate-500">{[e.lugar, e.localidad].filter(Boolean).join(" · ")}</p>
                {e.fuente && <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-600 hover:underline underline-offset-2 break-all line-clamp-1">🔗 Mirar la fuente</a>}
              </div>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => decidir(e.id, "subir")} disabled={!!enCurso} className={`${PRESS} flex-1 h-11 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50`}>{enCurso === e.id ? "…" : "✅ Subir"}</button>
                <button onClick={() => decidir(e.id, "tirar")} disabled={!!enCurso} className={`${PRESS} flex-1 h-11 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`}>✖ Tirar</button>
              </div>
            </Tarjeta>
          ))}
          {locales.map((l) => <Local key={l.clave} l={l} clave={clave} alQuitar={(t) => { setQuitados((q) => [...q, l.clave]); setAviso(t); }} />)}
          {fallos.map((e) => <Fallo key={e.id} e={e} clave={clave} alTerminar={alTerminar} />)}
        </ul>
      )}
      {bandeja.length > MAX_BANDEJA && <button onClick={alVerBandeja} className="mt-3 text-sm font-semibold text-sky-600">Ver los {bandeja.length} de la bandeja ↓</button>}
    </section>
  );
}

// El trabajo de anoche, paso a paso. Cada paso lleva a su sala del edificio.
export function Flujo({ flujo, alElegir }) {
  const pasos = [
    { sala: "busqueda", icono: "🔎", titulo: "Buscan", n: flujo.buscan, pie: "búsquedas anoche" },
    { sala: "control", icono: "🧐", titulo: "Comprueban", n: flujo.entran, pie: `nuevos · ${fmt(flujo.sinFuente)} sin fuente` },
    { sala: "archivo", icono: "📅", titulo: "Agenda", n: flujo.agenda, pie: "eventos, 3 semanas" },
    { sala: "escaparate", icono: "🗺️", titulo: "Planes", n: flujo.planesAyer, pie: "servidos ayer" },
    { sala: "negocio", icono: "📣", titulo: "Captación", n: flujo.captacion, pie: "locales listos" },
    { sala: "despacho", icono: "✋", titulo: "Tú", n: flujo.pendientes, pie: "esperan tu OK" },
  ];
  return (
    <section className="cz-up">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x">
        {pasos.map((p, i) => (
          <div key={p.sala} className="flex items-center gap-1.5 shrink-0 snap-start">
            <button onClick={() => alElegir(p.sala)} className={`${GLASS_SOFT} ${PRESS} w-[104px] sm:w-[128px] rounded-2xl px-3 py-2.5 text-left hover:-translate-y-0.5`}>
              <p className="text-[11px] font-semibold text-slate-500">{p.icono} {p.titulo}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 leading-tight">{p.n == null ? "—" : fmt(p.n)}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{p.pie}</p>
            </button>
            {i < pasos.length - 1 && <span className="text-slate-400 text-sm">→</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
