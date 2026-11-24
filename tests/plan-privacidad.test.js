// npm test — Privacidad de los planes guardados: sin la posición exacta y sin que otro reescriba tu plan a ciegas
import { beforeEach, describe, expect, it, vi } from "vitest";

const montarPlan = vi.fn();
vi.mock("../src/lib/montarPlan", async (original) => ({ ...(await original()), montarPlan: (...a) => montarPlan(...a), planesConGoogle: () => false }));
vi.mock("../src/lib/eventos", () => ({ asegurarBarridoReciente: async () => null }));
vi.mock("../src/lib/topeGasto", () => ({ dentroDelGastoDelDia: async () => true }));
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: async () => ({ texto: JSON.stringify({ hora: "21:00", titulo: "Bar Nuevo", descripcion: "x", precio: "8€", lat: 42.598, lon: -5.567, tipo: "bar" }) }),
}));
vi.mock("../src/lib/planUtils", async (original) => ({
  ...(await original()),
  obtenerLocalidad: async () => "León",
  enriquecerParada: async (p) => ({ parada: { ...p } }),
}));
vi.mock("../src/lib/lugares", async (original) => ({ ...(await original()), sitiosComprobados: async () => [] }));
vi.mock("next/server", async (original) => ({ ...(await original()), after: () => {} }));

const PEDIDO = { fecha: "2026-11-28", apetece: "tapas", presupuestoMin: 10, presupuestoMax: 40, radio: 3, lat: 42.598712, lon: -5.567134 };
const post = (ruta, url, cuerpo) => ruta.POST(new Request(url, { method: "POST", body: JSON.stringify(cuerpo) }));

describe("planes guardados", () => {
  let almacen;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.__cazurroMem?.kv.clear(); globalThis.__cazurroMem?.caduca.clear();
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    almacen = await import("../src/lib/almacen");
  });

  it("guardan la zona redondeada a ~100 m, no la posición exacta de «Usar mi ubicación»", async () => {
    montarPlan.mockResolvedValue({ exito: true, plan: [{ titulo: "Bar", lat: 42.598, lon: -5.567, tipo: "bar" }], prevision: null, masEseDia: [], nombreZona: "León" });
    const ruta = await import("../src/app/api/plan/route");
    const r = await (await post(ruta, "http://x/api/plan", PEDIDO)).json();
    const guardado = await almacen.leerJSON(`plan:${r.planId}`);
    expect(guardado.centro).toEqual([42.599, -5.567]);
  });

  it("un retoque solo cambia el plan guardado si la parada que se cambia es la que hay en él", async () => {
    await almacen.guardarJSON("plan:abcdef1234", { id: "abcdef1234", itinerario: [{ titulo: "Bar Viejo", hora: "21:00", tipo: "bar" }] }, 3600);
    const ruta = await import("../src/app/api/retocar/route");
    const cuerpo = (titulo) => ({ ...PEDIDO, planId: "abcdef1234", indice: 0, instruccion: "otro bar", itinerarioActual: [{ titulo, hora: "21:00", tipo: "bar" }] });

    expect((await (await post(ruta, "http://x/api/retocar", cuerpo("Otro sitio inventado"))).json()).exito).toBe(true);
    expect((await almacen.leerJSON("plan:abcdef1234")).itinerario[0].titulo).toBe("Bar Viejo"); // no coincide: no se toca

    expect((await (await post(ruta, "http://x/api/retocar", cuerpo("Bar Viejo"))).json()).exito).toBe(true);
    expect((await almacen.leerJSON("plan:abcdef1234")).itinerario[0].titulo).toBe("Bar Nuevo");
  });
});
