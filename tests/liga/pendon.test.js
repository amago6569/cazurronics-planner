// El Pendón: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los movimientos
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, mover, avanzar, rejugar, DURACION_MS, MAX_MOVIMIENTOS, LEVANTAR_MS } from "../../public/liga/motor-pendon.js";
import { jugarPendon } from "./bots-pendon.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("pendón: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-pendon.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos movimientos dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarPendon(semilla, "bueno");
      const a = rejugar(semilla, j.movimientos);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.movimientos.slice()));
    }
  });

  it("si no haces nada, se cae y tarda en volver a estar de pie", () => {
    const p = crearPartida(5);
    const pasado = avanzar(p, 12000);
    const caidas = pasado.filter((e) => e.tipo === "cae");
    expect(caidas.length).toBeGreaterThan(0);
    const arriba = pasado.find((e) => e.tipo === "arriba");
    expect(arriba.t - caidas[0].t).toBeGreaterThanOrEqual(LEVANTAR_MS - 5);
    expect(pasado.filter((e) => e.tipo === "puntos" && e.t > caidas[0].t && e.t < caidas[0].t + LEVANTAR_MS)).toHaveLength(0);
  });
});

describe("pendón: trampas", () => {
  it("rechaza movimientos mal formados, fuera de tiempo, demasiado seguidos o demasiados", () => {
    expect(rejugar(1, [100]).valida).toBe(false);
    expect(rejugar(1, [100, 70000]).valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1, 0]).valida).toBe(false);
    expect(rejugar(1, [100, 0, 104, 10]).valida).toBe(false);
    expect(rejugar(1, [100.5, 0]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: (MAX_MOVIMIENTOS + 1) * 2 }, (_, i) => (i % 2 ? 0 : i * 8))).valida).toBe(false);
    const p = crearPartida(1);
    mover(p, 100, 500);
    expect(() => mover(p, 101, 600)).toThrow();
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarPendon(4242, "normal");
    const base = { juego: "pendon", version: JUEGOS.pendon.version, semilla: 4242, empezada: "2026-11-09T10:00:00.000Z", datos: { movimientos: j.movimientos } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-09T10:00:50.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-09T10:00:05.000Z" }).estado).toBe("rechazada");
  });

  it("una partida con todos los movimientos que se permiten cabe en lo que acepta el servidor", () => {
    const lista = [];
    for (let i = 0; i < MAX_MOVIMIENTOS; i++) lista.push(10000 + i * 12, i % 2 ? -59999 : 59999);
    expect(JSON.stringify({ movimientos: lista }).length).toBeLessThan(JUEGOS.pendon.maxBytes);
  });
});

describe("pendón: dificultad", () => {
  it("cuanto mejor pulso, más puntos; y la máquina queda por encima", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 30 }, (_, i) => jugarPendon(800 + i, nivel).puntos));
    expect(t.novato.p50).toBeLessThan(t.normal.p50);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p50).toBeLessThan(t.maquina.p50);
    expect(t.novato.p50).toBeGreaterThan(50);
  });
});
