// ============ LLAMADAS A GEMINI, CON PLAN B ============
// Si un modelo está saturado o sin cuota (429), caído (5xx) o ya no existe (404), probamos el siguiente.
// Cada modelo tiene su propia cuota, así que el barrido automático usa modelos distintos que los planes
// de la gente: aunque el barrido gaste mucho, los planes de los usuarios siguen funcionando.

const MODELOS = {
  usuario: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"],
  // Solo modelos 2.x: en ellos las búsquedas en Google entran en las 1.500 peticiones gratis al día. Los 3.x (como
  // gemini-flash-lite-latest) cobran CADA búsqueda; cuando el 2.5 se saturaba (429) el barrido saltaba a uno 3.x y
  // eso fue la mayor parte de la factura. Si los 2.x no responden, ese tramo se salta y se repite en la siguiente pasada.
  barrido: ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"],
};
// Los modelos 3.x "piensan" antes de contestar y esos tokens se cobran. Con "low" el plan sale igual y cuesta bastante menos
// (y tarda menos). GEMINI_PENSAMIENTO=auto en Vercel devuelve el comportamiento de fábrica; también vale minimal, medium o high.
const NIVEL_PENSAMIENTO = String(process.env.GEMINI_PENSAMIENTO || "low").trim().toLowerCase();
const REINTENTABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

export class ErrorIA extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado; }
}

// Precio aproximado (dólares) para medir lo que cuesta cada llamada. Cambia si Google cambia la tarifa:
// https://ai.google.dev/pricing. Las búsquedas de Google de los modelos 3.x se cobran una a una
// (5.000 gratis al mes, luego 14 $ cada 1.000); en los 2.x se cobra cada petición con búsqueda (1.500 gratis al día).
const PRECIOS = [
  [/^gemini-(flash-latest|3)/, { entrada: 0.75, salida: 3.75, busqueda: 0.014, porConsulta: true }],
  [/^gemini-(2\.5-flash-lite|flash-lite)/, { entrada: 0.1, salida: 0.4, busqueda: 0.035, porConsulta: false }],
  [/^gemini-2\.5-flash/, { entrada: 0.3, salida: 2.5, busqueda: 0.035, porConsulta: false }],
  [/^gemini-2\.0/, { entrada: 0.1, salida: 0.4, busqueda: 0.035, porConsulta: false }],
];

// Tokens, búsquedas y coste aproximado de una respuesta de Gemini
export function medirUso(modelo, datos) {
  const u = datos?.usageMetadata || {};
  const consultas = (datos?.candidates?.[0]?.groundingMetadata?.webSearchQueries || []).length;
  const precio = PRECIOS.find(([re]) => re.test(modelo))?.[1] || PRECIOS[0][1];
  const entrada = Number(u.promptTokenCount) || 0;
  const salida = (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
  const busquedas = precio.porConsulta ? consultas : (consultas ? 1 : 0);
  const dolares = (entrada * precio.entrada + salida * precio.salida) / 1e6 + busquedas * precio.busqueda;
  return { modelo, entrada, salida, consultas, dolares: Math.round(dolares * 100000) / 100000 };
}

// json: true pide la respuesta directamente en JSON (solo sin Google Search: Gemini no admite las dos cosas a la vez)
export async function llamarGemini(prompt, { para = "usuario", temperatura = 0.2, google = true, json = false, msMax = 50000 } = {}) {
  const fallos = [];
  const fin = Date.now() + msMax;
  for (const modelo of MODELOS[para] || MODELOS.usuario) {
    const queda = fin - Date.now();
    if (queda < 3000) break;
    try {
      // La clave va en una cabecera, no en la URL (las URLs acaban en logs y trazas)
      // Los modelos 3.x "piensan" y los tokens de pensamiento se cobran: con nivel bajo el plan sale igual y cuesta mucho menos
      const pedir = (pensarPoco) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.max(1000, fin - Date.now())),
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(google ? { tools: [{ googleSearch: {} }] } : {}), generationConfig: { temperature: temperatura, ...(json && !google ? { responseMimeType: "application/json" } : {}), ...(pensarPoco ? { thinkingConfig: { thinkingLevel: NIVEL_PENSAMIENTO } } : {}) } }),
        cache: "no-store",
      });
      const pensarPoco = NIVEL_PENSAMIENTO !== "auto" && /^gemini-(flash|3)/.test(modelo);
      let res = await pedir(pensarPoco);
      // Si ese modelo no admite el ajuste (400), se repite sin él: nunca se rompe un plan por esto
      if (res.status === 400 && pensarPoco) { console.warn(`[gemini] ${modelo} no admite el nivel de pensamiento; se repite sin él`); res = await pedir(false); }
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
      const uso = medirUso(modelo, datos);
      console.log(`[gemini-uso] ${para} ${modelo} entrada=${uso.entrada} salida=${uso.salida} busquedas=${uso.consultas} ~${uso.dolares}$`);
      return { texto, dominios, modelo, uso };
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

// Lo que ve la persona cuando algo falla al montar o retocar un plan (nunca el error técnico)
export function mensajeParaUsuario(error) {
  if (error instanceof ErrorIA && (error.estado === 402 || error.estado === 403)) return "Estamos recargando la IA 🦁 Vuelve en un ratito y tendrás tu plan.";
  if (error instanceof ErrorIA && error.estado === 429) return "Hay muchísima gente montando planes ahora mismo 🦁 Prueba otra vez en un minuto.";
  if (error instanceof SyntaxError) return "La IA ha devuelto un plan a medias. Dale otra vez, que ahora sale.";
  return "La IA no ha respondido a tiempo. Prueba otra vez en unos segundos.";
}

// ============ SACAR EL JSON DE LA RESPUESTA ============
// Con Google Search activado, Gemini no puede devolver JSON "puro": a veces lo envuelve en ```json,
// añade una frase antes o después, o cita fuentes con corchetes ("[1]"). Antes cortábamos del primer
// "[" al último "]" y, si había un corchete de más, el plan entero fallaba. Ahora, si ese corte no vale,
// buscamos el primer bloque bien cerrado que sea del tipo pedido.
// tipo: "[" para una lista, "{" para un objeto. Devuelve null si no hay ninguno válido.
export function extraerJSON(texto, tipo = "[") {
  const t = String(texto || "").replace(/```(?:json)?/gi, "");
  const cierre = tipo === "[" ? "]" : "}";
  const esDelTipo = (v) => (tipo === "[" ? Array.isArray(v) : v !== null && typeof v === "object" && !Array.isArray(v));
  const probar = (trozo) => { try { const v = JSON.parse(trozo); return esDelTipo(v) ? v : null; } catch { return null; } };

  const ini = t.indexOf(tipo), fin = t.lastIndexOf(cierre);
  if (ini === -1 || fin <= ini) return null;
  const directo = probar(t.slice(ini, fin + 1));
  if (directo) return directo;

  // Recorremos el texto buscando bloques equilibrados (respetando lo que va entre comillas).
  // Una lista solo vale si trae objetos: así una cita como "[1]" no se confunde con el plan.
  let vacia = null;
  for (let i = ini; i !== -1; i = t.indexOf(tipo, i + 1)) {
    let nivel = 0, enCadena = false, escape = false;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (enCadena) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') enCadena = false;
        continue;
      }
      if (c === '"') enCadena = true;
      else if (c === "[" || c === "{") nivel++;
      else if (c === "]" || c === "}") {
        nivel--;
        if (nivel === 0) {
          const v = probar(t.slice(i, j + 1));
          if (v && tipo === "[" && !v.some((x) => x && typeof x === "object")) { if (!v.length) vacia ||= v; }
          else if (v) return v;
          break;
        }
      }
    }
  }
  return vacia;
}
