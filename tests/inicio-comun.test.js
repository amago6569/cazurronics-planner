// Las páginas de public/inicio llevan una copia de utilidades de src/lib (no usan módulos).
// Este test falla si una se cambia y la otra no, y fija que las fotos de Google (/api/foto) se aceptan.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { leerHora, esDeVariosDias, cuandoEs, FRANJAS } from "../src/lib/agenda";
import { webSegura, telSeguro } from "../src/lib/cliente";

const entorno = { window: {}, navigator: {}, location: {}, document: {}, crypto: {} };
vm.runInNewContext(readFileSync(resolve("public/inicio/comun.js"), "utf8"), entorno);
const CZ = entorno.window.CZ;
const igual = (a) => JSON.parse(JSON.stringify(a));

describe("utilidades de public/inicio/comun.js", () => {
  it.each(["21:00", "a las 9", "10h-14h", "10:00–20:00", "mañanas", "por la tarde", "noche", "mediodía", "todo el día", "", "consultar", "12:30", "18.45"])("leerHora(%s) igual que agenda.js", (h) => {
    expect(igual(CZ.leerHora(h))).toEqual(leerHora(h));
  });
  it("mismas franjas", () => { expect(CZ.FRANJAS.map((f) => [f.id, f.titulo])).toEqual(FRANJAS.map((f) => [f.id, f.titulo])); });
  it.each([{ permanente: true }, { diasSemana: [0, 6] }, { fecha: "2026-11-01", fechaFin: "2026-11-09" }, { fecha: "2026-11-01" }])("cuándo es igual que agenda.js", (e) => {
    expect(CZ.esDeVariosDias(e)).toBe(esDeVariosDias(e));
    expect(CZ.cuandoEs(e)).toBe(cuandoEs(e));
  });
  it("enlaces seguros iguales que cliente.js", () => {
    for (const u of ["https://a.es", "http://a.es", "javascript:alert(1)", "/ruta", ""]) expect(CZ.webSegura(u) || undefined).toBe(webSegura(u));
    expect(CZ.telSeguro("987 87 57 70")).toBe(telSeguro("987 87 57 70"));
  });
  it("acepta las fotos de nuestra ruta y las de otras webs, y nada raro", () => {
    expect(CZ.fotoSegura("/api/foto?ref=abc")).toBe("/api/foto?ref=abc");
    expect(CZ.fotoSegura("https://upload.wikimedia.org/x.jpg")).toBe("https://upload.wikimedia.org/x.jpg");
    for (const u of ["javascript:alert(1)", "//otro.sitio/x.jpg", "data:image/png;base64,x", "", null]) expect(CZ.fotoSegura(u)).toBe("");
  });
});
