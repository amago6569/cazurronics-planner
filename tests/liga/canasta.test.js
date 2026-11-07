// Canasta en la Catedral: que los puntos sean siempre los mismos, que no se pueda hacer trampa con los tiros
// y que la dificultad dé puntuaciones creíbles.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  crearPartida, lanzar, rejugar, resumen, motivoInvalido, simularVuelo, velocidadSalida, proyectar, xAro, nuevoAro, nivelDe,
  DURACION_MS, LIMITES, SALIDA, ALTURA_ARO, MAX_TIROS, PASO,
} from "../../public/liga/motor-canasta.js";
import { jugarPartida, estadisticas } from "./bots.js";

const aroFijo = (z = 4.2, x = 0, viento = 0) => ({ z, x, viento, amplitud: 0, periodo: 1, fase: 0 });

// el largo de deslizamiento que va justo hasta la canasta, tal como se ve
function largoHastaAro(aro) {
  return Math.round((proyectar(SALIDA.x, SALIDA.y, SALIDA.z).y - proyectar(aro.x, ALTURA_ARO, aro.z).y) * 10000);
}

describe("motor: siempre da lo mismo", () => {
  it("no usa nada que pueda cambiar entre navegadores o con la hora", () => {
    const src = readFileSync(resolve("public/liga/motor-canasta.js"), "utf8").replace(/\/\/.*$/gm, "");
    for (const prohibido of ["Math.random", "Math.sin", "Math.cos", "Math.tan", "Math.pow", "Math.exp", "Math.log", "Date", "performance", "**"]) {
      expect(src, prohibido).not.toContain(prohibido);
    }
  });

  it("la misma semilla y los mismos tiros dan exactamente la misma partida", () => {
    for (const semilla of [1, 42, 123456789, 4294967295]) {
      const jugada = jugarPartida(semilla, "bueno");
      const a = rejugar(semilla, jugada.lista);
      const b = rejugar(semilla, jugada.lista.map((t) => ({ ...t })));
      expect(a.valida).toBe(true);
      expect(a).toEqual(b);
      expect(a.puntos).toBe(jugada.puntos);
      expect(a.canastas).toBe(jugada.canastas);
    }
  });

  it("semillas distintas cambian dónde aparece la canasta", () => {
    const sitios = new Set();
    for (let s = 1; s <= 20; s++) sitios.add(JSON.stringify(nuevoAro(2, crearPartida(s).suerte)));
    expect(sitios.size).toBe(20);
  });
});

describe("motor: tiros", () => {
  it("deslizar justo hasta la canasta del principio, recto, entra", () => {
    const p = crearPartida(7);
    const r = lanzar(p, { t: 500, s: largoHastaAro(p.aro), a: 0 });
    expect(r.canasta).toBe(true);
    expect(p.puntos).toBeGreaterThanOrEqual(2);
  });

  it("muy flojo se queda corto y muy fuerte se pasa", () => {
    const aro = aroFijo();
    expect(simularVuelo(aro, 0, velocidadSalida(aro, 800, 0)).canasta).toBe(false);
    expect(simularVuelo(aro, 0, velocidadSalida(aro, 8000, 0)).canasta).toBe(false);
  });

  it("muy torcido no entra", () => {
    const aro = aroFijo();
    const s = largoHastaAro(aro);
    expect(simularVuelo(aro, 0, velocidadSalida(aro, s, 3000)).canasta).toBe(false);
    expect(simularVuelo(aro, 0, velocidadSalida(aro, s, -3000)).canasta).toBe(false);
  });

  it("deslizar hacia donde se ve la canasta la apunta, esté a la izquierda o a la derecha", () => {
    for (const x of [-0.5, 0.5]) {
      const aro = aroFijo(4.6, x);
      const ini = proyectar(SALIDA.x, SALIDA.y, SALIDA.z), fin = proyectar(aro.x, ALTURA_ARO, aro.z);
      const a = Math.round(((fin.x - ini.x) / (ini.y - fin.y)) * 10000);
      const r = simularVuelo(aro, 0, velocidadSalida(aro, 6000, a), { choques: false });
      // la dirección (lateral por metro de fondo) es la de la canasta; si el tiro es largo, pasa por detrás en la misma línea
      const rumbo = r.cruce.x / (r.cruce.z - SALIDA.z), rumboAro = x / (aro.z - SALIDA.z);
      expect(Math.abs(rumbo - rumboAro)).toBeLessThan(0.005);
    }
  });

  it("el viento empuja el balón hacia su lado", () => {
    const quieto = simularVuelo(aroFijo(4.2, 0, 0), 0, velocidadSalida(aroFijo(), 5800, 0), { choques: false });
    const derecha = simularVuelo(aroFijo(4.2, 0, 1.6), 0, velocidadSalida(aroFijo(), 5800, 0), { choques: false });
    expect(derecha.cruce.x).toBeGreaterThan(quieto.cruce.x + 0.1);
  });

  it("un balón que entra por debajo del aro y vuelve a caer no cuenta", () => {
    // tiro casi vertical desde justo debajo: imposible desde la posición de salida, se comprueba con un aro encima
    const aro = { ...aroFijo(SALIDA.z + 0.0001, 0) };
    const r = simularVuelo(aro, 0, { x: 0, y: 8, z: 0 });
    expect(r.canasta).toBe(false);
  });

  it("lo que pasa por encima del tablero sigue de largo: ni rebota en una pared invisible ni entra", () => {
    const aro = aroFijo();
    let porEncima = 0;
    for (let s = 6000; s <= 8000; s += 20) {
      const r = simularVuelo(aro, 0, velocidadSalida(aro, s, 0), { trayectoria: true });
      const zFinal = r.tray[r.tray.length - 1];
      if (zFinal > aro.z + 0.5) { porEncima++; expect(r.canasta).toBe(false); expect(r.tocoTablero).toBe(false); }
    }
    expect(porEncima).toBeGreaterThan(0);
  });

  it("un balón que ya está detrás del tablero no vuelve a aparecer delante", () => {
    const aro = aroFijo();
    // sale 2 cm detrás de la cara del tablero y sube a su altura muy despacio hacia el fondo: con el choque de antes
    // (que no miraba de dónde venía) aparecía de golpe delante del tablero
    const r = simularVuelo({ ...aro, z: SALIDA.z - 0.38 - 0.02 }, 0, { x: 0, y: 7, z: 0.1 }, { trayectoria: true });
    for (let i = 2; i < r.tray.length; i += 3) expect(r.tray[i]).toBeGreaterThanOrEqual(SALIDA.z - 1e-9);
    expect(r.tocoTablero).toBe(false);
  });

  it("niveles: cambia de sitio desde la 1.ª canasta, viento desde la 6.ª y se mueve desde la 10.ª", () => {
    expect([0, 1, 5, 6, 9, 10, 20].map(nivelDe)).toEqual([1, 2, 2, 3, 3, 4, 4]);
    const p = crearPartida(31);
    const antes = { ...p.aro };
    const r = lanzar(p, { t: 400, s: largoHastaAro(p.aro), a: 0 });
    expect(r.canasta).toBe(true);
    expect(p.nivel).toBe(2);
    expect(p.aro).not.toEqual(antes);
  });

  it("puntos: 2 por canasta, 3 si es limpia y +1 a partir de la tercera seguida", () => {
    const p = crearPartida(99);
    let t = 300;
    const ganados = [];
    for (let i = 0; i < 3; i++) {
      const r = lanzar(p, { t, s: largoHastaAro(p.aro), a: 0 });
      t = r.listoEn + 10;
      if (r.canasta) ganados.push({ g: r.ganados, limpia: r.limpia, racha: r.racha });
    }
    for (const { g, limpia, racha } of ganados) expect(g).toBe((limpia ? 3 : 2) + (racha >= 3 ? 1 : 0));
  });

  it("la canasta se queda en la pantalla en todos los niveles", () => {
    for (let s = 1; s <= 200; s++) {
      const suerte = crearPartida(s).suerte;
      for (const nivel of [1, 2, 3, 4]) {
        const aro = nuevoAro(nivel, suerte);
        expect(aro.z).toBeGreaterThanOrEqual(3.9);
        expect(aro.z).toBeLessThanOrEqual(5.2);
        expect(Math.abs(aro.viento)).toBeLessThanOrEqual(1.6);
        if (nivel < 3) expect(aro.viento).toBe(0);
        if (nivel < 4) expect(aro.amplitud).toBe(0);
        for (let t = 0; t < 40; t += 0.37) expect(Math.abs(xAro(aro, t))).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it("el balón no se sale por arriba de la pantalla en los tiros que entran", () => {
    for (const z of [3.9, 4.6, 5.2]) {
      const aro = aroFijo(z);
      for (let s = 3000; s <= 8000; s += 25) {
        const r = simularVuelo(aro, 0, velocidadSalida(aro, s, 0), { trayectoria: true });
        if (!r.canasta) continue;
        let minY = Infinity;
        for (let i = 0; i < r.tray.length; i += 3) minY = Math.min(minY, proyectar(r.tray[i], r.tray[i + 1], r.tray[i + 2]).y);
        expect(minY).toBeGreaterThan(0.03);
      }
    }
  });
});

describe("trampas: el servidor no se cree cualquier cosa", () => {
  const valida = () => jugarPartida(2024, "normal").lista;

  it("una partida normal vale", () => {
    expect(rejugar(2024, valida()).valida).toBe(true);
  });

  it.each([
    ["sin tiros", null, "faltan los tiros"],
    ["texto en vez de tiros", "hola", "faltan los tiros"],
  ])("rechaza %s", (_, tiros, motivo) => {
    expect(rejugar(1, tiros)).toEqual({ valida: false, motivo });
  });

  it("rechaza números con decimales, fuerza o dirección imposibles y tiros fuera de tiempo", () => {
    const base = { t: 1000, s: 5000, a: 0 };
    expect(rejugar(1, [{ ...base, s: 5000.5 }]).motivo).toMatch(/enteros/);
    expect(rejugar(1, [{ ...base, s: 99999 }]).motivo).toMatch(/fuerza/);
    expect(rejugar(1, [{ ...base, a: -99999 }]).motivo).toMatch(/dirección/);
    expect(rejugar(1, [{ ...base, t: DURACION_MS + 1 }]).motivo).toMatch(/tiempo/);
    expect(rejugar(1, [{ ...base, t: -5 }]).motivo).toMatch(/tiempo/);
    expect(rejugar(1, [{ t: "1000", s: 5000, a: 0 }]).motivo).toMatch(/enteros/);
  });

  it("no deja tirar antes de que salga el balón siguiente ni en ráfaga", () => {
    const tiros = valida();
    const adelantado = tiros.map((t, i) => (i === 3 ? { ...t, t: tiros[2].t + 1 } : t));
    expect(rejugar(2024, adelantado).valida).toBe(false);
    const p = crearPartida(5);
    expect(motivoInvalido(p, { t: 10, s: 5000, a: 0 })).toBeNull();
    lanzar(p, { t: 10, s: 5000, a: 0 });
    expect(motivoInvalido(p, { t: 20, s: 5000, a: 0 })).toMatch(/balón|seguidos/);
  });

  it("no acepta más tiros de los posibles", () => {
    const muchos = Array.from({ length: MAX_TIROS + 1 }, (_, i) => ({ t: i * 600, s: 5000, a: 0 }));
    expect(rejugar(1, muchos).valida).toBe(false);
  });

  it("si cambias un tiro, la puntuación la vuelve a calcular el motor (no se puede inventar)", () => {
    const tiros = valida();
    const original = rejugar(2024, tiros);
    const cambiado = tiros.map((t, i) => (i === 0 ? { ...t, s: Math.min(LIMITES.s[1], t.s + 3000) } : t));
    const r = rejugar(2024, cambiado);
    // o deja de valer (el balón sale a otra hora) o da los puntos que de verdad salen, nunca los que diga el jugador
    if (r.valida) expect(r.puntos).toBeLessThanOrEqual(original.puntos + 4);
  });
});

describe("dificultad: puntuaciones creíbles", () => {
  const N = 40;
  const tabla = {};
  for (const nivel of ["novato", "normal", "bueno", "experto", "maquina"]) {
    const res = Array.from({ length: nivel === "maquina" ? 12 : N }, (_, i) => jugarPartida(3000 + i * 101, nivel, 77 + i));
    tabla[nivel] = { puntos: estadisticas(res.map((r) => r.puntos)), canastas: estadisticas(res.map((r) => r.canastas)) };
  }
  const limpia = Array.from({ length: 12 }, (_, i) => jugarPartida(3000 + i * 101, "maquina", 77 + i, "limpia"));

  it("cuanto mejor juegas, más puntos", () => {
    const orden = ["novato", "normal", "bueno", "experto"];
    for (let i = 1; i < orden.length; i++) expect(tabla[orden[i]].puntos.p50).toBeGreaterThan(tabla[orden[i - 1]].puntos.p50);
  });

  it("quien empieza mete alguna, pero no muchas", () => {
    expect(tabla.novato.canastas.p50).toBeGreaterThanOrEqual(2);
    expect(tabla.novato.canastas.p50).toBeLessThanOrEqual(6);
  });

  it("ni una máquina perfecta, tire a lo seguro o a por la limpia, pasa de 130 puntos ni de 28 canastas", () => {
    expect(tabla.maquina.puntos.max).toBeLessThanOrEqual(130);
    expect(tabla.maquina.canastas.max).toBeLessThanOrEqual(28);
    for (const r of limpia) { expect(r.puntos).toBeLessThanOrEqual(130); expect(r.canastas).toBeLessThanOrEqual(28); }
  });

  it("una persona muy buena queda claramente por debajo de una máquina (así se ven las trampas)", () => {
    expect(tabla.experto.puntos.p50).toBeLessThan(tabla.maquina.puntos.p50 - 10);
  });

  it("el paso de la simulación es fino para que el balón no atraviese el aro", () => {
    expect(PASO).toBeLessThanOrEqual(1 / 200);
  });

  it("resumen solo trae números", () => {
    const r = resumen(crearPartida(1));
    expect(Object.values(r).every(Number.isInteger)).toBe(true);
  });
});
