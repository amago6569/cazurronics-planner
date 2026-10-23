import { describe, expect, it } from "vitest";
import { validarFicha, tiendasQueTocan, promptFichas } from "../src/lib/despensaFichas";
import { candidatoDeGoogle, candidatosCerca, palabrasClave, unirCandidatos } from "../src/lib/despensaBuscar";

describe("fichas de las tiendas", () => {
  it("solo vale lo que dicen las reseñas", () => {
    const resenas = '- "La mejor cecina de chivo de León, y los chorizos caseros"\n- "Ganaron el concurso de cecina de 2024"';
    const f = validarFicha({ especialidades: ["cecina de chivo", "chorizo casero", "lechazo"], premios: [{ que: "1.º premio concurso de cecina", anio: 2024 }, { que: "Mejor queso" }], destaca: "Matanza propia" }, resenas);
    expect(f.especialidades).toEqual(["cecina de chivo", "chorizo casero"]);
    expect(f.premios).toEqual([{ que: "1.º premio concurso de cecina", anio: 2024 }]);
    expect(f.destaca).toBe("Matanza propia");
  });
  it("sin hablar de premios en las reseñas no hay premio, y sin nada concreto no hay destaca", () => {
    const f = validarFicha({ especialidades: ["buen trato"], premios: [{ que: "Premio a la mejor cecina" }], destaca: "Muy amables" }, '- "La cecina muy buena, buen precio"');
    expect(f.premios).toEqual([]);
    expect(f.especialidades).toEqual([]);
    expect(f.destaca).toBeNull();
  });
  it("tocan las que no tienen ficha o la tienen caducada, León y mejor nota primero", () => {
    const ahora = Date.parse("2026-10-23");
    const t = (placeId, zona, nota, resenas) => ({ placeId, zona, nota, resenas });
    const tiendas = [t("a", "bierzo", 4.9, 300), t("b", "leon", 4.6, 200), t("c", "leon", 4.8, 200), t("d", "leon", 4.9, 400)];
    const fichas = { d: { f: "2026-10-01T00:00:00Z", v: 4 }, c: { f: "2026-09-01T00:00:00Z", v: 4 }, a: { f: "2026-10-20T00:00:00Z", v: 3 } };
    expect(tiendasQueTocan(tiendas, fichas, ahora).map((x) => x.placeId)).toEqual(["c", "b", "a"]);
  });
  it("el prompt lleva cada tienda con sus reseñas", () => {
    const p = promptFichas([{ nombre: "Confitería X", localidad: "León", cats: ["pasteleria"], texto: '- "Los nicanores, de lujo"' }]);
    expect(p).toContain("TIENDA 1: Confitería X (León) · Pastelería");
    expect(p).toContain("Los nicanores, de lujo");
  });
});

describe("el buscador usa premios y especialidades", () => {
  const g = (id, lat, cats) => ({ placeId: id, nombre: id, localidad: "León", lat, lon: -5.57, nota: 4.5, resenas: 100, cats, zona: "leon" });
  it("un premio sube la tienda y su especialidad cuenta como producto", () => {
    const c = candidatoDeGoogle(g("x", 42.6, ["tipicos"]), { especialidades: ["cecina de chivo"], premios: [{ que: "Premio cecina", anio: 2024, fuente: "https://a.es" }], destaca: null, fuente: "https://a.es" });
    expect(c.premios).toEqual(["Premio cecina (2024)"]);
    expect(c.puntuacion).toBeGreaterThan(candidatoDeGoogle(g("y", 42.6, ["tipicos"])).puntuacion);
    expect(c.productos).toContain("cecina");
    expect(c.deResenas).toBe(false);
    expect(candidatoDeGoogle(g("z", 42.6, ["tipicos"]), { especialidades: ["cecina"], premios: [], destaca: null, origen: "resenas" }).deResenas).toBe(true);
  });
  it("si pide algo que una tienda tiene como especialidad, esa va primero aunque esté más lejos", () => {
    const google = [g("cerca", 42.6, ["pasteleria"]), g("nicanores", 42.65, ["pasteleria"])];
    const fichas = { nicanores: { especialidades: ["nicanores", "hojaldres"], premios: [], destaca: null, fuente: "https://b.es" } };
    const c = candidatosCerca(unirCandidatos([], google, [], fichas), { lat: 42.5987, lon: -5.5671, radio: 15, pedidos: [], palabras: palabrasClave("unos nicanores buenos") });
    expect(c[0].placeId).toBe("nicanores");
  });
});

describe("fuentes de la IA", async () => {
  const { fuentesDelTramo, esRedireccion } = await import("../src/lib/fuentes");
  it("reconoce las redirecciones de Google", () => {
    expect(esRedireccion("https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc")).toBe(true);
    expect(esRedireccion("https://www.diariodeleon.es/x")).toBe(false);
  });
  it("da las páginas que respaldan el trozo de cada tienda (posiciones en bytes)", () => {
    const texto = '[{"n":1,"especialidades":["cecina añeja"]},{"n":2,"especialidades":["pan"]}]';
    const b = (i) => Buffer.byteLength(texto.slice(0, i), "utf8");
    const i2 = texto.indexOf('"n":2');
    const grounding = { chunks: [{ uri: "https://a" }, { uri: "https://b" }], supports: [{ segment: { startIndex: b(10) }, groundingChunkIndices: [0] }, { segment: { startIndex: b(i2 + 5) }, groundingChunkIndices: [1] }] };
    expect(fuentesDelTramo(texto, grounding, 1, i2)).toEqual(["https://a"]);
    expect(fuentesDelTramo(texto, grounding, i2, texto.length)).toEqual(["https://b"]);
  });
});
