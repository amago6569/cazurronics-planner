// npm test — «Algo de charla literaria y comer» (Alejandro, 25-11-2026): salió solo la comida, con 3 presentaciones de libros
// esa tarde en la agenda. Con más de 30 eventos, las de las 19:00 no llegaban a la lista que ve la IA.
import { describe, expect, it } from "vitest";
import { eventosParaPrompt } from "../src/lib/eventos";
import { encajaConLoPedido, quitarNoPedidas } from "../src/lib/intencion";

const FRASE = "algo de charla literaria y comer";
const ev = (titulo, hora, categoria = "", lugar = "") => ({ titulo, hora, categoria, lugar, fecha: "2026-11-25", fuente: `https://agenda.example/${encodeURIComponent(titulo)}` });
// Un miércoles cualquiera: muchas exposiciones y cosas «de todo el día» delante de las charlas de la tarde
const DIA = [
  ...Array.from({ length: 25 }, (_, i) => ev(`Exposición ${i}`, "Todo el día", "exposición", `Sala ${i}`)),
  ...Array.from({ length: 20 }, (_, i) => ev(`Actividad ${i}`, "Todo el día", "", `Centro cívico ${i}`)),
  ...Array.from({ length: 15 }, (_, i) => ev(`Grupo ${i} en directo`, "21:00", "concierto", `Bar ${i}`)),
  ev("Presentación del libro «Mientras me operan el cerebro»", "19:30", ""),
  ev("Presentación del libro «Tarot. Antología de relatos»", "19:00", ""),
  ev("Conferencia «Escribir para reinar: los documentos de Urraca I»", "19:30", "", "Museo de San Isidoro"),
];
const lineas = (texto) => texto.split("\n").filter((l) => l.startsWith("- "));

describe("lo que encaja con lo pedido", () => {
  it("«charla literaria» encaja con presentaciones de libros y conferencias, no con un concierto", () => {
    expect(encajaConLoPedido(ev("Presentación del libro «Tarot»", "19:00"), FRASE)).toBe(true);
    expect(encajaConLoPedido(ev("Recital de poesía de autores leoneses", "20:00"), "algo literario")).toBe(true);
    expect(encajaConLoPedido(ev("Grupo 1 en directo", "21:00", "concierto"), FRASE)).toBe(false);
    expect(encajaConLoPedido(ev("Exposición 3", "Todo el día", "exposición"), FRASE)).toBe(false);
  });
});

describe("la lista de la agenda que ve la IA", () => {
  it("con 63 eventos, las 3 charlas de la tarde entran siempre y la lista sigue en 30", () => {
    const texto = eventosParaPrompt(DIA, 30, FRASE);
    expect(texto).toContain("Mientras me operan el cerebro");
    expect(texto).toContain("Tarot. Antología de relatos");
    expect(texto).toContain("Escribir para reinar");
    expect(lineas(texto)).toHaveLength(30);
  });
  it("sin saber lo que pide, se reparte como antes (y las charlas se quedaban fuera)", () => {
    const texto = eventosParaPrompt(DIA, 30);
    expect(lineas(texto)).toHaveLength(30);
    expect(texto).not.toContain("Escribir para reinar");
  });
  it("la charla que elige la IA no se quita por no pedida", () => {
    const ia = [{ titulo: "La Bodega del Húmedo", tipo: "restaurante", hora: "14:00" }, { titulo: "Presentación del libro «Tarot»", tipo: "evento", hora: "19:00" }];
    expect(quitarNoPedidas(ia, FRASE)).toHaveLength(2);
  });
});

describe("sin IA", () => {
  it("«algo literario» también pide una charla de la agenda, además de la comida", async () => {
    const { huecosPedidos } = await import("../src/lib/planSinIA");
    expect(huecosPedidos(FRASE).map((h) => h.tipo || h.agenda?.join("+"))).toEqual(expect.arrayContaining(["restaurante", "charla"]));
    expect(huecosPedidos("algo literario por la tarde").some((h) => h.agenda?.includes("charla"))).toBe(true);
  });
});
