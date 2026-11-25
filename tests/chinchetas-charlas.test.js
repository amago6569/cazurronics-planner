// npm test — La chincheta de una charla de la agenda va en su local, o no va (25-11-2026, ya publicado #101):
// «algo de charla literaria y comer» puso la «Presentación del libro "Mientras me operan el cerebro"» (en la agenda solo
// «León») en la Casa del Libro de Espacio León, y la conferencia del Museo de San Isidoro (tipo «otro») salió sin chincheta.
import { afterEach, describe, expect, it, vi } from "vitest";
import { enriquecerParada } from "../src/lib/planUtils";
import { mismoSitioDeEvento } from "../src/lib/nombres";

const ficha = (name, types, lat = 42.6, lng = -5.57) => ({
  name, place_id: `id_${name.length}`, rating: 4.5, user_ratings_total: 90, types,
  formatted_address: "Calle Ancha, 24003 León, España", geometry: { location: { lat, lng } },
});
const consultas = [];
function simularGoogle(resultados) {
  consultas.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (String(url).includes("textsearch")) { consultas.push(decodeURIComponent(String(url))); return { json: async () => ({ status: "OK", results: resultados }) }; }
    if (String(url).includes("place/details")) return { json: async () => ({ result: {} }) };
    return { ok: false, json: async () => ({}) };
  }));
}
const LIBRO = "https://www.institutoleonesdecultura.es/eventos/";
const URRACA = "https://www.museosanisidoro.es/agenda-cultural/";
const contexto = { lat: 42.5987, lon: -5.5671, radio: 15, priceLevelObjetivo: 1, nombreZona: "León", mapsKey: "x", limite: Date.now() + 20000, fuentes: new Set([LIBRO, URRACA]) };
afterEach(() => vi.unstubAllGlobals());

describe("el local de un evento", () => {
  it("«libro» o «sala» no hacen que un sitio sea el suyo", () => {
    expect(mismoSitioDeEvento({ titulo: "Presentación del libro 'Mientras me operan el cerebro'" }, "Casa del Libro")).toBe(false);
    expect(mismoSitioDeEvento({ lugar: "Sala del Pendón de Baeza", titulo: "Conferencia" }, "Sala Gótica")).toBe(false);
  });
  it("sí lo es si coincide el nombre del local", () => {
    expect(mismoSitioDeEvento({ lugar: "Sala del Pendón de Baeza, Museo de San Isidoro", titulo: "Conferencia «Escribir para reinar»" }, "Museo de San Isidoro")).toBe(true);
    expect(mismoSitioDeEvento({ lugar: "Sala Babylon", titulo: "Concierto de Vangoura" }, "Babylon")).toBe(true);
  });
});

describe("charlas de la agenda en el plan", () => {
  it("la presentación sin local no acaba en la Casa del Libro: sin chincheta", async () => {
    simularGoogle([ficha("Casa del Libro", ["book_store", "store"], 42.6126, -5.596)]);
    const { parada } = await enriquecerParada({ titulo: "Presentación del libro 'MIENTRAS ME OPERAN EL CEREBRO'", tipo: "literatura", lugar: "León", hora: "19:30", fuente: LIBRO, lat: 42.6, lon: -5.57 }, contexto);
    expect(parada.nombreGoogle).toBeUndefined();
    expect(parada.sinUbicar).toBe(true);
    expect(parada.tipo).toBe("evento");
  });
  it("la conferencia de tipo «otro» se busca por su local y lleva su chincheta", async () => {
    simularGoogle([ficha("Museo de San Isidoro", ["museum", "point_of_interest"], 42.6, -5.5707)]);
    const { parada } = await enriquecerParada({ titulo: "Conferencia «Escribir para reinar: los documentos de Urraca I»", tipo: "otro", lugar: "Sala del Pendón de Baeza, Museo de San Isidoro", hora: "19:30", fuente: URRACA, lat: 42.61, lon: -5.58 }, contexto);
    expect(consultas[0]).toContain("Sala del Pendón de Baeza, Museo de San Isidoro, León");
    expect(parada).toMatchObject({ lat: 42.6, lon: -5.5707, nombreGoogle: "Museo de San Isidoro", tipo: "evento" });
    expect(parada.sinUbicar).toBeUndefined();
  });
  it("un tipo raro que no viene de la agenda no se toca", async () => {
    simularGoogle([]);
    const { parada } = await enriquecerParada({ titulo: "Paseo literario", tipo: "otro", lat: 42.6, lon: -5.57 }, contexto);
    expect(parada.tipo).toBe("otro");
  });
});
