// npm test — Rutas y parques que existen de verdad, y votos que no pasan a la parada nueva
import { afterEach, describe, expect, it, vi } from "vitest";
import { enriquecerParada } from "../src/lib/planUtils";
import { mismoSitioNatural } from "../src/lib/nombres";
import { camposDeParada, resumirVotos } from "../src/lib/votos";

const ficha = (name) => ({
  name, place_id: `id_${name.length}`, rating: 4.5, user_ratings_total: 90, types: ["park"],
  formatted_address: "Paseo de Quevedo, 24009 León, España", geometry: { location: { lat: 42.6, lng: -5.585 } },
});
function simularGoogle(resultados) {
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (String(url).includes("textsearch")) return { json: async () => ({ status: "OK", results: resultados }) };
    if (String(url).includes("place/details")) return { json: async () => ({ result: {} }) };
    return { ok: false, json: async () => ({}) };
  }));
}
const contexto = { lat: 42.5987, lon: -5.5671, radio: 15, priceLevelObjetivo: 1, nombreZona: "León", mapsKey: "x", limite: Date.now() + 20000 };
afterEach(() => vi.unstubAllGlobals());

describe("mismoSitioNatural", () => {
  it("coincide en el nombre propio", () => {
    expect(mismoSitioNatural("Paseo por el Parque de Quevedo", "Parque de Quevedo")).toBe(true);
    expect(mismoSitioNatural("Ruta de las Hoces de Vegacervera", "Hoces de Vegacervera")).toBe(true);
  });
  it("«parque» o «ruta» solos no bastan", () => {
    expect(mismoSitioNatural("Parque de Quevedo", "Parque de la Granja")).toBe(false);
    expect(mismoSitioNatural("Ruta del Esla", "Ruta del Bernesga")).toBe(false);
  });
});

describe("rutas y parques que propone la IA", () => {
  it("sale con los datos de Google si existe", async () => {
    simularGoogle([ficha("Parque de Quevedo")]);
    const { parada } = await enriquecerParada({ titulo: "Paseo por el Parque de Quevedo", tipo: "parque", lat: 42.59, lon: -5.58 }, contexto);
    expect(parada.lat).toBe(42.6);
  });
  it("se descarta si Google no la conoce, en vez de ponerle otro sitio o un punto inventado", async () => {
    simularGoogle([ficha("Restaurante La Toscana")]);
    const con = await enriquecerParada({ titulo: "Área Recreativa de Valinventada", tipo: "parque", lat: 42.6, lon: -5.56 }, contexto);
    expect(con.parada).toBe(null);
    simularGoogle([]);
    const sin = await enriquecerParada({ titulo: "Ruta de Valinventada", tipo: "ruta", lat: 42.6, lon: -5.56 }, contexto);
    expect(sin.parada).toBe(null);
  });
  it("una ruta de la agenda, con su fuente, se queda aunque Google no la conozca", async () => {
    simularGoogle([]);
    const { parada } = await enriquecerParada({ titulo: "Ruta guiada de los Filandones", tipo: "ruta", fuente: "https://aytoleon.es/ruta", lat: 42.6, lon: -5.56 }, contexto);
    expect(parada.titulo).toBe("Ruta guiada de los Filandones");
  });
});

describe("rutas y parques: lo que dijo la revisión", () => {
  const conFuentes = { ...contexto, fuentes: new Set(["https://aytoleon.es/ruta"]) };
  it("un enlace que escribe la IA no basta si no está en la agenda", async () => {
    simularGoogle([]);
    const inventada = await enriquecerParada({ titulo: "Ruta de Valinventada", tipo: "ruta", fuente: "https://turismoleon.org/rutas", lat: 42.6, lon: -5.56 }, conFuentes);
    expect(inventada.parada).toBe(null);
    const deAgenda = await enriquecerParada({ titulo: "Ruta de los Filandones", tipo: "ruta", fuente: "https://aytoleon.es/ruta", lat: 42.6, lon: -5.56 }, conFuentes);
    expect(deAgenda.parada.titulo).toBe("Ruta de los Filandones");
  });
  it("si Google falla no se descarta: no sabemos si existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("textsearch")) return { json: async () => ({ status: "OVER_QUERY_LIMIT", results: [] }) };
      return { ok: false, json: async () => ({}) };
    }));
    const { parada } = await enriquecerParada({ titulo: "Paseo por el Parque de Quevedo", tipo: "parque", lat: 42.6, lon: -5.58 }, contexto);
    expect(parada.titulo).toBe("Paseo por el Parque de Quevedo");
  });
  it("una ruta no se queda con los datos de un bar del pueblo", async () => {
    simularGoogle([{ ...ficha("Bar Boñar"), types: ["bar", "food"] }]);
    const { parada } = await enriquecerParada({ titulo: "Ruta por Boñar", tipo: "ruta", lat: 42.6, lon: -5.56 }, contexto);
    expect(parada).toBe(null);
  });
});

describe("eventos de deporte de la agenda", () => {
  it("una marcha no toma los datos de un pub que sale en la búsqueda", async () => {
    simularGoogle([{ ...ficha("Pub Luna 9"), types: ["bar", "night_club"] }, ficha("Centro Comercial Espacio León")]);
    const { parada } = await enriquecerParada({ titulo: "Marcha de la Amistad", tipo: "deporte", fuente: "https://aytoleon.es/marcha", lat: 42.39, lon: -5.76 }, { ...contexto, radio: 60 });
    expect(parada.titulo).toBe("Marcha de la Amistad");
    expect(parada.nombreGoogle).toBeUndefined();
    expect(parada.lat).toBe(42.39);
  });
});

describe("nombres de locales", () => {
  const local = (name) => ({ ...ficha(name), types: ["restaurant", "food"] });
  it("si solo se parecen en una palabra, manda el nombre de Google", async () => {
    simularGoogle([local("La Casona de Babia")]);
    const { parada } = await enriquecerParada({ titulo: "Restaurante La Casona de Ciñera", descripcion: "Comida casera.", tipo: "restaurante" }, contexto);
    expect(parada.titulo).toBe("La Casona de Babia");
  });
  it("si es el mismo nombre con más detalle, se respeta el título", async () => {
    simularGoogle([local("Restaurante Castrillo")]);
    const { parada } = await enriquecerParada({ titulo: "Cocido Maragato en Restaurante Castrillo", tipo: "restaurante" }, contexto);
    expect(parada.titulo).toBe("Cocido Maragato en Restaurante Castrillo");
  });
  it("al cambiar un local inventado se conserva la alternativa por si cambia el tiempo", async () => {
    simularGoogle([local("Restaurante La Toscana")]);
    const { parada } = await enriquecerParada({ titulo: "Mesón Inventado", descripcion: "Famoso. (Alternativa por si cambia el tiempo: Museo de León)", tipo: "restaurante" }, contexto);
    expect(parada.descripcion).toContain("(Alternativa por si cambia el tiempo: Museo de León)");
    expect(parada.descripcion).not.toContain("Famoso");
  });
});

describe("sitios para comer", () => {
  it("un restaurante no acaba en un paraje que se llama igual que el pueblo", async () => {
    simularGoogle([ficha("Hoces de Vegacervera"), { ...ficha("Mesón Vegacervera"), types: ["restaurant", "food"], geometry: { location: { lat: 42.61, lng: -5.57 } } }]);
    const { parada } = await enriquecerParada({ titulo: "Comida en Restaurante en Vegacervera", tipo: "restaurante" }, contexto);
    expect(parada.nombreGoogle).toBe("Mesón Vegacervera");
  });
  it("si solo aparece el paraje, la parada se descarta", async () => {
    simularGoogle([ficha("Hoces de Vegacervera")]);
    const { parada } = await enriquecerParada({ titulo: "Restaurante en Vegacervera", tipo: "restaurante" }, contexto);
    expect(parada).toBe(null);
  });
});

describe("votos al cambiar una parada", () => {
  const crudo = ["0|ana-12345", "1", "1|ana-12345", "-1", "1|luis-12345", "1", "10|ana-12345", "1"];
  it("borra solo los de esa parada, no los de la 10 al cambiar la 1", () => {
    expect(camposDeParada(crudo, 1)).toEqual(["1|ana-12345", "1|luis-12345"]);
  });
  it("sin esos votos la parada queda a cero y las demás igual", () => {
    const quitar = new Set(camposDeParada(crudo, 1));
    const quedan = [];
    for (let i = 0; i < crudo.length; i += 2) if (!quitar.has(crudo[i])) quedan.push(crudo[i], crudo[i + 1]);
    const r = resumirVotos(quedan, 11, "ana-12345");
    expect(r.porParada[1]).toEqual({ arriba: 0, abajo: 0 });
    expect(r.porParada[0]).toEqual({ arriba: 1, abajo: 0 });
  });
});
