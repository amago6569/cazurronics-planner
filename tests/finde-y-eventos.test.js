// npm test — Fechas del finde, eventos de la IA y fusión de la agenda por días
import { describe, expect, it } from "vitest";
import { fechasDelFinde, rangoTexto } from "../src/lib/finde";
import { extraerListaJSON, fusionarPorDia, validarEventoIA } from "../src/lib/eventos";
import { zonaDe } from "../src/lib/zonas";

describe("fechasDelFinde", () => {
  // 2026-10-05 es lunes
  it("de lunes a jueves: el viernes que viene", () => {
    expect(fechasDelFinde("2026-10-05")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(fechasDelFinde("2026-10-08")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  });
  it("viernes: los tres días; sábado: sábado y domingo", () => {
    expect(fechasDelFinde("2026-10-09")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(fechasDelFinde("2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("domingo: el fin de semana siguiente", () => {
    expect(fechasDelFinde("2026-10-11")).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
  });
  it("escribe el rango corto", () => {
    expect(rangoTexto(["2026-10-09", "2026-10-10", "2026-10-11"])).toBe("vie 9 – dom 11 oct");
  });
});

describe("validarEventoIA", () => {
  const base = { titulo: "Concierto", fecha: "2026-10-10", fuente: "https://www.aytoleon.es/agenda/1" };

  it("acepta un evento con fecha y fuente reales", () => {
    expect(validarEventoIA(base, "2026-10-05", "2026-10-18")).toMatchObject({ titulo: "Concierto", fecha: "2026-10-10", origen: "web" });
  });
  it("descarta lo que no trae una fuente verificable", () => {
    expect(validarEventoIA({ ...base, fuente: null }, "2026-10-05", "2026-10-18")).toBeNull();
    expect(validarEventoIA({ ...base, fuente: "https://vertexaisearch.cloud.google.com/x" }, "2026-10-05", "2026-10-18")).toBeNull();
  });
  it("descarta lo que cae fuera de la ventana", () => {
    expect(validarEventoIA({ ...base, fecha: "2026-11-30" }, "2026-10-05", "2026-10-18")).toBeNull();
  });
  it("un mercado semanal vale para toda la ventana", () => {
    expect(validarEventoIA({ ...base, fecha: null, diasSemana: [3, "sábado"] }, "2026-10-05", "2026-10-18"))
      .toMatchObject({ fecha: "2026-10-05", fechaFin: "2026-10-18", diasSemana: [3, 6] });
  });
});

describe("extraerListaJSON", () => {
  it("devuelve [] (nunca null) si la IA no trae lista", () => {
    expect(extraerListaJSON("nada por aquí")).toEqual([]);
  });
});

describe("fusionarPorDia", () => {
  it("reparte un mercado semanal solo en sus días", () => {
    const mercado = { titulo: "Mercado de abastos", fecha: "2026-10-05", fechaFin: "2026-10-11", diasSemana: [3, 6], fuente: "https://x.es" };
    expect(Object.keys(fusionarPorDia([[mercado]], "2026-10-05", "2026-10-18")).sort()).toEqual(["2026-10-07", "2026-10-10"]);
  });
  it("no duplica el mismo evento que llega dos veces", () => {
    const a = { titulo: "Teatro: La Celestina", fecha: "2026-10-10", hora: "20:00", fuente: "https://x.es" };
    const b = { titulo: "La Celestina (teatro)", fecha: "2026-10-10", fuente: "https://y.es" };
    expect(fusionarPorDia([[a], [b]], "2026-10-05", "2026-10-18")["2026-10-10"]).toHaveLength(1);
  });
});

describe("zonaDe", () => {
  it("sitúa cada evento en su comarca", () => {
    expect(zonaDe({ titulo: "Fiestas", localidad: "Ponferrada" })).toBe("bierzo");
    expect(zonaDe({ titulo: "Concierto", localidad: "León" })).toBe("leon");
    expect(zonaDe({ titulo: "Cata de vinos del Bierzo", localidad: "León" })).toBe("leon");
    expect(zonaDe({ titulo: "Ruta", lat: 42.4577, lon: -6.0563 })).toBe("astorga");
  });
});

describe("teatros y auditorios", () => {
  it("el barrido diario tiene su tramo de teatros (4 búsquedas: capital y provincia, dos semanas)", async () => {
    const { definirTramos, TRAMOS_DIARIOS } = await import("../src/lib/eventos");
    expect(TRAMOS_DIARIOS).toContain("d5");
    const d5 = definirTramos("2026-10-08").find((t) => t.id === "d5");
    expect(d5.busquedas).toHaveLength(4);
    expect(d5.busquedas.every((b) => /obra/.test(b.extra) && b.desde && b.hasta)).toBe(true);
  });

  it("si la agenda no cabe, guarda huecos para teatro y espectáculos", async () => {
    const { eventosParaPrompt } = await import("../src/lib/eventos");
    const conciertos = Array.from({ length: 40 }, (_, i) => ({ titulo: `Grupo ${i} en directo`, categoria: "concierto", hora: "10:00", lugar: `Bar ${i}`, fecha: "2026-10-10", fuente: "https://x.es" }));
    const obra = { titulo: "La vida es sueño", categoria: "teatro", hora: "21:00", lugar: "Teatro El Albéitar", fecha: "2026-10-10", fuente: "https://x.es" };
    const texto = eventosParaPrompt([...conciertos, obra], 30);
    expect(texto).toContain("La vida es sueño");
    expect(texto.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(30);
  });
});
