// npm test — La planta de la oficina 3D: mesas, rutas por los pasillos y escenas de la charla
import { describe, expect, it } from "vitest";
import { DEPARTAMENTOS } from "../src/lib/oficina";
import { CAFE, DESPACHO, episodios, largo, planta, puntoEn, ruta } from "../src/app/panel/oficina/guion";

const sitios = planta(DEPARTAMENTOS);
const mesas = Object.values(sitios);

// ¿El tramo de a a b pasa por encima de alguna mesa o silla (que no sea la suya o la de destino)?
function atraviesa(a, b, excepto) {
  for (const m of mesas) {
    if (excepto.includes(m.id)) continue;
    const [mx, mz] = m.mesa;
    const ancho = m.id === "jefe" ? 1.1 : 0.75;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (Math.abs(x - mx) < ancho && z > mz - 1.1 && z < mz + 0.45) return m.id;
    }
  }
  return null;
}

describe("planta de la oficina 3D", () => {
  it("cada empleado tiene mesa y ninguna se pisa con otra, con el café ni con el despacho", () => {
    const ids = DEPARTAMENTOS.flatMap((d) => d.empleados.map((e) => e.id));
    expect(ids.every((id) => sitios[id])).toBe(true);
    for (const a of mesas) for (const b of mesas) {
      if (a !== b) expect(Math.hypot(a.mesa[0] - b.mesa[0], a.mesa[1] - b.mesa[1])).toBeGreaterThan(2);
    }
    for (const m of mesas.filter((x) => x.id !== "jefe")) {
      const [x, z] = m.mesa;
      expect(x > CAFE.x0 - 0.8 && x < CAFE.x1 + 0.8 && z > CAFE.z0 - 0.5 && z < CAFE.z1).toBe(false);
      expect(x + 0.7 < DESPACHO.x0).toBe(true);
    }
  });

  it("vayan de donde vayan, caminan por los pasillos sin atravesar mesas", () => {
    for (const a of mesas) for (const b of mesas) {
      if (a === b) continue;
      const r = ruta(a, b);
      expect(r[0]).toEqual(a.silla);
      expect(r.at(-1)).toEqual(b.visita);
      for (let i = 1; i < r.length; i++) {
        // El primer tramo sale de su propia silla: su mesa no cuenta
        expect(atraviesa(r[i - 1], r[i], [a.id, b.id]), `${a.id} → ${b.id}, tramo ${i}`).toBeNull();
      }
    }
  });

  it("puntoEn recorre la ruta de principio a fin", () => {
    const r = ruta(sitios.musica, sitios.jefe);
    expect(puntoEn(r, 0)).toMatchObject({ x: r[0][0], z: r[0][1] });
    const fin = puntoEn(r, largo(r) + 5);
    expect(fin.x).toBeCloseTo(r.at(-1)[0]); expect(fin.z).toBeCloseTo(r.at(-1)[1]);
  });

  it("la charla se agrupa en escenas con su respuesta, y lo de Alejandro no camina", () => {
    const e = episodios([
      { de: "musica", a: "jefe", texto: "Traigo 3", cuando: "1" },
      { de: "jefe", a: "musica", texto: "¡Bien!", cuando: "2" },
      { de: "jefe", a: "tu", texto: "Te dejo 1 en la bandeja", cuando: "3" },
      { de: "noche", a: "jefe", texto: "¿Tenemos esto?", cuando: "4" },
    ], sitios);
    expect(e).toHaveLength(3);
    expect(e[0]).toMatchObject({ quien: "musica", a: "jefe", anda: true, respuesta: { texto: "¡Bien!" } });
    expect(e[1]).toMatchObject({ quien: "jefe", a: "tu", anda: false, respuesta: null });
    expect(e[2].respuesta).toBeNull();
  });
});
