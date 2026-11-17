// npm test — Sitios cerrados ese día, temporada, eventos ya pasados, búsquedas que se ahorran y Street View bien orientado
import { describe, expect, it, vi, afterEach } from "vitest";
import { abiertoEse, cerradoPorTemporada, minutoDeHora, rumboHacia } from "../src/lib/planUtils";
import { quitarPasados, soloComerYBeber } from "../src/lib/montarPlan";
import { mensajeCupoHora } from "../src/lib/freno";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// Restaurante: de martes a domingo, 13:00–16:00 y 20:30–23:30. Los lunes cierra.
const RESTAURANTE = {
  business_status: "OPERATIONAL",
  opening_hours: { periods: [0, 2, 3, 4, 5, 6].flatMap((day) => [
    { open: { day, time: "1300" }, close: { day, time: "1600" } },
    { open: { day, time: "2030" }, close: { day, time: "2330" } },
  ]) },
};

describe("abierto ese día", () => {
  it("el lunes que cierra, fuera", () => {
    expect(abiertoEse({ fecha: "2026-11-23", minuto: 14 * 60, detalle: RESTAURANTE, hoy: "2026-11-01" })).toBe(false);
  });
  it("martes a la hora de comer, dentro; a las 17:00, fuera", () => {
    expect(abiertoEse({ fecha: "2026-11-24", minuto: 14 * 60, detalle: RESTAURANTE, hoy: "2026-11-01" })).toBe(true);
    expect(abiertoEse({ fecha: "2026-11-24", minuto: 17 * 60, detalle: RESTAURANTE, hoy: "2026-11-01" })).toBe(false);
  });
  it("cerrado temporalmente en Google, fuera aunque tenga horario", () => {
    expect(abiertoEse({ fecha: "2026-11-24", minuto: 14 * 60, detalle: { ...RESTAURANTE, business_status: "CLOSED_TEMPORARILY" }, hoy: "2026-11-01" })).toBe(false);
  });
  it("sin horario no se sabe: el sitio se queda", () => {
    expect(abiertoEse({ fecha: "2026-11-24", minuto: 14 * 60, detalle: { business_status: "OPERATIONAL" } })).toBeNull();
  });
  it("un pub que cierra a las 3:00 vale para las copas de la 1:00", () => {
    const pub = { opening_hours: { periods: [{ open: { day: 6, time: "2200" }, close: { day: 0, time: "0300" } }] } };
    expect(abiertoEse({ fecha: "2026-11-21", minuto: 60, detalle: pub, hoy: "2026-11-01" })).toBe(true);
    expect(abiertoEse({ fecha: "2026-11-21", minuto: 23 * 60 + 30, detalle: pub, hoy: "2026-11-01" })).toBe(true);
  });
  it("esta semana manda el horario con festivos y cierres (current_opening_hours)", () => {
    // Normalmente abre el miércoles, pero esta semana Google dice que el miércoles 18 no abre
    const cerradoEsteMiercoles = { ...RESTAURANTE, current_opening_hours: { periods: [{ open: { day: 4, time: "1300", date: "2026-11-19" }, close: { day: 4, time: "1600", date: "2026-11-19" } }] } };
    expect(abiertoEse({ fecha: "2026-11-18", minuto: 14 * 60, detalle: cerradoEsteMiercoles, hoy: "2026-11-17" })).toBe(false);
    expect(abiertoEse({ fecha: "2026-11-19", minuto: 14 * 60, detalle: cerradoEsteMiercoles, hoy: "2026-11-17" })).toBe(true);
  });
  it("lee la hora de la parada", () => {
    expect(minutoDeHora("13:30")).toBe(13 * 60 + 30);
    expect(minutoDeHora("21h")).toBe(21 * 60);
    expect(minutoDeHora(null)).toBeNull();
  });
});

describe("sitios de temporada", () => {
  it("el chiringuito del Soto de Boñar no sale en noviembre y sí en julio", () => {
    expect(cerradoPorTemporada("Chiringuito del Soto de Boñar", "2026-11-20")).toBe(true);
    expect(cerradoPorTemporada("Chiringuito del Soto de Boñar", "2026-07-20")).toBe(false);
    expect(cerradoPorTemporada("Restaurante La Peña", "2026-11-20")).toBe(false);
  });
});

describe("búsqueda de eventos a medida", () => {
  it("no se hace si solo pide comer o beber", () => {
    expect(soloComerYBeber("comer cocido y luego unas cañas")).toBe(true);
    expect(soloComerYBeber("cenar")).toBe(true);
    expect(soloComerYBeber("comer y luego un concierto")).toBe(false);
    expect(soloComerYBeber("un plan para el sábado")).toBe(false);
    expect(soloComerYBeber("ruta de senderismo")).toBe(false);
  });
});

describe("plan para hoy", () => {
  const ahora = new Date("2026-11-17T18:00:00Z"); // 19:00 en León
  const agenda = [
    { titulo: "Charla", hora: "12:00" },
    { titulo: "Concierto", hora: "21:00" },
    { titulo: "Teatro empezado", hora: "18:30" },
    { titulo: "Exposición", hora: "10:00 - 14:00", permanente: true },
    { titulo: "Mercado", hora: null },
  ];
  it("quita lo que ya pasó y deja lo que viene", () => {
    const quedan = quitarPasados(agenda, "2026-11-17", ahora).map((e) => e.titulo);
    expect(quedan).toEqual(["Concierto", "Teatro empezado", "Mercado"]);
  });
  it("otro día no se toca", () => {
    expect(quitarPasados(agenda, "2026-11-18", ahora)).toHaveLength(5);
  });
});

describe("cupo por hora", () => {
  it("el mensaje dice cuánto falta", () => {
    expect(mensajeCupoHora(3, 25)).toContain("25 minutos");
    expect(mensajeCupoHora(3, 1)).toContain("1 minuto");
  });
});

describe("Street View bien hecho", () => {
  it("usa el panorama exacto de calle y mira hacia el local", async () => {
    vi.stubEnv("STREET_VIEW_API_KEY", "clave-navegador");
    const espia = vi.fn(async () => ({ json: async () => ({ status: "OK", pano_id: "PANO123", location: { lat: 42.5990, lng: -5.5710 } }) }));
    vi.stubGlobal("fetch", espia);
    const { obtenerStreetView } = await import("../src/lib/planUtils");
    const url = await obtenerStreetView(42.5995, -5.5710, Date.now() + 5000);
    expect(espia.mock.calls[0][0]).toContain("source=outdoor");
    expect(url).toContain("pano=PANO123");
    expect(url).toMatch(/heading=(0|360)\b/); // el local está justo al norte
  });
  it("calcula el rumbo", () => {
    expect(Math.round(rumboHacia(42.6, -5.57, 42.6, -5.56))).toBe(90);
  });
});
