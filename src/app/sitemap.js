import { URL_SITIO } from "../lib/sitio";

export default function sitemap() {
  const ahora = new Date();
  return [
    { url: `${URL_SITIO}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITIO}/agenda-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITIO}/que-hacer-en-leon`, lastModified: ahora, changeFrequency: "daily", priority: 0.8 },
    { url: `${URL_SITIO}/donde-comer-en-leon`, lastModified: ahora, changeFrequency: "weekly", priority: 0.8 },
  ];
}
