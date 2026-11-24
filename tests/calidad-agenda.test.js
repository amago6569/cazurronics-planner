// npm test — Calidad de la agenda (24-11-2026, medida en la web real: 471 planes):
//  · 87 tenían por «fuente» una búsqueda de Google, que siempre «existe» y repite lo que se le pidió → pasaban por comprobados.
//  · 36 repetidos: mismo nombre con otra categoría, y lo de un día que ya salía en «en marcha».
//  · 13 de fuera de León: Valdemoro, El Burgo de Osma, Ciudad Rodrigo, Astudillo, «León (Guanajuato)»…
import { beforeEach, describe, expect, it, vi } from "vitest";

const prompts = [];
let respuesta = "[]";
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async (prompt) => { prompts.push(prompt); return { texto: respuesta, dominios: new Set(["google.com"]) }; }),
}));
const paginas = {};
const abiertas = [];
vi.stubGlobal("fetch", vi.fn(async (url) => {
  abiertas.push(url);
  if (paginas[url] == null) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  return { status: 200, ok: true, body: null, json: async () => ({}), text: async () => paginas[url] };
}));

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon } = await import("../src/lib/estadisticas");
const ev = await import("../src/lib/eventos");
const { segundaComprobacion, leerVeredictos } = await import("../src/lib/guardia");
const { esBuscador, desenvolverEnlace, websDistintas } = await import("../src/lib/fiables");
const { mismoEvento, organizarAgenda, deduplicar } = await import("../src/lib/agenda");
const { calcularFinde } = await import("../src/lib/finde");

const dia = (n, desde = hoyEnLeon()) => { const d = new Date(`${desde}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const BUSQUEDA = "https://www.google.com/search?q=Exposici%C3%B3n+Mineras+Sabero+2026";

beforeEach(async () => {
  prompts.length = 0; abiertas.length = 0; respuesta = "[]";
  for (const k of Object.keys(paginas)) delete paginas[k];
  for (const k of ["eventos:bandeja", "eventos:tirados", "eventos:sinConfirmar", "oficina:charla", `ia:gratis:${hoyEnLeon()}`]) await comando(["DEL", k]);
  for (let i = 0; i < 21; i++) await comando(["DEL", `eventos:${dia(i)}`]);
});

describe("una búsqueda de Google no es una fuente", () => {
  it("reconoce búsquedas, mapas y acortadores, pero no Google Sites ni Docs", () => {
    expect(esBuscador(BUSQUEDA)).toBe(true);
    expect(esBuscador("https://www.google.es/maps/place/Sabero")).toBe(true);
    expect(esBuscador("https://maps.app.goo.gl/abc")).toBe(true);
    expect(esBuscador("https://www.bing.com/search?q=feria")).toBe(true);
    expect(esBuscador("https://sites.google.com/view/aytoboñar")).toBe(false);
    expect(esBuscador("https://docs.google.com/document/d/x")).toBe(false);
    expect(esBuscador("https://www.ileon.com/agenda")).toBe(false);
  });

  it("google.com/url?q=… se cambia por la web de verdad", () => {
    expect(desenvolverEnlace("https://www.google.com/url?q=https://www.sahagundigital.com/agenda&sa=D")).toBe("https://www.sahagundigital.com/agenda");
    const e = ev.validarEventoIA({ titulo: "Concurso", fecha: dia(2), localidad: "Sahagún", fuente: "https://www.google.com/url?q=https://www.sahagundigital.com/agenda" }, hoyEnLeon(), dia(20));
    expect(e.fuente).toBe("https://www.sahagundigital.com/agenda");
  });

  it("al barrer, no se da por comprobada (aunque Google «consultara» google.com): va a la bandeja y ni se abre", async () => {
    const lista = [{ titulo: "Mineras: femenino plural", fecha: dia(1), localidad: "Sabero", fuente: BUSQUEDA }];
    const { buenos, descartados } = await ev.verificarFuentes(lista, new Set(["google.com"]));
    expect(buenos).toHaveLength(0);
    expect(descartados.map((e) => e.motivo)).toEqual(["duda"]);
    expect(abiertas).not.toContain(BUSQUEDA);
  });

  it("un buscador no cuenta como segunda web", () => {
    expect(websDistintas({ fuente: BUSQUEDA, fuentesVistas: ["https://www.ileon.com/x"] })).toBe(1);
  });

  it("el Verificador no la lee ni la acepta como prueba", async () => {
    // Su página repetiría el nombre, el pueblo y la fecha: antes salía «la página lo dice»
    paginas[BUSQUEDA] = `Mineras Sabero ${dia(1)} - Buscar con Google`;
    const v = await leerVeredictos(JSON.stringify([{ n: 1, veredicto: "si", fuente: BUSQUEDA }]), new Set(["google.com"]), [{ titulo: "x" }], async () => "ok");
    expect(v[0].decision).toBe("porConfirmar");
    const v2 = await leerVeredictos(JSON.stringify([{ n: 1, veredicto: "si", fuente: "https://www.google.com/url?q=https://www.msmsabero.es/mineras" }]), new Set(), [{ titulo: "x" }], async () => "ok");
    expect(v2[0]).toEqual({ decision: "confirmado", fuente: "https://www.msmsabero.es/mineras" });
  });

  it("lo ya subido con una búsqueda por fuente pasa a la bandeja (8 por turno); lo «por confirmar» se queda", async () => {
    const hoy = hoyEnLeon();
    const nombres = ["Mineras", "Carbón vivo", "Pozo Herrera", "Lámparas", "Castilletes", "Vagonetas", "Escuela de capataces", "Ferrería", "Picadores", "Hulleras"];
    const subidos = nombres.map((n, i) => ({ titulo: `${n}`, categoria: "exposicion", fecha: hoy, fechaFin: dia(10), permanente: true, localidad: "Sabero", fuente: `${BUSQUEDA}+${i}`, verificado: true }));
    await ev.sumarALaAgenda([...subidos, { titulo: "Belén de Cistierna", fecha: hoy, localidad: "Cistierna", fuente: BUSQUEDA, verificado: true, porConfirmar: true }, { titulo: "Magosto de Boñar", fecha: hoy, localidad: "Boñar", fuente: "https://www.ileon.com/magosto", verificado: true }], hoy, dia(20));
    const r = await ev.pasarBuscadoresALaBandeja();
    expect(r.pasados).toBe(8);
    const quedan = (await ev.eventosDelDia(hoy)).map((e) => e.titulo);
    expect(quedan).toContain("Belén de Cistierna");
    expect(quedan).toContain("Magosto de Boñar");
    expect(quedan.filter((t) => nombres.includes(t))).toHaveLength(2);
    expect((await ev.leerBandeja()).length).toBe(8);
  });

  it("en el turno siguiente, el Verificador pregunta a Google por ellos en vez de darlos por buenos", async () => {
    const hoy = hoyEnLeon();
    await ev.sumarALaAgenda([{ titulo: "Mineras: femenino plural", fecha: hoy, fechaFin: dia(10), permanente: true, localidad: "Sabero", fuente: BUSQUEDA, verificado: true }], hoy, dia(20));
    await segundaComprobacion(); // este turno lo pasa a la bandeja
    expect((await ev.leerBandeja()).map((e) => e.titulo)).toEqual(["Mineras: femenino plural"]);
    respuesta = JSON.stringify([{ n: 1, veredicto: "si", fuente: "https://www.msmsabero.es/mineras" }]);
    paginas["https://www.msmsabero.es/mineras"] = "ok";
    const parte = await segundaComprobacion();
    expect(prompts.some((p) => /Mineras/.test(p))).toBe(true);
    expect(parte.confirmados).toBe(1);
    const enLaWeb = (await ev.eventosDelDia(hoy)).find((e) => e.titulo === "Mineras: femenino plural");
    expect(enLaWeb.fuente).toBe("https://www.msmsabero.es/mineras");
  });
});

describe("repetidos en la agenda", () => {
  it("mismo nombre y mismo sitio con distinta categoría: el mismo evento", () => {
    const a = { titulo: "Pabellón Retro de León", localidad: "León", categoria: "exposicion" };
    const b = { titulo: "Pabellón Retro de León", localidad: "León", categoria: "feria" };
    expect(mismoEvento(a, b)).toBe(true);
    expect(deduplicar([a, b, { ...a, categoria: "otro" }])).toHaveLength(1);
  });

  it("mismo pueblo, aunque cada copia venga de la búsqueda de una zona distinta", () => {
    const a = { titulo: "Fiestas de Santa Bárbara", localidad: "Matarrosa del Sil", zonaBusqueda: "bierzo", fecha: "2030-12-04" };
    const b = { ...a, zonaBusqueda: "laciana", fechaFin: "2030-12-06" };
    expect(mismoEvento(a, b)).toBe(true);
    expect(mismoEvento({ titulo: "Mercado semanal", localidad: "Astorga" }, { titulo: "Mercado semanal", localidad: "La Bañeza" })).toBe(false);
  });

  it("pero un concierto y un mercado en la misma plaza siguen siendo distintos", () => {
    expect(mismoEvento({ titulo: "Concierto en la Plaza Mayor", localidad: "León" }, { titulo: "Mercado de la Plaza Mayor", localidad: "León" })).toBe(false);
    expect(mismoEvento({ titulo: "Pabellón Retro", localidad: "León" }, { titulo: "Pabellón Retro", localidad: "Ponferrada" })).toBe(false);
  });

  it("lo de un día que ya sale en «en marcha» no se repite abajo", () => {
    const hoy = hoyEnLeon();
    const mercado = { titulo: "Mercadillo de Toreno", localidad: "Toreno", fecha: hoy, fechaFin: dia(20), diasSemana: [0], categoria: "mercado" };
    const suelto = { titulo: "Mercadillo de Toreno", localidad: "Toreno", fecha: dia(5), hora: "10:00", categoria: "mercado" };
    const concierto = { titulo: "Vangoura en concierto", localidad: "León", fecha: dia(5), hora: "21:00", categoria: "concierto" };
    const agenda = organizarAgenda([{ fecha: hoy, eventos: [mercado] }, { fecha: dia(5), eventos: [mercado, suelto, concierto] }]);
    expect(agenda.enMarcha.map((e) => e.titulo)).toEqual(["Mercadillo de Toreno"]);
    expect(agenda.porDia.flatMap((d) => d.grupos.flatMap((g) => g.eventos)).map((e) => e.titulo)).toEqual(["Vangoura en concierto"]);
  });

  it("en el resumen del finde, igual", () => {
    // Un viernes cualquiera: el finde es viernes, sábado y domingo
    const viernes = "2030-11-22";
    const feria = { titulo: "Feria Agroalimentaria", localidad: "Sariegos", fecha: viernes, fechaFin: "2030-11-24", categoria: "feria" };
    const suelta = { titulo: "Feria Agroalimentaria", localidad: "Sariegos", fecha: "2030-11-24", categoria: "feria", hora: "11:00" };
    const finde = calcularFinde([{ fecha: viernes, eventos: [feria] }, { fecha: "2030-11-23", eventos: [feria] }, { fecha: "2030-11-24", eventos: [feria, suelta] }], viernes);
    expect(finde.total).toBe(1);
  });
});

describe("solo León", () => {
  it("aparta pueblos de otras provincias que no estaban en la lista de siempre", () => {
    for (const localidad of ["Valdemoro", "El Burgo de Osma", "Ciudad Rodrigo", "Astudillo", "Carrión de los Condes", "Santovenia de Pisuerga", "San Cristóbal de Entreviñas", "León (Guanajuato)", "León, Guanajuato"]) {
      expect(ev.deOtraProvincia({ localidad, fuente: "https://cultura.jcyl.es/agenda" }), localidad).toBe(true);
    }
  });

  it("deja los de León, sus comarcas y pueblos que se llaman como uno de fuera", () => {
    for (const localidad of ["León", "La Cabrera", "Luna", "Babia", "Boñar", "Matarrosa del Sil", "El Acebo", "Valencia de Don Juan", "La Antigua", "Irede de Luna", "Balboa, Barjas, Trabadelo, Vega de Valcarce", "Provincia de León"]) {
      expect(ev.deOtraProvincia({ localidad, fuente: "https://cultura.jcyl.es/agenda" }), localidad).toBe(false);
    }
  });

  it("si el enlace es de una web de León, un nombre dudoso se queda", () => {
    expect(ev.deOtraProvincia({ localidad: "Santa Marta", fuente: "https://www.ileon.com/agenda/x" })).toBe(false);
    expect(ev.deOtraProvincia({ localidad: "Santa Marta", fuente: "https://www.canalcampotv.com/x" })).toBe(true);
  });

  it("no entra al barrer y sale de lo ya guardado", async () => {
    expect(ev.validarEventoIA({ titulo: "Tendido 4", fecha: dia(2), localidad: "Valdemoro", fuente: "https://www.valdemoro.es/agenda" }, hoyEnLeon(), dia(20))).toBeNull();
    await comando(["SET", `eventos:${dia(1)}`, JSON.stringify([
      { titulo: "Mua. mua.", fecha: dia(1), localidad: "El Burgo de Osma", fuente: "https://cultura.jcyl.es/x" },
      { titulo: "Cuentacuentos", fecha: dia(1), localidad: "Cistierna", fuente: "https://cultura.jcyl.es/y" },
    ])]);
    expect((await ev.eventosDelDia(dia(1))).map((e) => e.titulo)).toEqual(["Cuentacuentos"]);
  });
});
