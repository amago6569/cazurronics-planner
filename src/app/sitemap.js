import { URL_SITIO } from "../lib/sitio";
import { ZONAS } from "../lib/zonas";
import { rutaDespensaZona, rutaZona } from "../lib/zonasSeo";
import { PRODUCTOS, topTiendas } from "../lib/despensaProductos";
import { catalogoCacheado } from "../lib/despensaCache";

export const revalidate = 86400;

// Despensa: solo las páginas que ya tienen tiendas (las vacías llevan noindex y no se anuncian).
// Lee el catálogo de la caché de Next: no suma lecturas al almacén.
async function paginasDespensa(ahora) {
  const urls = [];
  for (const p of PRODUCTOS) {
    const tiendas = await catalogoCacheado(p.id).catch(() => []);
    if (!topTiendas(tiendas, { producto: p.id }).length) continue;
    urls.push({ url: `${URL_SITIO}/despensa/${p.id}`, lastModified: ahora, changeFrequency: "weekly", priority: 0.6 });
    for (const z of ZONAS) {
      if (!topTiendas(tiendas.filter((t) => t.zona === z.id), { producto: p.id }).length) continue;
      urls.push({ url: `${URL_SITIO}${rutaDespensaZona(p.id, z.id)}`, lastModified: ahora, changeFrequency: "weekly", priority: 0.5 });
    }
  }
  return urls;
}

export default async function sitemap() {
  const ahora = new Date();
  return [
    { url: `${URL_SITIO}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITIO}/agenda-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITIO}/que-hacer-en-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.8 },
    { url: `${URL_SITIO}/donde-comer-en-leon`, lastModified: ahora, changeFrequency: "weekly", priority: 0.8 },
    { url: `${URL_SITIO}/finde`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITIO}/que-hacer-hoy-en-leon`, lastModified: ahora, changeFrequency: "hourly", priority: 0.8 },
    { url: `${URL_SITIO}/que-hacer-manana-en-leon`, lastModified: ahora, changeFrequency: "hourly", priority: 0.7 },
    { url: `${URL_SITIO}/despensa`, lastModified: ahora, changeFrequency: "weekly", priority: 0.8 },
    ...(await paginasDespensa(ahora)),
    // Una página por zona de la provincia (Bierzo, Astorga, Riaño...)
    ...ZONAS.map((z) => ({ url: `${URL_SITIO}${rutaZona(z.id)}`, lastModified: ahora, changeFrequency: "daily", priority: 0.7 })),
  ];
}
