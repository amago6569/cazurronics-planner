// npm test — La foto de cada parada es la del sitio, o no hay foto (Alejandro, 25-11-2026: «que las fotos que salgan estén
// bien o sean coherentes»). En 40 eventos de la agenda sin foto de Google salió 1 coherente: 11 PDF de libros viejos de
// Wikimedia y 28 fotos genéricas de otros países. Los nombres de archivo de abajo son los que salieron de verdad.
import { afterEach, describe, expect, it, vi } from "vitest";
import { enriquecerParada, fotoDeSerie, fotoEsDelSitio, temaDeSerie } from "../src/lib/planUtils";

const CATEDRAL = "File:Catedral de León. España-44.jpg";
const LIBRO_VIEJO = "File:Cosas de España (IA cosasdeespaas2zarc).pdf";
const consultas = [];
// Dónde se hizo cada foto según Wikimedia (si no se dice, en León; null = sin posición)
const dondeSeHizo = {
  "File:Universidad de Guanajuato (León) I.jpg": { lat: 21.12, lon: -101.68 },
  "File:Rosetón da catedral de León 47.jpg": null,
};
// Google y Wikimedia de mentira: textsearch de Google devuelve `sitios`; la búsqueda de Wikimedia, `archivos`
function simular({ sitios = [], archivos = [] } = {}) {
  consultas.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = decodeURIComponent(String(url));
    if (u.includes("textsearch")) return { json: async () => ({ status: "OK", results: sitios }) };
    if (u.includes("place/details")) return { json: async () => ({ result: {} }) };
    if (u.includes("commons.wikimedia.org") && u.includes("list=search")) {
      consultas.push(u.match(/srsearch=([^&]*)/)[1]);
      return { json: async () => ({ query: { search: archivos.map((title) => ({ title })) } }) };
    }
    if (u.includes("commons.wikimedia.org") && u.includes("prop=coordinates|imageinfo")) {
      const pages = Object.fromEntries(u.match(/titles=([^&]*)/)[1].split("|").map((title, i) => [i + 1, {
        title, imageinfo: [{ url: `https://upload.wikimedia.org/x/${title.replace(/^File:/, "").replace(/ /g, "_")}` }],
        ...(dondeSeHizo[title] === null ? {} : { coordinates: [dondeSeHizo[title] || { lat: 42.599, lon: -5.567 }] }),
      }]));
      return { json: async () => ({ query: { pages } }) };
    }
    return { ok: false, json: async () => ({}) };
  }));
}
const contexto = { lat: 42.5987, lon: -5.5671, radio: 15, priceLevelObjetivo: 1, nombreZona: "León", mapsKey: "x", limite: Date.now() + 20000 };
afterEach(() => vi.unstubAllGlobals());

describe("¿la foto es del sitio?", () => {
  it("la de la Catedral es de la Catedral de León, no de la de Astorga", () => {
    expect(fotoEsDelSitio(CATEDRAL, "Catedral de León")).toBe(true);
    expect(fotoEsDelSitio(CATEDRAL, "Catedral de Astorga")).toBe(false);
    expect(fotoEsDelSitio("File:Parque de Quevedo, León.jpg", "Paseo por el Parque de Quevedo")).toBe(true);
  });
  it("tiene que llevar el nombre entero: «Carnaval San Francisco» no es el Teatro San Francisco", () => {
    expect(fotoEsDelSitio("File:Conceição Damasceno King & Queen Competition Carnaval San Francisco.jpg", "Teatro San Francisco")).toBe(false);
  });
  it("un PDF o un libro escaneado no es una foto, aunque diga «España»", () => {
    expect(fotoEsDelSitio(LIBRO_VIEJO, "La semilla (teatro infantil)")).toBe(false);
    expect(fotoEsDelSitio("File:Catedral de León.pdf", "Catedral de León")).toBe(false);
    expect(fotoEsDelSitio("File:Informe Anual Wikimedia España 2023 (es).pdf", "Festivales con Arte")).toBe(false);
  });
});

describe("la foto de cada parada", () => {
  it("un evento sin local ni foto de Google lleva una de serie de lo que es, no la de otra cosa", async () => {
    simular({ archivos: [LIBRO_VIEJO, "File:Live band performance captivates crowd at local music festival.jpg"] });
    const { parada } = await enriquecerParada({ titulo: "La semilla (teatro infantil)", tipo: "teatro", hora: "18:00", lat: 42.6, lon: -5.57 }, contexto);
    expect(parada.fotoOficial).toBe(fotoDeSerie({ titulo: "La semilla (teatro infantil)", tipo: "teatro" }));
    expect(parada.fotoDeSerie).toBe(true);
    // Ni búsqueda por el título del evento ni foto genérica en inglés
    expect(consultas).toEqual([]);
  });
  it("un evento cuyo local no está en Google lleva la foto de su local si Wikimedia la tiene", async () => {
    simular({ archivos: [LIBRO_VIEJO, "File:Museo de San Isidoro de León (2).jpg"] });
    const { parada } = await enriquecerParada({ titulo: "Conferencia «Escribir para reinar»", tipo: "evento", lugar: "Museo de San Isidoro", hora: "19:30", lat: 42.6, lon: -5.57 }, contexto);
    expect(consultas[0]).toBe("Museo de San Isidoro León");
    expect(parada.fotoOficial).toMatch(/Museo_de_San_Isidoro_de_León_\(2\)\.jpg$/);
  });
  it("un monumento sin foto de Google lleva la suya de Wikimedia, saltándose el PDF que sale antes", async () => {
    simular({ archivos: [LIBRO_VIEJO, CATEDRAL] });
    const { parada } = await enriquecerParada({ titulo: "Catedral de León", tipo: "monumento", hora: "11:00", lat: 42.5994, lon: -5.5668 }, contexto);
    expect(parada.fotoOficial).toMatch(/Catedral_de_León\._España-44\.jpg$/);
  });
  it("una foto de otro León (México) o sin posición no vale, aunque lleve el nombre", async () => {
    simular({ archivos: ["File:Universidad de Guanajuato (León) I.jpg"] });
    const mexico = await enriquecerParada({ titulo: "Universidad de León", tipo: "monumento", hora: "11:00", lat: 42.61, lon: -5.56 }, contexto);
    expect(mexico.parada.fotoDeSerie).toBe(true);
    expect(temaDeSerie(mexico.parada)).toBe("monumento");
    simular({ archivos: ["File:Rosetón da catedral de León 47.jpg", CATEDRAL] });
    const catedral = await enriquecerParada({ titulo: "Catedral de León", tipo: "monumento", hora: "11:00", lat: 42.5994, lon: -5.5668 }, contexto);
    expect(catedral.parada.fotoOficial).toMatch(/Catedral_de_León\._España-44\.jpg$/);
  });
  it("un bar sin foto en Google no busca en Wikimedia (allí no está): lleva la de serie de un bar", async () => {
    simular({ sitios: [{ name: "Bar El Gallo", place_id: "g1", types: ["bar"], formatted_address: "Calle Ancha 1, 24003 León", geometry: { location: { lat: 42.598, lng: -5.568 } } }], archivos: [CATEDRAL] });
    const { parada } = await enriquecerParada({ titulo: "Bar El Gallo", tipo: "bar", hora: "20:00", lat: 42.598, lon: -5.568 }, contexto);
    expect(temaDeSerie(parada)).toBe("bar");
    expect(parada).toMatchObject({ fotoOficial: fotoDeSerie({ tipo: "bar" }), fotoDeSerie: true });
    expect(consultas).toEqual([]);
  });
});

describe("la foto de serie va de lo que es la parada", () => {
  it("cada tipo de plan tiene la suya", () => {
    const casos = [
      [{ titulo: "Presentación del libro «Mientras me operan el cerebro»", tipo: "evento" }, "libro"],
      [{ titulo: "Conferencia «Escribir para reinar»", tipo: "evento" }, "charla"],
      [{ titulo: "Vangoura en concierto", tipo: "concierto" }, "concierto"],
      [{ titulo: "Concierto de Navidad de la Banda Municipal", tipo: "evento" }, "concierto"],
      [{ titulo: "Mercado de Navidad", tipo: "mercadillo" }, "mercadoNavidad"],
      [{ titulo: "Encendido del alumbrado navideño", tipo: "evento" }, "navidad"],
      [{ titulo: "Magosto popular de Boñar", tipo: "fiesta" }, "fiesta"],
      [{ titulo: "Jornadas gastronómicas de la matanza", tipo: "gastronomia" }, "gastronomia"],
      [{ titulo: "Cuentacuentos en la biblioteca", tipo: "evento" }, "infantil"],
      [{ titulo: "Exposición de ocho décadas de Pistoletto", tipo: "exposicion" }, "exposicion"],
      [{ titulo: "Ruta de las Hoces de Vegacervera", tipo: "ruta" }, "ruta"],
      [{ titulo: "Cultural Leonesa - Real Oviedo", tipo: "deporte" }, "deporte"],
      [{ titulo: "Algo que no se sabe qué es", tipo: "evento" }, "evento"],
    ];
    for (const [parada, tema] of casos) expect([parada.titulo, temaDeSerie(parada)]).toEqual([parada.titulo, tema]);
  });
  it("un bar es un bar aunque su nombre suene a otra cosa", () => {
    expect(temaDeSerie({ titulo: "La Bodega del Rock", tipo: "bar" })).toBe("bar");
    expect(temaDeSerie({ titulo: "Mesón El Concierto", tipo: "restaurante" })).toBe("restaurante");
    expect(temaDeSerie({ titulo: "Glam Theatre", tipo: "pub" })).toBe("discoteca");
  });
  it("son de Unsplash (permitido en la web) y cada tema tiene la suya", () => {
    const urls = ["libro", "charla", "teatro", "bar"].map((t) => fotoDeSerie({ titulo: t }));
    for (const u of urls) expect(u).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
