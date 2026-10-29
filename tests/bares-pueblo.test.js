// npm test — Bares de pueblo: si la IA se inventa el nombre, manda la ficha de Google
import { afterEach, describe, expect, it, vi } from "vitest";
import { descripcionReal, enriquecerParada } from "../src/lib/planUtils";

const BONAR = { lat: 42.8667, lon: -5.3237 };
const ficha = (name, extra = {}) => ({
  name, place_id: `id_${name.length}`, rating: 4.4, user_ratings_total: 212, price_level: 1,
  types: ["restaurant", "food", "point_of_interest"], formatted_address: "C. Pío Gullón, 2, 24850 Boñar, León, España",
  geometry: { location: { lat: 42.867, lng: -5.324 } }, ...extra,
});

function simularGoogle(resultados) {
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("textsearch")) return { json: async () => ({ status: "OK", results: resultados }) };
    if (u.includes("place/details")) return { json: async () => ({ result: { formatted_phone_number: "987 73 50 00" } }) };
    return { ok: false, json: async () => ({}) };
  }));
}
const contexto = { ...BONAR, radio: 10, priceLevelObjetivo: 1, nombreZona: "Boñar", mapsKey: "x", limite: Date.now() + 20000 };
afterEach(() => vi.unstubAllGlobals());

describe("bares y restaurantes de pueblo", () => {
  it("si el nombre de la IA no existe, usa el nombre real y no repite lo inventado", async () => {
    simularGoogle([ficha("RESTAURANTE LA TOSCANA")]);
    const { parada } = await enriquecerParada({ titulo: "Mesón El Rincón del Cazador", descripcion: "Famoso por su cecina de chivo casera desde 1950.", tipo: "restaurante", precio: "15€" }, contexto);
    expect(parada.titulo).toBe("Restaurante La Toscana");
    expect(parada.descripcion).not.toMatch(/cecina|1950/);
    expect(parada.descripcion).toContain("Boñar");
    expect(parada.descripcion).toContain("4,4");
    expect(parada.telefono).toBe("987 73 50 00");
  });

  it("si Google tiene el sitio que nombró la IA, se queda con ese aunque otro tenga mejor nota", async () => {
    simularGoogle([ficha("Bar Novo", { rating: 4.9, user_ratings_total: 900 }), ficha("Mesón El Abuelo", { rating: 4.0 })]);
    const { parada } = await enriquecerParada({ titulo: "Mesón El Abuelo", descripcion: "Cocina casera.", tipo: "restaurante" }, contexto);
    expect(parada.titulo).toBe("Mesón El Abuelo");
    expect(parada.nombreGoogle).toBe("Mesón El Abuelo");
    expect(parada.descripcion).toBe("Cocina casera.");
  });

  it("un evento que se celebra en un bar no cambia de nombre", async () => {
    simularGoogle([ficha("Bar La Plaza", { types: ["bar"] })]);
    const { parada } = await enriquecerParada({ titulo: "Concierto de gaitas", descripcion: "Folk leonés.", tipo: "concierto", lugar: "Bar La Plaza" }, contexto);
    expect(parada.titulo).toBe("Concierto de gaitas");
  });

  it("la descripción solo dice lo que sabe Google", () => {
    expect(descripcionReal(ficha("X", { types: ["bar"], price_level: 2 }), "bar", "Boñar"))
      .toBe("Bar de precio medio en Boñar. Tiene un 4,4 en Google con 212 reseñas. Lo hemos elegido por su nota en Google y su cercanía.");
    expect(descripcionReal({ types: [] }, "restaurante", "Riaño")).toBe("Restaurante en Riaño. Lo hemos elegido por su nota en Google y su cercanía.");
  });
});
