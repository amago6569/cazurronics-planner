// npm test — La lista de rutas solo entra en la petición cuando se pide salir a caminar o en bici
import { describe, expect, it } from "vitest";
import { RUTAS, TODAS_LAS_RUTAS, agendaParaRutas, rutaConocida, rutasParaPrompt } from "../src/lib/rutas";
import { enProvinciaLeon } from "../src/lib/provincia";
import { mensajeSinNadaEnProvincia } from "../src/lib/montarPlan";

const LEON = [42.5987, -5.5671];

describe("mensaje cuando no hay nada ni en toda la provincia", () => {
  it("no manda ampliar el radio", () => {
    const m = mensajeSinNadaEnProvincia("torneo de pádel en Sahagún");
    expect(m).toContain("«torneo de pádel en Sahagún» en toda la provincia");
    expect(m).not.toContain("radio");
  });
});

describe("agendaParaRutas", () => {
  const agenda = [{ titulo: "MARCHA DE LA AMISTAD" }, { titulo: "VIII Cross Popular de Sariegos" }, { titulo: "IV 10K de Astorga" }, { titulo: "Ruta guiada por Las Médulas" }, { titulo: "Concierto en el Auditorio" }];
  it("quien pide caminar no recibe pruebas de la agenda, pero sí rutas guiadas", () => {
    expect(agendaParaRutas(agenda, "una ruta para caminar").map((e) => e.titulo)).toEqual(["Ruta guiada por Las Médulas", "Concierto en el Auditorio"]);
  });
  it("si pide una prueba, o no pide ruta, la agenda queda igual", () => {
    expect(agendaParaRutas(agenda, "una marcha o una carrera")).toHaveLength(5);
    expect(agendaParaRutas(agenda, "un trail por la montaña")).toHaveLength(5);
    expect(agendaParaRutas(agenda, "cenar y un concierto")).toHaveLength(5);
    expect(agendaParaRutas(agenda, "ruta de tapas")).toHaveLength(5);
  });
});

describe("rutasParaPrompt", () => {
  it("todas están en la provincia", () => {
    expect(TODAS_LAS_RUTAS.length).toBeGreaterThan(RUTAS.length + 50);
    for (const r of TODAS_LAS_RUTAS) expect(enProvinciaLeon(r.lat, r.lon), r.nombre).toBe(true);
  });
  it("reconoce una ruta de la lista dentro del título y no inventa", () => {
    expect(rutaConocida("Ruta por las Hoces de Vegacervera").nombre).toBe("Hoces de Vegacervera");
    expect(rutaConocida("Ruta de Valinventada")).toBe(null);
  });
  it("si pide bici da rutas de bici", () => {
    const bici = TODAS_LAS_RUTAS.filter((r) => r.tipo === "b");
    expect(bici.length).toBeGreaterThan(10);
    expect(rutasParaPrompt("ruta en bici", bici[0].lat, bici[0].lon, 20)).toContain(bici[0].nombre);
  });
  it("da las cercanas si se pide caminar", () => {
    const t = rutasParaPrompt("una ruta para caminar", ...LEON, 30);
    expect(t).toContain("Monte San Isidro");
    expect(t).not.toContain("Las Médulas");
  });
  it("no añade nada si se pide otra cosa", () => {
    expect(rutasParaPrompt("comer y salir de fiesta", ...LEON, 30)).toBe("");
  });
  it("una ruta de comer o beber no es salir a caminar", () => {
    for (const pide of ["ruta de tapas", "ruta de vinos", "ruta por los bares", "ruta de pinchos", "ruta gastronómica"]) {
      expect(rutasParaPrompt(pide, ...LEON, 30), pide).toBe("");
    }
  });
  it("pero si también pide caminar, la lista sigue", () => {
    expect(rutasParaPrompt("ruta por la montaña y comer tapas", ...LEON, 30)).toContain("Monte San Isidro");
    expect(rutasParaPrompt("ruta de tapas y luego caminar", ...LEON, 30)).toContain("Monte San Isidro");
  });
  it("no añade nada si no hay ninguna en el radio", () => {
    expect(rutasParaPrompt("una ruta", 42.0, -5.67, 1)).toBe("");
  });
});
