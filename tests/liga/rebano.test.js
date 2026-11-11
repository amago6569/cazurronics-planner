// Trashumancia: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los movimientos
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, mover, avanzar, rejugar, DURACION_MS, MAX_MOVIMIENTOS, PARED, PERRO, LADO, CERCA } from "../../public/liga/motor-rebano.js";
import { jugarRebano } from "./bots-rebano.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS, EN_LIGA, enLigaEl } from "../../src/lib/liga/juegos.js";

describe("trashumancia: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-rebano.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Math.hypot", "Math.atan", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos movimientos dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarRebano(semilla, "bueno");
      const a = rejugar(semilla, j.movimientos);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.movimientos.slice()));
    }
  });

  it("si no haces nada, las ovejas pastan sin salirse del prado y no entra ninguna", () => {
    const p = crearPartida(5);
    avanzar(p, DURACION_MS);
    expect(p.puntos).toBe(0);
    for (const o of p.ovejas) {
      expect(o.estado).toBe("libre");
      expect(Math.abs(o.x)).toBeLessThanOrEqual(LADO);
      expect(o.y).toBeGreaterThanOrEqual(CERCA);
      expect(o.y).toBeLessThan(PARED);
    }
  });

  it("al encerrar un rebaño entero llega otro mayor, con su oveja negra", () => {
    const j = jugarRebano(801, "maquina");
    expect(j.rebanos).toBeGreaterThanOrEqual(2);
    expect(j.negras).toBeGreaterThanOrEqual(1);
    expect(j.ovejas).toBeGreaterThanOrEqual(11);
  });
});

describe("trashumancia: trampas", () => {
  it("rechaza movimientos mal formados, fuera del prado, fuera de tiempo, demasiado seguidos o demasiados", () => {
    expect(rejugar(1, [100, 0]).valida).toBe(false);
    expect(rejugar(1, [100, 20000, 100]).valida).toBe(false);
    expect(rejugar(1, [100, 0, Math.round(PERRO.yMax * 10000) + 1]).valida).toBe(false); // el mastín no entra al corral
    expect(rejugar(1, [100, 0, -1]).valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1, 0, 0]).valida).toBe(false);
    expect(rejugar(1, [100, 0, 0, 104, 10, 10]).valida).toBe(false);
    expect(rejugar(1, [100.5, 0, 0]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: (MAX_MOVIMIENTOS + 1) * 3 }, (_, i) => (i % 3 ? 0 : (i / 3) * 8))).valida).toBe(false);
    const p = crearPartida(1);
    mover(p, 100, 500, 500);
    expect(() => mover(p, 101, 600, 600)).toThrow();
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarRebano(4242, "normal");
    const base = { juego: "rebano", version: JUEGOS.rebano.version, semilla: 4242, empezada: "2026-11-16T10:00:00.000Z", datos: { movimientos: j.movimientos } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-16T10:00:55.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-16T10:00:05.000Z" }).estado).toBe("rechazada");
  });

  it("una partida con todos los movimientos que se permiten cabe en lo que acepta el servidor", () => {
    const lista = [];
    for (let i = 0; i < MAX_MOVIMIENTOS; i++) lista.push(10000 + i * 23, i % 2 ? -10200 : 10200, 25100);
    expect(rejugar(1, lista).valida).toBe(true);
    expect(JSON.stringify({ movimientos: lista }).length).toBeLessThan(JUEGOS.rebano.maxBytes);
  });
});

describe("trashumancia: dificultad", () => {
  it("cuanto mejor se pastorea, más puntos; y la máquina queda por encima", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 30 }, (_, i) => jugarRebano(800 + i, nivel).puntos));
    expect(t.novato.media).toBeLessThan(t.normal.media);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p50).toBeLessThan(t.maquina.p50);
    expect(t.novato.p50).toBeGreaterThan(50);
    expect(t.maquina.max).toBeLessThan(900);
  });
});

describe("juegos sin fecha de estreno: puntúan desde el primer día", () => {
  it("Trashumancia y La trucha están en la liga desde ya", () => {
    expect(enLigaEl("2026-11-14")).toEqual(EN_LIGA);
    expect(enLigaEl("2026-11-14")).toContain("rebano");
    expect(enLigaEl("2026-11-14")).toContain("trucha");
  });
});
