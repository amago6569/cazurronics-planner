// Catálogo de la Despensa guardado en la caché de Next (se renueva cada 6 horas).
// Las páginas de producto y de producto × comarca leen de aquí, así que 162 páginas nuevas no multiplican
// las lecturas al almacén (Upstash): como mucho una lectura del catálogo por producto cada 6 horas.
import { unstable_cache } from "next/cache";
import { catalogoParaWeb } from "./despensa";

export const catalogoCacheado = unstable_cache(
  (producto) => catalogoParaWeb({ producto }),
  ["despensa-catalogo"],
  { revalidate: 6 * 3600 },
);
