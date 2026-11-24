// npm test — El plan B: sin IA (sin saldo, tope del día, IA caída) el plan sale con lo ya comprobado, nunca «recargando»
import { afterEach, describe, expect, it, vi } from "vitest";
import { avisoSinIA, huecosPedidos, localesParaHueco, montarSinIA, rutasCerca } from "../src/lib/planSinIA";
import { claveCachePlan, segundosEnCache } from "../src/lib/cachePlanes";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

const LEON = { lat: 42.5987, lon: -5.5671 };
// Catálogo de prueba en el centro de León (a pocos cientos de metros unos de otros)
const SITIOS = [
  { n: "Bar El Gallo", t: "bar", la: 42.5975, lo: -5.5685, p: "2-3€", v: 9, g: 2 },
  { n: "Bar La Trucha", t: "bar", la: 42.5979, lo: -5.5690, p: "2-3€", v: 7, g: 1 },
  { n: "Taberna Los Pinos", t: "taberna", la: 42.5982, lo: -5.5679, p: "3€", v: 5, g: 0 },
  { n: "Bar Lejano", t: "bar", la: 42.64, lo: -5.60, p: "2€", v: 20, g: 5 },
  { n: "Restaurante El Roble", t: "restaurante", la: 42.5990, lo: -5.5670, p: "20€", v: 8, g: 1 },
  { n: "Cafetería La Plaza", t: "cafeteria", la: 42.5985, lo: -5.5675, p: "3€", v: 4, g: 0 },
];
const AGENDA = [
  { titulo: "Concierto de prueba", categoria: "concierto", hora: "21:30", lugar: "Sala X", fuente: "https://ejemplo.es/c", fecha: "2026-12-05", lat: 42.598, lon: -5.567 },
  { titulo: "Exposición larga", categoria: "exposicion", hora: "todo el día", fuente: "https://ejemplo.es/e", fecha: "2026-12-01", fechaFin: "2026-12-31" },
];
// Google de mentira: todo existe, abierto, y su placeId es el nombre
const enriquecerFalso = vi.fn(async (p) => ({ parada: { ...p, lat: p.lat ?? LEON.lat, lon: p.lon ?? LEON.lon, placeId: p.titulo } }));
const contexto = () => ({ ...LEON, radio: 3, nombreZona: "León", limite: Date.now() + 20000, fecha: "2026-12-05" });
const montar = (apetece, extra = {}) => montarSinIA({
  peticion: { apetece, fecha: "2026-12-05", ...LEON, radio: 3, presupuestoMin: 0, presupuestoMax: 50 },
  agenda: AGENDA, sitios: SITIOS, contexto: contexto(), ahora: new Date("2026-11-24T10:00:00Z"), ...extra,
}, enriquecerFalso);

describe("qué pide, sin IA", () => {
  it("lee los huecos en el orden en que se escriben", () => {
    expect(huecosPedidos("comer y luego salir de fiesta").map((h) => h.tipo)).toEqual(["restaurante", "discoteca"]);
    expect(huecosPedidos("cenar y un concierto").map((h) => h.tipo || h.agenda[0])).toEqual(["restaurante", "musica"]);
  });
  it("«4 bares» son 4 bares y «salir de fiesta» no son las fiestas del pueblo", () => {
    expect(huecosPedidos("4 bares para salir a tomar algo")).toEqual([expect.objectContaining({ tipo: "bar", n: 4 })]);
    expect(huecosPedidos("salir de fiesta").some((h) => h.agenda?.includes("fiesta"))).toBe(false);
  });
});

describe("montar el plan sin IA", () => {
  it("4 bares distintos, a poca distancia, con hora y precio, sin repetir ninguno", async () => {
    const { plan, faltan } = await montar("4 bares por el Húmedo");
    expect(faltan).toEqual([]);
    expect(plan).toHaveLength(4);
    expect(new Set(plan.map((p) => p.titulo)).size).toBe(4);
    // El cuarto no es el del catálogo a 5 km: es uno de Maps de la zona
    expect(plan.map((p) => p.titulo)).not.toContain("Bar Lejano");
    expect(plan[3].titulo).toBe("Bar de tapas en León");
    for (const p of plan) {
      expect(p.hora).toMatch(/^\d{2}:\d{2}$/);
      expect(p.precio).toBeTruthy();
    }
    expect(plan[1].transporte).toMatch(/min andando/);
  });
  it("cenar y un concierto: el restaurante a su hora y el concierto de la agenda a la suya", async () => {
    const { plan } = await montar("cenar y un concierto");
    expect(plan.map((p) => p.titulo)).toEqual(["Restaurante El Roble", "Concierto de prueba"]);
    expect(plan.map((p) => p.hora)).toEqual(["21:00", "21:30"]);
  });
  it("lo de «todo el día» lleva una hora concreta", async () => {
    const { plan } = await montar("ver una exposición");
    expect(plan[0].titulo).toBe("Exposición larga");
    expect(plan[0].hora).toBe("11:00");
  });
  it("si no hay lo pedido, lo dice y no rellena", async () => {
    const { plan, faltan } = await montar("un partido de baloncesto");
    expect(plan).toEqual([]);
    expect(avisoSinIA(faltan)).toMatch(/No hemos encontrado/);
  });
  it("si el local está cerrado a esa hora (Google no lo da), prueba el siguiente", async () => {
    const cerradoElPrimero = vi.fn(async (p) => (p.titulo === "Restaurante El Roble" ? { parada: null, cerrado: true } : { parada: { ...p, lat: p.lat ?? LEON.lat, lon: p.lon ?? LEON.lon, placeId: p.titulo } }));
    const { plan } = await montarSinIA({
      peticion: { apetece: "comer", fecha: "2026-12-05", ...LEON, radio: 3 }, agenda: [], sitios: SITIOS, contexto: contexto(), ahora: new Date("2026-11-24T10:00:00Z"),
    }, cerradoElPrimero);
    expect(plan).toHaveLength(1);
    expect(plan[0].titulo).toBe("Restaurante en León");
  });
  it("«3 bares en Boñar» un martes: si a las 20:50 está todo cerrado, prueba antes del primero", async () => {
    const BONAR = { lat: 42.8667, lon: -5.3236 };
    const bares = ["Bar Casa Pepe", "Bar La Plaza", "Bar Los Arcos", "Bar El Puente"].map((n, i) => ({ n, t: "bar", la: BONAR.lat + i * 0.0005, lo: BONAR.lon, p: "2€" }));
    // Google de mentira: después de las 20:30 todo está cerrado (pueblo, entre semana)
    const pueblo = vi.fn(async (p) => {
      const [hh, mm] = p.hora.split(":").map(Number);
      if (hh * 60 + mm > 20 * 60 + 30) return { parada: null, cerrado: true };
      return { parada: { ...p, lat: p.lat ?? BONAR.lat, lon: p.lon ?? BONAR.lon, placeId: p.titulo } };
    });
    const { plan, faltan } = await montarSinIA({
      peticion: { apetece: "3 bares", fecha: "2026-11-25", ...BONAR, radio: 3 }, agenda: [], sitios: bares,
      contexto: { ...BONAR, radio: 3, nombreZona: "Boñar", limite: Date.now() + 20000 }, ahora: new Date("2026-11-24T10:00:00Z"),
    }, pueblo);
    expect(plan.map((p) => p.hora)).toEqual(["18:20", "19:10", "20:00"]);
    expect(faltan).toEqual([]);
  });
  it("para hoy, nada antes de dentro de media hora", async () => {
    const { plan } = await montarSinIA({
      peticion: { apetece: "comer", fecha: "2026-11-24", ...LEON, radio: 3 }, agenda: [], sitios: SITIOS, contexto: contexto(),
      ahora: new Date("2026-11-24T14:10:00Z"), // 15:10 en Madrid
    }, enriquecerFalso);
    expect(plan[0].hora).toBe("15:45");
  });
  it("los locales a 15 min andando van antes que uno mejor pero lejos", () => {
    const lista = localesParaHueco(SITIOS, "bar", LEON);
    expect(lista.at(-1).n).toBe("Bar Lejano");
  });
  it("rutas y parajes solo dentro del radio", () => {
    expect(rutasCerca(LEON.lat, LEON.lon, 5).map((r) => r.nombre)).toContain("Parque de La Candamia");
    expect(rutasCerca(LEON.lat, LEON.lon, 5).map((r) => r.nombre)).not.toContain("Las Médulas");
  });
});

describe("caché de planes repetidos", () => {
  const base = { fecha: "2026-12-05", apetece: "Cenar y copas", presupuestoMin: 0, presupuestoMax: 50, radio: 3, ...LEON };
  it("el mismo pedido escrito con otras mayúsculas o tildes es el mismo plan", () => {
    expect(claveCachePlan(base)).toBe(claveCachePlan({ ...base, apetece: "cenar  y cópas" }));
  });
  it("otro presupuesto, otra fecha u otro punto (a más de ~1 km) es otro plan", () => {
    expect(claveCachePlan(base)).not.toBe(claveCachePlan({ ...base, presupuestoMax: 20 }));
    expect(claveCachePlan(base)).not.toBe(claveCachePlan({ ...base, fecha: "2026-12-06" }));
    expect(claveCachePlan(base)).not.toBe(claveCachePlan({ ...base, lat: 42.62 }));
  });
  it("dura 6 h para otro día, 30 min para hoy y 10 min si salió sin IA", () => {
    const ahora = new Date("2026-11-24T10:00:00Z");
    expect(segundosEnCache({ fecha: "2026-12-05" }, ahora)).toBe(6 * 3600);
    expect(segundosEnCache({ fecha: "2026-11-24" }, ahora)).toBe(30 * 60);
    expect(segundosEnCache({ fecha: "2026-12-05", sinIA: true }, ahora)).toBe(10 * 60);
  });
});

describe("tope de gasto del día", () => {
  it("pasado el tope, Gemini no se llama y el error lo dice", async () => {
    vi.doMock("../src/lib/topeGasto", () => ({ dentroDelGastoDelDia: async () => false }));
    const espia = vi.fn();
    vi.stubGlobal("fetch", espia);
    const { llamarGemini, motivoClaro } = await import("../src/lib/gemini");
    const error = await llamarGemini("hola", { para: "barrido" }).catch((e) => e);
    expect(error.tope).toBe(true);
    expect(espia).not.toHaveBeenCalled();
    expect(motivoClaro(error).tipo).toBe("tope");
    vi.doUnmock("../src/lib/topeGasto");
  });
  it("el fondo para antes que los planes, y con el almacén caído no se gasta", async () => {
    // 0,20 € en el contador x1,5 = 0,30 € de verdad
    vi.doMock("../src/lib/almacen", () => ({ comando: vi.fn(async () => String(0.2 / 0.9 * 1e6)), recordar: (_k, _ms, leer) => leer() }));
    const { dentroDelGastoDelDia } = await import("../src/lib/topeGasto");
    expect(await dentroDelGastoDelDia("barrido")).toBe(false); // 0,30 € ≥ 0,25 €
    expect(await dentroDelGastoDelDia("usuario")).toBe(true); // 0,30 € < 0,40 €
    vi.doUnmock("../src/lib/almacen");
    vi.resetModules();
    vi.doMock("../src/lib/almacen", () => ({ comando: vi.fn(async () => { throw new Error("caído"); }), recordar: (_k, _ms, leer) => leer() }));
    const otra = await import("../src/lib/topeGasto");
    expect(await otra.dentroDelGastoDelDia("usuario")).toBe(false);
    vi.doUnmock("../src/lib/almacen");
  });
  it("sin saldo (402) se explica en cristiano", async () => {
    const { motivoClaro } = await import("../src/lib/gemini");
    expect(motivoClaro({ fallos: ["gemini-2.5-flash-lite: 402 Your prepayment credits are depleted"] }).tipo).toBe("saldo");
  });
});
