// npm test — Los techos de planes al día solo cuentan los planes que usan la IA (el 24-11 llegó a 43 con 0,07 € gastados)
import { beforeEach, describe, expect, it, vi } from "vitest";

const montarPlan = vi.fn();
vi.mock("../src/lib/montarPlan", () => ({ montarPlan: (...a) => montarPlan(...a) }));
vi.mock("../src/lib/eventos", () => ({ asegurarBarridoReciente: async () => null }));
vi.mock("../src/lib/topeGasto", () => ({ dentroDelGastoDelDia: async () => true }));
vi.mock("next/server", async (original) => ({ ...(await original()), after: () => {} }));

const PEDIDO = { fecha: "2026-11-28", apetece: "tapas", presupuestoMin: 10, presupuestoMax: 40, radio: 3, lat: 42.5987, lon: -5.5671 };
const pedir = (ruta, extra = {}) => ruta.POST(new Request("http://x/api/plan", { method: "POST", headers: { "x-forwarded-for": "10.0.0.1" }, body: JSON.stringify({ ...PEDIDO, ...extra }) }));
const PLAN = { exito: true, plan: [{ titulo: "Bar", lat: 42.598, lon: -5.567, tipo: "bar" }], prevision: null, masEseDia: [], nombreZona: "León" };

describe("tope diario de planes", () => {
  let ruta, almacen, freno;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.__cazurroMem?.kv.clear(); globalThis.__cazurroMem?.caduca.clear();
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("PLANES_MAX_DIA", "2"); vi.stubEnv("PLANES_MAX_IP_DIA", "6");
    montarPlan.mockReset();
    ruta = await import("../src/app/api/plan/route");
    almacen = await import("../src/lib/almacen");
    freno = await import("../src/lib/freno");
  });
  const cuenta = async () => Number(await almacen.comando(["GET", freno.claveTopeDiario("plan")])) || 0;

  it("un plan que sale sin IA no gasta el cupo del día", async () => {
    montarPlan.mockResolvedValue({ ...PLAN, sinIA: true });
    for (let i = 0; i < 3; i++) await pedir(ruta, { apetece: `tapas ${i}` });
    expect(await cuenta()).toBe(0);
    // y el siguiente, si la IA vuelve, sale con IA
    montarPlan.mockImplementation(async (_p, op) => (op.sinIA ? { ...PLAN, sinIA: true } : PLAN));
    await pedir(ruta, { apetece: "vinos" });
    expect(montarPlan.mock.calls.at(-1)[1].sinIA).toBe(false);
    expect(await cuenta()).toBe(1);
  });

  it("los planes con IA sí cuentan y, pasado el tope, el siguiente sale sin IA", async () => {
    montarPlan.mockImplementation(async (_p, op) => (op.sinIA ? { ...PLAN, sinIA: true } : PLAN));
    for (let i = 0; i < 3; i++) await pedir(ruta, { apetece: `cañas ${i}` });
    expect(montarPlan.mock.calls.map((c) => c[1].sinIA)).toEqual([false, false, true]);
    expect(await cuenta()).toBe(2); // el tercero no se queda contado
  });
});
