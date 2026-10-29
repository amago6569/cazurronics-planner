// npm test — Fechas del finde, eventos de la IA y fusión de la agenda por días
import { describe, expect, it } from "vitest";
import { fechasDelFinde, rangoTexto } from "../src/lib/finde";
import { extraerListaJSON, fusionarPorDia, validarEventoIA } from "../src/lib/eventos";
import { zonaDe } from "../src/lib/zonas";

describe("fechasDelFinde", () => {
  // 2026-10-05 es lunes
  it("de lunes a jueves: el viernes que viene", () => {
    expect(fechasDelFinde("2026-10-05")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(fechasDelFinde("2026-10-08")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  });
  it("viernes: los tres días; sábado: sábado y domingo", () => {
    expect(fechasDelFinde("2026-10-09")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(fechasDelFinde("2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("domingo: el fin de semana siguiente", () => {
    expect(fechasDelFinde("2026-10-11")).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
  });
  it("escribe el rango corto", () => {
    expect(rangoTexto(["2026-10-09", "2026-10-10", "2026-10-11"])).toBe("vie 9 – dom 11 oct");
  });
});

describe("validarEventoIA", () => {
  const base = { titulo: "Concierto", fecha: "2026-10-10", fuente: "https://www.aytoleon.es/agenda/1" };

  it("acepta un evento con fecha y fuente reales", () => {
    expect(validarEventoIA(base, "2026-10-05", "2026-10-18")).toMatchObject({ titulo: "Concierto", fecha: "2026-10-10", origen: "web" });
  });
  it("descarta lo que no trae una fuente verificable", () => {
    expect(validarEventoIA({ ...base, fuente: null }, "2026-10-05", "2026-10-18")).toBeNull();
    expect(validarEventoIA({ ...base, fuente: "https://vertexaisearch.cloud.google.com/x" }, "2026-10-05", "2026-10-18")).toBeNull();
  });
  it("descarta lo que cae fuera de la ventana", () => {
    expect(validarEventoIA({ ...base, fecha: "2026-11-30" }, "2026-10-05", "2026-10-18")).toBeNull();
  });
  it("un mercado semanal vale para toda la ventana", () => {
    expect(validarEventoIA({ ...base, fecha: null, diasSemana: [3, "sábado"] }, "2026-10-05", "2026-10-18"))
      .toMatchObject({ fecha: "2026-10-05", fechaFin: "2026-10-18", diasSemana: [3, 6] });
  });
});

describe("extraerListaJSON", () => {
  it("devuelve [] (nunca null) si la IA no trae lista", () => {
    expect(extraerListaJSON("nada por aquí")).toEqual([]);
  });
});

describe("fusionarPorDia", () => {
  it("reparte un mercado semanal solo en sus días", () => {
    const mercado = { titulo: "Mercado de abastos", fecha: "2026-10-05", fechaFin: "2026-10-11", diasSemana: [3, 6], fuente: "https://x.es" };
    expect(Object.keys(fusionarPorDia([[mercado]], "2026-10-05", "2026-10-18")).sort()).toEqual(["2026-10-07", "2026-10-10"]);
  });
  it("no duplica el mismo evento que llega dos veces", () => {
    const a = { titulo: "Teatro: La Celestina", fecha: "2026-10-10", hora: "20:00", fuente: "https://x.es" };
    const b = { titulo: "La Celestina (teatro)", fecha: "2026-10-10", fuente: "https://y.es" };
    expect(fusionarPorDia([[a], [b]], "2026-10-05", "2026-10-18")["2026-10-10"]).toHaveLength(1);
  });
});

describe("zonaDe", () => {
  it("sitúa cada evento en su comarca", () => {
    expect(zonaDe({ titulo: "Fiestas", localidad: "Ponferrada" })).toBe("bierzo");
    expect(zonaDe({ titulo: "Concierto", localidad: "León" })).toBe("leon");
    expect(zonaDe({ titulo: "Cata de vinos del Bierzo", localidad: "León" })).toBe("leon");
    expect(zonaDe({ titulo: "Ruta", lat: 42.4577, lon: -6.0563 })).toBe("astorga");
  });
});

describe("teatros y auditorios", () => {
  it("el barrido diario tiene su tramo de teatros (6 búsquedas: capital y provincia, tres semanas)", async () => {
    const { definirTramos, TRAMOS_DIARIOS } = await import("../src/lib/eventos");
    expect(TRAMOS_DIARIOS).toContain("d5");
    const d5 = definirTramos("2026-10-08").find((t) => t.id === "d5");
    expect(d5.busquedas).toHaveLength(6);
    expect(d5.busquedas.every((b) => /obra/.test(b.extra) && b.desde && b.hasta)).toBe(true);
  });

  it("si la agenda no cabe, reparte los huecos entre todos los tipos (la obra de teatro también entra)", async () => {
    const { eventosParaPrompt } = await import("../src/lib/eventos");
    const conciertos = Array.from({ length: 40 }, (_, i) => ({ titulo: `Grupo ${i} en directo`, categoria: "concierto", hora: "10:00", lugar: `Bar ${i}`, fecha: "2026-10-10", fuente: "https://x.es" }));
    const obra = { titulo: "La vida es sueño", categoria: "teatro", hora: "21:00", lugar: "Teatro El Albéitar", fecha: "2026-10-10", fuente: "https://x.es" };
    const texto = eventosParaPrompt([...conciertos, obra], 30);
    expect(texto).toContain("La vida es sueño");
    expect(texto.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(30);
  });
});

describe("oficina: empleados del barrido", () => {
  it("12 empleados por tipo, cada uno con capital y provincia y tres semanas (6 búsquedas)", async () => {
    const { definirTramos, TIPOS } = await import("../src/lib/eventos");
    const tramos = definirTramos("2026-10-28");
    const porTipo = tramos.filter((t) => t.id.startsWith("t")).flatMap((t) => t.busquedas);
    expect(TIPOS).toHaveLength(12);
    for (const tipo of TIPOS) expect(porTipo.filter((b) => b.empleado === tipo.id)).toHaveLength(6);
    expect(tramos.every((t) => t.busquedas.length <= 10)).toBe(true); // cada tramo cabe en el minuto de Vercel
  });

  it("los pueblos van de uno en uno: una búsqueda por municipio, con sus pedanías", async () => {
    const { definirTramos } = await import("../src/lib/eventos");
    const { MUNICIPIOS } = await import("../src/lib/zonas");
    const pueblos = definirTramos("2026-10-28").filter((t) => t.id.startsWith("m")).flatMap((t) => t.busquedas).filter((b) => b.empleado === "pueblos");
    expect(pueblos).toHaveLength(Object.values(MUNICIPIOS).flat().length);
    const valderrueda = pueblos.find((b) => b.municipio === "Valderrueda");
    expect(valderrueda.tema).toMatch(/pedanías/);
    expect(valderrueda.hasta).toBe("2026-11-17"); // 21 días: esta semana y las dos siguientes
  });

  it("no le pide a la IA que reescriba lo que ya está en la agenda de esa zona", async () => {
    const { yaConocidos } = await import("../src/lib/eventos");
    const agenda = [
      { fecha: "2026-10-30", eventos: [
        { titulo: "Magosto de Morgovejo", fecha: "2026-10-30", localidad: "Morgovejo, Valderrueda" },
        { titulo: "Concierto en el Húmedo", fecha: "2026-10-30", localidad: "León" },
      ] },
      { fecha: "2026-12-01", eventos: [{ titulo: "Fuera de fechas", fecha: "2026-12-01", localidad: "Valderrueda" }] },
    ];
    expect(yaConocidos(agenda, { desde: "2026-10-28", hasta: "2026-11-17", zona: "leon" })).toEqual(["Concierto en el Húmedo (2026-10-30, León)"]);
    expect(yaConocidos(agenda, { desde: "2026-10-28", hasta: "2026-11-17", municipio: "Valderrueda" })).toEqual(["Magosto de Morgovejo (2026-10-30, Morgovejo, Valderrueda)"]);
  });

  it("suma lo que ha hecho cada empleado aunque vaya en varios tramos", async () => {
    const { partesPorEmpleado } = await import("../src/lib/eventos");
    const p = partesPorEmpleado([
      { fin: "2026-10-28T03:00:00Z", fuentes: { a: { ok: true, empleado: "musica", eventos: 5, descartados: 1 }, b: { ok: false, empleado: "musica" } } },
      { fin: "2026-10-28T04:00:00Z", fuentes: { c: { ok: true, empleado: "musica", eventos: 2 } } },
    ]);
    expect(p.musica).toEqual({ busquedas: 3, eventos: 7, descartados: 1, errores: 1, fin: "2026-10-28T04:00:00Z" });
  });
});

describe("extraerListaJSON con respuesta cortada", () => {
  it("se queda con los eventos completos", async () => {
    const { extraerListaJSON } = await import("../src/lib/eventos");
    expect(extraerListaJSON('[{"titulo":"A"},{"titulo":"B"},{"titu')).toEqual([{ titulo: "A" }, { titulo: "B" }]);
  });
});

describe("oficina: parte del jefe", () => {
  it("duerme quien se salta su turno, echa humo quien falla y el jefe lo cuenta", async () => {
    const { montarOficina } = await import("../src/lib/oficina");
    const ahora = Date.parse("2026-10-28T12:00:00Z");
    const o = montarOficina({
      musica: { fin: "2026-10-28T03:00:00Z", busquedas: 6, eventos: 12, descartados: 1, errores: 0 },
      noche: { fin: "2026-10-25T03:00:00Z", busquedas: 6, eventos: 3, descartados: 0, errores: 0 },
      pueblos: { fin: "2026-10-28T03:00:00Z", busquedas: 10, eventos: 4, descartados: 0, errores: 8 },
    }, { bandeja: 2, agenda: 140 }, ahora);
    const mesa = (id) => o.departamentos.flatMap((d) => d.empleados).find((e) => e.id === id);
    expect(mesa("musica").estado).toBe("ok");
    expect(mesa("noche").estado).toBe("tarde");
    expect(mesa("pueblos").estado).toBe("error");
    expect(mesa("teatros").estado).toBe("nuevo");
    expect(o.jefe.lineas.join(" ")).toMatch(/Van con retraso: Noche/);
    expect(o.jefe.lineas.join(" ")).toMatch(/2 eventos esperan la segunda comprobación del Verificador/);
    expect(o.jefe.cifras.equipo).toBe(25);
  });
});
