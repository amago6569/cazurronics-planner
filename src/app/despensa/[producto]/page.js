// /despensa/cecina, /despensa/quesos... — una página por producto (para Google) con el buscador ya elegido
import { notFound } from "next/navigation";
import Link from "next/link";
import PaginaContenido from "../../components/PaginaContenido";
import BuscadorDespensa from "../../components/BuscadorDespensa";
import SelectorSeccion from "../../components/SelectorSeccion";
import { catalogoParaWeb } from "../../../lib/despensa";
import { PRODUCTOS, enlaceMaps, productoPorId, topTiendas } from "../../../lib/despensaProductos";
import { ZONAS } from "../../../lib/zonas";
import { GLASS } from "../../../lib/estilos";

export const revalidate = 3600;
export const generateStaticParams = () => PRODUCTOS.map((p) => ({ producto: p.id }));

export async function generateMetadata({ params }) {
  const p = productoPorId((await params).producto);
  if (!p) return {};
  const que = p.nombre.toLowerCase();
  return {
    title: `Dónde comprar ${que} en León: las mejores tiendas · Cazurronics`,
    description: `Las 3 mejores tiendas de ${que} de León capital y de cada comarca de la provincia, elegidas a partir de prensa, guías y reseñas.`,
    alternates: { canonical: `/despensa/${p.id}` },
  };
}

export default async function ProductoDespensa({ params }) {
  const p = productoPorId((await params).producto);
  if (!p) notFound();
  const tiendas = await catalogoParaWeb({ producto: p.id });
  const porZona = ZONAS.map((z) => ({ z, top: topTiendas(tiendas.filter((t) => t.zona === z.id), { producto: p.id }) })).filter((x) => x.top.length);
  return (
    <PaginaContenido
      etiqueta="Despensa de León"
      titulo={`Dónde comprar ${p.nombre.toLowerCase()}`}
      destacado="en León"
      intro={`Las mejores tiendas de ${p.nombre.toLowerCase()} de la provincia, cerca de donde estés. Salen de Google Maps con su valoración y de lo que cuentan la prensa y las guías.`}
      ctaRef={`despensa-${p.id}`}
      actual={`/despensa/${p.id}`}
      arriba={<SelectorSeccion actual="despensa" className="cz-up" />}
    >
      <BuscadorDespensa tiendas={tiendas} productoInicial={p.id} />
      {porZona.length > 0 && (
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 px-1 mb-3">{p.emoji} {p.nombre}, comarca a comarca</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {porZona.map(({ z, top }) => (
              <div key={z.id} className="bg-white/60 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4">
                <h3 className="font-semibold text-slate-900">{z.emoji} {z.nombre}</h3>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {top.map((t, i) => (
                    <li key={t.placeId || t.nombre}><span className="tabular-nums text-slate-400 mr-1">{i + 1}.</span><a href={enlaceMaps(t)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-rose-600">{t.nombre}</a> <span className="text-slate-500">· {t.localidad}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
      <nav aria-label="Otros productos" className="flex flex-wrap justify-center gap-2">
        <Link href="/despensa" className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-semibold text-rose-600 hover:bg-white">🧺 Toda la despensa</Link>
        {PRODUCTOS.filter((x) => x.id !== p.id).map((x) => (
          <Link key={x.id} href={`/despensa/${x.id}`} className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600 transition-colors">{x.emoji} {x.nombre}</Link>
        ))}
      </nav>
    </PaginaContenido>
  );
}
