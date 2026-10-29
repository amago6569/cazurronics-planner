// npm test — El jefe contesta con lo que sabe la oficina (y busca si no hay nada), y los eventos «por confirmar»
// se resuelven solos. Sin llamar a Google de verdad: la IA y las webs se simulan.
import { beforeEach, describe, expect, it, vi } from "vitest";

const respuestas = []; // lo que contestará la IA, en orden
const prompts = [];
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async (prompt) => {
    prompts.push(prompt);
    const r = respuestas.shift();
    if (r instanceof Error) throw r;
    return r || { texto: "[]", dominios: new Set() };
  }),
}));
vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); }));

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon } = await import("../src/lib/estadisticas");
const ev = await import("../src/lib/eventos");
const { segundaComprobacion } = await import("../src/lib/guardia");
const { hablarConJefe } = await import("../src/lib/jefe");
const { rangoDeFechas, puebloEnTexto, esDelSitio, parecido, BUSCA_AL_DIA } = await import("../src/lib/jefeSabe");

const dia = (n) => { const d = new Date(`${hoyEnLeon()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const enAgenda = async () => ((await ev.eventosProximos()).flatMap((d) => d.eventos));
const ia = (obj) => ({ texto: typeof obj === "string" ? obj : JSON.stringify(obj), dominios: new Set() });

beforeEach(async () => {
  respuestas.length = 0; prompts.length = 0;
  for (const k of ["eventos:bandeja", "eventos:tirados", "eventos:sinConfirmar", "oficina:charla", "oficina:encargos", "oficina:enCurso", "oficina:repesca", `ia:gratis:${hoyEnLeon()}`, `jefe:busquedas:${hoyEnLeon()}`]) await comando(["DEL", k]);
  for (let i = 0; i < 21; i++) await comando(["DEL", `eventos:${dia(i)}`]);
});

describe("📅 Cuándo y dónde (sin IA)", () => {
  const hoy = "2026-10-29"; // jueves
  it("entiende las fechas de siempre", () => {
    expect(rangoDeFechas("¿qué planes hay esta semana?", hoy)).toMatchObject({ desde: "2026-10-29", hasta: "2026-11-01" });
    expect(rangoDeFechas("y el finde?", hoy)).toMatchObject({ desde: "2026-10-30", hasta: "2026-11-01" });
    expect(rangoDeFechas("la semana que viene", hoy)).toMatchObject({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(rangoDeFechas("qué hay mañana en Astorga", hoy)).toMatchObject({ desde: "2026-10-30", hasta: "2026-10-30" });
    expect(rangoDeFechas("el sábado", hoy)).toMatchObject({ desde: "2026-10-31", hasta: "2026-10-31" });
    expect(rangoDeFechas("algo por la mañana", hoy)).toMatchObject({ desde: "2026-10-29", hasta: "2026-11-04" });
    expect(rangoDeFechas("qué hay en Boñar", hoy)).toMatchObject({ desde: "2026-10-29", hasta: "2026-11-04" });
    expect(rangoDeFechas("este mes", hoy).hasta).toBe("2026-11-18"); // no pasa de la agenda (21 días)
  });

  it("encuentra el pueblo aunque vaya sin tilde y no confunde la provincia con la capital", () => {
    expect(puebloEnTexto("¿Qué planes tienes esta semana sobre boñar?")).toBe("Boñar");
    expect(puebloEnTexto("fiestas en Valencia de Don Juan")).toBe("Valencia de Don Juan");
    expect(puebloEnTexto("qué hay en León este finde")).toBe("León");
    expect(puebloEnTexto("conciertos en la provincia de León")).toBe(null);
    expect(puebloEnTexto("¿hay matanza en Cea?")).toBe("Cea");
    expect(puebloEnTexto("hay alguna matanza?")).toBe(null);
  });

  it("un evento es del pueblo por su nombre o por la distancia", () => {
    expect(esDelSitio({ titulo: "Magosto", localidad: "Boñar" }, "Boñar")).toBe(true);
    expect(esDelSitio({ titulo: "Fiestas de Boñar", localidad: "" }, "Boñar")).toBe(true);
    expect(esDelSitio({ titulo: "Ruta", localidad: "Vegamián", lat: 42.86, lon: -5.33 }, "Boñar", { lat: 42.867, lon: -5.322 })).toBe(true);
    expect(esDelSitio({ titulo: "Teatro", localidad: "Astorga" }, "Boñar")).toBe(false);
  });

  it("reconoce un evento por su nombre aproximado", () => {
    expect(parecido("el mercadillo de Valencia", "Mercadillo semanal de Valencia de Don Juan")).toBeGreaterThanOrEqual(0.6);
    expect(parecido("concierto de rock", "Feria del pimiento")).toBe(0);
  });
});

describe("👔 El jefe contesta", () => {
  it("si no tiene nada del pueblo, lo busca ahora, lo comprueba, lo sube y te lo dice", async () => {
    respuestas.push(
      ia({ tipo: "pregunta", tema: "planes", sitio: "Boñar", que: null }),
      { texto: JSON.stringify([{ titulo: "Magosto popular de Boñar", fecha: dia(0), hora: "18:00", lugar: "Plaza del Ayuntamiento", localidad: "Boñar", fuente: "https://aytobonar.example/magosto" }]), dominios: new Set(["aytobonar.example"]) },
      ia("📅 Hoy a las 18:00 Magosto popular de Boñar…"),
    );
    const avisos = [];
    const r = await hablarConJefe("¿Qué planes tienes esta semana sobre Boñar?", { desde: "telegram", avisar: async (t) => avisos.push(t) });
    expect(avisos[0]).toMatch(/Lo busco ahora/);
    expect(r.buscado).toMatchObject({ hecho: true, nuevos: 1 });
    expect(r.respuesta).toMatch(/Magosto/);
    // Lo que se le pasa a la IA para redactar lleva el evento real y la búsqueda hecha
    expect(prompts[1]).toMatch(/Boñar/);
    expect(prompts[2]).toMatch(/Magosto popular de Boñar/);
    expect(prompts[2]).toMatch(/se ha buscado en Google ahora mismo/);
    // Y queda en la agenda de la web para todo el mundo
    expect((await enAgenda()).map((e) => e.titulo)).toContain("Magosto popular de Boñar");
  });

  it("si ya lo tiene, contesta sin buscar (0 búsquedas)", async () => {
    await ev.sumarALaAgenda([{ titulo: "Mercado de Boñar", fecha: dia(0), localidad: "Boñar", fuente: "https://x.example/m", verificado: true }], dia(0), dia(20));
    respuestas.push(ia({ tipo: "pregunta", tema: "agenda", sitio: "Boñar" }), ia("Hoy hay mercado en Boñar."));
    const r = await hablarConJefe("¿qué hay hoy en Boñar?");
    expect(r.buscado).toBe(null);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/Mercado de Boñar/);
  });

  it("si ni buscando hay nada, lo dice y deja el encargo a Pueblos", async () => {
    respuestas.push(ia({ tipo: "pregunta", tema: "agenda", sitio: "Prioro" }), ia("[]"), ia("De Prioro no hay nada publicado."));
    const r = await hablarConJefe("¿hay algo en Prioro el finde?");
    expect(r.buscado).toMatchObject({ hecho: true, nuevos: 0, encargo: true });
    expect((await ev.leerEncargos()).pueblos[0].texto).toMatch(/Prioro/);
  });

  it("no pasa del tope de búsquedas al día", async () => {
    await comando(["SET", `jefe:busquedas:${hoyEnLeon()}`, String(BUSCA_AL_DIA)]);
    respuestas.push(ia({ tipo: "pregunta", tema: "agenda", sitio: "Sabero" }), ia("Hoy ya no busco más."));
    const r = await hablarConJefe("¿qué hay en Sabero?");
    expect(r.buscado).toMatchObject({ hecho: false, motivo: "tope" });
    expect(prompts).toHaveLength(2); // la pregunta y la respuesta: ninguna búsqueda
  });

  it("si la IA no contesta, al menos te da la lista tal cual", async () => {
    await ev.sumarALaAgenda([{ titulo: "Mercado de Boñar", fecha: dia(0), localidad: "Boñar", fuente: "https://x.example/m", verificado: true }], dia(0), dia(20));
    respuestas.push(ia({ tipo: "pregunta", tema: "agenda" }), new Error("caída"));
    const r = await hablarConJefe("¿qué hay hoy en Boñar?");
    expect(r.respuesta).toMatch(/Mercado de Boñar/);
  });

  it("«quita …» saca el evento de la web y no vuelve a entrar", async () => {
    const e = { titulo: "Mercadillo semanal de Valencia de Don Juan", fecha: dia(1), localidad: "Valencia de Don Juan", fuente: "https://x.example/v", verificado: true };
    await ev.sumarALaAgenda([e], dia(0), dia(20));
    respuestas.push(ia({ tipo: "quitar", texto: "el mercadillo de Valencia" }));
    const r = await hablarConJefe("quita el mercadillo de Valencia, no es cierto");
    expect(r.respuesta).toMatch(/Quitado/);
    expect((await enAgenda()).some((x) => x.titulo === e.titulo)).toBe(false);
    await ev.sumarALaAgenda([{ ...e, fuente: "https://otra.example/v" }], dia(0), dia(20));
    expect((await enAgenda()).some((x) => x.titulo === e.titulo)).toBe(false);
  });
});

describe("🕵️ Lo «por confirmar» se resuelve solo", () => {
  const subir = async (e) => {
    await ev.sumarALaAgenda([{ ...e, verificado: true, porConfirmar: true }], dia(0), dia(20));
    await ev.apuntarSinConfirmar([e]);
  };
  const ruta = { titulo: "Ruta guiada por el Curueño", fecha: dia(4), localidad: "La Vecilla", fuente: "https://www.facebook.com/ruta" };
  const verbena = { titulo: "Verbena de otoño", fecha: dia(5), localidad: "Cistierna", fuente: "https://www.facebook.com/verbena" };

  it("el Verificador vuelve a preguntar a Google: confirmado se queda sin marca, falso fuera", async () => {
    await subir(ruta); await subir(verbena);
    respuestas.push({ texto: JSON.stringify([{ n: 1, veredicto: "si", fuente: "https://diario.example/ruta" }, { n: 2, veredicto: "no", nota: "suspendida" }]), dominios: new Set(["diario.example"]) });
    const p = await segundaComprobacion();
    expect(p.repasados).toEqual({ confirmados: 1, quitados: 1 });
    const agenda = await enAgenda();
    expect(agenda.find((e) => e.titulo === ruta.titulo).porConfirmar).toBeUndefined();
    expect(agenda.some((e) => e.titulo === verbena.titulo)).toBe(false);
    expect(await ev.leerSinConfirmar()).toEqual([]);
  });

  it("lo que sigue sin aclararse no se vuelve a preguntar en el mismo día", async () => {
    await subir(ruta);
    respuestas.push({ texto: JSON.stringify([{ n: 1, veredicto: "nose" }]), dominios: new Set() });
    await segundaComprobacion();
    expect((await ev.leerSinConfirmar())[0].repaso).toBeTruthy();
    prompts.length = 0;
    await segundaComprobacion();
    expect(prompts).toHaveLength(0);
  });

  it("si vuelve a salir en otra web, se confirma solo", async () => {
    await subir(ruta);
    await ev.guardarDudosos([{ ...ruta, fuente: "https://otra.example/ruta", motivo: "duda" }]);
    expect(await ev.leerSinConfirmar()).toEqual([]);
    expect((await enAgenda()).find((e) => e.titulo === ruta.titulo).porConfirmar).toBeUndefined();
  });
});
