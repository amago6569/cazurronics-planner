// ============ FUENTES DE LA IA ============
// Cuando la IA busca en Google, los enlaces que da a menudo son redirecciones de Google (vertexaisearch...) y no la
// página de verdad. Antes se descartaban y con ellas el dato. Aquí se convierten en la página real:
//  · Un enlace de redirección se sigue una vez (sin descargar la página) para leer adónde lleva.
//  · Si la IA no da enlace bueno, se usa la página que Google dice que respalda ese trozo de la respuesta.
const REDIRECCION = /vertexaisearch\.cloud\.google\.com|grounding-api-redirect/;

export const esRedireccion = (url) => typeof url === "string" && REDIRECCION.test(url);

// La página a la que lleva una redirección de Google, o null
export async function seguirRedireccion(url, ms = 3500) {
  if (!esRedireccion(url)) return url || null;
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(ms) });
    try { await r.body?.cancel(); } catch { /* nada */ }
    const destino = r.headers.get("location");
    return destino && /^https?:\/\//.test(destino) && !esRedireccion(destino) ? destino : null;
  } catch {
    return null;
  }
}

// Las páginas que respaldan el trozo de texto [desde, hasta) de la respuesta (en caracteres), en orden.
// Google da las posiciones en bytes UTF-8: se pasan a bytes para comparar.
export function fuentesDelTramo(texto, grounding, desde, hasta) {
  if (!grounding?.supports?.length || desde < 0) return [];
  const bytes = (i) => Buffer.byteLength(texto.slice(0, i), "utf8");
  const [b0, b1] = [bytes(desde), bytes(hasta)];
  const indices = grounding.supports
    .filter((s) => { const ini = Number(s?.segment?.startIndex) || 0; return ini >= b0 && ini < b1; })
    .flatMap((s) => s.groundingChunkIndices || []);
  return [...new Set(indices)].map((i) => grounding.chunks?.[i]?.uri).filter(Boolean);
}
