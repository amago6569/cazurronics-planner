// npm test — Si Google se queda sin saldo (402) a mitad de un plan, el plan sale igual, sin IA. Nunca «recargando».
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/gemini", async (original) => {
  const real = await original();
  return { ...real, llamarGemini: vi.fn(async () => { const e = new real.ErrorIA("Gemini 402", 402); e.fallos = ["gemini-2.5-flash: 402 Your prepayment credits are depleted"]; throw e; }) };
});
vi.mock("../src/lib/planUtils", async (original) => ({
  ...(await original()),
  obtenerLocalidad: vi.fn(async () => "León"),
  obtenerPrevisionTiempo: vi.fn(async () => null),
  enriquecerParada: vi.fn(async (p) => ({ parada: { ...p, lat: p.lat ?? 42.5987, lon: p.lon ?? -5.5671, placeId: p.titulo } })),
}));
vi.mock("../src/lib/eventos", async (original) => ({
  ...(await original()),
  eventosDelDia: vi.fn(async () => [{ titulo: "Concierto de prueba", categoria: "concierto", hora: "21:30", lugar: "Sala X", fuente: "https://ejemplo.es/c", fecha: "2026-12-05", lat: 42.598, lon: -5.567 }]),
  barridoAMedida: vi.fn(async () => []),
}));
vi.mock("../src/lib/lugares", async (original) => ({
  ...(await original()),
  preferenciasComunidad: vi.fn(async () => null),
  sitiosComprobados: vi.fn(async () => [{ n: "Restaurante El Roble", t: "restaurante", la: 42.599, lo: -5.567, p: "20€", v: 8, g: 1 }]),
}));

describe("plan con la IA sin saldo", () => {
  it("sale sin IA, con lo pedido y sin mensaje de recarga", async () => {
    const { montarPlan } = await import("../src/lib/montarPlan");
    const r = await montarPlan({ fecha: "2026-12-05", apetece: "cenar y un concierto", presupuestoMin: 0, presupuestoMax: 60, radio: 3, lat: 42.5987, lon: -5.5671 }, { inicio: Date.now() });
    expect(r.exito).toBe(true);
    expect(r.sinIA).toBe(true);
    expect(r.plan.map((p) => p.titulo)).toEqual(["Restaurante El Roble", "Concierto de prueba"]);
    expect(JSON.stringify(r)).not.toMatch(/recargando/i);
  });
  it("con el tope del día ya pasado ni se intenta la IA", async () => {
    const { llamarGemini } = await import("../src/lib/gemini");
    llamarGemini.mockClear();
    const { montarPlan } = await import("../src/lib/montarPlan");
    const r = await montarPlan({ fecha: "2026-12-05", apetece: "cenar", presupuestoMin: 0, presupuestoMax: 60, radio: 3, lat: 42.5987, lon: -5.5671 }, { inicio: Date.now(), sinIA: true });
    expect(r.exito).toBe(true);
    expect(llamarGemini).not.toHaveBeenCalled();
  });
});
