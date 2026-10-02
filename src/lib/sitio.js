// URL pública de la web (para el sitemap, las etiquetas canónicas y las imágenes al compartir).
// En Vercel se rellena sola; si usas dominio propio, define NEXT_PUBLIC_SITE_URL=https://tudominio.es
export const URL_SITIO =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
