"use client";
// Órdenes desde la ficha de un empleado: que se ponga a trabajar ya o dejarle un encargo concreto.
// Cada orden se paga en búsquedas de Gemini (modelos 2.x, dentro de la cuota gratis de Google):
// un turno ~0,03-0,05 €, un encargo al momento ~0,005 €, uno para su próximo turno 0 €.
import { useState } from "react";
import { ZONAS } from "../../../lib/zonas";
import { BOTON_CTA, PRESS } from "../../../lib/estilos";
import { Monigote, diaCorto, fmt } from "./monigotes";

async function mandar(clave, cuerpo) {
  const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => null);
  return d || { exito: false, mensaje: `Error ${r.status}` };
}

function Resultado({ parte }) {
  const tiendas = parte.tipo === "tiendas";
  const lineas = [
    `${fmt(parte.busquedas)} ${parte.busquedas === 1 ? "búsqueda" : "búsquedas"}`,
    `${fmt(parte.encontrados)} ${tiendas ? "encontradas" : "encontrados"}`,
    tiendas ? `${fmt(parte.comprobadas)} comprobadas en Google Maps` : null,
    `${fmt(parte.nuevos)} ${tiendas ? "nuevas en la Despensa" : "nuevos en la agenda"}`,
    parte.dudosos ? `${fmt(parte.dudosos)} a tu bandeja` : null,
    parte.errores ? `${parte.errores} fallos` : null,
  ].filter(Boolean);
  return (
    <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-3 cz-fade">
      <p className="text-sm font-semibold text-emerald-800">✅ Hecho: {lineas.join(" · ")}</p>
      {parte.muestra?.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {parte.muestra.map((e) => <li key={`${e.titulo}${e.fecha || ""}`}>{e.fecha ? <><b className="text-rose-500">{diaCorto(e.fecha)}</b> · </> : "🏪 "}{e.titulo}{e.localidad ? ` (${e.localidad})` : ""}</li>)}
        </ul>
      )}
      {!parte.nuevos && !parte.errores && <p className="mt-1 text-xs text-slate-500">No había nada que no tuviéramos ya.</p>}
    </div>
  );
}

export default function Ordenes({ e, clave, alTerminar }) {
  const [trabajando, setTrabajando] = useState(null); // "turno" | "encargo" | "ya"
  const [parte, setParte] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [encargos, setEncargos] = useState(e.encargos || []);
  const [turnoHecho, setTurnoHecho] = useState(false);
  const [zona, setZona] = useState("leon"); // solo la Despensa: en qué comarca buscar

  const orden = async (tipo, cuerpo) => {
    setTrabajando(tipo); setError(""); setParte(null);
    try {
      const d = await mandar(clave, { empleado: e.id, ...cuerpo, ...(e.conComarca ? { zona } : {}) });
      if (!d.exito) { setError(d.mensaje || "No ha podido ser"); return; }
      if (d.parte) setParte(d.parte);
      if (tipo === "turno") setTurnoHecho(true);
      if (d.encargos) setEncargos(d.encargos.map((x) => (typeof x === "string" ? x : x.texto)));
      if (cuerpo.accion === "encargo") setTexto("");
      alTerminar?.();
    } catch { setError("No se pudo conectar"); } finally { setTrabajando(null); }
  };

  const ocupado = !!trabajando;
  const listo = texto.trim().length >= 4;
  return (
    <div className="mt-4 pt-4 border-t border-slate-900/5 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tus órdenes</p>

      {trabajando === "turno" || trabajando === "ya" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 ring-1 ring-slate-900/5 p-3 cz-fade">
          <Monigote estado="ok" semilla={3} camisa="#f43f5e" emoji={e.emoji} className="w-20 h-auto shrink-0" />
          <p className="text-sm text-slate-700">{trabajando === "turno" ? "Buscando… puede tardar hasta un minuto." : "Buscando tu encargo… unos 40 segundos."}</p>
        </div>
      ) : (
        <button onClick={() => orden("turno", { accion: "trabajar" })} disabled={ocupado || turnoHecho} className={`${BOTON_CTA} w-full disabled:opacity-60`}>
          {turnoHecho ? "✓ Turno hecho" : "▶ Ponte a trabajar ya"}
        </button>
      )}
      <p className="text-[11px] text-slate-400 -mt-1">Repite su turno ahora (~0,03-0,05 €{e.conComarca ? " + Google Maps dentro del cupo gratis" : ""}). Como mucho una vez cada 6 horas.</p>

      {parte && <Resultado parte={parte} />}
      {error && <p className="text-sm text-rose-600 cz-fade">{error}</p>}

      <div className="space-y-2">
        <label htmlFor="cz-encargo" className="text-sm font-semibold text-slate-800">📝 Encargo</label>
        <textarea
          id="cz-encargo" value={texto} onChange={(ev) => setTexto(ev.target.value.slice(0, 200))} rows={2} disabled={ocupado}
          placeholder={e.conComarca ? "Ej.: cecina de chivo cerca de Boñar" : "Ej.: mira la feria del pimiento de Fresno de la Vega"}
          className="w-full resize-none bg-white/80 rounded-2xl px-4 py-3 text-[15px] outline-none ring-1 ring-slate-900/10 focus:ring-2 focus:ring-rose-300 disabled:opacity-60"
        />
        {e.conComarca && (
          <select value={zona} onChange={(ev) => setZona(ev.target.value)} disabled={ocupado} aria-label="Comarca" className="w-full h-11 bg-white/80 rounded-2xl px-3 text-[15px] outline-none ring-1 ring-slate-900/10 focus:ring-2 focus:ring-rose-300">
            {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.emoji} {z.nombre}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={() => orden("encargo", { accion: "encargo", texto, ya: false })} disabled={ocupado || !listo} className={`${PRESS} flex-1 h-11 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50`}>
            {trabajando === "encargo" ? "…" : e.conComarca ? "Esta noche · 0 €" : "Próximo turno · 0 €"}
          </button>
          <button onClick={() => orden("ya", { accion: "encargo", texto, ya: true })} disabled={ocupado || !listo} className={`${PRESS} flex-1 h-11 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50`}>
            Ya mismo · ~0,005 €
          </button>
        </div>
        {encargos.length > 0 && (
          <ul className="space-y-1">
            {encargos.map((t) => <li key={t} className="text-xs text-slate-600 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-1.5">⏳ {t}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
