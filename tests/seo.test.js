// npm test — piezas para Google: la frase con la respuesta y los datos estructurados
import { describe, expect, it } from "vitest";
import { fraseRespuesta, jsonLdSeguro, listaTiendasJsonLd } from "../src/lib/seo";
import { rutaDespensaZona, zonaPorSlug } from "../src/lib/zonasSeo";

const tiendas = [
  { nombre: "Embutidos A", localidad: "Astorga", nota: 4.7, resenas: 312, lat: 42.45, lon: -6.05, placeId: "a" },
  { nombre: "Carnicería B", localidad: "Astorga", nota: 4.5, resenas: 3 },
  { nombre: "Charcutería C", localidad: "Benavides", nota: 4.6, resenas: 80 },
];

describe("fraseRespuesta", () => {
  it("da la respuesta en el orden de la lista y con la nota de Google", () => {
    expect(fraseRespuesta("Morcilla", tiendas, "en Astorga")).toBe(
      "Para comprar morcilla en Astorga, nuestra primera recomendación es Embutidos A, en Astorga, con 4,7 ★ en Google Maps y 312 reseñas. Le siguen Carnicería B (Astorga) y Charcutería C (4,6 ★).",
    );
  });
  it("con pocas reseñas no cita la nota", () => {
    expect(fraseRespuesta("Cecina", [tiendas[1]])).toBe("Para comprar cecina en León, nuestra primera recomendación es Carnicería B, en Astorga.");
  });
  it("sin tiendas, nada", () => {
    expect(fraseRespuesta("Cecina", [])).toBeNull();
  });
});

describe("listaTiendasJsonLd", () => {
  const j = listaTiendasJsonLd({ nombre: "X", url: "https://cazurronics.es/x", tiendas });
  it("una lista de tiendas con posición", () => {
    expect(j["@type"]).toBe("ItemList");
    expect(j.itemListElement.map((x) => x.position)).toEqual([1, 2, 3]);
  });
  it("nota solo con 5 reseñas o más, y coordenadas si las hay", () => {
    expect(j.itemListElement[0].item.aggregateRating).toMatchObject({ ratingValue: 4.7, reviewCount: 312 });
    expect(j.itemListElement[1].item.aggregateRating).toBeUndefined();
    expect(j.itemListElement[0].item.geo).toMatchObject({ latitude: 42.45 });
  });
  it("no deja cerrar la etiqueta script", () => {
    expect(jsonLdSeguro({ a: "</script>" })).not.toContain("</script>");
  });
});

describe("rutas de la despensa por comarca", () => {
  it("producto y comarca, y vuelta atrás", () => {
    expect(rutaDespensaZona("morcilla", "astorga")).toBe("/despensa/morcilla/astorga");
    expect(rutaDespensaZona("cecina", "leon")).toBe("/despensa/cecina/leon-capital");
    expect(zonaPorSlug("leon-capital")?.id).toBe("leon");
  });
});
