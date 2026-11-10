// «Al calendario» del planner: el .ics que se monta en el móvil con el plan en pantalla
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const entorno = { window: {}, navigator: {}, location: {}, document: {}, crypto: {} };
vm.runInNewContext(readFileSync(resolve("public/inicio/comun.js"), "utf8"), entorno);
const CZ = entorno.window.CZ;
const desplegar = (ics) => ics.replace(/\r\n /g, "");

describe("calendarioPlan", () => {
  const plan = [
    { titulo: "Tapas en el Húmedo", hora: "13:30", lugar: "Plaza San Martín, León", descripcion: "Morcilla, cecina; y vino", precio: "15 €" },
    { titulo: "Catedral", hora: "17:00 - 18:30", lugar: "Plaza de Regla" },
    { titulo: "Copas", hora: "23:30" },
  ];
  const ics = CZ.calendarioPlan(plan, "2026-11-14", "abc123");
  const plano = desplegar(ics);

  it("una cita por parada, con su hora y aviso", () => {
    expect(plano.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(plano).toContain("DTSTART:20261114T133000");
    expect(plano).toContain("DTEND:20261114T170000"); // hasta la parada siguiente
    expect(plano).toContain("DTSTART:20261114T170000\r\nDTEND:20261114T183000"); // su propio fin
    expect(plano).toContain("DTEND:20261115T010000"); // la última: 90 min, pasa de medianoche
    expect(plano.match(/TRIGGER:-PT30M/g)).toHaveLength(3);
    expect(plano).toContain("URL:https://cazurronics.es/plan/abc123");
  });
  it("escapa comas, puntos y comas y saltos", () => {
    expect(plano).toContain("DESCRIPTION:Morcilla\\, cecina\\; y vino\\nPrecio: 15 €\\nTu plan:");
    expect(plano).toContain("LOCATION:Copas\\, León");
  });
  it("líneas de 75 bytes como máximo y fin de línea CRLF", () => {
    for (const l of ics.split("\r\n")) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("sin horas: un aviso de día entero con todas las paradas", () => {
    const d = desplegar(CZ.calendarioPlan([{ titulo: "Museo" }, { titulo: "Paseo", hora: "consultar" }], "2026-12-31", null));
    expect(d.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(d).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(d).toContain("1. Museo\\n2. Paseo");
    expect(d).not.toContain("VALARM");
  });
});
