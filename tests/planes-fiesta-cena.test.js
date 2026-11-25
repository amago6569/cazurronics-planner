// npm test — «Cenar algo leonés y luego salir de fiesta» (Alejandro, 24-11-2026): solo salía el sitio de fiesta, a las 20:30,
// en una discoteca que seguro que ni abría, y la chincheta del minimapa caía en otro sitio
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ajustarFiesta, completarLocalesPedidos, completarPedido, localesPedidos } from "../src/lib/montarPlan";
import { cocinaPedida, montarSinIA } from "../src/lib/planSinIA";
import { enriquecerParada, precioCreible } from "../src/lib/planUtils";

afterEach(() => { vi.unstubAllGlobals(); });

const FRASE = "cenar algo leonés y luego salir de fiesta";
const LEON = { lat: 42.5987, lon: -5.5671 };

describe("lo que pide, leído sin IA", () => {
  it("su frase: un restaurante para cenar a las 21:00 y un sitio de fiesta a las 23:30, con cocina leonesa", () => {
    expect(localesPedidos(FRASE).map((h) => [h.tipo, h.hora])).toEqual([["restaurante", 21 * 60], ["discoteca", 23 * 60 + 30]]);
    expect(cocinaPedida(FRASE)).toBe("Restaurante de cocina leonesa");
    expect(cocinaPedida("comer un cocido en Astorga")).toBe("Restaurante de cocido maragato");
    expect(cocinaPedida("un cocido")).toBe("Restaurante con cocido");
    expect(cocinaPedida("comida típica")).toBe("Restaurante de cocina leonesa");
    expect(cocinaPedida("cenar sushi")).toBeNull();
  });
  it("«qué hay hoy» o un concierto no piden locales", () => {
    expect(localesPedidos("qué hay hoy en León")).toEqual([]);
    expect(localesPedidos("un concierto")).toEqual([]);
  });
});

describe("la parada de fiesta que pone la IA", () => {
  const fuentes = new Set(["https://agenda.example/fiesta-erasmus"]);
  it("una «fiesta» inventada a las 20:30 pasa a ser un local de noche, comprobado y después de cenar", () => {
    const ia = [
      { titulo: "Mesón Leonés", tipo: "restaurante", hora: "21:00" },
      { titulo: "Glam", tipo: "fiesta", hora: "20:30" },
    ];
    const [cena, fiesta] = ajustarFiesta(ia, FRASE, fuentes);
    expect(cena).toMatchObject({ tipo: "restaurante", hora: "21:00" });
    expect(fiesta).toMatchObject({ tipo: "discoteca", hora: "23:00" });
    expect(ia[1].tipo).toBe("fiesta"); // no toca lo que le llega
  });
  it("si cena tarde, la fiesta va después; de madrugada y con hora dicha se respeta", () => {
    expect(ajustarFiesta([{ tipo: "restaurante", hora: "22:00" }, { tipo: "pub", hora: "22:30" }], FRASE)[1].hora).toBe("23:30");
    expect(ajustarFiesta([{ tipo: "discoteca", hora: "00:30" }], FRASE)[0].hora).toBe("00:30");
    expect(ajustarFiesta([{ tipo: "discoteca", hora: "22:00" }], "salir de fiesta a las 22")[0].hora).toBe("22:00");
  });
  it("una fiesta de la agenda (con su fuente) se queda como evento con su hora; sin pedir fiesta no se toca nada", () => {
    expect(ajustarFiesta([{ tipo: "fiesta", hora: "20:30", fuente: "https://agenda.example/fiesta-erasmus" }], FRASE, fuentes)[0]).toMatchObject({ tipo: "fiesta", hora: "20:30" });
    const ia = [{ tipo: "fiesta", hora: "12:00", titulo: "Fiestas de San Froilán" }];
    expect(ajustarFiesta(ia, "ir a las fiestas de San Froilán")).toEqual(ia);
  });
});

describe("si falta la cena o la fiesta, se busca una abierta", () => {
  it("con solo la fiesta, se busca restaurante de cocina leonesa a las 21:00; si no hay ninguno abierto, se dice", async () => {
    const ruta = [{ titulo: "Glam", tipo: "discoteca", hora: "23:00" }];
    const pedidos = [];
    const nada = vi.fn(async (r, pedido) => { pedidos.push(pedido); return 0; });
    const faltan = await completarLocalesPedidos(ruta, FRASE, null, {}, nada);
    expect(pedidos).toEqual([expect.objectContaining({ n: 1, tipo: "restaurante", hora: 21 * 60, cocina: "Restaurante de cocina leonesa" })]);
    expect(faltan).toEqual(["restaurante abierto a las 21:00"]);
  });
  it("con solo la cena, la fiesta se busca después de cenar; «4 bares» lo completa el pedido, no esto", async () => {
    const pedidos = [];
    const uno = vi.fn(async (r, pedido) => { pedidos.push(pedido); return 1; });
    await completarLocalesPedidos([{ titulo: "Mesón", tipo: "restaurante", hora: "22:15" }], FRASE, null, {}, uno);
    expect(pedidos[0]).toMatchObject({ tipo: "discoteca", hora: 23 * 60 + 45 });
    pedidos.length = 0;
    await completarLocalesPedidos([], "4 bares", { n: 4, tipo: "bar", plural: "bares" }, {}, uno);
    expect(pedidos).toEqual([]);
  });
  it("si la IA pone un bar para cenar, el restaurante lo sustituye; si no hay restaurante abierto, el bar se queda", async () => {
    // Producción, 26-11-2026: «21:00 Ezequiel Calle Ancha | bar» + concierto a las 23:00
    const deIA = () => [{ titulo: "Ezequiel Calle Ancha", tipo: "bar", hora: "21:00" }, { titulo: "Kamikaze Helmets", tipo: "concierto", hora: "23:00" }];
    const pone = vi.fn(async (r) => { r.push({ titulo: "Mesón leonés", tipo: "restaurante", hora: "21:00" }); return 1; });
    const ruta = deIA();
    expect(await completarLocalesPedidos(ruta, FRASE, null, {}, pone)).toEqual([]);
    expect(ruta.map((p) => [p.hora, p.tipo])).toEqual([["23:00", "concierto"], ["21:00", "restaurante"]]);
    const sinNada = deIA();
    expect(await completarLocalesPedidos(sinNada, FRASE, null, {}, vi.fn(async () => 0))).toEqual([]);
    expect(sinNada.map((p) => p.tipo)).toEqual(["bar", "concierto"]);
    // «unas cañas y cenar»: el bar es suyo, no se quita
    const conCañas = [{ titulo: "Bar", tipo: "bar", hora: "20:30" }];
    await completarLocalesPedidos(conCañas, "unas cañas de tapas y luego cenar", null, {}, pone);
    expect(conCañas.map((p) => p.tipo)).toContain("bar");
  });
  it("un bar o un concierto de noche ya valen como «salir de fiesta»", async () => {
    const uno = vi.fn(async () => 1);
    await completarLocalesPedidos([{ tipo: "restaurante", hora: "21:00" }, { tipo: "concierto", hora: "22:30" }], FRASE, null, {}, uno);
    expect(uno).not.toHaveBeenCalled();
  });
  it("completarPedido busca primero por la cocina y a la hora pedida", async () => {
    const vistos = [];
    const google = vi.fn(async (p) => { vistos.push([p.titulo, p.hora]); return { parada: { ...p, placeId: p.titulo, lat: 42.6, lon: -5.57 } }; });
    const ruta = [];
    const contexto = { ...LEON, radio: 3, nombreZona: "León", limite: Date.now() + 20000 };
    const sitios = [{ n: "Restaurante del Hotel", t: "restaurante", la: 42.6, lo: -5.57, p: "5€" }];
    const n = await completarPedido(ruta, { n: 1, tipo: "restaurante", plural: "restaurante", hora: 21 * 60, cocina: "Restaurante de cocina leonesa" }, { sitios, contexto, fecha: "2030-01-05" }, google);
    expect(n).toBe(1);
    expect(vistos[0]).toEqual(["Restaurante de cocina leonesa en León", "21:00"]);
  });
});

describe("plan sin IA con su frase", () => {
  it("restaurante buscado por cocina leonesa a las 21:00 y fiesta a las 23:30", async () => {
    const vistos = [];
    const google = vi.fn(async (p) => { vistos.push(p.titulo); return { parada: { ...p, lat: p.lat ?? LEON.lat, lon: p.lon ?? LEON.lon, placeId: p.titulo } }; });
    const sitios = [
      { n: "Restaurante del Hotel", t: "restaurante", la: 42.5990, lo: -5.5670, p: "5€" },
      { n: "Pub Noche", t: "discoteca", la: 42.5985, lo: -5.5680, p: "8€" },
    ];
    const { plan } = await montarSinIA({
      peticion: { apetece: FRASE, fecha: "2026-12-05", ...LEON, radio: 3 },
      agenda: [], sitios, contexto: { ...LEON, radio: 3, nombreZona: "León", limite: Date.now() + 20000 }, ahora: new Date("2026-11-24T10:00:00Z"),
    }, google);
    expect(vistos[0]).toBe("Restaurante de cocina leonesa en León");
    expect(plan.map((p) => [p.tipo, p.hora])).toEqual([["restaurante", "21:00"], ["discoteca", "23:30"]]);
  });
});

describe("precios que cuadran", () => {
  it("cenar por 5 € no: lo típico o el tramo de Google; lo demás se deja", () => {
    expect(precioCreible("restaurante", "5€")).toBe("15-25€");
    expect(precioCreible("restaurante", "5€", 2)).toBe("20-35€");
    expect(precioCreible("restaurante", "12-18€")).toBe("12-18€");
    expect(precioCreible("discoteca", "2€")).toBe("8-12€");
    expect(precioCreible("discoteca", "Gratis")).toBe("Gratis");
    expect(precioCreible("bar", "2€")).toBe("2€");
    expect(precioCreible("restaurante", null)).toBe("15-25€");
  });
});

describe("chinchetas en su sitio", () => {
  const contexto = { ...LEON, radio: 15, priceLevelObjetivo: 1, nombreZona: "León", mapsKey: "x", limite: Date.now() + 20000 };
  const sitio = (name, lat, lng) => ({ name, place_id: `p_${name}`, types: ["night_club"], formatted_address: "Calle X, 24001 León, España", geometry: { location: { lat, lng } } });
  const google = (resultados, urls) => vi.stubGlobal("fetch", vi.fn(async (url) => {
    urls?.push(String(url));
    if (String(url).includes("textsearch")) return { json: async () => ({ status: "OK", results: resultados }) };
    return { json: async () => ({ result: {} }) };
  }));
  it("un concierto se busca por su local y se queda con el que se llama así, no con el primero", async () => {
    const urls = [];
    google([sitio("Bar Cualquiera", 42.61, -5.58), sitio("Sala Babylon León", 42.5970, -5.5700)], urls);
    const { parada } = await enriquecerParada({ titulo: "Vangoura en concierto", tipo: "concierto", lugar: "Sala Babylon", hora: "22:00", lat: 42.5, lon: -5.5 }, contexto);
    expect(urls.find((u) => u.includes("textsearch"))).toContain(encodeURIComponent("Sala Babylon, León"));
    expect([parada.lat, parada.lon, parada.sinUbicar]).toEqual([42.597, -5.57, undefined]);
    expect(parada.titulo).toBe("Vangoura en concierto");
  });
  it("si Google no conoce su local, sin chincheta (ni la de otro sitio ni la que se inventa la IA)", async () => {
    google([sitio("Discoteca Otra", 42.61, -5.58)]);
    const { parada } = await enriquecerParada({ titulo: "Fiesta de los 80", tipo: "fiesta", lugar: "Local Desconocido", hora: "23:00", lat: 42.5, lon: -5.5 }, contexto);
    expect(parada.sinUbicar).toBe(true);
    expect([parada.lat, parada.lon]).toEqual([LEON.lat, LEON.lon]);
  });
  it("un museo que no es el pedido no se cambia por el mejor valorado de la zona", async () => {
    google([{ ...sitio("MUSAC", 42.6045, -5.5868), types: ["museum"] }]);
    const { parada } = await enriquecerParada({ titulo: "Museo de los Faroles de Prueba", tipo: "museo", hora: "11:00" }, contexto);
    expect(parada.nombreGoogle).toBeUndefined();
    expect(parada.sinUbicar).toBe(true);
  });
  it("el planificador no pinta lo que va sin ubicar", () => {
    const html = readFileSync(new URL("../public/inicio/planner.html", import.meta.url), "utf8");
    expect(html).toMatch(/const conSitio = \(p\) => !p\.sinUbicar &&/);
  });
});

describe("pueblos del selector de zona en su sitio (no en el centro del término municipal)", () => {
  const datos = readFileSync(new URL("../public/inicio/provincia-datos.js", import.meta.url), "utf8");
  const window = {};
  new Function("window", datos)(window);
  const tx = (lon) => ((lon + 180) / 360) * 1024;
  const ty = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 1024;
  const X0 = Math.floor(tx(-7.2)), Y0 = Math.floor(ty(43.32));
  const aLatLon = (x, y) => { const X = X0 + x / 256, Y = Y0 + y / 256; return [(Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / 1024))) * 180) / Math.PI, (X / 1024) * 360 - 180]; };
  const km = (a, b) => { const R = 6371, dl = ((b[0] - a[0]) * Math.PI) / 180, dn = ((b[1] - a[1]) * Math.PI) / 180; const h = Math.sin(dl / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  // Posición del pueblo en OpenStreetMap (nodo place), comprobada el 25-11-2026
  const OSM = { "Ponferrada": [42.54541, -6.59387], "Villafranca del Bierzo": [42.60558, -6.81117], "Bembibre": [42.6154, -6.41697], "Molinaseca": [42.53784, -6.52046], "Fabero": [42.76804, -6.62499], "Puebla de Lillo": [43.00825, -5.27421], "León": [42.599, -5.56824], "Astorga": [42.4554, -6.0529] };
  it.each(Object.entries(OSM))("%s, a menos de 500 m", (nombre, osm) => {
    const p = window.PROVINCIA.pueblos.find((q) => q[0] === nombre);
    expect(km(aLatLon(p[1], p[2]), osm)).toBeLessThan(0.5);
  });
});
