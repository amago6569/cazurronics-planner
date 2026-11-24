// npm test — La hora que falta, leída en la página del evento (24-11-2026: 70 de 162 planes sueltos sin hora)
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async () => ({ texto: "[]", dominios: new Set() })),
}));
vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); }));

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon } = await import("../src/lib/estadisticas");
const ev = await import("../src/lib/eventos");
const { horaEnPagina } = await import("../src/lib/fiables");
const { segundaComprobacion } = await import("../src/lib/guardia");

const dia = (n) => { const d = new Date(`${hoyEnLeon()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const VANGOURA = { titulo: "Vangoura en concierto", fecha: "2026-11-27" };

beforeEach(async () => {
  for (const k of [ev.HORAS_PROPUESTAS, "eventos:bandeja", "eventos:sinConfirmar"]) await comando(["DEL", k]);
  for (let i = 0; i < 21; i++) await comando(["DEL", `eventos:${dia(i)}`]);
});

describe("la hora que dice la página", () => {
  it("la encuentra junto al título, escrita de varias formas", () => {
    expect(horaEnPagina("Viernes 27 de noviembre. Vangoura en concierto en el Gran Café, a las 22:00. Entrada 10 €.", VANGOURA)).toBe("22:00");
    expect(horaEnPagina("Vangoura en concierto el 27/11 a las 22.30 h en el Gran Café", VANGOURA)).toBe("22:30");
    expect(horaEnPagina("Concierto de Vangoura: 27 nov, 21 h, Sala X", { titulo: "Concierto de Vangoura" })).toBe("21:00");
  });

  it("en un horario «de 10 a 14 h» vale la de empezar", () => {
    expect(horaEnPagina("Mercado de artesanía de Navidad, sábado de 10 a 14 h en la Plaza Mayor", { titulo: "Mercado de artesanía de Navidad" })).toBe("10:00");
    expect(horaEnPagina("Mercado de artesanía de Navidad, 10:00-14:00, Plaza Mayor", { titulo: "Mercado de artesanía de Navidad" })).toBe("10:00");
  });

  it("si hay dos horas distintas o ninguna, no se la inventa", () => {
    expect(horaEnPagina("Vangoura en concierto. Puertas 21:00, concierto 22:00", VANGOURA)).toBeNull();
    expect(horaEnPagina("Vangoura en concierto el 21.11.2026 en León", VANGOURA)).toBeNull();
    expect(horaEnPagina("Otra cosa a las 20:00. " + "x".repeat(800) + " Vangoura en concierto el viernes", VANGOURA)).toBeNull();
    expect(horaEnPagina("Agenda: teatro a las 20:00 y cine a las 22:00", VANGOURA)).toBeNull();
  });
});

describe("repaso de horas del Verificador", () => {
  // Cada prueba usa sus propias páginas (cada una se lee una vez cada 3 días)
  const PAGINAS = {
    vangoura: "<p>27 de noviembre · Vangoura en concierto · a las 22:00 · Gran Café</p>",
    dudosa: "<p>Magosto popular de Boñar: castañas 18:00 y orquesta 23:00</p>",
  };
  const leer = vi.fn(async (url) => {
    const k = Object.keys(PAGINAS).find((x) => url.includes(`/${x}`));
    return k ? { estado: "ok", texto: PAGINAS[k] } : { estado: "duda", texto: "" };
  });
  let n = 0;
  const subir = () => ev.sumarALaAgenda([
    { titulo: "Vangoura en concierto", fecha: dia(2), localidad: "León", fuente: `https://sala.example/vangoura?v=${++n}`, verificado: true },
    { titulo: "Magosto popular de Boñar", fecha: dia(2), localidad: "Boñar", fuente: `https://sala.example/dudosa?v=${n}`, verificado: true },
    { titulo: "Teatro con hora", fecha: dia(2), hora: "20:00", localidad: "León", fuente: "https://sala.example/teatro", verificado: true },
    { titulo: "Belén municipal", fecha: dia(2), localidad: "León", fuente: "https://www.google.com/search?q=belen", verificado: true },
  ], hoyEnLeon(), dia(20));

  it("de momento solo apunta lo que encuentra: la agenda no cambia", async () => {
    await subir();
    const r = await ev.buscarHorasQueFaltan({ leer });
    expect(r).toEqual({ mirados: 2, propuestas: 1 });
    expect(leer).not.toHaveBeenCalledWith("https://www.google.com/search?q=belen", expect.anything());
    const propuestas = Object.values(await comando(["HGETALL", ev.HORAS_PROPUESTAS]) || {});
    expect(JSON.stringify(propuestas)).toMatch(/Vangoura en concierto.*22:00/);
    expect((await ev.eventosDelDia(dia(2))).find((e) => e.titulo === "Vangoura en concierto").hora).toBeFalsy();
  });

  it("cada página se lee una vez cada 3 días", async () => {
    await subir();
    await ev.buscarHorasQueFaltan({ leer });
    expect(await ev.buscarHorasQueFaltan({ leer })).toEqual({ mirados: 0, propuestas: 0 });
  });

  it("cuando se active, pone la hora y apunta de dónde sale", async () => {
    await subir();
    await ev.buscarHorasQueFaltan({ leer, aplicar: true });
    const vangoura = (await ev.eventosDelDia(dia(2))).find((e) => e.titulo === "Vangoura en concierto");
    expect(vangoura).toMatchObject({ hora: "22:00", horaDe: "pagina" });
  });

  it("el parte del Verificador lo cuenta", async () => {
    await subir();
    const parte = await segundaComprobacion({ leer: async (u) => leer(u), repasarEnlaces: async () => null, pasarBuscadores: async () => null });
    expect(parte.horas).toEqual({ mirados: 2, propuestas: 1 });
  });
});
