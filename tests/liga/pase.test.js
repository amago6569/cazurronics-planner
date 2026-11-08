import { describe, it, expect } from "vitest";
import { ligaConClave, tienePase, firmaPase, destinoSeguro } from "../../src/lib/liga/pase.js";

describe("liga: contraseña de mientras", () => {
  it("en la web de verdad está cerrada, también si falta la clave", () => {
    expect(ligaConClave({ PANEL_CLAVE: "x", VERCEL_ENV: "production" })).toBe(true);
    expect(ligaConClave({ VERCEL_ENV: "production" })).toBe(true);
    expect(ligaConClave({})).toBe(false); // en local sin clave, abierta
    expect(ligaConClave({ PANEL_CLAVE: "x", LIGA_ABIERTA: "1" })).toBe(false);
  });
  it("la cookie vale solo con la firma de la clave buena", async () => {
    const env = { PANEL_CLAVE: "secreta", VERCEL_ENV: "production" };
    expect(await tienePase(await firmaPase("secreta"), env)).toBe(true);
    expect(await tienePase(await firmaPase("otra"), env)).toBe(false);
    expect(await tienePase("", env)).toBe(false);
    expect(await tienePase(undefined, { VERCEL_ENV: "production" })).toBe(false);
  });
  it("solo vuelve a páginas de la liga", () => {
    expect(destinoSeguro("/liga/pendon.html?x=1")).toBe("/liga/pendon.html?x=1");
    expect(destinoSeguro("https://malo.com")).toBe("/liga");
    expect(destinoSeguro("//malo.com")).toBe("/liga");
    expect(destinoSeguro("/liga//malo.com")).toBe("/liga");
  });
});
