import { describe, expect, it } from "vitest";
import { cifrasPeriodo, fraseHoy, techoEje, variacion } from "../src/lib/panelCifras";
import { faseDe, giroCorto, postura } from "../src/app/panel/oficina/posturas";

const dia = (n, extra = {}) => ({ fecha: `2026-11-${String(n).padStart(2, "0")}`, ...extra });

describe("cifras de Inicio", () => {
  it("suma el periodo y lo compara con el anterior", () => {
    const porDia = [dia(4, { visita: 10, plan: 2, detalle: 3, como_llegar: 1, visita_planner: 6, visita_despensa: 4 }), dia(3, { visita: 10 }), dia(2, { visita: 5 }), dia(1, { visita: 5 })];
    const c = cifrasPeriodo(porDia, 2);
    expect(c.visitas).toEqual({ valor: 20, cambio: 100 });
    expect(c.locales.valor).toBe(4);
    expect(c.planner).toBe(6);
    expect(c.despensa).toBe(4);
    expect(c.serie.map((d) => d.fecha)).toEqual(["2026-11-03", "2026-11-04"]);
  });
  it("no inventa un cambio si antes no se medía", () => {
    expect(variacion(50, 0)).toBeNull();
    expect(cifrasPeriodo([dia(1, { visita: 9 })], 7).visitas.cambio).toBeNull();
  });
  it("el eje acaba en un número redondo por encima del máximo", () => {
    expect(techoEje(117)).toBe(150);
    expect(techoEje(7)).toBe(10);
    expect(techoEje(1234)).toBeGreaterThanOrEqual(1234);
  });
  it("dice lo que toca hoy en una frase", () => {
    expect(fraseHoy({ solicitudes: 1, locales: 2 })).toBe("Tienes 3 negocios para hoy");
    expect(fraseHoy({ locales: 1, fallos: 1 })).toBe("Tienes 1 negocio y 1 empleado que falla para hoy");
    expect(fraseHoy({})).toBe("Hoy no tienes nada pendiente");
  });
});

describe("posturas de los monigotes", () => {
  it("sentado baja la pelvis y dobla las rodillas", () => {
    const a = postura("teclea", 1);
    expect(a.pelvisY).toBeLessThan(0.7);
    expect(a.rodillaI).toBeGreaterThan(1);
    expect(a.hombroIX).toBeLessThan(-0.8);
  });
  it("en un taburete se sienta más alto", () => {
    expect(postura("sentado", 1, { asiento: "alto" }).pelvisY).toBeGreaterThan(postura("sentado", 1).pelvisY);
  });
  it("al andar una pierna va al revés que la otra", () => {
    const a = postura("anda", 0, { fase: Math.PI / 2, veloz: 1.5 });
    expect(a.caderaI).toBeCloseTo(-a.caderaD);
    expect(a.caderaI).not.toBe(0);
  });
  it("el paso depende de los metros andados", () => {
    expect(faseDe(1.45)).toBeCloseTo(Math.PI * 2);
  });
  it("gira por el camino corto", () => {
    expect(giroCorto(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(giroCorto(3, -3)).toBeCloseTo(Math.PI * 2 - 6);
  });
  it("todas las posturas dan números", () => {
    for (const m of ["anda", "teclea", "jefe", "duerme", "sentado", "reunion", "habla", "entrega", "espera", "otra"]) {
      for (const v of Object.values(postura(m, 3.3, { fase: 2, veloz: 8, lleva: m === "anda" }))) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
