// npm test — La lista de rutas solo entra en la petición cuando se pide salir a caminar o en bici
import { describe, expect, it } from "vitest";
import { RUTAS, rutasParaPrompt } from "../src/lib/rutas";
import { enProvinciaLeon } from "../src/lib/provincia";
import { mensajeSinNadaEnProvincia } from "../src/lib/montarPlan";

const LEON = [42.5987, -5.5671];

describe("mensaje cuando no hay nada ni en toda la provincia", () => {
  it("no manda ampliar el radio", () => {
    const m = mensajeSinNadaEnProvincia("torneo de pádel en Sahagún");
    expect(m).toContain("«torneo de pádel en Sahagún» en toda la provincia");
    expect(m).not.toContain("radio");
  });
});

describe("rutasParaPrompt", () => {
  it("todas están en la provincia", () => {
    for (const r of RUTAS) expect(enProvinciaLeon(r.lat, r.lon), r.nombre).toBe(true);
  });
  it("da las cercanas si se pide caminar", () => {
    const t = rutasParaPrompt("una ruta para caminar", ...LEON, 30);
    expect(t).toContain("Monte San Isidro");
    expect(t).not.toContain("Las Médulas");
  });
  it("no añade nada si se pide otra cosa", () => {
    expect(rutasParaPrompt("comer y salir de fiesta", ...LEON, 30)).toBe("");
  });
  it("una ruta de comer o beber no es salir a caminar", () => {
    for (const pide of ["ruta de tapas", "ruta de vinos", "ruta por los bares", "ruta de pinchos", "ruta gastronómica"]) {
      expect(rutasParaPrompt(pide, ...LEON, 30), pide).toBe("");
    }
  });
  it("pero si también pide caminar, la lista sigue", () => {
    expect(rutasParaPrompt("ruta por la montaña y comer tapas", ...LEON, 30)).toContain("Monte San Isidro");
    expect(rutasParaPrompt("ruta de tapas y luego caminar", ...LEON, 30)).toContain("Monte San Isidro");
  });
  it("no añade nada si no hay ninguna en el radio", () => {
    expect(rutasParaPrompt("una ruta", 42.0, -5.67, 1)).toBe("");
  });
});
