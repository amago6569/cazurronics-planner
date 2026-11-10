import { describe, it, expect } from "vitest";
import { APERTURA_LIGA, ligaConClave, tienePase, firmaPase, destinoSeguro, claveBuena, secretoPase } from "../../src/lib/liga/pase.js";

const ANTES = APERTURA_LIGA - 1;

describe("liga: contraseña de mientras", () => {
  it("en Vercel está cerrada; en local, abierta", () => {
    expect(ligaConClave({ PANEL_CLAVE: "x", VERCEL_ENV: "production" }, ANTES)).toBe(true);
    expect(ligaConClave({ VERCEL_ENV: "production" }, ANTES)).toBe(true);
    expect(ligaConClave({ SUPABASE_SECRET_KEY: "s", VERCEL_ENV: "preview" }, ANTES)).toBe(true);
    expect(ligaConClave({}, ANTES)).toBe(false);
    expect(ligaConClave({ PANEL_CLAVE: "x", LIGA_ABIERTA: "1" }, ANTES)).toBe(false);
  });
  it("se abre sola el sábado 14-11-2026 a las 12:00 de Madrid", async () => {
    expect(APERTURA_LIGA).toBe(Date.parse("2026-11-14T11:00:00Z"));
    const env = { PANEL_CLAVE: "x", VERCEL_ENV: "production" };
    expect(ligaConClave(env, APERTURA_LIGA)).toBe(false);
    expect(await tienePase("", env, APERTURA_LIGA)).toBe(true);
    expect(await tienePase("", env, ANTES)).toBe(false);
  });
  it("la contraseña es «negocios» (sin importar mayúsculas ni espacios)", async () => {
    expect(await claveBuena("negocios", {})).toBe(true);
    expect(await claveBuena(" Negocios ", {})).toBe(true);
    expect(await claveBuena("negocio", {})).toBe(false);
    expect(await claveBuena("", {})).toBe(false);
    expect(await claveBuena("otra", { LIGA_CLAVE: "otra" })).toBe(true);
  });
  it("la cookie vale solo con la firma buena (que lleva un secreto del servidor)", async () => {
    const env = { PANEL_CLAVE: "secreta", VERCEL_ENV: "production" };
    expect(await tienePase(await firmaPase(secretoPase(env)), env, ANTES)).toBe(true);
    expect(await tienePase(await firmaPase(secretoPase({ PANEL_CLAVE: "otra" })), env, ANTES)).toBe(false);
    expect(await tienePase("", env, ANTES)).toBe(false);
  });
  it("solo vuelve a páginas de la liga", () => {
    expect(destinoSeguro("/liga/pendon.html?x=1")).toBe("/liga/pendon.html?x=1");
    expect(destinoSeguro("https://malo.com")).toBe("/liga");
    expect(destinoSeguro("//malo.com")).toBe("/liga");
  });
});
