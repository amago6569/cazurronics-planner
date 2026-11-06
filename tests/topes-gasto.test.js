// npm test — Los techos de gasto: sin contador no se gasta, y la clave de Maps nunca llega al navegador
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/almacen", () => ({
  comando: vi.fn(async () => { throw new Error("almacén caído"); }),
  varios: vi.fn(async () => { throw new Error("almacén caído"); }),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("tope diario con el almacén caído", () => {
  it("por defecto deja pasar y, si es un techo de gasto, no", async () => {
    const { dentroDelTopeDiario } = await import("../src/lib/freno");
    expect(await dentroDelTopeDiario("prueba", 5)).toBe(true);
    expect(await dentroDelTopeDiario("prueba", 5, null, false)).toBe(false);
  });
});

describe("clave de Street View", () => {
  it("sin clave propia no hay vista 360º, aunque exista la de Maps", async () => {
    vi.stubEnv("STREET_VIEW_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "clave-maps");
    const espia = vi.fn();
    vi.stubGlobal("fetch", espia);
    const { obtenerStreetView } = await import("../src/lib/planUtils");
    expect(await obtenerStreetView(42.6, -5.57, Date.now() + 5000)).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it("consulta y vista usan solo la clave propia, nunca la de Maps", async () => {
    vi.stubEnv("STREET_VIEW_API_KEY", "clave-navegador");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "clave-maps");
    const espia = vi.fn(async () => ({ json: async () => ({ status: "OK" }) }));
    vi.stubGlobal("fetch", espia);
    const { obtenerStreetView } = await import("../src/lib/planUtils");
    const url = await obtenerStreetView(42.6, -5.57, Date.now() + 5000);
    expect(url).toContain("key=clave-navegador");
    expect(url).not.toContain("clave-maps");
    expect(espia.mock.calls[0][0]).toContain("key=clave-navegador");
    expect(espia.mock.calls[0][0]).not.toContain("clave-maps");
  });
});
