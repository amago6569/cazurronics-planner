// npm test — Eventos de fuera de León y el aviso de "lo más cercano"
import { describe, expect, it } from "vitest";
import { eventoDeFuera } from "../src/lib/provincia";
import { avisoCercano } from "../src/lib/montarPlan";

describe("eventoDeFuera", () => {
  it("aparta León de México y lo que el enlace sitúa fuera", () => {
    expect(eventoDeFuera({ titulo: "Festival del Globo 2026", fuente: "https://www.eticket.mx/eventos/leon" })).toBe(true);
    expect(eventoDeFuera({ titulo: "Calle 24", fuente: "https://www.elsoldemexico.com.mx/gto/cartelera-leon" })).toBe(true);
    expect(eventoDeFuera({ titulo: "IV 10K Ciudad de Mérida", fuente: "https://www.deporticket.com/eventos/iv-10k-ciudad-de-merida" })).toBe(true);
    expect(eventoDeFuera({ titulo: "San Martín", fuente: "https://www.defiestas.com/fiesta/san-martin-2026-la-zarza-valladolid/" })).toBe(true);
  });
  it("deja lo de León, aunque nombre otro país o ciudad", () => {
    expect(eventoDeFuera({ titulo: "La guitarra en el Perú del S. XVIII y XIX", fuente: "https://www.teatrobergidum.es/programacion/" })).toBe(false);
    expect(eventoDeFuera({ titulo: "Cultural Leonesa vs Real Madrid Castilla", fuente: "https://www.culturalleonesa.com/partido" })).toBe(false);
    expect(eventoDeFuera({ titulo: "VIII Cross Popular de Sariegos", localidad: "Sariegos", fuente: "https://www.deportistas.es/eventos/listado" })).toBe(false);
    expect(eventoDeFuera({ titulo: "Sin enlace" })).toBe(false);
  });
});

describe("avisoCercano", () => {
  const base = { apetece: "un trail", radio: 15, lat: 42.5987, lon: -5.5671 };
  it("dice a cuántos km está lo más cercano", () => {
    expect(avisoCercano({ ...base, plan: [{ lat: 42.9, lon: -5.54 }] })).toBe("En 15 km a la redonda no hay nada de «un trail». Lo más cercano es esto, a 34 km.");
  });
  it("dice claro cuando es solo lo más parecido", () => {
    expect(avisoCercano({ ...base, apetece: "clases de kintsugi", plan: [{ lat: 42.6, lon: -5.56, parecido: true }] })).toBe("No hemos encontrado «clases de kintsugi». Lo más parecido que hay es esto.");
  });
  it("si está dentro de la zona no habla de distancia", () => {
    expect(avisoCercano({ ...base, plan: [{ lat: 42.6, lon: -5.56 }] })).toBe("Ese día no hay «un trail» tal cual en tu zona. Lo más cercano es esto.");
  });
});
