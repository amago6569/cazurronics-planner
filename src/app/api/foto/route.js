// Proxy de fotos de Google Places: el navegador pide /api/foto?ref=..., y aquí añadimos la clave.
// Así la clave de Google Maps nunca aparece en el HTML ni en las peticiones del navegador.
import { dentroDelLimite, dentroDelTopeDiario } from "../../../lib/freno";

export async function GET(request) {
  const ref = new URL(request.url).searchParams.get("ref") || "";
  if (!/^[\w-]{20,1200}$/.test(ref)) return new Response("Foto no válida", { status: 400 });
  // Un plan carga como mucho unas pocas decenas de fotos: más de 120 por minuto es alguien inventando refs para gastar cuota
  if (!(await dentroDelLimite(request, "foto", 120, 60))) return new Response("Demasiadas fotos", { status: 429 });

  // Techo de gasto: cada foto que llega hasta aquí cuesta dinero (las ya guardadas en la CDN no). Pasado el tope, sale el rosetón.
  // Primero el de la conexión, para que una sola inventando refs no deje sin fotos a los demás
  if (!(await dentroDelTopeDiario("foto", 100, request, false)) || !(await dentroDelTopeDiario("foto", Number(process.env.FOTOS_MAX_DIA ?? 300), null, false))) return Response.redirect(new URL("/roseton.png", request.url), 302);

  const clave = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${clave}`;
  // La CDN de Vercel guarda la respuesta 30 días: la misma foto no vuelve a gastar cuota de Google
  const cache = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

  try {
    // Google responde con una redirección a la imagen final (googleusercontent.com, sin clave).
    const res = await fetch(url, { redirect: "manual" });
    const destino = res.headers.get("location");
    if (destino && /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(destino) && res.status >= 300 && res.status < 400) {
      return new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": cache } });
    }
    if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
      return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type"), "Cache-Control": cache } });
    }
  } catch (e) {
    console.error("[foto]", e?.message || e);
  }
  return Response.redirect(new URL("/roseton.png", request.url), 302);
}
