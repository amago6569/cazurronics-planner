// Proxy de fotos de Google Places: el navegador pide /api/foto?ref=..., y aquí añadimos la clave.
// Así la clave de Google Maps nunca aparece en el HTML ni en las peticiones del navegador.
export async function GET(request) {
  const ref = new URL(request.url).searchParams.get("ref") || "";
  if (!/^[\w-]{20,1200}$/.test(ref)) return new Response("Foto no válida", { status: 400 });

  const clave = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${clave}`;
  // La CDN de Vercel guarda la respuesta 30 días: la misma foto no vuelve a gastar cuota de Google
  const cache = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

  try {
    // Google responde con una redirección a la imagen final (googleusercontent.com, sin clave).
    const res = await fetch(url, { redirect: "manual" });
    const destino = res.headers.get("location");
    if (destino && res.status >= 300 && res.status < 400) {
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
