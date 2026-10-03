// Plantilla de "Qué hacer hoy / mañana en León": los planes de UN día, ordenados por horas,
// con la capital primero y debajo lo mejor de cada zona de la provincia.
import { cache } from "react";
import Link from "next/link";
import PaginaContenido from "./PaginaContenido";
import TarjetaEvento, { fechaLarga } from "./TarjetaEvento";
import AgendaFranjas from "./AgendaFranjas";
import { eventosProximos } from "../../lib/eventos";
import { organizarAgenda } from "../../lib/agenda";
import { ZONAS, zonaDe } from "../../lib/zonas";
import { rutaZona } from "../../lib/zonasSeo";
import { datosEstructurados } from "../../lib/jsonld";
import { GLASS } from "../../lib/estilos";

const CAPITAL = ["leon", "alfoz"];
const MAX_POR_ZONA = 4;

const datosDia = cache(async (offset) => {
  const dias = await eventosProximos(offset + 1);
  const dia = dias[offset];
  const delDia = dia?.eventos || [];
  const capital = organizarAgenda([{ fecha: dia.fecha, eventos: delDia.filter((e) => CAPITAL.includes(zonaDe(e))) }]);
  const provincia = ZONAS.filter((z) => !CAPITAL.includes(z.id))
    .map((z) => ({ z, org: organizarAgenda([{ fecha: dia.fecha, eventos: delDia.filter((e) => zonaDe(e) === z.id) }]) }))
    .map(({ z, org }) => ({ z, enMarcha: org.enMarcha.length, eventos: org.porDia[0]?.grupos.flatMap((g) => g.eventos) || [] }))
    .filter((x) => x.eventos.length);
  const total = capital.enMarcha.length + (capital.porDia[0]?.total || 0) + provincia.reduce((s, x) => s + x.eventos.length, 0);
  return { fecha: dia.fecha, capital, provincia, total };
});

const PALABRA = ["hoy", "mañana"];
export const rutaDia = (offset) => (offset === 0 ? "/que-hacer-hoy-en-leon" : "/que-hacer-manana-en-leon");

export async function metadataDia(offset) {
  const { fecha, total } = await datosDia(offset);
  const titulo = `Qué hacer ${PALABRA[offset]} en León (${fechaLarga(fecha)}) · Cazurronics`;
  const descripcion = `Planes para ${PALABRA[offset]} en León y la provincia: conciertos, teatro, mercados, fiestas y exposiciones, ordenados por horas y con su fuente. Actualizado cada día.`;
  return {
    title: titulo, description: descripcion,
    alternates: { canonical: rutaDia(offset) },
    openGraph: { title: titulo, description: descripcion, url: rutaDia(offset), type: "website", locale: "es_ES" },
    ...(total === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PaginaDia({ offset }) {
  const { fecha, capital, provincia, total } = await datosDia(offset);
  const hayCapital = capital.enMarcha.length > 0 || capital.porDia.length > 0;
  const otraRuta = rutaDia(offset === 0 ? 1 : 0);
  return (
    <PaginaContenido
      etiqueta={fechaLarga(fecha)}
      titulo="Qué hacer"
      destacado={`${PALABRA[offset]} en León`}
      intro={total ? `${total} planes distintos ${PALABRA[offset]} en León y la provincia, ordenados por horas y con su fuente para que puedas comprobarlos.` : `Todavía no tenemos planes cerrados para ${PALABRA[offset]}. Rastreamos las agendas cada mañana: vuelve en unas horas.`}
      ctaRef={offset === 0 ? "hoy" : "manana"}
      actual={rutaDia(offset)}
    >
      {total > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados({ enMarcha: capital.enMarcha, porDia: capital.porDia })).replace(/</g, "\\u003c") }} />}

      {hayCapital && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">En León capital y alrededores</h2>
          <div className="space-y-5">
            {capital.porDia[0] && <AgendaFranjas eventos={capital.porDia[0].grupos.flatMap((g) => g.eventos)} />}
            {capital.enMarcha.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 px-1 mb-2">📌 Abierto estos días</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{capital.enMarcha.slice(0, 6).map((e, i) => <TarjetaEvento key={i} e={e} mostrarCuando />)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {provincia.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Por la provincia</h2>
          <div className="space-y-5">
            {provincia.map(({ z, eventos }) => (
              <div key={z.id}>
                <div className="flex items-center justify-between gap-2 px-1 mb-2">
                  <p className="text-sm font-semibold text-slate-700">{z.emoji} {z.nombre}</p>
                  <Link href={rutaZona(z.id)} className="text-xs font-semibold text-rose-600 hover:underline underline-offset-2">Ver toda la zona</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{eventos.slice(0, MAX_POR_ZONA).map((e, i) => <TarjetaEvento key={i} e={e} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <section className={`${GLASS} rounded-[2rem] p-6 text-center`}>
          <p className="text-slate-600">Mientras tanto, mira la <Link href="/agenda-leon" className="text-rose-600 underline underline-offset-2">agenda de los próximos 14 días</Link> o <Link href={otraRuta} className="text-rose-600 underline underline-offset-2">qué hacer {PALABRA[offset === 0 ? 1 : 0]}</Link>.</p>
        </section>
      )}
    </PaginaContenido>
  );
}
