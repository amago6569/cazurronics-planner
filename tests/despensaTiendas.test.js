import { describe, expect, it } from "vitest";
import { CELDAS, tareasPendientes, tiendaDeGoogle, unirFicha, zonasCerca, esDeLeon, puntuacionGoogle } from "../src/lib/despensaTiendas";
import { validarMercadillo, textoDias } from "../src/lib/despensaMercados";
import { candidatosCerca, candidatoDeGoogle, productosEnTexto, unirCandidatos } from "../src/lib/despensaBuscar";
import { CATEGORIAS, categoriaPorId, categoriasDeProducto } from "../src/lib/despensaProductos";

const panaderia = categoriaPorId("panaderia");
const ficha = (o = {}) => ({
  id: "ChIJpan1",
  displayName: { text: "Panadería La Espiga" },
  location: { latitude: 42.5985, longitude: -5.5702 },
  formattedAddress: "Calle Ancha 3, 24003 León, España",
  addressComponents: [{ longText: "24003", types: ["postal_code"] }, { longText: "León", types: ["locality", "political"] }],
  businessStatus: "OPERATIONAL",
  primaryType: "bakery",
  types: ["bakery", "store", "point_of_interest", "establishment"],
  rating: 4.7,
  userRatingCount: 210,
  ...o,
});

describe("cuadrículas", () => {
  it("León capital va primero y en trozos pequeños", () => {
    expect(CELDAS[0].id).toMatch(/^leon-/);
    expect(CELDAS.filter((c) => c.id.startsWith("leon-"))).toHaveLength(9);
    expect(CELDAS.filter((c) => c.id.startsWith("prov-")).length).toBeGreaterThan(150);
  });
  it("la ciudad se barre por tipos; la provincia, primero con la sonda", () => {
    const t = tareasPendientes({}, {}, Date.parse("2026-10-23"), 1e6);
    expect(t.filter((x) => x.celda.id === "leon-1-1").map((x) => x.cat.id)).toEqual(CATEGORIAS.map((c) => c.id));
    const prov = t.filter((x) => x.celda.id.startsWith("prov-"));
    expect(prov.every((x) => x.cat.id === "sonda")).toBe(true);
  });
  it("una cuadrícula fuera de la provincia no vuelve en 6 meses", () => {
    const ahora = Date.parse("2026-10-23");
    const id = CELDAS.find((c) => c.id.startsWith("prov-")).id;
    const t = tareasPendientes({ [`${id}|sonda`]: "2026-10-01T00:00:00Z" }, { [id]: "2026-10-01T00:00:00Z" }, ahora, 1e6);
    expect(t.some((x) => x.celda.id === id)).toBe(false);
  });
  it("sondeada y con tiendas: tocan sus tipos; hechos hace menos de 30 días, no", () => {
    const ahora = Date.parse("2026-10-23");
    const id = CELDAS.find((c) => c.id.startsWith("prov-")).id;
    const hechas = { [`${id}|sonda`]: "2026-10-20T00:00:00Z", [`${id}|carniceria`]: "2026-10-10T00:00:00Z" };
    const cats = tareasPendientes(hechas, {}, ahora, 1e6).filter((x) => x.celda.id === id).map((x) => x.cat.id);
    expect(cats).not.toContain("sonda");
    expect(cats).not.toContain("carniceria");
    expect(cats).toContain("panaderia");
  });
});

describe("tiendaDeGoogle", () => {
  it("una panadería de León con buena nota vale", () => {
    expect(tiendaDeGoogle(ficha(), panaderia, "2026-10-23T00:00:00Z")).toMatchObject({ placeId: "ChIJpan1", localidad: "León", nota: 4.7, resenas: 210, cats: ["panaderia"], zona: "leon" });
  });
  it("fuera de la provincia (código postal que no es 24), no", () => {
    const f = ficha({ addressComponents: [{ longText: "33001", types: ["postal_code"] }] });
    expect(esDeLeon(f)).toBe(false);
    expect(tiendaDeGoogle(f, panaderia)).toBeNull();
  });
  it("cadenas, súper, cerradas y mala nota, no", () => {
    expect(tiendaDeGoogle(ficha({ displayName: { text: "Mercadona" } }), panaderia)).toBeNull();
    expect(tiendaDeGoogle(ficha({ primaryType: "supermarket" }), panaderia)).toBeNull();
    expect(tiendaDeGoogle(ficha({ businessStatus: "CLOSED_PERMANENTLY" }), panaderia)).toBeNull();
    expect(tiendaDeGoogle(ficha({ rating: 2.9, userRatingCount: 80 }), panaderia)).toBeNull();
  });
  it("tiene que ser de ese tipo: por el nombre o por Google", () => {
    const pescaderia = categoriaPorId("pescaderia");
    expect(tiendaDeGoogle(ficha({ displayName: { text: "Bazar Chino" }, types: ["store"] }), pescaderia)).toBeNull();
    expect(tiendaDeGoogle(ficha({ displayName: { text: "Pescados Ramón" }, types: ["store"] }), pescaderia)).not.toBeNull();
  });
  it("sin nota (búsqueda sin nota) también vale, sin estrellas", () => {
    expect(tiendaDeGoogle(ficha({ rating: undefined, userRatingCount: undefined }), panaderia)).toMatchObject({ nota: null, resenas: 0 });
  });
});

describe("unirFicha", () => {
  const ahora = Date.parse("2026-10-23");
  it("suma tipos y conserva la nota si tiene menos de 30 días", () => {
    const vieja = { placeId: "x", cats: ["panaderia"], nota: 4.5, resenas: 40, fn: "2026-10-10T00:00:00Z" };
    const nueva = { placeId: "x", cats: ["pasteleria"], nota: null, resenas: 0, f: "2026-10-23T00:00:00Z" };
    expect(unirFicha(vieja, nueva, ahora)).toMatchObject({ cats: ["panaderia", "pasteleria"], nota: 4.5, resenas: 40 });
  });
  it("una nota de hace más de 30 días no se arrastra", () => {
    const vieja = { placeId: "x", cats: ["panaderia"], nota: 4.5, resenas: 40, fn: "2026-09-01T00:00:00Z" };
    expect(unirFicha(vieja, { placeId: "x", cats: ["panaderia"], nota: null, resenas: 0 }, ahora).nota).toBeNull();
  });
});

describe("zonasCerca", () => {
  it("en León con 10 km no lee el Bierzo", () => {
    const z = zonasCerca(42.5987, -5.5671, 10);
    expect(z).toContain("leon");
    expect(z).not.toContain("bierzo");
  });
  it("toda la provincia lee todo", () => {
    expect(zonasCerca(42.5987, -5.5671, 200)).toHaveLength(9);
  });
});

describe("buscador con tiendas de Google", () => {
  it("'un buen pan' pide pan; 'una carnicería' pide lo de la carnicería", () => {
    expect(productosEnTexto("un buen pan")).toContain("pan");
    expect(productosEnTexto("una carnicería buena")).toEqual(expect.arrayContaining(["carne", "morcilla"]));
  });
  it("la morcilla se compra en carnicerías y charcuterías", () => {
    expect(categoriasDeProducto("morcilla")).toEqual(expect.arrayContaining(["carniceria", "charcuteria"]));
  });
  it("con pan cerca en León, salen las panaderías cercanas y no una tienda lejana", () => {
    const g = (id, lat, lon, nota, resenas, cats = ["panaderia"]) => ({ placeId: id, nombre: id, localidad: "León", lat, lon, nota, resenas, cats, zona: "leon" });
    const google = [g("cerca", 42.6, -5.57, 4.6, 120), g("lejos", 42.95, -5.0, 4.9, 300), g("carne", 42.6, -5.571, 4.8, 90, ["carniceria"])];
    const riano = [{ nombre: "Horno de Riaño", localidad: "Riaño", lat: 42.97, lon: -5.0, placeId: "r", producto: "pan", puntuacion: 9 }];
    const c = candidatosCerca(unirCandidatos(riano, google), { lat: 42.5987, lon: -5.5671, radio: 10, pedidos: productosEnTexto("un buen pan") });
    expect(c.map((t) => t.placeId)).toEqual(["cerca", "carne"]);
    expect(c[0]).toMatchObject({ ref: "t1", productoNombre: "Panadería" });
  });
  it("la nota de Google se ajusta por reseñas", () => {
    expect(puntuacionGoogle({ nota: 5, resenas: 3 })).toBe(6);
    expect(puntuacionGoogle({ nota: 4.7, resenas: 300 })).toBeGreaterThan(9);
    expect(candidatoDeGoogle({ placeId: "a", nombre: "A", cats: ["mercado"], nota: null, resenas: 0 }).productos).toContain("fruta");
  });
});

describe("mercadillos", () => {
  it("valida días, fuente y tipo", () => {
    const m = validarMercadillo({ pueblo: "Boñar", dias: ["Jueves"], horario: "9-14 h", lugar: "Plaza", que: "fruta y embutido", fuente: "https://www.bonar.es/mercado" });
    expect(m).toMatchObject({ pueblo: "Boñar", dias: ["jueves"], tipo: "semanal" });
    expect(validarMercadillo({ pueblo: "Boñar", dias: ["jueves"], fuente: null })).toBeNull();
    expect(validarMercadillo({ pueblo: "Boñar", dias: ["cuando sea"], fuente: "https://x.es" })).toBeNull();
  });
  it("los días se leen bien", () => {
    expect(textoDias(["miércoles", "sábado"])).toBe("miércoles y sábado");
    expect(textoDias(["lunes", "jueves", "sábado"])).toBe("lunes, jueves y sábado");
  });
});
