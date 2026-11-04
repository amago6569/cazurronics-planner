import { describe, expect, it } from "vitest";
import { fueraDeTemporada } from "../src/lib/agenda";

describe("fueraDeTemporada", () => {
  it("quita lo que anuncia otra estación", () => {
    expect(fueraDeTemporada({ titulo: "Actividades Verano 2026" }, "2026-11-07")).toBe(true);
    expect(fueraDeTemporada({ titulo: "Mercado de Navidad" }, "2026-07-10")).toBe(true);
  });
  it("deja lo que toca y lo que no anuncia estación", () => {
    expect(fueraDeTemporada({ titulo: "Actividades Verano 2026" }, "2026-07-07")).toBe(false);
    expect(fueraDeTemporada({ titulo: "Mercado de Navidad" }, "2026-12-07")).toBe(false);
    expect(fueraDeTemporada({ titulo: "Concierto en el Auditorio" }, "2026-11-07")).toBe(false);
    expect(fueraDeTemporada({ titulo: "Otoño micológico" }, "2026-11-07")).toBe(false);
  });
});
