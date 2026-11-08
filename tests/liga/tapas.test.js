// Tapeo en el Húmedo: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los movimientos
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  crearPartida, mover, avanzar, rejugar, xEn, multiplicador, DURACION_MS, CAZUELA, LIMITE_X, MAX_MOVIMIENTOS,
} from "../../public/liga/motor-tapas.js";
import { jugarTapas } from "./bots-tapas.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("tapas: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-tapas.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos movimientos dan exactamente la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const jugada = jugarTapas(semilla, "bueno");
      const a = rejugar(semilla, jugada.movimientos);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(jugada.puntos);
      expect(a).toEqual(rejugar(semilla, jugada.movimientos.slice()));
    }
  });

  it("jugar a trozos (como el móvil, fotograma a fotograma) da lo mismo que repetirla de golpe", () => {
    const jugada = jugarTapas(777, "experto");
    const p = crearPartida(777);
    let i = 0;
    for (let t = 0; t <= DURACION_MS; t += 16.7) {
      while (i < jugada.movimientos.length && jugada.movimientos[i] <= t) { mover(p, jugada.movimientos[i], jugada.movimientos[i + 1]); i += 2; }
      avanzar(p, t);
    }
    avanzar(p, DURACION_MS);
    expect(p.puntos).toBe(rejugar(777, jugada.movimientos).puntos);
  });

  it("todo lo que cae se puede alcanzar y cae dentro de la barra", () => {
    for (const semilla of [3, 99, 2024, 31337]) {
      const p = crearPartida(semilla);
      expect(p.cosas.length).toBeGreaterThan(50);
      for (const c of p.cosas) {
        expect(c.tc).toBeLessThanOrEqual(DURACION_MS);
        expect(Math.abs(xEn(c, c.tc))).toBeLessThanOrEqual(0.95);
      }
    }
  });
});

describe("tapas: trampas", () => {
  it("rechaza movimientos fuera de tiempo, de la barra o desordenados", () => {
    expect(rejugar(1, [100, 20000]).valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1, 0]).valida).toBe(false);
    expect(rejugar(1, [500, 0, 400, 100]).valida).toBe(false);
    expect(rejugar(1, [500, 0, 503, 100]).valida).toBe(false); // menos de 8 ms entre uno y otro
    expect(rejugar(1, [500.5, 0]).valida).toBe(false);
    expect(rejugar(1, "nada").valida).toBe(false);
  });

  it("no deja mandar más movimientos de la cuenta", () => {
    const lista = [];
    for (let i = 0; i <= MAX_MOVIMIENTOS; i++) lista.push(i * 10, (i % 2) * 5000);
    expect(rejugar(1, lista).valida).toBe(false);
  });

  it("la cazuela no se teletransporta: tiene su velocidad máxima", () => {
    const p = crearPartida(5);
    mover(p, 1000, 10000);
    avanzar(p, 1100);
    expect(p.cazuela).toBeLessThanOrEqual(CAZUELA.velocidad * 0.105 + 1e-9); // 100 ms, más el paso en que entra el movimiento
    avanzar(p, 2000);
    expect(p.cazuela).toBe(LIMITE_X);
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const jugada = jugarTapas(4242, "normal");
    const empezada = "2026-11-09T10:00:00.000Z";
    const bien = comprobarPartida({ juego: "tapas", version: JUEGOS.tapas.version, semilla: 4242, empezada, ahora: "2026-11-09T10:00:45.000Z", datos: { movimientos: jugada.movimientos } });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(jugada.puntos);
    const rapida = comprobarPartida({ juego: "tapas", version: JUEGOS.tapas.version, semilla: 4242, empezada, ahora: "2026-11-09T10:00:10.000Z", datos: { movimientos: jugada.movimientos } });
    expect(rapida.estado).toBe("rechazada");
  });

  it("la peor partida posible (50 movimientos por segundo) cabe en el límite de datos", () => {
    const lista = [];
    for (let t = 0; t <= DURACION_MS; t += 20) lista.push(t, -9999 + ((t * 37) % 19998));
    expect(JSON.stringify({ movimientos: lista }).length).toBeLessThan(JUEGOS.tapas.maxBytes);
  });
});

describe("tapas: dificultad", () => {
  it("puntos: 1 por tapa, dobles desde 5 seguidas y triples desde 15", () => {
    expect([1, 4, 5, 14, 15, 40].map(multiplicador)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("cuanto mejor juegas, más puntos; y nadie humano roza el máximo", () => {
    const tabla = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) {
      tabla[nivel] = estadisticas(Array.from({ length: 30 }, (_, i) => jugarTapas(1000 + i, nivel).puntos));
    }
    expect(tabla.novato.p50).toBeLessThan(tabla.normal.p50);
    expect(tabla.normal.p50).toBeLessThan(tabla.experto.p50);
    expect(tabla.experto.p50).toBeLessThan(tabla.maquina.p50);
    expect(tabla.novato.p50).toBeGreaterThan(15); // quien empieza también suma
  });
});
