// npm test — Sacar el JSON de lo que responde la IA, aunque venga "adornado"
import { describe, expect, it } from "vitest";
import { ErrorIA, extraerJSON, mensajeParaUsuario } from "../src/lib/gemini";

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
