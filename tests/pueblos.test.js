// npm test — Si el texto nombra un pueblo, el plan va a ese pueblo; y los parajes de los pueblos llegan a la IA
import { describe, expect, it } from "vitest";
import { centrarEnPueblo, puebloEnTexto } from "../src/lib/pueblos";
import { MUNICIPIOS } from "../src/lib/pueblosDatos";
import { PARAJES, parajesParaPrompt, rutaConocida, rutasParaPrompt } from "../src/lib/rutas";
import { enProvinciaLeon } from "../src/lib/provincia";

const LEON = { lat: 42.5987, lon: -5.5671, radio: 15 };

describe("pueblo escrito en el texto", () => {
  it("encuentra Sahelices de Sabero (el caso de la Cueva de Valdelajo)", () => {
    expect(puebloEnTexto("algo de mirar cosas naturales, cuevas o algo así en sahelices de sabero")?.nombre).toBe("Sahelices de Sabero");
  });
  it("encuentra municipios con y sin tildes", () => {
    expect(puebloEnTexto("comer en Riaño")?.nombre).toBe("Riaño");
    expect(puebloEnTexto("una ruta por boñar y luego cañas")?.nombre).toBe("Boñar");
    expect(puebloEnTexto("cenar en la robla")?.nombre).toBe("La Robla");
  });
  it("una pedanía que no está en la lista cae en su municipio", () => {
    expect(puebloEnTexto("paseo en Olleros de Sabero")?.nombre).toBe("Sabero");
  });
  it("«en León» no mueve nada (suele ser la provincia), salvo que diga la capital", () => {
    expect(puebloEnTexto("un plan de naturaleza en León")).toBeNull();
    expect(puebloEnTexto("tapas en León capital")?.nombre).toBe("León");
  });
  it("no confunde palabras con pueblos", () => {
    expect(puebloEnTexto("ir a pescar truchas")).toBeNull();
    expect(puebloEnTexto("cocido maragato y unas cañas")).toBeNull();
  });
});

describe("centrar el plan en el pueblo", () => {
  it("mapa en León (el de serie) y texto en Sahelices: el plan va a Sahelices", () => {
    const { peticion, pueblo } = centrarEnPueblo({ ...LEON, apetece: "cuevas en sahelices de sabero" });
    expect(pueblo.nombre).toBe("Sahelices de Sabero");
    expect(peticion.lat).not.toBe(LEON.lat);
    const valdelajo = PARAJES.find((p) => p.nombre === "Cueva de Valdelajo");
    expect(parajesParaPrompt(peticion.lat, peticion.lon, peticion.radio)).toContain("Cueva de Valdelajo");
    expect(Math.abs(valdelajo.lat - peticion.lat)).toBeLessThan(0.05);
  });
  it("si el pueblo ya está dentro del radio, no toca nada", () => {
    const p = { ...LEON, apetece: "cenar en Villaquilambre" };
    expect(centrarEnPueblo(p).pueblo).toBeNull();
    expect(centrarEnPueblo(p).peticion).toBe(p);
  });
  it("sin pueblo en el texto, no toca nada", () => {
    expect(centrarEnPueblo({ ...LEON, apetece: "tapeo por el Húmedo" }).pueblo).toBeNull();
  });
});

describe("parajes de los pueblos", () => {
  it("todos los municipios y parajes están en la provincia", () => {
    expect(MUNICIPIOS.length).toBeGreaterThan(200);
    for (const [n, la, lo] of MUNICIPIOS) expect(enProvinciaLeon(la, lo), n).toBe(true);
    for (const p of PARAJES) expect(enProvinciaLeon(p.lat, p.lon), p.nombre).toBe(true);
  });
  it("una cueva de la lista no se descarta aunque Google no la tenga", () => {
    expect(rutaConocida("Cueva de Valdelajo")?.zona).toBe("Sahelices de Sabero");
  });
  it("desde León capital con 15 km no se cuelan cuevas de la montaña", () => {
    expect(parajesParaPrompt(LEON.lat, LEON.lon, 15)).toBe("");
  });
  it("si pide una cueva, la lista de rutas no la cambia por una ruta", () => {
    expect(rutasParaPrompt("naturaleza y cuevas", 42.818, -5.165, 15)).toMatch(/una cueva.*dale eso/);
  });
});
