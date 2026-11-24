// URL pública de la web (para el sitemap, las etiquetas canónicas y las imágenes al compartir).
// En Vercel se rellena sola; si usas dominio propio, define NEXT_PUBLIC_SITE_URL=https://tudominio.es
export const URL_SITIO =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

// Imagen al compartir (app/opengraph-image.js). Una página que define su propio openGraph pierde la
// del layout (Next no mezcla objetos anidados), así que la tiene que volver a poner.
export const IMAGEN_OG = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Cazurronics Planner · tu planazo en León" }];
