// ============ LLAMADAS A GEMINI, CON PLAN B ============
// Si un modelo está saturado o sin cuota (429), caído (5xx) o ya no existe (404), probamos el siguiente.
// Cada modelo tiene su propia cuota, así que el barrido automático usa modelos distintos que los planes
// de la gente: aunque el barrido gaste mucho, los planes de los usuarios siguen funcionando.

const MODELOS = {
  usuario: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"],
  barrido: ["gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.0-flash-lite", "gemini-2.0-flash"],
};
const REINTENTABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

export class ErrorIA extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado; }
}

export async function llamarGemini(prompt, { para = "usuario", temperatura = 0.2, google = true, msMax = 50000 } = {}) {
  const fallos = [];
  const fin = Date.now() + msMax;
  for (const modelo of MODELOS[para] || MODELOS.usuario) {
    const queda = fin - Date.now();
    if (queda < 3000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        signal: AbortSignal.timeout(queda),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(google ? { tools: [{ googleSearch: {} }] } : {}), generationConfig: { temperature: temperatura } }),
        cache: "no-store",
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        fallos.push(`${modelo}: ${res.status} ${String(datos?.error?.message || "").slice(0, 160)}`);
        if (REINTENTABLE.has(res.status)) { if (res.status === 429) await new Promise((r) => setTimeout(r, 400)); continue; }
        const err = new ErrorIA(`Gemini ${res.status}`, res.status);
        err.fallos = fallos;
        throw err;
      }
      const candidato = datos.candidates?.[0];
      const texto = (candidato?.content?.parts || []).map((p) => p.text || "").join("\n");
      if (!texto.trim()) { fallos.push(`${modelo}: respuesta vacía (${candidato?.finishReason || "?"})`); continue; }
      const dominios = new Set((candidato?.groundingMetadata?.groundingChunks || [])
        .map((c) => String(c?.web?.title || "").toLowerCase().replace(/^www\./, "").trim())
        .filter((t) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t)));
      if (fallos.length) console.warn("[gemini] plan B:", fallos.join(" | "), "→ usando", modelo);
      return { texto, dominios, modelo };
    } catch (e) {
      if (e instanceof ErrorIA) { console.error("[gemini]", fallos.join(" | ")); throw e; }
      fallos.push(`${modelo}: ${e?.name === "TimeoutError" ? "tardó demasiado" : e?.message || e}`);
    }
  }
  console.error("[gemini] todos los modelos fallaron:", fallos.join(" | "));
  const saturado = fallos.some((f) => / 429 /.test(f));
  const err = new ErrorIA(saturado ? "saturado" : "Error en la IA", saturado ? 429 : 502);
  err.fallos = fallos;
  throw err;
}
