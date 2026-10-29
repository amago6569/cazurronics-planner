"use client";
// 💬 El chat de la oficina, como un grupo de WhatsApp: todo lo que se dicen el equipo y el jefe en cada turno
// (lib/charla, 0 €) y abajo la caja para escribirle al jefe. Lo que le pides lo convierte en una orden para
// el empleado que toque o te contesta con las cifras (~0,0001 $ por mensaje).
import { useEffect, useMemo, useRef, useState } from "react";
import { GLASS, PRESS } from "../../../lib/estilos";

const hora = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const dia = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const COLORES = ["text-rose-600", "text-sky-600", "text-amber-600", "text-violet-600", "text-emerald-600", "text-fuchsia-600"];

export default function Chat({ charla = [], departamentos = [], clave, alTerminar }) {
  // Lo que escribes aquí se ve al momento; al recargar ya viene en la charla guardada y no se repite
  const [propias, setPropias] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  const lineas = useMemo(() => {
    const igual = (a, b) => a.de === b.de && String(a.texto).slice(0, 100) === String(b.texto).slice(0, 100);
    return [...charla, ...propias.filter((p) => !charla.some((c) => igual(c, p)))];
  }, [charla, propias]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [lineas.length]);

  const gente = useMemo(() => {
    const g = { jefe: { emoji: "👔", nombre: "Jefe" }, tu: { emoji: "📱", nombre: "Tú" } };
    departamentos.flatMap((d) => d.empleados).forEach((e) => { g[e.id] = { emoji: e.emoji, nombre: e.nombre }; });
    return g;
  }, [departamentos]);
  const color = (id) => COLORES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES.length];

  const enviar = async (ev) => {
    ev.preventDefault();
    const t = texto.trim();
    if (t.length < 2 || enviando) return;
    setEnviando(true); setTexto("");
    const ahora = new Date().toISOString();
    setPropias((l) => [...l, { de: "tu", a: "jefe", texto: t, cuando: ahora }]);
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ chat: t }) });
      const d = await r.json().catch(() => null);
      setPropias((l) => [...l, { de: "jefe", a: "tu", texto: d?.respuesta || d?.mensaje || "No he podido contestar.", cuando: new Date().toISOString() }]);
      if (d?.orden) alTerminar?.();
    } catch {
      setPropias((l) => [...l, { de: "jefe", a: "tu", texto: "No me llega tu mensaje. Prueba otra vez.", cuando: new Date().toISOString() }]);
    } finally { setEnviando(false); }
  };

  let diaAnterior = null;
  return (
    <section className={`${GLASS} rounded-[2rem] overflow-hidden cz-up flex flex-col h-[70dvh] min-h-[460px] sm:h-[620px]`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-900/5 bg-white/60">
        <span className="text-2xl">🏢</span>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 leading-tight">Oficina Cazurronics</p>
          <p className="text-xs text-slate-500 truncate">El jefe y {departamentos.reduce((s, d) => s + d.empleados.length, 0)} empleados · lo de los últimos 7 días</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1.5 bg-[linear-gradient(180deg,rgba(255,241,242,0.5),rgba(240,249,255,0.5))]">
        {!lineas.length && <p className="text-center text-sm text-slate-500 mt-10">Aún no se han dicho nada. En cuanto el equipo trabaje un turno, lo verás aquí.</p>}
        {lineas.map((l, i) => {
          const d = dia(l.cuando);
          const cabecera = d !== diaAnterior;
          diaAnterior = d;
          const mio = l.de === "tu";
          const p = gente[l.de] || { emoji: "🤖", nombre: l.de };
          const a = gente[l.a];
          const seguido = i > 0 && lineas[i - 1].de === l.de && !cabecera;
          return (
            <div key={`${l.cuando}${i}`}>
              {cabecera && <p className="my-2 text-center"><span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">{new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span></p>}
              <div className={`flex items-end gap-2 ${mio ? "justify-end" : ""}`}>
                {!mio && <span className={`w-8 shrink-0 text-center text-xl leading-none ${seguido ? "invisible" : ""}`}>{p.emoji}</span>}
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm ${mio ? "bg-emerald-100 rounded-br-md" : "bg-white rounded-bl-md"}`}>
                  {!mio && !seguido && <p className={`text-[11px] font-bold ${color(l.de)}`}>{p.nombre}{a && l.a !== "jefe" && l.a !== l.de ? <span className="font-medium text-slate-400"> → {a.emoji} {a.nombre}</span> : null}</p>}
                  <p className="text-[14px] leading-snug text-slate-800 whitespace-pre-line">{l.texto}</p>
                  <p className="text-right text-[10px] text-slate-400 -mt-0.5">{hora(l.cuando)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {enviando && <p className="pl-10 text-xs text-slate-500 animate-pulse">👔 El jefe está escribiendo…</p>}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar} className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-900/5 bg-white/70">
        <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 400))} disabled={enviando} placeholder="Escríbele al jefe: «que Música mire El Gran Café»"
          className="flex-1 min-w-0 h-12 rounded-full bg-white px-4 text-[15px] outline-none ring-1 ring-slate-900/10 focus:ring-2 focus:ring-rose-300 disabled:opacity-60" />
        <button disabled={enviando || texto.trim().length < 2} className={`${PRESS} h-12 w-12 shrink-0 rounded-full bg-slate-900 text-white text-lg disabled:opacity-40`} aria-label="Enviar">➤</button>
      </form>
    </section>
  );
}
