// El cuerpo de los monigotes se monta sin navegador: cada pieza tiene que salir con color y sin números rotos.
import { describe, expect, it } from "vitest";
import { aspectoDe, crearCuerpo, NOMBRES_PEINADO } from "../src/app/panel/oficina/personaje";
import { paseoLibre } from "../src/app/panel/oficina/vida";
import { CAFE_SITIOS, planta } from "../src/app/panel/oficina/guion";

const COLORES = { pieles: ["#f6d2b8"], pelos: ["#2b1d14"] };

describe("cuerpo de los monigotes", () => {
  it.each(NOMBRES_PEINADO)("se monta con el peinado %s", (peinado) => {
    const c = crearCuerpo({ ...aspectoDe(1, COLORES), peinado, camisa: "#f43f5e" });
    for (const [nombre, g] of Object.entries(c)) {
      expect(g.attributes.color, nombre).toBeTruthy();
      expect(g.attributes.position.array.every(Number.isFinite), nombre).toBe(true);
    }
  });
  it("el jefe va de traje", () => {
    const normal = crearCuerpo({ ...aspectoDe(1, COLORES), camisa: "#000000" });
    const jefe = crearCuerpo({ ...aspectoDe(1, COLORES), camisa: "#000000", jefe: true });
    expect(jefe.torso.attributes.position.count).toBeGreaterThan(normal.torso.attributes.position.count - 900);
  });
  it("cada uno tiene su aspecto, siempre el mismo", () => {
    expect(aspectoDe(4, COLORES)).toEqual(aspectoDe(4, COLORES));
    expect(aspectoDe(4, COLORES).peinado).toBeTruthy();
  });
});

describe("paseos libres", () => {
  const sitios = planta([{ id: "agenda", empleados: [{ id: "musica" }] }]);
  const barra = CAFE_SITIOS.filter((s) => s.tipo === "barra");
  const vivos = { a: { sitio: CAFE_SITIOS[0], modo: "sentado" }, b: { sitio: CAFE_SITIOS[1], modo: "sentado" }, c: { sitio: sitios.musica, modo: "teclea" } };
  it("nunca saca de la mesa a quien trabaja", () => {
    for (let i = 0; i < 40; i++) {
      const p = paseoLibre({ vivos, sitios: barra, azar: () => (i % 10) / 10 });
      if (p) expect(p.id).not.toBe("c");
    }
  });
  it("no mueve a quien ya está ocupado", () => {
    expect(paseoLibre({ vivos, ocupados: ["a", "b"], sitios: barra })).toBeNull();
  });
  it("sin nadie libre no pasa nada", () => {
    expect(paseoLibre({ vivos: {}, sitios: barra })).toBeNull();
  });
});
