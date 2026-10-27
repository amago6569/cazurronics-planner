import { describe, it, expect } from "vitest";
import { filtrarMasEseDia, fuentesPara, palabrasClave } from "../src/lib/intencion";

describe("palabras clave de lo que pide la persona", () => {
  it("se queda con el tema y quita el relleno", () => {
    expect(palabrasClave("¿Hay alguna charla esta tarde cerca?")).toEqual(["charla"]);
    expect(palabrasClave("Quiero ver un partido de baloncesto")).toEqual(["partido", "baloncesto"]);
  });
});

describe("fuentes según el tema", () => {
  it("charlas: universidad y bibliotecas", () => {
    const f = fuentesPara("alguna charla o conferencia");
    expect(f).toMatch(/Universidad de León/);
    expect(f).toMatch(/bibliotecas/);
  });
  it("deporte: clubes y federaciones", () => {
    expect(fuentesPara("ver el partido de la Cultural")).toMatch(/federaciones/);
  });
  it("comida: jornadas y reseñas", () => {
    expect(fuentesPara("comer un buen cocido")).toMatch(/jornadas gastronómicas/);
  });
  it("no se confunde con trozos de otras palabras", () => {
    expect(fuentesPara("quiero disfrutar el martes por la tarde")).toBe("");
    expect(fuentesPara("una escena de teatro")).not.toMatch(/jornadas gastronómicas/);
    expect(fuentesPara("cenar y unas tapas")).toMatch(/jornadas gastronómicas/);
  });
  it("sin tema claro no añade nada", () => {
    expect(fuentesPara("sorpréndeme")).toBe("");
  });
});

describe("Más cosas ese día", () => {
  const agenda = [
    { titulo: "Charla sobre el Reino de León", categoria: "otro" },
    { titulo: "Concierto de jazz", categoria: "concierto" },
    { titulo: "Mercadillo de Santa Ana", categoria: "mercado" },
    { titulo: "Conferencia de astronomía", categoria: "otro", descripcion: "Charla divulgativa" },
  ];

  it("plan concreto: solo lo parecido a lo pedido", () => {
    const plan = [{ titulo: "Charla en la Universidad", tipo: "evento" }];
    const r = filtrarMasEseDia(agenda, plan, "¿hay alguna charla?");
    expect(r.map((e) => e.titulo)).toEqual(["Charla sobre el Reino de León", "Conferencia de astronomía"]);
  });

  it("plan concreto: también lo del mismo tipo", () => {
    const plan = [{ titulo: "Jazz en el Gran Café", tipo: "concierto" }];
    expect(filtrarMasEseDia(agenda, plan, "música en directo").map((e) => e.titulo)).toEqual(["Concierto de jazz"]);
  });

  it("un tipo genérico como evento no deja pasar toda la agenda", () => {
    const plan = [{ titulo: "Charla en la Universidad", tipo: "evento" }];
    const agendaEv = [...agenda, { titulo: "Feria del queso", categoria: "evento" }];
    expect(filtrarMasEseDia(agendaEv, plan, "una charla").map((e) => e.titulo)).not.toContain("Feria del queso");
  });

  it("plan completo: se enseña todo como siempre", () => {
    const plan = [{ tipo: "bar" }, { tipo: "museo" }, { tipo: "restaurante" }];
    expect(filtrarMasEseDia(agenda, plan, "un plan para el sábado")).toHaveLength(4);
  });
});
