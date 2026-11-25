// npm test — Panel de gasto de la IA (/admin/gasto): saldo, cuadre con AI Studio, avisos y que nada salga sin clave
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factorDelCuadre } from "../src/lib/topeGasto";
import { avisosDeGasto, calcularSaldo, contadoDesde, cuadrar, elegirFactor } from "../src/lib/gastoPanel";

const T = (iso) => Date.parse(iso);
const EUR = 0.9; // EUROS_POR_DOLAR
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("factor del contador (lo que cobra Google / lo que cuenta la web)", () => {
  it("vale entre 1 y 2; un dato loco se ignora", () => {
    expect(factorDelCuadre(1.52)).toBe(1.52);
    expect(factorDelCuadre(0.8)).toBe(1); // nunca afloja el tope por debajo de lo contado
    expect(factorDelCuadre(2.6)).toBe(2);
    expect(factorDelCuadre(0.3)).toBeNull();
    expect(factorDelCuadre(5)).toBeNull();
    expect(factorDelCuadre("abc")).toBeNull();
    expect(factorDelCuadre(null)).toBeNull();
  });
  it("Vercel manda; si no, el cuadre; si no, 1,5", () => {
    expect(elegirFactor("1.3", { GASTO_IA_AJUSTE: "" })).toEqual({ factor: 1.3, origen: "cuadre" });
    expect(elegirFactor(null, {})).toEqual({ factor: 1.5, origen: "estimado" });
    vi.stubEnv("GASTO_IA_AJUSTE", "1.7");
    expect(elegirFactor("1.3", { GASTO_IA_AJUSTE: "1.7" })).toEqual({ factor: 1.7, origen: "vercel" });
  });
});

describe("gasto contado desde un momento", () => {
  const porDia = { "2026-11-24": 3_000_000, "2026-11-25": 1_000_000, "2026-11-26": 500_000 };
  it("días enteros después y, del primer día, solo las llamadas desde ese momento", () => {
    const llamadas = [
      { t: T("2026-11-24T11:00:00Z"), u: 2_000_000 }, // antes de la recarga
      { t: T("2026-11-24T13:00:00Z"), u: 1_000_000 },
    ];
    expect(contadoDesde(T("2026-11-24T12:25:00Z"), porDia, llamadas)).toBe(1_000_000 + 1_000_000 + 500_000);
  });
  it("si las llamadas guardadas no llegan tan atrás, cuenta el día entero (mejor pasarse que quedarse corto)", () => {
    const llamadas = [{ t: T("2026-11-26T09:00:00Z"), u: 500_000 }];
    expect(contadoDesde(T("2026-11-24T12:25:00Z"), porDia, llamadas)).toBe(4_500_000);
  });
});

describe("saldo calculado", () => {
  const porDia = { "2026-11-24": 0, "2026-11-25": 1_000_000, "2026-11-26": 1_000_000 };
  it("sin recargas ni cuadre no se inventa un saldo", () => {
    expect(calcularSaldo({ recargas: [], cuadre: null, porDia, llamadas: [], factor: 1.5 })).toBeNull();
  });
  it("recargas menos lo contado × factor", () => {
    const s = calcularSaldo({ recargas: [{ t: T("2026-11-24T12:25:00Z"), euros: 20 }], cuadre: null, porDia, llamadas: [], factor: 1.5 });
    expect(s.recargado).toBe(20);
    expect(s.euros).toBeCloseTo(20 - 2 * EUR * 1.5, 2);
    expect(s.viejo).toBe(false);
  });
  it("con cuadre parte del saldo de AI Studio y suma solo las recargas posteriores", () => {
    const cuadre = { t: T("2026-11-25T00:00:01Z"), saldoAIStudio: 15 };
    const recargas = [{ t: T("2026-11-24T12:25:00Z"), euros: 20 }, { t: T("2026-11-26T10:00:00Z"), euros: 10 }];
    const s = calcularSaldo({ recargas, cuadre, porDia, llamadas: [], factor: 1 });
    expect(s.recargado).toBe(10);
    expect(s.euros).toBeCloseTo(15 + 10 - 2 * EUR, 2); // el día del cuadre cuenta entero: no hay llamadas sueltas que lo partan
  });
  it("avisa si el punto de partida es más viejo que los días guardados", () => {
    const s = calcularSaldo({ recargas: [{ t: T("2026-09-01T10:00:00Z"), euros: 20 }], cuadre: null, porDia, llamadas: [], factor: 1 });
    expect(s.viejo).toBe(true);
  });
});

describe("cuadre con AI Studio", () => {
  const recargas = [{ t: T("2026-11-24T12:25:00Z"), euros: 20 }];
  const porDia = { "2026-11-24": 0, "2026-11-25": 2_000_000, "2026-11-26": 2_000_000 }; // 3,60 € contados
  it("da la desviación y el factor nuevo: Google cobró 5,40 € de 3,60 € contados → × 1,5", () => {
    const c = cuadrar({ saldoAIStudio: 14.6, recargas, cuadreAnterior: null, porDia, llamadas: [], factor: 1, ahora: 1 });
    expect(c.saldoCalculado).toBeCloseTo(16.4, 2);
    expect(c.desviacion).toBeCloseTo((16.4 - 14.6) / 14.6, 3);
    expect(c.factor).toBeCloseTo(1.5, 2);
  });
  it("con menos de 0,50 € contados no toca el factor (sería ruido)", () => {
    const c = cuadrar({ saldoAIStudio: 19.5, recargas, cuadreAnterior: null, porDia: { "2026-11-25": 300_000 }, llamadas: [], factor: 1.5, ahora: 1 });
    expect(c.factor).toBeNull();
  });
});

describe("avisos de saldo", () => {
  const dias = (ultimos) => [...Array(9 - ultimos.length).fill(0.3), ...ultimos].map((euros, i) => ({ fecha: `2026-11-${String(10 + i).padStart(2, "0")}`, euros }));
  it("menos de 3 €", () => {
    expect(avisosDeGasto({ saldo: { euros: 2.4, diasQueQuedan: 8 }, dias: dias([0.3, 0.1]) }).map((a) => a.tipo)).toEqual(["saldo-bajo"]);
  });
  it("menos de 5 días al ritmo de la semana", () => {
    expect(avisosDeGasto({ saldo: { euros: 4, diasQueQuedan: 4 }, dias: dias([0.3, 0.1]) }).map((a) => a.tipo)).toEqual(["pocos-dias"]);
  });
  it("ayer más del doble de la media de los 7 días anteriores", () => {
    expect(avisosDeGasto({ saldo: { euros: 18, diasQueQuedan: 30 }, dias: dias([0.7, 0.1]) }).map((a) => a.tipo)).toEqual(["gasto-doble"]);
    expect(avisosDeGasto({ saldo: { euros: 18, diasQueQuedan: 30 }, dias: dias([0.5, 0.1]) })).toEqual([]);
  });
  it("sin saldo apuntado solo puede avisar del gasto", () => {
    expect(avisosDeGasto({ saldo: null, dias: dias([0.3, 0.1]) })).toEqual([]);
  });
});

describe("de la llamada a la IA al panel (almacén en memoria)", () => {
  let almacen, estadisticas, panel;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.__cazurroMem?.kv.clear(); globalThis.__cazurroMem?.caduca.clear(); // cada prueba con el almacén vacío
    vi.stubEnv("KV_REST_API_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("GASTO_IA_AJUSTE", "");
    almacen = await import("../src/lib/almacen");
    estadisticas = await import("../src/lib/estadisticas");
    panel = await import("../src/lib/gastoPanel");
  });

  it("cada llamada se apunta con su función, modelo y precio, y el saldo la descuenta", async () => {
    await panel.apuntarRecarga(20, Date.now() - 60_000);
    await estadisticas.registrarGastoIA("planes", { modelo: "gemini-2.5-flash", entrada: 2000, salida: 400, dolares: 0.0016 });
    await estadisticas.registrarGastoIA("barrido-eventos", { modelo: "gemini-2.5-flash-lite", entrada: 5000, salida: 800, consultas: 3, dolares: 0.00082 });
    await estadisticas.registrarErrorIA(429);
    const d = await panel.leerPanelGasto();
    expect(d.exito).toBe(true);
    expect(d.llamadas).toHaveLength(2);
    expect(d.llamadas[0]).toMatchObject({ f: "barrido", k: "barrido-eventos", m: "gemini-2.5-flash-lite", e: 5000, s: 800, b: 3, u: 820 });
    expect(d.porFuncion.map((f) => f.funcion).sort()).toEqual(["barrido", "planes"]);
    expect(d.porModelo.find((m) => m.modelo === "gemini-2.5-flash")).toMatchObject({ llamadas: 1 });
    expect(d.errores.at(-1)["429"]).toBe(1);
    expect(d.factor).toEqual({ valor: 1.5, origen: "estimado" });
    expect(d.saldo.euros).toBeCloseTo(20 - (0.0016 + 0.00082) * EUR * 1.5, 2);
    // El tope de hoy: 0,40 €; miércoles y domingos (barrido de todos los pueblos) 0,75 € (25-11-2026)
    const { esDiaDePueblos } = await import("../src/lib/topeGasto");
    expect(d.gasto.tope).toBe(esDiaDePueblos() ? 0.75 : 0.4);
  });

  it("recargas absurdas no se guardan", async () => {
    expect((await panel.apuntarRecarga(0)).exito).toBe(false);
    expect((await panel.apuntarRecarga(900)).exito).toBe(false);
    expect((await panel.apuntarRecarga(20, Date.now() - 90 * 864e5)).exito).toBe(false);
    expect((await panel.apuntarRecarga("12,5")).exito).toBe(true);
  });

  it("el cuadre guarda el saldo de AI Studio y, con datos bastantes, el factor nuevo que usa el tope", async () => {
    await panel.apuntarRecarga(20, Date.now() - 3 * 864e5);
    await almacen.comando(["SET", `ia:dia:${estadisticas.hoyEnLeon(-1)}`, String(4_000_000)]); // 3,60 € contados
    const r = await panel.apuntarCuadre("14,60");
    expect(r.exito).toBe(true);
    expect(r.cuadre.factor).toBeCloseTo(1.5, 2);
    expect(await almacen.comando(["GET", panel.CLAVE_FACTOR])).toBe("1.5");
    const d = await panel.leerPanelGasto();
    expect(d.factor.origen).toBe("cuadre");
    expect(d.saldo.euros).toBeCloseTo(14.6, 2);
  });

  it("cada aviso sale una vez al día", async () => {
    await panel.apuntarRecarga(2);
    const telegram = vi.fn(async () => {}), correo = vi.fn(async () => {});
    expect((await panel.mandarAvisosDeGasto({ telegram, correo })).map((a) => a.tipo)).toEqual(["saldo-bajo"]);
    expect(await panel.mandarAvisosDeGasto({ telegram, correo })).toEqual([]);
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(correo).toHaveBeenCalledTimes(1);
  });
});

describe("/api/admin/gasto sin clave", () => {
  it("no da ni un dato de gasto y no guarda recargas", async () => {
    vi.resetModules();
    vi.stubEnv("PANEL_CLAVE", "clave-de-prueba-larga");
    const ruta = await import("../src/app/api/admin/gasto/route");
    const sinClave = await ruta.GET(new Request("http://x/api/admin/gasto"));
    expect(sinClave.status).toBe(401);
    const cuerpo = await sinClave.json();
    expect(cuerpo).toEqual({ exito: false, mensaje: "Clave incorrecta" });
    const mala = await ruta.POST(new Request("http://x/api/admin/gasto", { method: "POST", headers: { "x-clave": "otra" }, body: JSON.stringify({ accion: "recarga", euros: 20 }) }));
    expect(mala.status).toBe(401);
    const buena = await ruta.GET(new Request("http://x/api/admin/gasto", { headers: { "x-clave": "clave-de-prueba-larga" } }));
    expect(buena.status).toBe(200);
    expect(buena.headers.get("cache-control")).toBe("no-store");
  });
});
