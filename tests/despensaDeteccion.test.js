// npm test — Despensa: qué productos se reconocen en lo que escribe la persona (sin pedir cosas de más)
import { describe, expect, it } from "vitest";

describe("productos en el texto", async () => {
  const { productosEnTexto } = await import("../src/lib/despensaBuscar");

  it("las palabras de relleno no meten productos", () => {
    expect(productosEnTexto("cecina de León con algo más")).toEqual(["cecina"]);
  });

  it("el sitio no cuenta como producto", () => {
    expect(productosEnTexto("vino del Bierzo")).toEqual(["vino"]);
    expect(productosEnTexto("pimientos del Bierzo")).toEqual(["pimientos"]);
    expect(productosEnTexto("frutería en Ponferrada")).toEqual(["fruta"]);
  });

  it("una cosa sola da esa cosa", () => {
    expect(productosEnTexto("morcilla")).toEqual(["morcilla"]);
    expect(productosEnTexto("botillo")).toEqual(["botillo"]);
  });

  it("una lista da cada cosa", () => {
    const r = productosEnTexto("quiero queso y pan");
    expect(r).toContain("quesos");
    expect(r).toContain("pan");
    expect(r).not.toContain("dulces");
  });
});
