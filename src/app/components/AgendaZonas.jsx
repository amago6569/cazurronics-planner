"use client";
// Agenda de León con mapa: se elige una zona (en el mapa o en las pastillas) y un día,
// y se ve solo lo de ahí, sin repetir y ordenado por horas. Siempre empieza en León capital.
import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import TarjetaEvento, { fechaLarga } from "./TarjetaEvento";
import AgendaFranjas from "./AgendaFranjas";
import { GLASS, PRESS } from "../../lib/estilos";
import { ordenarPorHora } from "../../lib/agenda";
import { TODAS, ZONA_INICIAL, ZONAS, zonaDe, zonaPorId } from "../../lib/zonas";

const MapaZonas = dynamic(() => import("./MapaZonas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-rose-50" />,
});

const diaCorto = (f) => {
  const d = new Date(`${f}T12:00:00`);
  return { semana: d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", ""), num: d.getDate() };
};

// enMarcha: lo que dura varios días (una vez) · dias: [{ fecha, eventos }] con lo de cada día
export default function AgendaZonas({ enMarcha = [], dias = [] }) {
  const [zona, setZona] = useState(ZONA_INICIAL);
  const [dia, setDia] = useState(TODAS);
  const resultados = useRef(null);

  // Cada evento con su zona, calculada una sola vez
  const datos = useMemo(() => ({
    enMarcha: enMarcha.map((e) => ({ ...e, _zona: zonaDe(e) })),
    dias: dias.map((d) => ({ fecha: d.fecha, eventos: d.eventos.map((e) => ({ ...e, _zona: zonaDe(e) })) })),
  }), [enMarcha, dias]);

  const deLaZona = (e, z = zona) => z === TODAS || e._zona === z;

  // Cuántos planes hay en cada zona (para las burbujas del mapa y las pastillas)
  const totales = useMemo(() => {
    const t = { [TODAS]: 0 };
    for (const e of [...datos.enMarcha, ...datos.dias.flatMap((d) => d.eventos)]) {
      t[e._zona] = (t[e._zona] || 0) + 1;
      t[TODAS]++;
    }
    return t;
  }, [datos]);

  const zonasConTotal = ZONAS.map((z) => ({ ...z, total: totales[z.id] || 0 }));
  const enMarchaZona = ordenarPorHora(datos.enMarcha.filter((e) => deLaZona(e)));
  const diasZona = datos.dias.map((d) => ({ fecha: d.fecha, eventos: d.eventos.filter((e) => deLaZona(e)) }));
  const diasVisibles = diasZona.filter((d) => d.eventos.length && (dia === TODAS || d.fecha === dia));
  const totalZona = enMarchaZona.length + diasZona.reduce((s, d) => s + d.eventos.length, 0);
  const nombreZona = zona === TODAS ? "toda la provincia" : zonaPorId(zona)?.nombre;

  const elegirZona = (id) => {
    setZona(id);
    setDia(TODAS);
    // En el móvil, que se vea que ha cambiado: bajamos un poco hasta los resultados
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      requestAnimationFrame(() => resultados.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const pastilla = ({ id, emoji, texto, total }) => {
    const activa = zona === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => elegirZona(id)}
        aria-pressed={activa}
        className={`${PRESS} shrink-0 snap-start h-10 pl-3 pr-2.5 inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap ${activa ? "bg-slate-900 text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)]" : "bg-white/70 text-slate-700 ring-1 ring-white hover:bg-white"} ${!total && !activa ? "opacity-60" : ""}`}
      >
        <span aria-hidden>{emoji}</span>{texto}
        <span className={`min-w-[1.4rem] h-[1.4rem] px-1 rounded-full text-[11px] leading-[1.4rem] tabular-nums ${activa ? "bg-white/20" : "bg-slate-900/5 text-slate-500"}`}>{total}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* MAPA + ZONAS */}
      <section className={`${GLASS} rounded-[2.25rem] p-3 sm:p-4 cz-up`} aria-labelledby="zonas-titulo">
        <div className="flex items-end justify-between gap-3 px-2 pt-1 pb-3">
          <div>
            <h2 id="zonas-titulo" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">¿Por dónde te mueves?</h2>
            <p className="text-[13px] text-slate-500 leading-snug">Pincha en una zona del mapa para ver lo que hay allí.</p>
          </div>
        </div>
        {/* isolate: que el mapa no se ponga por encima de la cabecera fija */}
        <div className="relative isolate z-0 h-[300px] sm:h-[380px] rounded-[1.6rem] overflow-hidden ring-1 ring-slate-900/5">
          <MapaZonas zonas={zonasConTotal} seleccionada={zona} onElegir={elegirZona} />
        </div>
        <div className="-mx-3 sm:-mx-4 mt-3 px-3 sm:px-4 flex gap-2 overflow-x-auto no-scrollbar snap-x scroll-px-3" role="group" aria-label="Elegir zona">
          {zonasConTotal.map((z) => pastilla({ id: z.id, emoji: z.emoji, texto: z.corto, total: z.total }))}
          {pastilla({ id: TODAS, emoji: "🗺️", texto: "Toda la provincia", total: totales[TODAS] })}
        </div>
      </section>

      {/* RESULTADOS DE LA ZONA */}
      <div ref={resultados} className="scroll-mt-24 space-y-4 sm:space-y-5">
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Agenda de</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 first-letter:uppercase">
            {nombreZona} <span className="text-base font-medium text-slate-400">· {totalZona} {totalZona === 1 ? "plan" : "planes"}</span>
          </h2>
        </div>

        {/* Días: para ir directo al que interesa */}
        {totalZona > 0 && (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar snap-x scroll-px-4 sm:scroll-px-0" role="group" aria-label="Elegir día">
            <button type="button" onClick={() => setDia(TODAS)} aria-pressed={dia === TODAS} className={`${PRESS} shrink-0 snap-start h-14 px-4 rounded-2xl text-sm font-semibold ${dia === TODAS ? "bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_10px_24px_-10px_rgba(244,63,94,0.8)]" : "bg-white/70 text-slate-700 ring-1 ring-white"}`}>Todos</button>
            {diasZona.map((d) => {
              const { semana, num } = diaCorto(d.fecha);
              const activo = dia === d.fecha;
              return (
                <button key={d.fecha} type="button" disabled={!d.eventos.length} onClick={() => setDia(d.fecha)} aria-pressed={activo} aria-label={`${fechaLarga(d.fecha)}: ${d.eventos.length} planes`}
                  className={`${PRESS} shrink-0 snap-start w-14 h-14 rounded-2xl flex flex-col items-center justify-center leading-none disabled:opacity-35 ${activo ? "bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_10px_24px_-10px_rgba(244,63,94,0.8)]" : "bg-white/70 text-slate-700 ring-1 ring-white"}`}>
                  <span className={`text-[10px] font-semibold uppercase ${activo ? "text-white/80" : "text-slate-400"}`}>{semana}</span>
                  <span className="text-lg font-bold tabular-nums mt-0.5">{num}</span>
                  <span className={`text-[9px] font-semibold mt-0.5 ${activo ? "text-white/80" : "text-rose-500"}`}>{d.eventos.length ? `${d.eventos.length}` : "–"}</span>
                </button>
              );
            })}
          </div>
        )}

        {enMarchaZona.length > 0 && (
          <section aria-labelledby="en-marcha">
            <h3 id="en-marcha" className="text-lg font-bold tracking-tight text-slate-900 px-1">📌 En marcha estos días</h3>
            <p className="text-sm text-slate-500 px-1 mb-3">Exposiciones, ferias y mercados que puedes visitar cualquier día de su calendario.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {enMarchaZona.map((e, i) => <TarjetaEvento key={`m-${i}-${e.titulo}`} e={e} mostrarCuando />)}
            </div>
          </section>
        )}

        {diasVisibles.map((d) => (
          <section key={d.fecha} aria-labelledby={`dia-${d.fecha}`}>
            <h3 id={`dia-${d.fecha}`} className="flex items-baseline gap-2 text-lg font-bold tracking-tight text-slate-900 px-1 mb-3">
              <span className="first-letter:uppercase">{fechaLarga(d.fecha)}</span>
              <span className="text-sm font-medium text-slate-400">{d.eventos.length} {d.eventos.length === 1 ? "plan" : "planes"}</span>
            </h3>
            <AgendaFranjas eventos={d.eventos} />
          </section>
        ))}

        {totalZona === 0 && (
          <div className={`${GLASS} rounded-[1.75rem] p-6 text-center`}>
            <p className="text-3xl mb-2">🔎</p>
            <p className="font-semibold text-slate-900">Aún no tenemos nada en {nombreZona} estos días</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Cada mañana volvemos a rastrear toda la provincia. Mientras, mira lo que hay en la capital.</p>
            <button type="button" onClick={() => elegirZona(ZONA_INICIAL)} className={`${PRESS} h-11 px-5 rounded-full bg-slate-900 text-white text-sm font-semibold`}>🦁 Ver León capital</button>
          </div>
        )}
      </div>
    </div>
  );
}
