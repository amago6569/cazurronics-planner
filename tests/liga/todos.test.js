// La lista «Todos los juegos» de la portada de la liga tiene que coincidir con los juegos del servidor.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JUEGOS, EN_LIGA } from "../../src/lib/liga/juegos.js";

const OCULTOS = ["bolos"];

describe("portada de la liga", () => {
  it("enseña todos los juegos, con su página y su foto", () => {
    const html = readFileSync(resolve("public/liga/index.html"), "utf8");
    for (const j of Object.values(JUEGOS)) {
      // los Bolos están ocultos (regla de Alejandro, 13-11-2026): ni en la liga ni en «Todos los juegos»
      if (OCULTOS.includes(j.id)) expect(html, j.id).not.toContain(`["${j.id}", "${j.nombre}"`);
      else expect(html, j.id).toContain(`["${j.id}", "${j.nombre}", "${j.habilidad}", "${j.foto}"]`);
      expect(existsSync(resolve(`public${j.pagina}`)), j.pagina).toBe(true);
      expect(existsSync(resolve(`public${j.foto}`)), j.foto).toBe(true);
    }
    expect([...EN_LIGA, ...OCULTOS].sort()).toEqual(Object.keys(JUEGOS).sort());
  });
});
