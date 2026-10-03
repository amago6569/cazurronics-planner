import { URL_SITIO } from "../lib/sitio";
import { ZONAS } from "../lib/zonas";
import { rutaZona } from "../lib/zonasSeo";

export default function sitemap() {
  const ahora = new Date();
  return [
    { url: `${URL_SITIO}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITIO}/agenda-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITIO}/que-hacer-en-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.8 },
    { url: `${URL_SITIO}/donde-comer-en-leon`, lastModified: ahora, changeFrequency: "weekly", priority: 0.8 },
    { url: `${URL_SITIO}/finde`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITIO}/que-hacer-hoy-en-leon`, lastModified: ahora, changeFrequency: "hourly", priority: 0.8 },
    { url: `${URL_SITIO}/que-hacer-manana-en-leon`, lastModified: ahora, changeFrequency: "hourly", priority: 0.7 },
    // Una página por zona de la provincia (Bierzo, Astorga, Riaño...)
    ...ZONAS.map((z) => ({ url: `${URL_SITIO}${rutaZona(z.id)}`, lastModified: ahora, changeFrequency: "daily", priority: 0.7 })),
  ];
}
