// La trucha: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los toques
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPartida, tocar, avanzar, rejugar, DURACION_MS, MAX_TOQUES, CLAVAR_MS } from "../../public/liga/motor-trucha.js";
import { jugarTrucha } from "./bots-trucha.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS } from "../../src/lib/liga/juegos.js";

describe("trucha: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-trucha.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Math.hypot", "Math.sqrt", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos toques dan la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const j = jugarTrucha(semilla, "bueno");
      const a = rejugar(semilla, j.toques);
      expect(a.valida).toBe(true);
      expect(a.puntos).toBe(j.puntos);
      expect(a).toEqual(rejugar(semilla, j.toques.slice()));
    }
  });

  it("si no tocas, pican y se van: cero puntos", () => {
    const p = crearPartida(5);
    const pasado = avanzar(p, DURACION_MS);
    expect(p.puntos).toBe(0);
    const pica = pasado.find((e) => e.tipo === "pica"), sefue = pasado.find((e) => e.tipo === "sefue");
    expect(sefue.t - pica.t).toBeGreaterThanOrEqual(CLAVAR_MS - 10);
    expect(pasado.filter((e) => e.tipo === "pica").length).toBeGreaterThan(8);
  });

  it("dejar el dedo apretado toda la partida no saca truchas: hay que clavar a tiempo y el sedal se rompe", () => {
    const r = rejugar(9, [400]);
    expect(r.valida).toBe(true);
    expect(r.puntos).toBe(0);
    // y aporrear la pantalla tampoco es buena idea: los tirones en falso espantan y los arreones rompen
    const golpes = []; for (let t = 400; t < DURACION_MS; t += 150) golpes.push(t);
    const media = (n) => estadisticas(Array.from({ length: 12 }, (_, i) => rejugar(n + i, golpes).puntos)).media;
    expect(media(300)).toBeLessThan(estadisticas(Array.from({ length: 12 }, (_, i) => jugarTrucha(300 + i, "novato").puntos)).media);
  });

  it("clavar antes de que pique la espanta", () => {
    const p = crearPartida(12);
    avanzar(p, 1400);
    expect(p.estado).toBe("espera");
    const antes = p.pica;
    if (antes > 1500) {
      tocar(p, 1450);
      const pasado = avanzar(p, 1500);
      expect(pasado.some((e) => e.tipo === "falso")).toBe(true);
      expect(p.pica).toBeGreaterThan(antes);
    }
  });
});

describe("trucha: trampas", () => {
  it("rechaza toques mal formados, fuera de tiempo, demasiado seguidos o demasiados", () => {
    expect(rejugar(1, "no").valida).toBe(false);
    expect(rejugar(1, [DURACION_MS + 1]).valida).toBe(false);
    expect(rejugar(1, [-5]).valida).toBe(false);
    expect(rejugar(1, [100, 110]).valida).toBe(false);
    expect(rejugar(1, [100.5]).valida).toBe(false);
    expect(rejugar(1, [500, 300]).valida).toBe(false);
    expect(rejugar(1, Array.from({ length: MAX_TOQUES + 1 }, (_, i) => i * 30)).valida).toBe(false);
    const p = crearPartida(1);
    tocar(p, 100);
    expect(() => tocar(p, 110)).toThrow();
  });

  it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
    const j = jugarTrucha(4242, "normal");
    const base = { juego: "trucha", version: JUEGOS.trucha.version, semilla: 4242, empezada: "2026-11-16T10:00:00.000Z", datos: { toques: j.toques } };
    const bien = comprobarPartida({ ...base, ahora: "2026-11-16T10:00:55.000Z" });
    expect(bien.estado).toBe("valida");
    expect(bien.puntos).toBe(j.puntos);
    expect(comprobarPartida({ ...base, ahora: "2026-11-16T10:00:05.000Z" }).estado).toBe("rechazada");
  });
});

describe("trucha: dificultad", () => {
  it("cuanto mejor pulso, más puntos; y la máquina queda por encima", () => {
    const t = {};
    for (const nivel of ["novato", "normal", "experto", "maquina"]) t[nivel] = estadisticas(Array.from({ length: 30 }, (_, i) => jugarTrucha(800 + i, nivel).puntos));
    expect(t.novato.p50).toBeLessThan(t.normal.p50);
    expect(t.normal.p50).toBeLessThan(t.experto.p50);
    expect(t.experto.p50).toBeLessThan(t.maquina.p50);
    expect(t.novato.p50).toBeGreaterThan(50);
    expect(t.maquina.max).toBeLessThan(500);
  });
});
