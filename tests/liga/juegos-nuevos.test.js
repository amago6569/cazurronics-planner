// Justa, Bolos, Lucha y Maragatos: que los puntos sean siempre los mismos, que no se pueda hacer trampa
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as justa from "../../public/liga/motor-justa.js";
import * as bolos from "../../public/liga/motor-bolos.js";
import * as lucha from "../../public/liga/motor-lucha.js";
import * as maragatos from "../../public/liga/motor-maragatos.js";
import { jugarJusta } from "./bots-justa.js";
import { jugarBolos } from "./bots-bolos.js";
import { jugarLucha } from "./bots-lucha.js";
import { jugarMaragatos } from "./bots-maragatos.js";
import { estadisticas } from "./bots.js";
import { comprobarPartida, JUEGOS, EN_LIGA } from "../../src/lib/liga/juegos.js";

const PROHIBIDO = ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Math.hypot", "Math.atan", "Date", "performance", "**"];

// clave: lo que se manda al servidor; jugar: bot; partidas: cuántas por nivel en la prueba de dificultad
const CASOS = [
  { id: "justa", motor: justa, clave: "movimientos", jugar: jugarJusta, partidas: 20 },
  { id: "bolos", motor: bolos, clave: "tiros", jugar: jugarBolos, partidas: 4 },
  { id: "lucha", motor: lucha, clave: "gestos", jugar: jugarLucha, partidas: 20 },
  { id: "maragatos", motor: maragatos, clave: "toques", jugar: jugarMaragatos, partidas: 20 },
];

for (const { id, motor, clave, jugar, partidas } of CASOS) {
  describe(`${id}: siempre da lo mismo`, () => {
    it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
      const src = readFileSync(resolve(`public/liga/motor-${id}.js`), "utf8").replace(/\/\/.*$/gm, "");
      for (const prohibido of PROHIBIDO) expect(src, prohibido).not.toContain(prohibido);
    });

    it("la misma semilla y las mismas jugadas dan la misma partida", () => {
      for (const semilla of [1, 42, 4294967295]) {
        const j = jugar(semilla, "bueno");
        const a = motor.rejugar(semilla, j[clave]);
        expect(a.valida).toBe(true);
        expect(a.puntos).toBe(j.puntos);
        expect(a).toEqual(motor.rejugar(semilla, j[clave].slice()));
      }
    });

    it("si no haces nada, no sumas", () => {
      const r = motor.rejugar(7, []);
      expect(r.valida).toBe(true);
      expect(r.puntos).toBe(0);
    });

    it("está en la liga, con su página y su versión", () => {
      expect(EN_LIGA).toContain(id);
      expect(JUEGOS[id].version).toBe(motor.VERSION);
    });
  });

  describe(`${id}: trampas`, () => {
    it("rechaza datos que no son una lista", () => {
      expect(motor.rejugar(1, undefined).valida).toBe(false);
      expect(motor.rejugar(1, "hola").valida).toBe(false);
    });

    it("el servidor acepta una partida normal y rechaza una «más rápida que el reloj»", () => {
      const j = jugar(4242, "normal");
      const base = { juego: id, version: JUEGOS[id].version, semilla: 4242, empezada: "2026-11-16T10:00:00.000Z", datos: { [clave]: j[clave] } };
      const bien = comprobarPartida({ ...base, ahora: "2026-11-16T10:01:00.000Z" });
      expect(bien.estado).toBe("valida");
      expect(bien.puntos).toBe(j.puntos);
      expect(comprobarPartida({ ...base, ahora: "2026-11-16T10:00:05.000Z" }).estado).toBe("rechazada");
    });

    it("la partida de la máquina cabe en lo que acepta el servidor", { timeout: 60000 }, () => {
      const j = jugar(99, "maquina");
      expect(JSON.stringify({ [clave]: j[clave] }).length).toBeLessThan(JUEGOS[id].maxBytes || 20000);
    });
  });

  describe(`${id}: dificultad`, () => {
    it("cuanto mejor se juega, más puntos; y la máquina queda por encima", { timeout: 120000 }, () => {
      const t = {};
      for (const nivel of ["novato", "normal", "maquina"]) t[nivel] = estadisticas(Array.from({ length: partidas }, (_, i) => jugar(900 + i, nivel).puntos));
      expect(t.novato.media).toBeLessThan(t.normal.media);
      expect(t.normal.p50).toBeLessThan(t.maquina.p50);
      expect(t.novato.p50).toBeGreaterThan(0);
    });
  });
}

describe("trampas concretas de cada juego", () => {
  it("justa: alturas fuera, tiempos raros, movimientos pegados o impares", () => {
    expect(justa.rejugar(1, [100]).valida).toBe(false);
    expect(justa.rejugar(1, [100, 10001]).valida).toBe(false);
    expect(justa.rejugar(1, [100, -1]).valida).toBe(false);
    expect(justa.rejugar(1, [justa.DURACION_MS + 1, 5000]).valida).toBe(false);
    expect(justa.rejugar(1, [100.5, 5000]).valida).toBe(false);
    expect(justa.rejugar(1, [100, 5000, 102, 5000]).valida).toBe(false);
  });

  it("justa: dejar la lanza quieta en una altura no da para mucho", () => {
    const quietos = [];
    for (let semilla = 1; semilla <= 20; semilla++) for (const y of [2000, 3000, 4000, 5000, 6000, 7000, 8000]) quietos.push(justa.rejugar(semilla, [500, y]).puntos);
    const t = estadisticas(quietos);
    expect(t.media).toBeLessThan(60);
    expect(t.max).toBeLessThan(estadisticas([1, 2, 3, 4, 5].map((s) => jugarJusta(s, "bueno").puntos)).p50);
  });

  it("lucha: gestos desconocidos o a ráfagas", () => {
    expect(lucha.rejugar(1, [100, 4]).valida).toBe(false);
    expect(lucha.rejugar(1, [100, -1]).valida).toBe(false);
    expect(lucha.rejugar(1, [100, 0, 120, 1]).valida).toBe(false);
    expect(lucha.rejugar(1, [lucha.DURACION_MS + 1, 0]).valida).toBe(false);
  });

  it("lucha: deslizar sin parar a todos lados no gana", () => {
    const lista = [];
    for (let t = 800; t < lucha.DURACION_MS && lista.length < lucha.MAX_GESTOS * 2; t += 200) lista.push(t, (t / 200) % 4);
    const r = lucha.rejugar(5, lista);
    expect(r.valida).toBe(true);
    expect(r.puntos).toBeLessThan(jugarLucha(5, "normal").puntos);
  });

  it("maragatos: lados raros, toques desordenados o a ráfagas", () => {
    expect(maragatos.rejugar(1, [100, 2]).valida).toBe(false);
    expect(maragatos.rejugar(1, [200, 0, 100, 1]).valida).toBe(false);
    expect(maragatos.rejugar(1, [100, 0, 110, 0]).valida).toBe(false);
  });

  it("maragatos: aporrear sin compás resta en vez de sumar", () => {
    const lista = [];
    for (let i = 0, t = 500; t < maragatos.DURACION_MS && i < maragatos.MAX_TOQUES; i++, t += 37) lista.push(t, i % 2);
    const r = maragatos.rejugar(5, lista);
    expect(r.valida).toBe(true);
    expect(r.puntos).toBeLessThan(jugarMaragatos(5, "normal").puntos);
  });

  it("bolos: tiros imposibles o demasiado seguidos", () => {
    expect(bolos.rejugar(1, [100, 0, 0, 0]).valida).toBe(false);
    expect(bolos.rejugar(1, [100, bolos.TIRO.xMax + 1, 0, 0, 500]).valida).toBe(false);
    expect(bolos.rejugar(1, [100, 0, 0, 0, bolos.TIRO.sMax + 1]).valida).toBe(false);
    expect(bolos.rejugar(1, [100, 0, 0, 0, 500, 300, 0, 0, 0, 500]).valida).toBe(false);
  });
});

describe("bolos: las reglas del bolo leonés", () => {
  const p = bolos.crearPartida(3);
  const tira = (t) => bolos.simularTiro(p.bolos.map((b) => ({ ...b })), t, p.lado);
  it("una bola floja que no llega al castro es cinca: no vale nada", () => {
    const r = tira({ x: 0, a: 0, c: 0, s: 0 });
    expect(r.valida).toBe(false);
    expect(bolos.tantosDe(r, false)).toMatchObject({ tantos: 0, cinca: true });
  });
  it("recta al castro tira bolos y vale uno cada bolo", () => {
    const r = tira({ x: 0, a: 0, c: 0, s: 0.5 });
    const t = bolos.tantosDe(r, false);
    expect(r.valida).toBe(true);
    expect(t.once).toBe(false);
    expect(t.tantos).toBe(t.bolos);
    expect(t.bolos).toBeGreaterThan(0);
  });
  it("con efecto hacia el miche se puede hacer once (16 tantos o más) y el once solo sale torciendo", () => {
    let once = null, onceSinEfecto = false;
    for (let c = -1; c <= 1.001; c += 0.125) for (let s = 0.3; s <= 0.9; s += 0.05) for (let a = -0.25; a <= 0.2501; a += 0.025) {
      const t = bolos.tantosDe(tira({ x: 0, a, c, s }), false);
      if (t.once && Math.abs(c) < 0.2) onceSinEfecto = true;
      if (t.once && !once) once = { t, c };
    }
    expect(once).not.toBeNull();
    expect(once.t.tantos).toBeGreaterThanOrEqual(bolos.PUNTOS.onceFuera);
    expect(Math.sign(once.c)).toBe(p.lado);
    expect(onceSinEfecto).toBe(false);
  });
  it("si la bola queda fuera de la raya de parada y quedan bolos, se birla desde donde paró", () => {
    const q = bolos.crearPartida(3);
    bolos.lanzar(q, 400, 0, 0, 0, 1000); // fuerte y recta: se va al fondo
    bolos.avanzar(q, 8000);
    expect(q.birle).not.toBeNull();
    expect(q.estado).toBe("listo");
    bolos.lanzar(q, 8100, 0, 0, 0, 300);
    bolos.avanzar(q, 16000);
    expect(q.birles).toBe(1);
    expect(q.birle).toBeNull();
  });
});

