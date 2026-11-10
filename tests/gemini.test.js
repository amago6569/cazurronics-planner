// npm test — Sacar el JSON de lo que responde la IA, aunque venga "adornado"
import { describe, expect, it } from "vitest";
import { ErrorIA, extraerJSON, llamarGemini, medirUso, mensajeParaUsuario, MODELOS } from "../src/lib/gemini";

describe("extraerJSON", () => {
  it("lee una lista limpia", () => {
    expect(extraerJSON('[{"titulo":"Bar"}]')).toEqual([{ titulo: "Bar" }]);
  });

  it("quita los ```json y el texto de alrededor", () => {
    expect(extraerJSON('Aquí tienes:\n```json\n[{"titulo":"Bar"}]\n```\n¡Disfruta!')).toEqual([{ titulo: "Bar" }]);
  });

  it("no se lía con citas tipo [1] antes o después del plan", () => {
    expect(extraerJSON('Según [1] y [2]: [{"titulo":"Catedral"}] (ver [3])')).toEqual([{ titulo: "Catedral" }]);
  });

  it("respeta los corchetes que van dentro de los textos", () => {
    const texto = 'Nota [a]: [{"titulo":"Bar [el de siempre]","descripcion":"Tapas \\"ricas\\" ]"}]';
    expect(extraerJSON(texto)).toEqual([{ titulo: "Bar [el de siempre]", descripcion: 'Tapas "ricas" ]' }]);
  });

  it("lee un objeto cuando se pide un objeto", () => {
    expect(extraerJSON('Vale: {"titulo":"Otro sitio","lat":42.6} [fuente]', "{")).toEqual({ titulo: "Otro sitio", lat: 42.6 });
  });

  it("devuelve null si no hay JSON válido", () => {
    expect(extraerJSON("Lo siento, no he encontrado nada")).toBeNull();
    expect(extraerJSON('[{"titulo": "a medias"')).toBeNull();
    expect(extraerJSON("")).toBeNull();
  });

  it("acepta una lista vacía si es lo único que hay", () => {
    expect(extraerJSON("No hay eventos: []")).toEqual([]);
  });
});

describe("mensajeParaUsuario", () => {
  it("traduce cada fallo a un mensaje amable", () => {
    expect(mensajeParaUsuario(new ErrorIA("saturado", 429))).toMatch(/muchísima gente/);
    expect(mensajeParaUsuario(new ErrorIA("sin saldo", 403))).toMatch(/recargando/);
    expect(mensajeParaUsuario(new SyntaxError("x"))).toMatch(/a medias/);
    expect(mensajeParaUsuario(new Error("cualquier cosa"))).toMatch(/no ha respondido a tiempo/);
  });
});

describe("medirUso", () => {
  it("cobra cada búsqueda de Google en los modelos 3.x", () => {
    const datos = { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500, thoughtsTokenCount: 500 }, candidates: [{ groundingMetadata: { webSearchQueries: ["a", "b", "c"] } }] };
    const u = medirUso("gemini-flash-latest", datos);
    expect(u).toMatchObject({ entrada: 1000, salida: 1000, consultas: 3 });
    expect(u.dolares).toBeCloseTo((1000 * 0.75 + 1000 * 3.75) / 1e6 + 3 * 0.014, 5);
  });

  it("sin búsqueda solo cuenta los tokens", () => {
    const u = medirUso("gemini-flash-latest", { usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 800 } });
    expect(u.consultas).toBe(0);
    expect(u.dolares).toBeCloseTo((2000 * 0.75 + 800 * 3.75) / 1e6, 5);
  });

  it("en los 2.x se cobra una vez por petición con búsqueda", () => {
    const u = medirUso("gemini-2.5-flash-lite", { usageMetadata: { promptTokenCount: 0 }, candidates: [{ groundingMetadata: { webSearchQueries: ["a", "b"] } }] });
    expect(u.dolares).toBe(0); // dentro de las 1.500 gratis al día: se cobra solo si se pasan (registrarGastoIA)
    expect(u.peticionGratis).toBe(1);
    expect(u.precioPeticion).toBeCloseTo(0.035, 5);
  });
});

describe("llamarGemini sin Google", () => {
  it("no manda la herramienta de búsqueda, pide JSON y devuelve lo que ha costado", async () => {
    const original = globalThis.fetch;
    let cuerpo = null;
    globalThis.fetch = async (url, opciones) => {
      cuerpo = JSON.parse(opciones.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "[]" }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10 } }), { status: 200 });
    };
    try {
      const r = await llamarGemini("hola", { google: false, json: true });
      expect(cuerpo.tools).toBeUndefined();
      expect(cuerpo.generationConfig.responseMimeType).toBe("application/json");
      expect(r.uso).toMatchObject({ entrada: 100, salida: 10, consultas: 0 });
    } finally { globalThis.fetch = original; }
  });
});

describe("modelos que se usan", () => {
  it("el barrido solo usa 2.5 (búsqueda gratis): ni 3.x, ni alias -latest, ni los 2.0 que Google apagó", () => {
    expect(MODELOS.barrido.length).toBeGreaterThan(0);
    for (const m of MODELOS.barrido) expect(m).toMatch(/^gemini-2\.5-flash(-lite)?$/);
  });
  it("nadie pide ya los 2.0 (devuelven 404 desde el 1-6-2026)", () => {
    for (const lista of Object.values(MODELOS)) for (const m of lista) expect(m).not.toMatch(/^gemini-2\.0/);
  });
  it("2.5 Flash de reserva en el barrido no piensa (no se paga pensamiento)", async () => {
    const original = globalThis.fetch;
    const cuerpos = [];
    globalThis.fetch = async (url, opciones) => {
      cuerpos.push({ url, cuerpo: JSON.parse(opciones.body) });
      if (url.includes("flash-lite")) return new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "[]" }] } }], usageMetadata: {} }), { status: 200 });
    };
    try {
      const r = await llamarGemini("hola", { para: "barrido" });
      expect(r.modelo).toBe("gemini-2.5-flash");
      expect(cuerpos[1].cuerpo.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(cuerpos[1].cuerpo.tools).toEqual([{ googleSearch: {} }]);
    } finally { globalThis.fetch = original; }
  });
});
