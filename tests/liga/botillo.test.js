// La torre del botillo: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los toques
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, colgando, soltar, rejugar, DURACION_MS, AGARRE, MAX_TOQUES } from "../../public/liga/motor-botillo.js";
import { jugarBotillo } from "./bots-botillo.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("botillo: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-botillo.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos toques dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarBotillo(semilla, "bueno");
      const a = rejugar(semilla, j.toques);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.toques.slice()));
    }
  });

  it("soltar justo encima de la torre se queda; muy de lado, al suelo", () => {
    const p = crearPartida(9);
    let t = p.aparece;
    while (Math.abs(colgando(p, t).x) > 0.01) t++;
    expect(soltar(p, t).apoyado).toBe(true);
    let u = p.aparece;
    while (Math.abs(colgando(p, u).x - p.torre[0]) < AGARRE + 0.05) u++;
    expect(soltar(p, u).apoyado).toBe(false);
  });
});

describe("botillo: trampas", () => {
  it("rechaza toques sin botillo colgando, desordenados o fuera de tiempo", () => {
    expect(rejugar(1, [100]).valida).toBe(false); // aún no hay botillo
    expect(rejugar(1, [1000, 1100]).valida).toBe(false); // el segundo aún no ha llegado
    expect(rejugar(1, [DURACION_MS + 1]).valida).toBe(false);
    expect(rejugar(1, [1000.5]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: MAX_TOQUES + 1 }, (_, i) => 1000 + i * 1000)).valida).toBe(false);
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarBotillo(4242, "normal");
    const base = { juego: "botillo", version: JUEGOS.botillo.version, semilla: 4242, empezada: "2026-11-09T10:00:00.000Z", datos: { toques: j.toques } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-09T10:00:50.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-09T10:00:05.000Z" }).estado).toBe("rechazada");
  });
});

describe("botillo: dificultad", () => {
  it("cuanto mejor juegas, más puntos; y nadie humano roza el máximo", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 40 }, (_, i) => jugarBotillo(800 + i, nivel).puntos));
    expect(t.novato.p50).toBeLessThan(t.normal.p50);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p90).toBeLessThan(t.maquina.p10);
    expect(t.novato.p50).toBeGreaterThan(5);
  });
});
