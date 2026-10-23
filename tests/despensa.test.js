// npm test — Despensa de León: lo que se acepta de la IA, la ficha de Google, qué toca buscar y el top 3
import { describe, expect, it } from "vitest";
import { COMBINACIONES, fichaValida, pendientes, validarTiendaIA } from "../src/lib/despensa";
import { enlaceMaps, rutaMaps, topTiendas } from "../src/lib/despensaProductos";

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
    expect(toca.map((c) => `${c.producto}:${c.zona}`)).toEqual(["cecina:leon", "embutidos:leon", "morcilla:leon"]);
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

describe("buscar con tus palabras", async () => {
  const { candidatosCerca, leerPeticionDespensa, lugarEnTexto, productosEnTexto, validarRespuesta } = await import("../src/lib/despensaBuscar");
  const { limpiarPeticion, peticionesPendientes } = await import("../src/lib/despensa");
  const t = (nombre, extra) => ({ nombre, localidad: "León", producto: "cecina", puntuacion: 7, precio: "calidad-precio", lat: 42.5987, lon: -5.5671, ...extra });

  it("lee la petición y pone valores seguros", () => {
    expect(leerPeticionDespensa({ texto: "  cecina ", lat: 42.6, lon: -5.57, radio: 999, presupuesto: "x" })).toMatchObject({ texto: "cecina", radio: 200, presupuesto: "igual" });
    expect(leerPeticionDespensa({ texto: "cecina", lat: 42.6, lon: -5.57, radio: 23.4 })).toMatchObject({ radio: 23 });
    expect(leerPeticionDespensa({ texto: "cecina", lat: 42.6, lon: -5.57, radio: 0 })).toMatchObject({ radio: 15 });
    expect(leerPeticionDespensa({ texto: "a", lat: 42.6, lon: -5.57 }).error).toBeTruthy();
    expect(leerPeticionDespensa({ texto: "cecina", lat: "x" }).error).toBeTruthy();
  });
  it("encuentra el sitio que nombras", () => {
    expect(lugarEnTexto("mantecadas en Astorga para regalar")).toBe("astorga");
    expect(lugarEnTexto("vino por el Bierzo")).toBe("bierzo");
    expect(lugarEnTexto("cecina de León")).toBeNull();
  });
  it("adivina el producto del catálogo", () => {
    expect(productosEnTexto("un queso curado")).toContain("quesos");
    expect(productosEnTexto("cecina buena para regalar")).toContain("cecina");
  });
  it("los candidatos respetan radio y presupuesto, y lo pedido va primero", () => {
    const tiendas = [t("A", { puntuacion: 9 }), t("B", { producto: "quesos", puntuacion: 5, precio: "capricho" }), t("Lejos", { lat: 42.46, lon: -6.06 })];
    const c = candidatosCerca(tiendas, { lat: 42.5987, lon: -5.5671, radio: 15, presupuesto: "igual", pedidos: ["quesos"] });
    expect(c.map((x) => x.nombre)).toEqual(["B", "A"]);
    expect(c[0].ref).toBe("t1");
    expect(candidatosCerca(tiendas, { lat: 42.5987, lon: -5.5671, radio: 15, presupuesto: "ajustado" }).map((x) => x.nombre)).toEqual(["A"]);
  });
  it("solo acepta tiendas de la lista, sin repetir", () => {
    const candidatos = candidatosCerca([t("A"), t("B")], { lat: 42.5987, lon: -5.5671, radio: 15 });
    const r = validarRespuesta({ frase: "Hola", tiendas: [{ ref: "t2", para: "Cecina", motivo: "La mejor" }, { ref: "t2" }, { ref: "t9" }, { nombre: "Inventada" }], falta: "aceite de oliva" }, candidatos);
    expect(r.tiendas.map((x) => x.nombre)).toEqual(["B"]);
    expect(r).toMatchObject({ frase: "Hola", falta: "aceite de oliva" });
    expect(validarRespuesta({ falta: "null" }, candidatos).falta).toBeNull();
    expect(validarRespuesta(null, candidatos)).toMatchObject({ tiendas: [], falta: null });
  });
  it("lo que falta se limpia y la cola va de la más antigua a la más nueva", () => {
    expect(limpiarPeticion("<b>aceite</b> de oliva!!")).toBe("aceite de oliva");
    expect(limpiarPeticion("??")).toBeNull();
    const todas = [{ id: "c", fecha: "3" }, { id: "b", fecha: "2", hecha: true }, { id: "a", fecha: "1" }];
    expect(peticionesPendientes(todas, 2).map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("rutaMaps", () => {
  const leon = { lat: 42.5987, lon: -5.5671 };
  const cerca = { nombre: "Carnicería Cerca", localidad: "León", lat: 42.60, lon: -5.57, placeId: "A" };
  const lejos = { nombre: "Horno Lejos", localidad: "Boñar", lat: 42.87, lon: -5.32, placeId: "B" };
  const medio = { nombre: "Panadería Medio", localidad: "Villaquilambre", lat: 42.64, lon: -5.55, placeId: "C" };
  it("con una sola tienda no hay ruta", () => {
    expect(rutaMaps([cerca], leon)).toBeNull();
  });
  it("va de la más cercana a la más lejana y acaba en la última", () => {
    const r = rutaMaps([lejos, cerca, medio], leon);
    expect(r.paradas.map((t) => t.nombre)).toEqual(["Carnicería Cerca", "Panadería Medio", "Horno Lejos"]);
    const u = new URL(r.url);
    expect(u.searchParams.get("destination")).toBe("Horno Lejos, Boñar");
    expect(u.searchParams.get("waypoints")).toBe("Carnicería Cerca, León|Panadería Medio, Villaquilambre");
    expect(u.searchParams.get("waypoint_place_ids")).toBe("A|C");
    expect(u.searchParams.get("origin")).toBe("42.5987,-5.5671");
  });
  it("como mucho 4 paradas", () => {
    const muchas = Array.from({ length: 6 }, (_, i) => ({ ...cerca, nombre: `T${i}`, placeId: `P${i}`, lat: 42.6 + i / 100 }));
    expect(rutaMaps(muchas, leon).paradas).toHaveLength(4);
  });
});
