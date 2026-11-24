import { describe, expect, it } from "vitest";
import { paradasPedidas, pideAgenda, esDelTipo } from "../src/lib/intencion";
import { bloquePedido, completarPedido, duraHoras, elegirMasEseDia, quitarPasados, separarRepetidos } from "../src/lib/montarPlan";
import { ajustarAlPresupuesto } from "../src/lib/planUtils";
import { fechaAyto, horaAyto, leerAgendaAyto } from "../src/lib/fuenteAyto";

describe("cuántos sitios pide", () => {
  it("lee el número y el tipo", () => {
    expect(paradasPedidas("necesito 4 bares para salir a tomar algo")).toMatchObject({ n: 4, tipo: "bar" });
    expect(paradasPedidas("cuatro buenos bares")).toMatchObject({ n: 4, tipo: "bar" });
    expect(paradasPedidas("un par de bares de tapas")).toMatchObject({ n: 2, tipo: "bar" });
    expect(paradasPedidas("4 sitios para tomar algo")).toMatchObject({ n: 4, tipo: "bar" });
    expect(paradasPedidas("cenar y luego 3 bares")).toMatchObject({ n: 3, tipo: "bar" });
    expect(paradasPedidas("3 restaurantes para elegir")).toMatchObject({ n: 3, tipo: "restaurante" });
    expect(paradasPedidas("20 bares")).toMatchObject({ n: 8 });
  });
  it("ruta de bares o salir a tomar algo sin número = 3", () => {
    expect(paradasPedidas("ruta de tapas por el Húmedo")).toMatchObject({ n: 3, tipo: "bar" });
    expect(paradasPedidas("salir a tomar algo")).toMatchObject({ n: 3, tipo: "bar" });
  });
  it("no se confunde", () => {
    expect(paradasPedidas("para 4 personas un bar")).toBeNull();
    expect(paradasPedidas("un bar para ver el partido")).toBeNull();
    expect(paradasPedidas("tomar dos cafés")).toBeNull();
    expect(paradasPedidas("comer cocido")).toBeNull();
  });
  it("el prompt pide exactamente N", () => {
    expect(bloquePedido({ n: 4, tipo: "bar", plural: "bares" })).toContain("EXACTAMENTE 4");
    expect(bloquePedido(null)).toBe("");
  });
  it("un pub cuenta como bar", () => {
    expect(esDelTipo({ tipo: "pub" }, "bar")).toBe(true);
    expect(esDelTipo({ tipo: "restaurante" }, "bar")).toBe(false);
  });
  it("el presupuesto no baja de lo pedido", () => {
    const bares = [1, 2, 3, 4].map((i) => ({ titulo: `Bar ${i}`, precio: "15€" }));
    expect(ajustarAlPresupuesto(bares, 50)).toHaveLength(3);
    expect(ajustarAlPresupuesto(bares, 50, 4)).toHaveLength(4);
  });
});

describe("qué hay hoy", () => {
  it("detecta que pide la agenda", () => {
    expect(pideAgenda("qué hay hoy en León")).toBe(true);
    expect(pideAgenda("qué hacer este sábado")).toBe(true);
    expect(pideAgenda("qué conciertos hay hoy")).toBe(false);
    expect(pideAgenda("4 bares")).toBe(false);
  });
  it("una feria de las 10:00 sigue a las 16:00; una charla no", () => {
    const ahora = new Date("2026-11-21T15:00:00Z"); // 16:00 en León
    const agenda = [
      { titulo: "Expojoven 2026", hora: "10:00", categoria: "otro" },
      { titulo: "Charla de la mañana", hora: "10:00" },
      { titulo: "Magosto", hora: "15:30", categoria: "fiesta" },
      { titulo: "Concierto de Alice Wonder", hora: "21:30" },
    ];
    expect(quitarPasados(agenda, "2026-11-21", ahora).map((e) => e.titulo)).toEqual(["Expojoven 2026", "Magosto", "Concierto de Alice Wonder"]);
    expect(duraHoras({ titulo: "Feria del Bienestar Animal" })).toBe(true);
    expect(duraHoras({ titulo: "Concierto" })).toBe(false);
  });
  it("Más cosas ese día: lo de ese día antes que lo de siempre", () => {
    const visitas = Array.from({ length: 12 }, (_, i) => ({ titulo: `Visita ${i}`, permanente: true, categoria: "visita" }));
    const lista = [...visitas, { titulo: "Concierto", hora: "21:30", categoria: "concierto" }, { titulo: "Expojoven", hora: "10:00" }];
    const elegidos = elegirMasEseDia(lista, 12).map((e) => e.titulo);
    expect(elegidos).toContain("Concierto");
    expect(elegidos).toContain("Expojoven");
    expect(elegidos).toHaveLength(12);
  });
});

describe("cuatro bares distintos", () => {
  const contexto = { lat: 42.5987, lon: -5.5671, radio: 15, nombreZona: "León", limite: Date.now() + 60000 };
  // Google de mentira: cada búsqueda da el primer local que no esté excluido
  const locales = ["A", "B", "C", "D", "E", "F"].map((n, i) => ({ placeId: `p${n}`, nombre: `Bar ${n}`, lat: 42.5987 + i * 0.001, lon: -5.5671 }));
  const falsoGoogle = async (p, ctx) => {
    const libres = locales.filter((x) => !ctx.excluir?.has(x.placeId));
    const l = libres.find((x) => x.nombre === p.titulo) || libres[0];
    return { parada: l ? { ...p, titulo: l.nombre, placeId: l.placeId, lat: l.lat, lon: l.lon } : null };
  };

  it("dos paradas que caen en el mismo local se separan", async () => {
    const originales = [{ titulo: "Bar en León", tipo: "bar" }, { titulo: "Bar en León", tipo: "bar" }];
    const enriquecidas = await Promise.all(originales.map((p) => falsoGoogle(p, contexto)));
    expect(enriquecidas[0].parada.placeId).toBe(enriquecidas[1].parada.placeId);
    await separarRepetidos(enriquecidas, originales, contexto, falsoGoogle);
    expect(enriquecidas[0].parada.placeId).not.toBe(enriquecidas[1].parada.placeId);
  });

  it("si la IA da 1, se completa hasta 4 sin repetir y a horas seguidas", async () => {
    const ruta = [{ titulo: "Bar A", tipo: "bar", placeId: "pA", hora: "20:00", lat: 42.5987, lon: -5.5671 }];
    const sitios = [{ n: "Bar B", t: "bar", la: 42.5997, lo: -5.5671, p: "3€" }, { n: "Bar A", t: "bar", la: 42.5987, lo: -5.5671 }];
    const n = await completarPedido(ruta, { n: 4, tipo: "bar", plural: "bares" }, { sitios, contexto, fecha: "2030-01-05" }, falsoGoogle);
    expect(n).toBe(3);
    expect(ruta).toHaveLength(4);
    expect(new Set(ruta.map((p) => p.placeId)).size).toBe(4);
    expect(ruta.map((p) => p.hora)).toEqual(["20:00", "20:50", "21:40", "22:30"]);
    expect(ruta[1].transporte).toMatch(/andando/);
  });
});

describe("agenda del Ayuntamiento de León", () => {
  const fila = (dia, mes, titulo, hora, lugar) => `<a><div class="row listitem-row">
        <div class="col-3"><div class="shortpoint-listitem-date">
            <div class="listitem-date-day">${dia}</div>
            <div class="listitem-date-month">${mes}</div>
        </div></div>
        <div class="col-9">
          <div class="listitem-title">${titulo}</div>
          <div class="listitem-subtitle" style="color:  #9e9e9e;"><i class="bi bi-clock"></i>
                ${hora}
                <i class="bi bi-geo-alt"></i> ${lugar}</div>
        </div>
      </div></a>`;
  const html = [
    fila(23, "NOV.", "Consejo de Administración de Aguas de León.", "13:00", "Sala de Comisiones. San Marcelo"),
    fila(21, "NOV.", "Expojoven", "11:00", "Palacio de Congresos y Exposiciones"),
    fila(29, "NOV.", "Encendido navideño", "18:30", "Plaza de Santo Domingo"),
    fila(3, "NOV.", "Pleno Extraordinario de sorteo de las mesas electorales", "8:30", "Salón de Plenos. San Marcelo."),
  ].join("");

  it("saca los actos de ocio y tira los de despacho", () => {
    const eventos = leerAgendaAyto(html, { hoy: "2026-11-21", fuente: "https://www.aytoleon.es/x" });
    expect(eventos.map((e) => e.titulo)).toEqual(["Expojoven", "Encendido navideño"]);
    expect(eventos[0]).toMatchObject({ fecha: "2026-11-21", hora: "11:00", lugar: "Palacio de Congresos y Exposiciones", localidad: "León", categoria: "feria" });
    expect(eventos[1].categoria).toBe("fiesta");
  });
  it("horas raras y año", () => {
    expect(horaAyto("9.30")).toBe("09:30");
    expect(horaAyto("8;30")).toBe("08:30");
    expect(horaAyto("12:30 horas")).toBe("12:30");
    expect(horaAyto("24:00")).toBe("00:00");
    expect(fechaAyto(3, 1, "2026-12-20")).toBe("2027-01-03");
    expect(fechaAyto(21, 11, "2026-11-21")).toBe("2026-11-21");
  });
});
