// npm test — Avisos de la CSP: se cuentan por día, sitio y tipo, sin guardar quién ni desde dónde
import { describe, expect, it } from "vitest";
import { claveAviso, clavesDeInforme } from "../src/lib/csp";

describe("avisos de la CSP", () => {
  it("lee el formato antiguo (report-uri)", () => {
    const cuerpo = JSON.stringify({ "csp-report": { "document-uri": "https://www.cazurronics.es/planner?x=1", "effective-directive": "img-src", "blocked-uri": "https://ejemplo.com/foto.jpg" } });
    expect(clavesDeInforme(cuerpo)).toEqual(["img-src|ejemplo.com"]);
  });
  it("lee el nuevo (Reporting API) e ignora lo que no es CSP", () => {
    const cuerpo = JSON.stringify([
      { type: "csp-violation", body: { effectiveDirective: "script-src-elem", blockedURL: "inline" } },
      { type: "deprecation", body: { id: "x" } },
    ]);
    expect(clavesDeInforme(cuerpo)).toEqual(["script-src-elem|inline"]);
  });
  it("no guarda la página ni nada raro: solo tipo y sitio, recortados", () => {
    const k = claveAviso({ "violated-directive": "connect-src 'self'", "blocked-uri": "https://mal.com/<script>?token=123" });
    expect(k).toBe("connect-src|mal.com");
    expect(claveAviso({ "blocked-uri": "x" })).toBeNull();
  });
  it("un cuerpo roto o enorme no rompe nada", () => {
    expect(clavesDeInforme("no es json")).toEqual([]);
    expect(clavesDeInforme(JSON.stringify(Array.from({ length: 50 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://a.com/x" } }))))).toHaveLength(10);
  });
});
