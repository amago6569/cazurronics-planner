// /despensa/cecina, /despensa/quesos... — una página por producto (para Google) con el buscador ya elegido
import { notFound } from "next/navigation";
import Link from "next/link";
import PaginaContenido from "../../components/PaginaContenido";
import BuscadorDespensa from "../../components/BuscadorDespensa";
import SelectorSeccion from "../../components/SelectorSeccion";
import { catalogoCacheado } from "../../../lib/despensaCache";
import { PRODUCTOS, enlaceMaps, productoPorId, topTiendas } from "../../../lib/despensaProductos";
import { ZONAS } from "../../../lib/zonas";
import { GLASS } from "../../../lib/estilos";
import { rutaDespensaZona } from "../../../lib/zonasSeo";
import { fraseRespuesta, jsonLdSeguro, listaTiendasJsonLd } from "../../../lib/seo";
import { URL_SITIO } from "../../../lib/sitio";

export const revalidate = 3600;
export const generateStaticParams = () => PRODUCTOS.map((p) => ({ producto: p.id }));

export async function generateMetadata({ params }) {
  const p = productoPorId((await params).producto);
  if (!p) return {};
  const que = p.nombre.toLowerCase();
  const tiendas = await catalogoCacheado(p.id);
  return {
    // Sin tiendas todavía, la página no se enseña en Google: una página vacía resta
    ...(topTiendas(tiendas, { producto: p.id }).length ? {} : { robots: { index: false, follow: true } }),
    title: `Dónde comprar ${que} en León: las mejores tiendas · Cazurronics`,
    description: `Las 3 mejores tiendas de ${que} de León capital y de cada comarca de la provincia, elegidas a partir de prensa, guías y reseñas.`,
    alternates: { canonical: `/despensa/${p.id}` },
  };
}

export default async function ProductoDespensa({ params }) {
  const p = productoPorId((await params).producto);
  if (!p) notFound();
  const tiendas = await catalogoCacheado(p.id);
  const top = topTiendas(tiendas, { producto: p.id, cuantas: 10 });
  const respuesta = fraseRespuesta(p.nombre, top, "en la provincia de León");
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
      {top.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(listaTiendasJsonLd({ nombre: `Dónde comprar ${p.nombre.toLowerCase()} en León`, url: `${URL_SITIO}/despensa/${p.id}`, tiendas: top })) }} />}
      <BuscadorDespensa tiendas={tiendas} productoInicial={p.id} />
      {porZona.length > 0 && (
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 px-1 mb-3">{p.emoji} {p.nombre}, comarca a comarca</h2>
          {respuesta && <p className="text-sm text-slate-600 leading-relaxed px-1 mb-4 max-w-3xl">{respuesta}</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {porZona.map(({ z, top }) => (
              <div key={z.id} className="bg-white/60 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4">
                <h3 className="font-semibold text-slate-900"><Link href={rutaDespensaZona(p.id, z.id)} className="hover:text-rose-600 transition-colors">{z.emoji} {z.nombre}</Link></h3>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {top.map((t, i) => (
                    <li key={t.placeId || t.nombre}><span className="tabular-nums text-slate-400 mr-1">{i + 1}.</span><a href={enlaceMaps(t)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-rose-600">{t.nombre}</a> <span className="text-slate-500">· {t.localidad}</span>{t.premios?.length > 0 && <span title={t.premios[0]}> 🏆</span>}</li>
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
