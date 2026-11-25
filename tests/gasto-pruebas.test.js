// npm test — Las pruebas de planes (npm run evals) tienen su propio tope y no dejan a la web sin IA
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("presupuesto de las pruebas", () => {
  let almacen, est, tope, pruebas, panel;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.__cazurroMem?.kv.clear(); globalThis.__cazurroMem?.caduca.clear();
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("GASTO_IA_AJUSTE", "1"); vi.stubEnv("GASTO_IA_MAX_DIA", "0.40"); vi.stubEnv("GASTO_PRUEBAS_MAX_DIA", "1");
    almacen = await import("../src/lib/almacen");
    est = await import("../src/lib/estadisticas");
    tope = await import("../src/lib/topeGasto");
    pruebas = await import("../src/lib/modoPruebas");
    panel = await import("../src/lib/gastoPanel");
  });

  it("lo que gastan las pruebas va a su contador, no al de la web", async () => {
    await pruebas.conPresupuestoDePruebas(() => est.registrarGastoIA("planes", { modelo: "gemini-2.5-flash", dolares: 0.3 }, { prueba: pruebas.esGastoDePruebas() }));
    expect(Number(await almacen.comando(["GET", pruebas.claveGastoPruebas(est.hoyEnLeon())]))).toBe(300000);
    expect(await almacen.comando(["GET", `ia:dia:${est.hoyEnLeon()}`])).toBeNull();
    const [llamada] = (await almacen.comando(["LRANGE", est.CLAVE_LLAMADAS_IA, 0, 0])).map(JSON.parse);
    expect(llamada).toMatchObject({ f: "pruebas", k: "pruebas-planes" });
  });

  it("con la web en su tope, las pruebas siguen; y con las pruebas en el suyo, la web sigue", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z")); // martes: tope normal de 0,40 € (miércoles y domingos sube)
    await almacen.comando(["SET", `ia:dia:${est.hoyEnLeon()}`, String(Math.round((0.45 / 0.9) * 1e6))]); // web: 0,45 €
    expect(await tope.dentroDelGastoDelDia("usuario")).toBe(false);
    expect(await pruebas.conPresupuestoDePruebas(() => tope.dentroDelGastoDelDia("usuario"))).toBe(true);
    await almacen.comando(["SET", pruebas.claveGastoPruebas(est.hoyEnLeon()), String(Math.round((1.05 / 0.9) * 1e6))]); // pruebas: 1,05 €
    expect(await pruebas.conPresupuestoDePruebas(() => tope.dentroDelGastoDelDia("usuario"))).toBe(false);
    await almacen.comando(["DEL", `ia:dia:${est.hoyEnLeon()}`]);
    tope = await import("../src/lib/topeGasto"); almacen.olvidar("tope-gasto");
    expect(await tope.dentroDelGastoDelDia("usuario")).toBe(true);
    vi.useRealTimers();
  });

  it("el saldo del panel descuenta también lo de las pruebas (sale del mismo saldo de AI Studio)", async () => {
    await panel.apuntarRecarga(20, Date.now() - 864e5);
    await almacen.comando(["SET", `ia:dia:${est.hoyEnLeon()}`, String(1_000_000)]);
    await almacen.comando(["SET", pruebas.claveGastoPruebas(est.hoyEnLeon()), String(1_000_000)]);
    const d = await panel.leerPanelGasto();
    expect(d.saldo.euros).toBeCloseTo(20 - 2 * 0.9, 2);
    expect(d.gasto.pruebasHoy).toBeCloseTo(0.9, 2);
  });
});
