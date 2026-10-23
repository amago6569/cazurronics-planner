import { describe, expect, it } from "vitest";
import { validarFicha, tiendasQueTocan, promptFichas } from "../src/lib/despensaFichas";
import { candidatoDeGoogle, candidatosCerca, palabrasClave, unirCandidatos } from "../src/lib/despensaBuscar";

describe("fichas de las tiendas", () => {
  it("sin fuente no hay especialidades; un premio sin su fuente no vale", () => {
    const f = validarFicha({ especialidades: ["cecina de chivo"], destaca: "Matanza propia", fuente: null, premios: [{ que: "1.º premio cecina", anio: 2024, fuente: "https://diariodeleon.es/x" }, { que: "Mejor embutido", fuente: null }] });
    expect(f.especialidades).toEqual([]);
    expect(f.destaca).toBeNull();
    expect(f.premios).toEqual([{ que: "1.º premio cecina", anio: 2024, fuente: "https://diariodeleon.es/x" }]);
    expect(validarFicha({ especialidades: ["nicanores"], fuente: "https://vertexaisearch.cloud.google.com/x" }).especialidades).toEqual([]);
    expect(validarFicha({ especialidades: ["nicanores", "hojaldres"], fuente: "https://confiteria.es" })).toMatchObject({ especialidades: ["nicanores", "hojaldres"], fuente: "https://confiteria.es" });
  });
  it("tocan las que no tienen ficha o la tienen caducada, León y mejor nota primero", () => {
    const ahora = Date.parse("2026-10-23");
    const t = (placeId, zona, nota, resenas) => ({ placeId, zona, nota, resenas });
    const tiendas = [t("a", "bierzo", 4.9, 300), t("b", "leon", 4.6, 200), t("c", "leon", 4.8, 200), t("d", "leon", 4.9, 400)];
    const fichas = { d: { f: "2026-10-01T00:00:00Z", vacia: false }, c: { f: "2026-07-01T00:00:00Z", vacia: true } };
    expect(tiendasQueTocan(tiendas, fichas, ahora).map((x) => x.placeId)).toEqual(["c", "b", "a"]);
  });
  it("el prompt lleva nombre y dirección de cada tienda", () => {
    expect(promptFichas([{ nombre: "Confitería X", direccion: "Calle Ancha 1, León", cats: ["pasteleria"] }])).toContain("1. Confitería X | Calle Ancha 1, León | Pastelería");
  });
});

describe("el buscador usa premios y especialidades", () => {
  const g = (id, lat, cats) => ({ placeId: id, nombre: id, localidad: "León", lat, lon: -5.57, nota: 4.5, resenas: 100, cats, zona: "leon" });
  it("un premio sube la tienda y su especialidad cuenta como producto", () => {
    const c = candidatoDeGoogle(g("x", 42.6, ["tipicos"]), { especialidades: ["cecina de chivo"], premios: [{ que: "Premio cecina", anio: 2024, fuente: "https://a.es" }], destaca: null, fuente: "https://a.es" });
    expect(c.premios).toEqual(["Premio cecina (2024)"]);
    expect(c.puntuacion).toBeGreaterThan(candidatoDeGoogle(g("y", 42.6, ["tipicos"])).puntuacion);
    expect(c.productos).toContain("cecina");
  });
  it("si pide algo que una tienda tiene como especialidad, esa va primero aunque esté más lejos", () => {
    const google = [g("cerca", 42.6, ["pasteleria"]), g("nicanores", 42.65, ["pasteleria"])];
    const fichas = { nicanores: { especialidades: ["nicanores", "hojaldres"], premios: [], destaca: null, fuente: "https://b.es" } };
    const c = candidatosCerca(unirCandidatos([], google, [], fichas), { lat: 42.5987, lon: -5.5671, radio: 15, pedidos: [], palabras: palabrasClave("unos nicanores buenos") });
    expect(c[0].placeId).toBe("nicanores");
  });
});
