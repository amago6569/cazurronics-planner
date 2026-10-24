import { describe, expect, it } from "vitest";
import { aplicarMarcas, esElSitio, MARCAS } from "../src/lib/despensaMarcas";
import { candidatosCerca, palabrasClave, primeroLaMarca, unirCandidatos } from "../src/lib/despensaBuscar";

describe("productores y sus tiendas", () => {
  const m = MARCAS.find((x) => x.id === "morvega");
  const sitios = {
    [m.fabrica.busca]: { placeId: "fab", lat: 42.84, lon: -5.15, localidad: "Sahelices de Sabero", f: "2026-10-24" },
    [m.tiendas[0].busca]: { placeId: "conocida", lat: 42.6, lon: -5.57, f: "2026-10-24" },
    [m.tiendas[1].busca]: { placeId: "nueva", lat: 42.598, lon: -5.567, localidad: "León", f: "2026-10-24" },
    [m.tiendas[2].busca]: { f: "2026-10-24" },
  };
  const google = [{ placeId: "conocida", nombre: "Patatas Marcos", localidad: "León", lat: 42.6, lon: -5.57, nota: 4.6, resenas: 80, cats: ["fruteria"], zona: "leon" }];

  it("solo vale el sitio si Google da el nombre que buscamos", () => {
    expect(esElSitio({ clave: "selecta" }, { placeId: "x", nombre: "Rúa Selecta - Tienda Gourmet" })).toBe(true);
    expect(esElSitio({ clave: "serranillo" }, { placeId: "x", nombre: "Bar Pepe" })).toBe(false);
    expect(esElSitio({ clave: "morvega" }, null)).toBe(false);
  });
  it("a las tiendas conocidas se les añade la morcilla; las demás y la fábrica entran como nuevas", () => {
    const { fichas, extra } = aplicarMarcas(google, {}, sitios);
    expect(fichas.conocida.especialidades[0]).toMatch(/morcilla Morvega/);
    expect(extra.map((t) => t.placeId).sort()).toEqual(["fab", "nueva"]);
    expect(extra.find((t) => t.placeId === "fab").porque).toMatch(/Sahelices de Sabero/);
  });
  it("quien pide morcilla en León ve las tiendas que tienen Morvega", () => {
    const { fichas, extra } = aplicarMarcas(google, {}, sitios);
    const c = candidatosCerca([...unirCandidatos([], google, [], fichas), ...extra], { lat: 42.5987, lon: -5.5671, radio: 3, pedidos: ["morcilla"], palabras: palabrasClave("una buena morcilla") });
    expect(c.map((t) => t.placeId)).toEqual(expect.arrayContaining(["conocida", "nueva"]));
    expect(c.find((t) => t.placeId === "fab")).toBeUndefined(); // la fábrica está a más de 3 km
  });

  it("si pide morcilla y hay un sitio con Morvega en el radio, va el primero; si no, nada cambia", () => {
    const { fichas, extra, primero } = aplicarMarcas(google, {}, sitios);
    const todas = [...unirCandidatos([], google, [], fichas), ...extra];
    const otra = { placeId: "otra", nombre: "Carnicería X", lat: 42.599, lon: -5.567, para: "Morcilla", motivo: "Muy buena" };
    const leon = { lat: 42.5987, lon: -5.5671, radio: 3 };
    const r = primeroLaMarca([otra], todas, primero, ["morcilla"], leon);
    expect(r[0].placeId).toBe("nueva");
    expect(r[0].motivo).toMatch(/Morvega/);
    expect(r[1].placeId).toBe("otra");
    // Sin pedir morcilla, o sin sitio en el radio, queda como estaba
    expect(primeroLaMarca([otra], todas, primero, ["pan"], leon)).toEqual([otra]);
    expect(primeroLaMarca([otra], todas, primero, ["morcilla"], { lat: 42.0, lon: -6.5, radio: 5 })).toEqual([otra]);
  });
});
