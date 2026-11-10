import { beforeEach, describe, expect, it } from "vitest";
import { comando } from "../src/lib/almacen";
import { CLAVE_PREMIOS, guardarPremio, leerPremios, limpiarPremio, quitarPremio } from "../src/lib/premiosLiga";

const LOGO = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

describe("premios de la Liga", () => {
  beforeEach(async () => { await comando(["DEL", CLAVE_PREMIOS]); });

  it("pide nombre y premio", () => {
    expect(limpiarPremio({ premio: "Cena" }).error).toMatch(/nombre/);
    expect(limpiarPremio({ nombre: "Bar" }).error).toMatch(/premio/);
  });

  it("limpia lo que llega", () => {
    const { premio } = limpiarPremio({ nombre: "  Bar\nLa   Esquina ", premio: "Cena", estado: "raro", instagram: "https://instagram.com/laesquina/", logo: LOGO }, 5);
    expect(premio).toMatchObject({ nombre: "Bar La Esquina", estado: "si", instagram: "@laesquina", logo: LOGO, creado: 5 });
  });

  it("no acepta logos que no son imagen", () => {
    expect(limpiarPremio({ nombre: "a", premio: "b", logo: "data:text/html;base64,PGI+" }).error).toMatch(/logo/);
    expect(limpiarPremio({ nombre: "a", premio: "b", logo: `data:image/png;base64,${"A".repeat(200_000)}` }).error).toMatch(/logo/);
  });

  it("añade, cambia y quita", async () => {
    const a = await guardarPremio({ nombre: "Bar A", premio: "Caña", estado: "hablando" });
    const b = await guardarPremio({ nombre: "Bar B", premio: "Tapa" });
    expect((await leerPremios()).map((p) => p.nombre)).toEqual(["Bar A", "Bar B"]);
    const cambio = await guardarPremio({ nombre: "Bar A", premio: "Cena", estado: "si" }, a.id);
    expect(cambio.premio).toMatchObject({ id: a.id, premio: "Cena", creado: a.premio.creado });
    expect(await quitarPremio(b.id)).toBe(true);
    expect((await leerPremios()).map((p) => p.premio)).toEqual(["Cena"]);
    expect((await guardarPremio({ nombre: "x", premio: "y" }, "noexiste1")).error).toBeTruthy();
  });
});
