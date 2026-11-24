// npm test — El comprobador de las reglas de PLANES.md: si falla aquí, npm run evals mediría mal
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGLAS, abiertoA, comprobar, costeEuros, minutos, resolverFecha } from "../evals/reglas";

const { casos } = JSON.parse(readFileSync(new URL("../evals/casos.json", import.meta.url), "utf8"));
const HORARIO = "lunes: Cerrado | martes: 12:00–16:00, 20:00–0:30 | miércoles: 12:00–16:00 | jueves: 12:00–16:00 | viernes: 12:00–2:00 | sábado: Abierto 24 horas | domingo: 9:00–14:00";
const caso = { id: "x", espera: { tipos: ["bar", "restaurante"], min: 2 } };
const peticion = { fecha: "2026-12-01", presupuestoMax: 40 }; // martes
const bar = (extra = {}) => ({ titulo: "Bar El Gallo", tipo: "bar", hora: "20:30", lat: 42.5975, lon: -5.5685, placeId: "a", direccion: "Calle Ancha 1", precio: "3€", horario: HORARIO, ...extra });
const cena = (extra = {}) => ({ titulo: "Restaurante El Roble", tipo: "restaurante", hora: "21:30", lat: 42.599, lon: -5.567, placeId: "b", direccion: "Plaza Mayor 2", precio: "20€", horario: HORARIO, ...extra });
const mirar = (plan, extra = {}) => comprobar({ caso: extra.caso || caso, peticion: extra.peticion || peticion, respuesta: { exito: true, plan, ...(extra.respuesta || {}) }, segundos: extra.segundos ?? 3 });
const fallan = (r) => REGLAS.filter((k) => !r[k].ok);

describe("los 20 casos", () => {
  it("son 20, con id único, petición completa y fecha que se entiende", () => {
    expect(casos).toHaveLength(20);
    expect(new Set(casos.map((c) => c.id)).size).toBe(20);
    for (const c of casos) {
      expect(c.peticion).toEqual(expect.objectContaining({ apetece: expect.any(String), lat: expect.any(Number), lon: expect.any(Number), presupuestoMax: expect.any(Number) }));
      expect(resolverFecha(c.peticion.fecha, new Date("2026-11-24T10:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("fechas relativas", () => {
  const martes = new Date("2026-11-24T10:00:00Z");
  it("el próximo sábado, nunca hoy; mañana y hoy en hora de Madrid", () => {
    expect(resolverFecha("sabado", martes)).toBe("2026-11-28");
    expect(resolverFecha("martes", martes)).toBe("2026-12-01");
    expect(resolverFecha("hoy", new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-25");
    expect(resolverFecha("manana", martes)).toBe("2026-11-25");
  });
  it("San Froilán: el 5 de octubre que viene", () => {
    expect(resolverFecha("proximo:10-05", martes)).toBe("2027-10-05");
    expect(resolverFecha("proximo:10-05", new Date("2027-09-01T10:00:00Z"))).toBe("2027-10-05");
  });
});

describe("horario de Google", () => {
  it("abierto, cerrado, 24 horas y pasada la medianoche", () => {
    expect(abiertoA(HORARIO, "2026-12-01", "13:00")).toBe(true); // martes
    expect(abiertoA(HORARIO, "2026-12-01", "17:00")).toBe(false);
    expect(abiertoA(HORARIO, "2026-12-01", "23:45")).toBe(true);
    expect(abiertoA(HORARIO, "2026-12-02", "00:15")).toBe(true); // la noche del martes
    expect(abiertoA(HORARIO, "2026-11-30", "13:00")).toBe(false); // lunes cerrado
    expect(abiertoA(HORARIO, "2026-12-05", "04:00")).toBe(true); // sábado 24 h
    expect(abiertoA("", "2026-12-01", "13:00")).toBe(null);
    expect(minutos("Todo el día")).toBe(null);
  });
});

describe("las reglas", () => {
  it("un plan bueno las cumple todas", () => {
    expect(fallan(mirar([bar(), cena()]))).toEqual([]);
  });
  it("cada fallo cae en su regla", () => {
    expect(fallan(mirar([bar({ placeId: null }), cena()]))).toEqual(["real"]);
    expect(fallan(mirar([bar({ lat: 43.53, lon: -5.66 }), cena()]))).toContain("leon"); // Gijón
    expect(fallan(mirar([bar(), cena({ placeId: "a" })]))).toContain("sin-repetir");
    expect(fallan(mirar([bar({ hora: "Todo el día" }), cena()]))).toContain("hora");
    expect(fallan(mirar([bar({ direccion: null }), cena()]))).toEqual(["donde"]);
    expect(fallan(mirar([bar({ precio: "" }), cena()]))).toEqual(["precio"]);
    expect(fallan(mirar([bar({ hora: "17:00" }), cena()]))).toEqual(["abierto"]);
    expect(fallan(mirar([bar(), cena({ precio: "40-50€" })]))).toEqual(["presupuesto"]);
    expect(fallan(mirar([bar(), cena({ lat: 42.61 })]))).toEqual(["andando"]);
    expect(fallan(mirar([bar(), cena({ tipo: "museo" })]))).toEqual(["lo-pedido"]);
    expect(fallan(mirar([bar(), cena()], { segundos: 7.5 }))).toEqual(["rapido"]);
  });
  it("menos de lo pedido vale solo con aviso; vacío solo si el caso lo admite", () => {
    expect(fallan(mirar([bar()]))).toEqual(["lo-pedido"]);
    expect(fallan(mirar([bar()], { respuesta: { aviso: "No hemos encontrado restaurante." } }))).toEqual([]);
    const vacio = (vacioVale) => comprobar({ caso: { espera: { tipos: ["deporte"], vacioVale } }, peticion, respuesta: { exito: false, mensaje: "No hay partidos ese día" }, segundos: 2 });
    expect(fallan(vacio(true))).toEqual([]);
    expect(fallan(vacio(false))).toEqual(["lo-pedido"]);
  });
  it("fuera de León tiene que negarse", () => {
    const r = (respuesta) => comprobar({ caso: { espera: { fuera: true } }, peticion, respuesta, segundos: 1 });
    expect(r({ exito: false, mensaje: "Solo hacemos planes en León" })["lo-pedido"].ok).toBe(true);
    expect(r({ exito: true, plan: [bar()] })["lo-pedido"].ok).toBe(false);
  });
  it("zona libre: se salta los 15 min andando; «desde» no deja nada antes de esa hora", () => {
    expect(mirar([bar(), cena({ lat: 42.7 })], { caso: { ...caso, zonaLibre: true } }).andando.ok).toBe(true);
    expect(mirar([bar(), cena()], { caso: { espera: { ...caso.espera, desde: "21:00" } } })["lo-pedido"].motivo).toMatch(/antes de las 21:00/);
    expect(mirar([bar({ hora: "23:30" }), cena({ hora: "00:15" })], { caso: { espera: { ...caso.espera, desde: "23:00" } } })["lo-pedido"].ok).toBe(true);
  });
  it("el coste suma IA y las llamadas a Google que no salieron de la caché", () => {
    const c = costeEuros({ uso: { dolares: 0.01 }, google: { busquedas: 3, fichas: 2, geocoding: 1 } });
    expect(c.ia).toBeCloseTo(0.009);
    expect(c.maps).toBeCloseTo((3 * 0.032 + 2 * 0.02 + 0.005) * 0.9);
  });
});
