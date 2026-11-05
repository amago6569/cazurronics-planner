// npm test — La lista de rutas solo entra en la petición cuando se pide salir a caminar o en bici
import { describe, expect, it } from "vitest";
import { RUTAS, rutasParaPrompt } from "../src/lib/rutas";
import { enProvinciaLeon } from "../src/lib/provincia";

const LEON = [42.5987, -5.5671];

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
  it("no añade nada si no hay ninguna en el radio", () => {
    expect(rutasParaPrompt("una ruta", 42.0, -5.67, 1)).toBe("");
  });
});
