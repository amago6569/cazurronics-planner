// La Vidriera: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los toques
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, tocar, avanzar, encendida, rejugar, DURACION_MS, MAX_TOQUES, ESPERA_MS, LARGO_INICIAL } from "../../public/liga/motor-vidriera.js";
import { jugarVidriera } from "./bots-vidriera.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("vidriera: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-vidriera.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos toques dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarVidriera(semilla, "bueno");
      const a = rejugar(semilla, j.toques);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.toques.slice()));
    }
  });

  it("la serie se enseña entera, sin repetir vidriera seguida; acertarla trae una más larga", () => {
    const p = crearPartida(7);
    const vistas = [];
    for (let t = p.desde; t < p.abre; t += 10) { const e = encendida(p, t); if (e >= 0 && vistas.at(-1) !== e) vistas.push(e); }
    expect(vistas).toEqual(p.serie);
    let t = p.abre;
    for (const n of p.serie.slice()) tocar(p, t++, n);
    expect(p.largo).toBe(LARGO_INICIAL + 1);
    expect(p.puntos).toBe(LARGO_INICIAL * 2);
  });

  it("si fallas o tardas, la serie se pierde y viene otra más corta (nunca menos de 3)", () => {
    const p = crearPartida(9);
    const mala = (p.serie[0] + 1) % 8;
    expect(tocar(p, p.abre, mala).r.bien).toBe(false);
    expect(p.largo).toBe(LARGO_INICIAL);
    const fallos = avanzar(p, p.abre + ESPERA_MS + 5);
    expect(fallos).toHaveLength(1);
    expect(fallos[0].motivo).toBe("tarde");
    expect(p.puntos).toBe(0);
  });
});

describe("vidriera: trampas", () => {
  it("rechaza toques mientras se enseña la serie, desordenados, fuera de tiempo o en vidrieras que no existen", () => {
    expect(rejugar(1, [100, 0]).valida).toBe(false);
    const p = crearPartida(1);
    expect(rejugar(1, [p.abre, p.serie[0], p.abre, p.serie[1]]).valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1, 0]).valida).toBe(false);
    expect(rejugar(1, [p.abre + 0.5, 0]).valida).toBe(false);
    expect(rejugar(1, [p.abre, 8]).valida).toBe(false);
    expect(rejugar(1, [p.abre]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: (MAX_TOQUES + 1) * 2 }, (_, i) => (i % 2 ? 0 : 3000 + i * 50))).valida).toBe(false);
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarVidriera(4242, "normal");
    const base = { juego: "vidriera", version: JUEGOS.vidriera.version, semilla: 4242, empezada: "2026-11-09T10:00:00.000Z", datos: { toques: j.toques } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-09T10:00:55.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-09T10:00:05.000Z" }).estado).toBe("rechazada");
  });
});

describe("vidriera: dificultad", () => {
  it("cuanto mejor memoria, más puntos; y nadie humano roza el máximo", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 40 }, (_, i) => jugarVidriera(800 + i, nivel).puntos));
    expect(t.novato.p50).toBeLessThan(t.normal.p50);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p90).toBeLessThan(t.maquina.p10);
    expect(t.novato.p50).toBeGreaterThan(20);
  });
});
