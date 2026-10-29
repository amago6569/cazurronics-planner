"use client";
// 🤝 La reunión del equipo: cada empleado propone algo con sus cifras reales (lib/reunion.js) y tú dices sí o no.
// «Verla en la oficina» los lleva a la mesa redonda del 3D y la dicen por turnos. Responder no gasta IA, salvo
// «repítelas ya» / «compruébalos ya», que son búsquedas dentro del cupo gratis de Google.
import { useState } from "react";
import { GLASS, PRESS } from "../../../lib/estilos";

export default function Reunion({ reunion, porId, clave, alVer, alFicha, alIr, alTerminar }) {
  const [hechas, setHechas] = useState({}); // id → texto del resultado
  const [ocupado, setOcupado] = useState(null);
  const propuestas = reunion?.propuestas || [];
  const quien = (id) => (id === "jefe" ? { emoji: "👔", nombre: "Jefe" } : porId[id] || { emoji: "🤖", nombre: id });

  const responder = async (p, si) => {
    if (si && p.accion?.tipo === "ficha") return alFicha(p.accion.empleado);
    if (si && p.accion?.tipo === "ir") return alIr(p.accion.destino);
    setOcupado(p.id);
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ reunion: p.id, accion: si ? "si" : "no", propuesta: p.accion }) });
      const d = await r.json().catch(() => null);
      setHechas((h) => ({ ...h, [p.id]: d?.mensaje || (d?.exito ? "Hecho" : "No ha podido ser") }));
      if (d?.exito && si) alTerminar?.();
    } catch { setHechas((h) => ({ ...h, [p.id]: "No se pudo conectar" })); } finally { setOcupado(null); }
  };

  return (
    <section id="reunion" className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up scroll-mt-4`} aria-labelledby="titulo-reunion">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-reunion" className="font-bold text-slate-900 text-lg">🤝 Reunión del equipo</h2>
        {propuestas.length > 0 && (
          <button onClick={alVer} className={`${PRESS} h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold`}>▶ Verla en la oficina</button>
        )}
      </div>
      <p className="mt-1 text-[15px] text-slate-700">{reunion?.abre}</p>
      {propuestas.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {propuestas.map((p) => {
            const q = quien(p.quien);
            const hecho = hechas[p.id];
            return (
              <li key={p.id} className="bg-white/80 ring-1 ring-slate-900/5 rounded-2xl p-3.5 flex flex-col gap-2 cz-fade">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl leading-none" aria-hidden>{q.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-500">{q.nombre}</p>
                    <p className="text-[15px] leading-snug text-slate-800">{p.texto}</p>
                    <p className="text-[15px] leading-snug font-semibold text-slate-900 mt-0.5">👉 {p.propuesta}</p>
                  </div>
                </div>
                {hecho ? (
                  <p className="text-sm font-semibold text-emerald-700" role="status">✓ {hecho}</p>
                ) : p.boton ? (
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => responder(p, true)} disabled={!!ocupado} className={`${PRESS} flex-1 h-11 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50`}>
                      {ocupado === p.id ? "Trabajando…" : p.boton}
                    </button>
                    <button onClick={() => responder(p, false)} disabled={!!ocupado} aria-label={`No a la propuesta de ${q.nombre}`} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`}>✖ No</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
