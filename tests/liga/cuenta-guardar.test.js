// El guardado de partidas en el navegador (public/liga/cuenta.js): que ningún intento pierda sus puntos.
import { describe, it, expect, beforeEach, vi } from "vitest";

const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};
globalThis.addEventListener ||= () => {};
globalThis.document ||= { addEventListener: () => {}, visibilityState: "visible" };

let llamadas, responder;
globalThis.fetch = vi.fn((url, op) => {
  const ruta = String(url).replace("/api/liga/", "").split("?")[0];
  const cuerpo = op?.body ? JSON.parse(op.body) : null;
  llamadas.push({ ruta, cuerpo, hora: llamadas.length });
  return responder(ruta, cuerpo);
});
const json = (j, status = 200) => Promise.resolve(new Response(JSON.stringify(j), { status }));
const HOY = { conectado: true, abierta: true, perfil: { apodo: "Ana" }, juegos: [{ id: "trucha", quedan: 3, usados: 0, mejor: null }] };

const { crearLiga, resultadoLiga, FIN_LIGA } = await import("../../public/liga/cuenta.js");
const ANTES_DEL_FIN = new Date("2026-11-20T10:00:00Z"); // estas pruebas son de cuando la liga puntuaba

beforeEach(() => {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ["Date"], now: ANTES_DEL_FIN });
  almacen.clear();
  almacen.set("liga-sesion", JSON.stringify({ access: "acceso-de-prueba", refresh: "refresco-de-prueba", expira: Date.now() / 1000 + 3600 }));
  llamadas = [];
});

describe("liga terminada (sáb 21-11-2026, 12:00)", () => {
  it("los juegos pasan a libres sin preguntar al servidor ni gastar intentos", async () => {
    vi.setSystemTime(FIN_LIGA);
    responder = () => json(HOY);
    const liga = crearLiga("trucha");
    expect(await liga.preparar()).toEqual({ oficial: false, motivo: "libre" });
    expect(await liga.empezar()).toEqual({ oficial: false, semilla: null });
    expect(llamadas.filter((l) => l.ruta === "empezar")).toHaveLength(0);
  });
  it("si el servidor dice que ha terminado (reloj del móvil atrasado), también", async () => {
    responder = () => json({ ...HOY, abierta: false, libre: true, juegos: [] });
    expect((await crearLiga("trucha").preparar()).motivo).toBe("libre");
  });
});

describe("guardar partidas de liga", () => {
  it("«Otro intento» espera a que la partida anterior esté guardada (si no, el servidor la daba por abandonada)", async () => {
    let soltar;
    responder = (ruta) => {
      if (ruta === "hoy") return json(HOY);
      if (ruta === "empezar") return json({ partida: `p${llamadas.length}`, semilla: 5, intento: 1, quedan: 2 });
      if (ruta === "terminar") return new Promise((ok) => { soltar = () => ok(new Response(JSON.stringify({ estado: "valida", puntos: 80, mejor: 80, quedan: 2 }))); });
    };
    const liga = crearLiga("trucha");
    await liga.preparar();
    await liga.empezar();
    const guardado = liga.terminar({ x: 1 });
    expect(JSON.parse(almacen.get("liga-pendientes"))).toHaveLength(1); // apuntada antes de mandarla
    const otra = liga.empezar();
    await new Promise((ok) => setTimeout(ok, 20));
    expect(llamadas.filter((l) => l.ruta === "empezar")).toHaveLength(1); // aún no ha pedido el 2.º intento
    soltar();
    expect((await guardado).estado).toBe("valida");
    await otra;
    const orden = llamadas.map((l) => l.ruta).filter((r) => r !== "hoy");
    expect(orden).toEqual(["empezar", "terminar", "empezar"]);
    expect(almacen.has("liga-pendientes")).toBe(false);
  });

  it("sin cobertura la partida se queda apuntada y se manda antes del siguiente intento", async () => {
    vi.useRealTimers(); vi.useFakeTimers({ now: ANTES_DEL_FIN });
    let sinRed = true;
    responder = (ruta) => {
      if (ruta === "hoy") return json(HOY);
      if (ruta === "empezar") return json({ partida: `p${llamadas.length}`, semilla: 5, intento: 1, quedan: 2 });
      if (ruta === "terminar") return sinRed ? Promise.reject(new TypeError("sin red")) : json({ estado: "valida", puntos: 50, mejor: 50, quedan: 1 });
    };
    const liga = crearLiga("trucha");
    await liga.preparar();
    await liga.empezar();
    const guardado = liga.terminar({ x: 2 });
    await vi.runAllTimersAsync();
    const r = await guardado;
    vi.useRealTimers();
    expect(r.estado).toBe("error");
    expect(JSON.parse(almacen.get("liga-pendientes"))).toHaveLength(1);
    sinRed = false;
    await liga.empezar();
    const orden = llamadas.map((l) => l.ruta).filter((x) => x !== "hoy");
    expect(orden.slice(-2)).toEqual(["terminar", "empezar"]); // primero la pendiente, luego el intento nuevo
    expect(almacen.has("liga-pendientes")).toBe(false);
  });

  it("si la respuesta se perdió pero el servidor la tenía, no dice que no se guardó", async () => {
    let veces = 0;
    responder = (ruta) => {
      if (ruta === "hoy") return json(HOY);
      if (ruta === "empezar") return json({ partida: "p1", semilla: 5, intento: 1, quedan: 2 });
      if (ruta === "terminar") return ++veces === 1 ? json({ error: "Algo ha fallado." }, 502) : json({ error: "Ya guardada", codigo: "ya_guardada" }, 409);
    };
    vi.useRealTimers(); vi.useFakeTimers({ now: ANTES_DEL_FIN });
    const liga = crearLiga("trucha");
    await liga.preparar();
    await liga.empezar();
    const guardado = liga.terminar({ x: 3 });
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect((await guardado).estado).toBe("valida");
    expect(almacen.has("liga-pendientes")).toBe(false);
  });

  it("la pantalla final enseña los puntos del servidor y la mejor de hoy, no la de práctica", () => {
    expect(resultadoLiga({ estado: "valida", puntos: 40, mejor: 90, quedan: 1 })).toMatchObject({ puntos: 40, record: "Cuenta tu mejor de hoy: 90 puntos." });
    expect(resultadoLiga({ estado: "valida", puntos: 90, mejor: 90, quedan: 0 }).record).toMatch(/^¡Tu mejor marca de hoy!/);
    expect(resultadoLiga({ estado: "valida", puntos: 90, mejor: 90, quedan: null }).html).toBe("Guardado en la liga.");
  });
});
