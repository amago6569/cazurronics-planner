// /despensa/morcilla/astorga, /despensa/cecina/bierzo... — una página por producto y comarca (para Google).
// La gente busca "dónde comprar cecina en Astorga": aquí sale la respuesta ya hecha, con datos que ya tenemos (0 €).
import { notFound } from "next/navigation";
import Link from "next/link";
import PaginaContenido from "../../../components/PaginaContenido";
import SelectorSeccion from "../../../components/SelectorSeccion";
import { catalogoCacheado } from "../../../../lib/despensaCache";
import { PRODUCTOS, enlaceEsTuTienda, enlaceMaps, productoPorId, topTiendas } from "../../../../lib/despensaProductos";
import { ZONAS } from "../../../../lib/zonas";
import { SEO_ZONAS, rutaDespensaZona, zonaPorSlug } from "../../../../lib/zonasSeo";
import { fraseRespuesta, jsonLdSeguro, listaTiendasJsonLd } from "../../../../lib/seo";
import { URL_SITIO } from "../../../../lib/sitio";
import { GLASS, PRESS } from "../../../../lib/estilos";

export const revalidate = 21600;
// Se generan la primera vez que alguien (o Google) las visita, no en cada despliegue
export const generateStaticParams = () => [];

async function cargar(params) {
  const { producto, zona } = await params;
  const p = productoPorId(producto);
  const z = zonaPorSlug(zona);
  if (!p || !z) return null;
  const tiendas = await catalogoCacheado(p.id);
  const top = topTiendas(tiendas.filter((t) => t.zona === z.id), { producto: p.id, cuantas: 10 });
  return { p, z, en: SEO_ZONAS[z.id].en, top, tiendas };
}

export async function generateMetadata({ params }) {
  const d = await cargar(params);
  if (!d) return {};
  const que = d.p.nombre.toLowerCase();
  return {
    title: `Dónde comprar ${que} en ${d.en} · Cazurronics`,
    description: d.top.length
      ? `Las mejores tiendas de ${que} en ${d.en}: ${d.top.slice(0, 3).map((t) => t.nombre).join(", ")}. Con su nota en Google Maps y cómo llegar.`
      : `Tiendas de ${que} en ${d.en}, en la Despensa de León de Cazurronics.`,
    alternates: { canonical: rutaDespensaZona(d.p.id, d.z.id) },
    // Sin tiendas todavía, fuera de Google: una página vacía resta
    ...(d.top.length ? {} : { robots: { index: false, follow: true } }),
  };
}

const coma = (n) => String(n).replace(".", ",");

export default async function ProductoEnZona({ params }) {
  const d = await cargar(params);
  if (!d) notFound();
  const { p, z, en, top, tiendas } = d;
  const que = p.nombre.toLowerCase();
  const respuesta = fraseRespuesta(p.nombre, top, `en ${en}`);
  const otrasZonas = ZONAS.filter((x) => x.id !== z.id && topTiendas(tiendas.filter((t) => t.zona === x.id), { producto: p.id }).length);
  const otrosProductos = PRODUCTOS.filter((x) => x.id !== p.id);
  return (
    <PaginaContenido
      etiqueta="Despensa de León"
      titulo={`Dónde comprar ${que}`}
      destacado={`en ${en}`}
      intro={respuesta || `Todavía estamos buscando las mejores tiendas de ${que} en ${en}. Mientras tanto, mira las de toda la provincia.`}
      ctaRef={`despensa-${p.id}-${z.id}`}
      actual={`/despensa/${p.id}`}
      arriba={<SelectorSeccion actual="despensa" className="cz-up" />}
    >
      {top.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(listaTiendasJsonLd({ nombre: `Dónde comprar ${que} en ${en}`, url: `${URL_SITIO}${rutaDespensaZona(p.id, z.id)}`, tiendas: top })) }} />}

      {top.length > 0 && (
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 px-1 mb-3">{p.emoji} Las mejores de {z.nombre}</h2>
          <ol className="grid sm:grid-cols-2 gap-3">
            {top.map((t, i) => (
              <li key={t.placeId || `${t.nombre}|${t.localidad}`} className="bg-white/70 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4 transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.35)]">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 text-white font-bold text-sm flex items-center justify-center shadow-[0_5px_12px_-4px_rgba(244,63,94,0.6)] tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 leading-snug">{t.nombre}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.localidad}
                      {t.nota && t.resenas >= 5 && <span className="ml-2 font-semibold text-slate-700">★ {coma(t.nota)} <span className="font-normal text-slate-500">({t.resenas})</span></span>}
                    </p>
                    {t.premios?.length > 0 && <p className="mt-2 text-[13px] font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200/70 rounded-xl px-2.5 py-1.5 leading-snug">🏆 {t.premios[0]}</p>}
                    {t.porque && <p className="text-sm text-slate-700 mt-2 leading-relaxed">{t.porque}</p>}
                    {t.especialidad && <p className="text-xs text-slate-500 mt-1.5"><span className="font-semibold text-slate-700">Conocida por:</span> {t.especialidad}</p>}
                    <a href={enlaceMaps(t)} target="_blank" rel="noopener noreferrer" className={`${PRESS} mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)] hover:bg-slate-800 hover:-translate-y-0.5`}>📍 Cómo llegar</a>
                    {enlaceEsTuTienda(t) && <a href={enlaceEsTuTienda(t)} target="_blank" rel="noopener noreferrer" className={`${PRESS} mt-3 ml-1 inline-flex items-center h-10 px-3 rounded-full text-sm font-semibold text-slate-500 hover:text-rose-600`}>¿Es tu tienda? Escríbenos</a>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex justify-center">
        <Link href={`/despensa/${p.id}`} className={`${PRESS} h-11 px-5 inline-flex items-center gap-2 rounded-full bg-white/70 ring-1 ring-white text-sm font-semibold text-rose-600 hover:bg-white hover:-translate-y-0.5`}>🗺️ Buscar {que} cerca de mí</Link>
      </div>

      {otrasZonas.length > 0 && (
        <nav aria-label={`${p.nombre} en otras comarcas`} className="flex flex-wrap justify-center gap-2">
          {otrasZonas.map((x) => (
            <Link key={x.id} href={rutaDespensaZona(p.id, x.id)} className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600 transition-colors">{x.emoji} {p.nombre} en {x.corto}</Link>
          ))}
        </nav>
      )}
      <nav aria-label="Otros productos" className="flex flex-wrap justify-center gap-2">
        {otrosProductos.map((x) => (
          <Link key={x.id} href={rutaDespensaZona(x.id, z.id)} className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600 transition-colors">{x.emoji} {x.nombre}</Link>
        ))}
      </nav>
    </PaginaContenido>
  );
}
