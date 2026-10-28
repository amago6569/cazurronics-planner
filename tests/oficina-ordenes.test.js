// npm test — Órdenes a los empleados de la oficina: trabajar ya y encargos (sin llamar a Gemini de verdad)
import { beforeEach, describe, expect, it, vi } from "vitest";

const prompts = [];
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async (prompt) => { prompts.push(prompt); return { texto: "[]", dominios: new Set() }; }),
}));

const { ordenar, leerEncargos, partesDeOrdenes } = await import("../src/lib/eventos");
const { comando } = await import("../src/lib/almacen");
const { montarOficina } = await import("../src/lib/oficina");

beforeEach(async () => {
  prompts.length = 0;
  for (const k of ["oficina:encargos", "oficina:orden:musica", "oficina:orden:noche", "oficina:ya:musica"]) await comando(["DEL", k]);
});

describe("oficina: órdenes", () => {
  it("un encargo para el próximo turno se apunta, sale en la ficha y va en sus búsquedas", async () => {
    const r = await ordenar({ empleado: "musica", accion: "encargo", texto: "  mira el concierto de   Fresno ", ya: false });
    expect(r.exito).toBe(true);
    expect((await leerEncargos()).musica.map((x) => x.texto)).toEqual(["mira el concierto de Fresno"]);
    const o = montarOficina({}, { encargos: await leerEncargos() });
    const musica = o.departamentos.flatMap((d) => d.empleados).find((e) => e.id === "musica");
    expect(musica.ordenes).toBe(true);
    expect(musica.encargos).toEqual(["mira el concierto de Fresno"]);
    expect(o.jefe.lineas.join(" ")).toMatch(/1 encargo tuyo pendiente/);

    // Ponte a trabajar ya: sus 6 búsquedas, con el encargo dentro; luego el encargo se borra
    const t = await ordenar({ empleado: "musica", accion: "trabajar" });
    expect(t.exito).toBe(true);
    expect(t.parte.busquedas).toBe(6);
    expect(prompts).toHaveLength(6);
    expect(prompts.every((p) => p.includes("mira el concierto de Fresno"))).toBe(true);
    expect((await leerEncargos()).musica).toBeUndefined();
    expect((await partesDeOrdenes()).musica.busquedas).toBe(6);
  });

  it("no se le puede mandar trabajar dos veces en 6 horas", async () => {
    expect((await ordenar({ empleado: "noche", accion: "trabajar" })).exito).toBe(true);
    const otra = await ordenar({ empleado: "noche", accion: "trabajar" });
    expect(otra.exito).toBe(false);
    expect(otra.mensaje).toMatch(/6 horas/);
  });

  it("un encargo al momento es UNA búsqueda", async () => {
    const r = await ordenar({ empleado: "fiestas", accion: "encargo", texto: "magosto de Boñar", ya: true });
    expect(r.exito).toBe(true);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatch(/magosto de Boñar/);
  });

  it("los que no buscan con la IA no reciben órdenes", async () => {
    expect((await ordenar({ empleado: "captacion", accion: "trabajar" })).exito).toBe(false);
    expect((await ordenar({ empleado: "musica", accion: "encargo", texto: "ab" })).exito).toBe(false);
  });
});

describe("oficina: novedades y encargos de la Despensa", () => {
  it("apunta lo nuevo y solo enseña los últimos 7 días", async () => {
    const { apuntarNovedades, leerNovedades } = await import("../src/lib/novedades");
    await comando(["DEL", "oficina:novedades"]);
    await apuntarNovedades([{ tipo: "evento", titulo: "Magosto", fecha: "2026-11-01", quien: "fiestas" }, { tipo: "tienda", titulo: "Cecinas Nieto", quien: "despensa-productos" }, { titulo: "" }]);
    const hoy = await leerNovedades();
    expect(hoy.map((n) => n.titulo)).toEqual(["Magosto", "Cecinas Nieto"]);
    expect(hoy[0].cuando).toBeTruthy();
    expect(await leerNovedades(Date.now() + 8 * 86400000)).toEqual([]);
  });

  it("los encargos del jefe pasan delante de lo que pide la gente", async () => {
    const { peticionesPendientes } = await import("../src/lib/despensa");
    const todas = [
      { id: "a", texto: "miel", fecha: "2026-10-27" },
      { id: "b", texto: "cecina de chivo", fecha: "2026-10-28", jefe: true },
      { id: "c", texto: "pan", fecha: "2026-10-26" },
      { id: "d", texto: "queso", fecha: "2026-10-20", hecha: true },
    ];
    expect(peticionesPendientes(todas, 2).map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("el encargo de la Despensa para esta noche pide comarca y queda pendiente", async () => {
    const { ordenarDespensa, encargosDespensa } = await import("../src/lib/despensa");
    expect((await ordenarDespensa({ accion: "encargo", texto: "cecina de chivo", zona: "marte" })).exito).toBe(false);
    const r = await ordenarDespensa({ accion: "encargo", texto: "cecina de chivo", zona: "leon", ya: false });
    expect(r.exito).toBe(true);
    expect((await encargosDespensa()).join()).toMatch(/cecina de chivo \(León capital\)/);
  });
});
