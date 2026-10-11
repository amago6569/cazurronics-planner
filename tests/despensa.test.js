// npm test — Despensa de León: lo que se acepta de la IA, la ficha de Google, qué toca buscar y el top 3
import { describe, expect, it } from "vitest";
import { COMBINACIONES, fichaValida, pendientes, validarTiendaIA } from "../src/lib/despensa";
import { enlaceMaps, topTiendas } from "../src/lib/despensaProductos";

describe("validarTiendaIA", () => {
  const base = { nombre: "Embutidos Entrepeñas", localidad: "León", fuente: "https://www.diariodeleon.es/x", puntuacion: "9", precio: "calidad-precio" };
  it("acepta una tienda con nombre, pueblo y fuente", () => {
    expect(validarTiendaIA(base)).toMatchObject({ nombre: "Embutidos Entrepeñas", localidad: "León", puntuacion: 9, precio: "calidad-precio" });
  });
  it("sin fuente verificable no se publica", () => {
    expect(validarTiendaIA({ ...base, fuente: null })).toBeNull();
    expect(validarTiendaIA({ ...base, fuente: "https://vertexaisearch.cloud.google.com/x" })).toBeNull();
  });
  it("puntuación y precio raros se arreglan", () => {
    expect(validarTiendaIA({ ...base, puntuacion: 40, precio: "carísimo" })).toMatchObject({ puntuacion: 10, precio: "calidad-precio" });
  });
});

describe("fichaValida", () => {
  const tienda = { nombre: "Cecinas Nieto", localidad: "Astorga" };
  const ficha = { location: { latitude: 42.4567, longitude: -6.0567 }, formattedAddress: "Calle X, 24700 Astorga, León", types: ["store", "food", "point_of_interest", "establishment"] };
  it("vale un negocio de verdad en su zona", () => {
    expect(fichaValida(ficha, tienda, "astorga")).toBe(true);
  });
  it("no vale si Google solo encuentra el pueblo", () => {
    expect(fichaValida({ ...ficha, types: ["locality", "political"] }, tienda, "astorga")).toBe(false);
  });
  it("no vale fuera de la provincia ni lejos de la zona buscada", () => {
    expect(fichaValida({ ...ficha, location: { latitude: 40.4, longitude: -3.7 } }, tienda, "astorga")).toBe(false);
    expect(fichaValida({ ...ficha, formattedAddress: "Ponferrada", location: { latitude: 42.546, longitude: -6.596 } }, tienda, "astorga")).toBe(false);
  });
});

describe("pendientes", () => {
  it("primero las que nunca se han buscado, en orden", () => {
    const toca = pendientes(COMBINACIONES.map(() => null), Date.parse("2026-10-11"), 3);
    expect(toca.map((c) => `${c.producto}:${c.zona}`)).toEqual(["cecina:leon", "embutidos:leon", "botillo:leon"]);
  });
  it("no repite lo buscado hace menos de 90 días", () => {
    const ahora = Date.parse("2026-10-11");
    const fechas = COMBINACIONES.map((_, i) => (i === 0 ? "2026-06-01T00:00:00Z" : "2026-10-01T00:00:00Z"));
    expect(pendientes(fechas, ahora, 6)).toHaveLength(1);
  });
});

describe("topTiendas", () => {
  const t = (nombre, extra) => ({ nombre, localidad: "León", producto: "cecina", puntuacion: 7, precio: "calidad-precio", lat: 42.5987, lon: -5.5671, ...extra });
  const tiendas = [
    t("A", { puntuacion: 9 }), t("B", { puntuacion: 8, precio: "capricho" }), t("C", { puntuacion: 6 }), t("D", { puntuacion: 10, lat: 42.46, lon: -6.06 }),
    t("E", { producto: "quesos", puntuacion: 10 }),
  ];
  it("ordena por puntuación y respeta el radio", () => {
    expect(topTiendas(tiendas, { producto: "cecina", lat: 42.5987, lon: -5.5671, radio: 15 }).map((x) => x.nombre)).toEqual(["A", "B", "C"]);
  });
  it("ajustado quita los caprichos; capricho los pone primero", () => {
    expect(topTiendas(tiendas, { producto: "cecina", lat: 42.5987, lon: -5.5671, radio: 15, presupuesto: "ajustado" }).map((x) => x.nombre)).toEqual(["A", "C"]);
    expect(topTiendas(tiendas, { producto: "cecina", lat: 42.5987, lon: -5.5671, radio: 15, presupuesto: "capricho" })[0].nombre).toBe("B");
  });
  it("con más radio entra la de Astorga", () => {
    expect(topTiendas(tiendas, { producto: "cecina", lat: 42.5987, lon: -5.5671, radio: 60 })[0].nombre).toBe("D");
  });
});

it("el enlace a Maps lleva la ficha", () => {
  expect(enlaceMaps({ nombre: "Cecinas Nieto", localidad: "Astorga", placeId: "abc" })).toContain("query_place_id=abc");
});
