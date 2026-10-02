import { URL_SITIO } from "../lib/sitio";

export default function robots() {
  return {
    // /plan/ no se bloquea: las vistas previas de WhatsApp o X necesitan leerlo (ya lleva noindex)
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/panel", "/negocio/"] },
    sitemap: `${URL_SITIO}/sitemap.xml`,
  };
}
