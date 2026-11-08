// La Bajada en San Isidro: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los movimientos
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, mover, rejugar, DURACION_MS, MAX_MOVIMIENTOS, ESQUIADOR, PINO } from "../../public/liga/motor-esqui.js";
import { jugarEsqui } from "./bots-esqui.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("esquí: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-esqui.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos movimientos dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarEsqui(semilla, "bueno");
      const a = rejugar(semilla, j.movimientos);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.movimientos.slice()));
    }
  });

  it("las puertas se pueden alcanzar y ningún pino corta el camino entre dos puertas", () => {
    for (const semilla of [3, 77, 2024]) {
      const p = crearPartida(semilla);
      const puertas = p.cosas.filter((c) => c.tipo === "puerta");
      expect(puertas.length).toBeGreaterThan(30);
      for (let i = 1; i < puertas.length; i++) {
        const a = puertas[i - 1], b = puertas[i];
        expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(ESQUIADOR.velocidad * (b.tc - a.tc) / 1000);
        for (const c of p.cosas.filter((c) => c.tipo === "pino" && c.tc > a.tc && c.tc < b.tc)) {
          expect(c.x > Math.max(a.x, b.x) + PINO || c.x < Math.min(a.x, b.x) - PINO).toBe(true);
        }
      }
    }
  });

  it("si no te mueves, fallas casi todas las puertas", () => {
    const r = rejugar(5, []);
    expect(r.valida).toBe(true);
    expect(r.puertas).toBeLessThan(r.total / 2);
  });
});

describe("esquí: trampas", () => {
  it("rechaza movimientos mal formados, fuera de tiempo, demasiado seguidos o demasiados", () => {
    expect(rejugar(1, [100]).valida).toBe(false);
    expect(rejugar(1, [100, 20000]).valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1, 0]).valida).toBe(false);
    expect(rejugar(1, [100, 0, 104, 10]).valida).toBe(false);
    expect(rejugar(1, [100.5, 0]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: (MAX_MOVIMIENTOS + 1) * 2 }, (_, i) => (i % 2 ? 0 : i * 8))).valida).toBe(false);
    const p = crearPartida(1);
    mover(p, 100, 500);
    expect(() => mover(p, 101, 600)).toThrow();
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarEsqui(4242, "normal");
    const base = { juego: "esqui", version: JUEGOS.esqui.version, semilla: 4242, empezada: "2026-11-09T10:00:00.000Z", datos: { movimientos: j.movimientos } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-09T10:00:50.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-09T10:00:05.000Z" }).estado).toBe("rechazada");
  });

  it("una partida con todos los movimientos que se permiten cabe en lo que acepta el servidor", () => {
    const lista = [];
    for (let i = 0; i < MAX_MOVIMIENTOS; i++) lista.push(10000 + i * 12, i % 2 ? -9999 : 9999);
    expect(JSON.stringify({ movimientos: lista }).length).toBeLessThan(JUEGOS.esqui.maxBytes);
  });
});

describe("esquí: dificultad", () => {
  it("cuanto mejor juegas, más puntos; y nadie humano roza el máximo", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 30 }, (_, i) => jugarEsqui(800 + i, nivel).puntos));
    expect(t.novato.p50).toBeLessThan(t.normal.p50);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p90).toBeLessThan(t.maquina.p10);
    expect(t.novato.p50).toBeGreaterThan(20);
  });
});
