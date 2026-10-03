// npm test — Duplicados, horas y orden de la agenda
import { describe, expect, it } from "vitest";
import { agruparPorFranja, cuandoEs, deduplicar, leerHora, mismoEvento, ordenarPorHora } from "../src/lib/agenda";

describe("mismoEvento", () => {
  it("reconoce el mismo mercado con otro nombre", () => {
    expect(mismoEvento({ titulo: "Mercado de la Plaza Mayor" }, { titulo: "Mercadillo Plaza Mayor León" })).toBe(true);
  });

  it("no confunde un concierto con el mercado del mismo sitio", () => {
    expect(mismoEvento({ titulo: "Concierto en la Plaza Mayor" }, { titulo: "Mercado de la Plaza Mayor" })).toBe(false);
  });

  it("no junta el mercado semanal de dos pueblos distintos", () => {
    expect(mismoEvento({ titulo: "Mercado semanal", localidad: "Astorga" }, { titulo: "Mercado semanal", localidad: "La Bañeza" })).toBe(false);
  });

  it("reconoce un nombre contenido en otro más largo", () => {
    expect(mismoEvento({ titulo: "Vidrieras del Mundo" }, { titulo: "Exposición Vidrieras del Mundo en el Conde Luna" })).toBe(true);
  });
});

describe("deduplicar", () => {
  it("se queda con la versión más completa", () => {
    const pobre = { titulo: "Mercadillo Plaza Mayor" };
    const rica = { titulo: "Mercado de la Plaza Mayor", hora: "09:00", lugar: "Plaza Mayor", precio: "Gratis" };
    expect(deduplicar([pobre, rica])).toEqual([rica]);
  });
});

describe("leerHora", () => {
  it("entiende horas y rangos", () => {
    expect(leerHora("21:00")).toMatchObject({ min: 21 * 60, franja: "noche", texto: "21:00" });
    expect(leerHora("10h-14h")).toMatchObject({ min: 600, fin: 840, franja: "manana" });
    expect(leerHora("10:00 - 20:00")).toMatchObject({ franja: "todo" }); // abierto casi todo el día
  });

  it("entiende textos sin hora", () => {
    expect(leerHora("Por la tarde")).toMatchObject({ min: 17 * 60, franja: "tarde" });
    expect(leerHora("Todo el día")).toMatchObject({ min: null, franja: "todo" });
    expect(leerHora(null)).toMatchObject({ min: null, franja: "todo" });
  });
});

describe("ordenarPorHora y agruparPorFranja", () => {
  const lista = [
    { titulo: "Concierto de rock", hora: "22:00" },
    { titulo: "Exposición de vidrieras", hora: "Todo el día" },
    { titulo: "Ruta guiada por el casco", hora: "11:00" },
    { titulo: "Teatro infantil", hora: "18:00" },
  ];

  it("ordena: todo el día, mañana, tarde y noche", () => {
    expect(ordenarPorHora(lista).map((e) => e.hora)).toEqual(["Todo el día", "11:00", "18:00", "22:00"]);
  });

  it("agrupa solo las franjas que tienen algo", () => {
    expect(agruparPorFranja(lista).map((g) => g.id)).toEqual(["todo", "manana", "tarde", "noche"]);
    expect(agruparPorFranja([lista[0]]).map((g) => g.id)).toEqual(["noche"]);
  });
});

describe("cuandoEs", () => {
  it("describe lo que se repite cada semana", () => {
    expect(cuandoEs({ diasSemana: [6, 3] })).toBe("Todos los miércoles y sábados");
  });
});
