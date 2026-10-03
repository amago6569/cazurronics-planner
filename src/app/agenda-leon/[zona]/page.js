// /agenda-leon/[zona] — la agenda de los próximos 14 días de UNA zona (Bierzo, Astorga, Riaño...).
// Páginas pensadas para Google: "qué hacer en el Bierzo", "planes en Astorga este finde"...
// Sin repetidos, ordenada por horas, con datos estructurados "Event".
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PaginaContenido from "../../components/PaginaContenido";
import TarjetaEvento, { fechaLarga } from "../../components/TarjetaEvento";
import AgendaFranjas from "../../components/AgendaFranjas";
import { eventosProximos } from "../../../lib/eventos";
import { organizarAgenda } from "../../../lib/agenda";
import { ZONAS, zonaDe } from "../../../lib/zonas";
import { SEO_ZONAS, rutaZona, zonaPorSlug } from "../../../lib/zonasSeo";
import { datosEstructurados } from "../../../lib/jsonld";
import { GLASS } from "../../../lib/estilos";

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => ZONAS.map((z) => ({ zona: SEO_ZONAS[z.id].slug }));

const cargar = cache(async (zonaId) => {
  const dias = await eventosProximos(14);
  const agenda = organizarAgenda(dias.map((d) => ({ fecha: d.fecha, eventos: d.eventos.filter((e) => zonaDe(e) === zonaId) })));
  const total = agenda.enMarcha.length + agenda.porDia.reduce((s, d) => s + d.total, 0);
  return { agenda, total };
});

export async function generateMetadata({ params }) {
  const { zona } = await params;
  const z = zonaPorSlug(zona);
  if (!z) return {};
  const { total } = await cargar(z.id);
  const titulo = `Qué hacer en ${SEO_ZONAS[z.id].en}: agenda de los próximos días · Cazurronics`;
  const descripcion = `Conciertos, teatro, mercados, fiestas y exposiciones en ${SEO_ZONAS[z.id].en} en los próximos días. Agenda actualizada cada mañana, sin repetidos y ordenada por horas.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: rutaZona(z.id) },
    openGraph: { title: titulo, description: descripcion, url: rutaZona(z.id), type: "website", locale: "es_ES" },
    // Una zona sin ningún plan cerrado no merece aparecer en Google hasta que lo tenga
    ...(total === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function AgendaDeZona({ params }) {
  const { zona } = await params;
  const z = zonaPorSlug(zona);
  if (!z) notFound();
  const seo = SEO_ZONAS[z.id];
  const { agenda, total } = await cargar(z.id);

  return (
    <PaginaContenido
      etiqueta={`Agenda · ${z.nombre}`}
      titulo="Qué hacer en"
      destacado={seo.en}
      intro={`${total ? `${total} planes distintos en los próximos días. ` : ""}${seo.intro}`}
      ctaRef={`zona-${z.id}`}
      actual={rutaZona(z.id)}
    >
      {total > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados(agenda)).replace(/</g, "\\u003c") }} />}

      {agenda.enMarcha.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">📌 En marcha estos días</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{agenda.enMarcha.map((e, i) => <TarjetaEvento key={i} e={e} mostrarCuando />)}</div>
        </section>
      )}

      {agenda.porDia.map((d) => (
        <section key={d.fecha}>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3 first-letter:uppercase">{fechaLarga(d.fecha)}</h2>
          <AgendaFranjas eventos={d.grupos.flatMap((g) => g.eventos)} />
        </section>
      ))}

      {total === 0 && (
        <section className={`${GLASS} rounded-[2rem] p-6 text-center`}>
          <p className="font-semibold text-slate-900">Ahora mismo no tenemos planes cerrados en esta zona.</p>
          <p className="text-sm text-slate-600 mt-1">Rastreamos las agendas cada mañana: vuelve en unas horas o mira <Link href="/agenda-leon" className="text-rose-600 underline underline-offset-2">toda la provincia</Link>.</p>
        </section>
      )}

      {seo.imprescindibles.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Imprescindibles de la zona</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {seo.imprescindibles.map(([icono, nombre, texto]) => (
              <div key={nombre} className={`${GLASS} rounded-[1.5rem] p-4`}>
                <p className="text-2xl">{icono}</p>
                <h3 className="font-semibold text-slate-900 mt-2">{nombre}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Otras zonas de la provincia" className="px-1">
        <p className="text-sm font-semibold text-slate-700 mb-2">Mira otras zonas</p>
        <div className="flex flex-wrap gap-2">
          {ZONAS.filter((o) => o.id !== z.id).map((o) => (
            <Link key={o.id} href={rutaZona(o.id)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/60 ring-1 ring-white text-[13px] font-medium text-slate-700 hover:bg-white hover:text-rose-600 transition-colors">
              <span aria-hidden>{o.emoji}</span>{o.corto}
            </Link>
          ))}
        </div>
      </nav>
    </PaginaContenido>
  );
}
