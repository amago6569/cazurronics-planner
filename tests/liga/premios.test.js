// Premios de la Liga: packs, códigos de los ganadores y correo de cierre de semana (todo en memoria).
import { describe, it, expect, beforeEach } from "vitest";
import { servicio } from "../../src/lib/liga/servicio.js";
import { PREMIOS, codigoPremio, limpiarCodigoPremio } from "../../src/lib/liga/premios.js";
import { ganadoresDe, comprobarCodigo, semanaCerrada } from "../../src/lib/liga/ganadores.js";
import { cerrarSemanas, semanasPorAvisar } from "../../src/lib/liga/cierre.js";
import { correoGanador } from "../../src/lib/liga/correo.js";

const s = servicio();
const CIERRE = Date.parse("2026-11-21T11:00:00Z"); // sábado 21, 12:00 en Madrid

// 6 jugadores con puntos en la semana del 14 (el 6.º se queda sin premio)
async function semanaJugada() {
  s._reiniciar();
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const { usuario } = await s.verificar(`j${i}@x.es`, (await s.pedirCodigo(`j${i}@x.es`)).codigoDePrueba);
    await s.guardarPerfil(usuario.id, { apodo: `Jugador${i}`, clave: `jugador${i}`, pueblo: "x", novedades: false }, true);
    const p = await s.empezar(usuario.id, "canasta", "2026-11-16", 1, 1);
    await s.terminar(p.partida, usuario.id, "valida", 100 - i * 10, null, {});
    ids.push(usuario.id);
  }
  return ids;
}

describe("packs de premios", () => {
  it("la primera semana tiene 5 packs, del 1.º al 5.º, sin precios en euros y con sus logos", () => {
    const packs = PREMIOS["2026-11-14"];
    expect(packs.map((p) => p.puesto)).toEqual([1, 2, 3, 4, 5]);
    expect(JSON.stringify(packs)).not.toMatch(/€|euros?\b/i);
    expect(packs[0].texto).toMatch(/Ataraxia/);
    expect(packs[0].texto).toMatch(/Eros/);
    for (const p of packs) for (const n of p.negocios) expect(n.logo).toMatch(/^\/liga\/premios\/.+\.jpg$/);
    const todos = packs.flatMap((p) => p.negocios.map((n) => n.nombre));
    expect(new Set(todos).size).toBe(10); // los 10 negocios (con DLION y ESGAYA), cada uno una vez, 2 por pack
    for (const p of packs) expect(p.negocios).toHaveLength(2);
    expect(todos).toContain("DLION Personal Training Studio");
    for (const p of packs) for (const n of p.negocios) expect(n.instagram).toMatch(/^[a-z0-9._]+$/);
  });
});

describe("códigos", () => {
  it("salen siempre iguales para el mismo ganador y distintos para otro", async () => {
    const a = await codigoPremio("2026-11-14", 1, "u1", "secreto");
    expect(a).toMatch(/^CZ-1[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await codigoPremio("2026-11-14", 1, "u1", "secreto")).toBe(a);
    expect(await codigoPremio("2026-11-14", 1, "u2", "secreto")).not.toBe(a);
    expect(await codigoPremio("2026-11-14", 1, "u1", "otro")).not.toBe(a);
    expect(limpiarCodigoPremio(` ${a.toLowerCase().replace(/-/g, " ")} `)).toBe(a);
    expect(limpiarCodigoPremio("hola")).toBeNull();
  });
});

describe("ganadores y cierre", () => {
  beforeEach(semanaJugada);

  it("antes del cierre no hay ganadores; después, los 5 primeros con su pack", async () => {
    expect(semanaCerrada("2026-11-14", CIERRE - 60000)).toBe(false);
    expect(await ganadoresDe(s, "2026-11-14", { ahora: CIERRE + 5 * 60000 })).toEqual([]); // aún en el margen
    const g = await ganadoresDe(s, "2026-11-14", { ahora: CIERRE + 30 * 60000 });
    expect(g.map((x) => x.apodo)).toEqual(["Jugador0", "Jugador1", "Jugador2", "Jugador3", "Jugador4"]);
    expect(g[0].premio.titulo).toBe("Belleza y bienestar");
    const bueno = await comprobarCodigo(s, g[2].codigo, CIERRE + 30 * 60000);
    expect(bueno).toMatchObject({ puesto: 3, apodo: "Jugador2" });
    expect(await comprobarCodigo(s, "CZ-1AAAA-BBBB", CIERRE + 30 * 60000)).toBeNull();
  });

  it("manda un correo a cada ganador una sola vez y avisa a Alejandro", async () => {
    const guardado = {}, mandados = [], avisos = [];
    const deps = {
      env: { LIGA_SMTP_USUARIO: "liga@x.es", LIGA_SMTP_CLAVE: "x" },
      leer: async (k) => guardado[k] || null, guardar: async (k, v) => { guardado[k] = JSON.parse(JSON.stringify(v)); },
      mandar: async (para, c) => { mandados.push({ para, ...c }); }, telegram: async (t) => { avisos.push(t); },
    };
    const ahora = CIERRE + 70 * 60000;
    expect(semanasPorAvisar(ahora)).toEqual(["2026-11-14"]);
    await cerrarSemanas(s, ahora, deps);
    expect(mandados.map((m) => m.para)).toEqual(["j0@x.es", "j1@x.es", "j2@x.es", "j3@x.es", "j4@x.es"]);
    expect(mandados[0].asunto).toMatch(/Jugador0.*1\.º/);
    expect(mandados[0].texto).toMatch(/CZ-1/);
    expect(mandados[0].texto).not.toMatch(/€/);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/Jugador4/);
    // al día siguiente no se repite nada
    await cerrarSemanas(s, ahora + 86400000, deps);
    expect(mandados).toHaveLength(5);
    expect(avisos).toHaveLength(1);
    // pasados 3 días ya no se mira esa semana
    expect(semanasPorAvisar(CIERRE + 4 * 86400000)).toEqual([]);
  });

  it("sin la clave del correo no manda nada, pero le pasa la lista a Alejandro para hacerlo a mano", async () => {
    const mandados = [], avisos = [];
    await cerrarSemanas(s, CIERRE + 70 * 60000, {
      env: {}, leer: async () => null, guardar: async () => {}, mandar: async (p) => mandados.push(p), telegram: async (t) => avisos.push(t),
    });
    expect(mandados).toHaveLength(0);
    expect(avisos[0]).toMatch(/SIN mandar/);
    expect(avisos[0]).toMatch(/j0@x\.es/);
  });

  it("si no puede leer a quién avisó ya, no manda nada (para no repetir)", async () => {
    const mandados = [];
    await cerrarSemanas(s, CIERRE + 70 * 60000, {
      env: { LIGA_SMTP_USUARIO: "a", LIGA_SMTP_CLAVE: "b" }, leer: async () => { throw new Error("caído"); },
      guardar: async () => {}, mandar: async (p) => mandados.push(p), telegram: async () => {},
    });
    expect(mandados).toHaveLength(0);
  });
});

describe("el correo", () => {
  it("lleva premio, código, cómo canjearlo y escapa el apodo", () => {
    const c = correoGanador({ apodo: "<b>Pepe</b>", puesto: 2, codigo: "CZ-2ABCD-EFGH", premio: PREMIOS["2026-11-14"][1] }, { desde: "2026-11-14", cierre: "2026-11-21" });
    expect(c.texto).toMatch(/2\.º/);
    expect(c.texto).toMatch(/14 de noviembre.*21 de noviembre/);
    expect(c.texto).toMatch(/Floristería La Cala/);
    expect(c.html).not.toMatch(/<b>Pepe<\/b>/);
    expect(c.html).toMatch(/CZ-2ABCD-EFGH/);
    expect(c.texto).toMatch(/@floristerialacala/);
    expect(c.html).toMatch(/instagram\.com\/floristerialacala/);
    expect(c.texto).toMatch(/Liga Cazurra de Cazurronics\. Mi código de ganador es CZ-2ABCD-EFGH/);
  });
});
