// Catálogo de la Despensa guardado en la caché de Next (se renueva cada 6 horas).
// Las páginas de producto y de producto × comarca leen de aquí, así que 162 páginas nuevas no multiplican
// las lecturas al almacén (Upstash): como mucho una lectura del catálogo por producto cada 6 horas.
import { unstable_cache } from "next/cache";
import { catalogoParaWeb } from "./despensa";

// Solo las tiendas de ese producto: mucho más pequeño (la caché de Next no guarda nada de más de 2 MB, y el
// catálogo entero se acercaba). Lo usan las páginas de producto × comarca y el sitemap.
export const tiendasDeProducto = unstable_cache(
  async (producto) => (await catalogoParaWeb({ producto })).filter((t) => t.producto === producto),
  ["despensa-producto"],
  { revalidate: 6 * 3600 },
);

export const catalogoCacheado = unstable_cache(
  (producto) => catalogoParaWeb({ producto }),
  ["despensa-catalogo"],
  { revalidate: 6 * 3600 },
);
