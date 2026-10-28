import { describe, it, expect } from "vitest";
import { direccionEnLeon, enProvinciaLeon, sitioFueraEnTexto, esSitioDeFuera } from "../src/lib/provincia";
import { fueraDeLeon } from "../src/lib/montarPlan";
import { leerPeticionDespensa } from "../src/lib/despensaBuscar";
import { validarEventoIA } from "../src/lib/eventos";

describe("solo provincia de León", () => {
  it("acepta la capital y pueblos del borde", () => {
    for (const [lat, lon] of [[42.5987, -5.5671], [42.546, -6.598], [42.94, -6.32], [43.15, -4.918], [42.2, -5.82], [42.294, -5.517], [42.371, -5.03]]) {
      expect(enProvinciaLeon(lat, lon)).toBe(true);
    }
  });
  it("rechaza Zamora, Benavente, Asturias, Palencia y Galicia", () => {
    for (const [lat, lon] of [[41.5, -5.75], [42.003, -5.678], [43.16, -5.83], [42.79, -4.84], [42.415, -6.98], [42.054, -6.635]]) {
      expect(enProvinciaLeon(lat, lon)).toBe(false);
    }
  });
  it("detecta sitios de fuera en el texto sin pillar falsos", () => {
    expect(sitioFueraEnTexto("un plan en Zamora")).toBe("Zamora");
    expect(sitioFueraEnTexto("escapada a Oviedo y cenar")).toBe("Oviedo");
    expect(sitioFueraEnTexto("una paella en Valencia")).toBe("Valencia");
    expect(sitioFueraEnTexto("comer en Valencia de Don Juan")).toBeNull();
    expect(sitioFueraEnTexto("ver el partido del Real Madrid")).toBeNull();
    expect(sitioFueraEnTexto("sidra como en Asturias")).toBeNull();
    expect(sitioFueraEnTexto("cena por la cuenca minera")).toBeNull();
    expect(sitioFueraEnTexto("plan en Astorga")).toBeNull();
  });
  it("el plan se para antes de la IA si es de fuera", () => {
    expect(fueraDeLeon({ lat: 41.5, lon: -5.75, texto: "comer" })).toMatch(/provincia/);
    expect(fueraDeLeon({ lat: 42.5987, lon: -5.5671, texto: "comer en Zamora" })).toMatch(/Zamora/);
    expect(fueraDeLeon({ lat: 42.5987, lon: -5.5671, texto: "comer y luego fiesta" })).toBeNull();
  });
  it("la Despensa tampoco busca fuera", () => {
    expect(leerPeticionDespensa({ texto: "chorizo", lat: 41.5, lon: -5.75 }).error).toMatch(/León/);
    expect(leerPeticionDespensa({ texto: "chorizo en Benavente", lat: 42.6, lon: -5.57 }).error).toMatch(/Benavente/);
    expect(leerPeticionDespensa({ texto: "chorizo", lat: 42.6, lon: -5.57 }).error).toBeUndefined();
  });
  it("los barridos tiran los eventos de otra provincia", () => {
    const base = { titulo: "Concierto", fecha: "2026-11-01", fuente: "https://ejemplo.es/a" };
    expect(validarEventoIA({ ...base, lat: 42.003, lon: -5.678 }, "2026-11-01", "2026-11-05")).toBeNull();
    expect(validarEventoIA({ ...base, localidad: "Benavente" }, "2026-11-01", "2026-11-05")).toBeNull();
    expect(validarEventoIA({ ...base, localidad: "Astorga" }, "2026-11-01", "2026-11-05")).not.toBeNull();
    expect(esSitioDeFuera("Valencia de Don Juan")).toBe(false);
  });
  it("un sitio de Google solo vale si su dirección es de León", () => {
    expect(direccionEnLeon("Calle Ancha, 5, 24003 León")).toBe(true);
    expect(direccionEnLeon("Plaza Mayor, 1, 49600 Benavente, Zamora")).toBe(false);
    expect(direccionEnLeon("Calle Uría, 33003 Oviedo, Asturias")).toBe(false);
    expect(direccionEnLeon("Plaza Mayor, León")).toBe(true);
  });
});
