// npm test — Lo que usa el almacén (en memoria, sin Redis): votos, locales y freno anti-abuso
import { describe, expect, it } from "vitest";
import { leerLugar, leerLugares, registrarApariciones, topLugares, claveLugar } from "../src/lib/lugares";
import { resumirVotos, resumenVotos, votar } from "../src/lib/votos";
import { dentroDelLimite } from "../src/lib/freno";

const peticionDesde = (ip) => new Request("http://localhost/api/plan", { headers: { "x-forwarded-for": ip } });

describe("votos", () => {
  it("resume votos por parada, los míos y cuánta gente ha votado", () => {
    const crudo = ["0|ana", "1", "0|luis", "-1", "1|ana", "1", "1|eva", "0"];
    expect(resumirVotos(crudo, 2, "ana")).toEqual({
      porParada: [{ arriba: 1, abajo: 1 }, { arriba: 1, abajo: 0 }],
      mios: [1, 1],
      participantes: 2,
    });
  });

  it("guarda y relee un voto", async () => {
    await votar("planTest01", 0, "votante-1", 1);
    await votar("planTest01", 1, "votante-1", -1);
    const r = await resumenVotos("planTest01", 2, "votante-1");
    expect(r.mios).toEqual([1, -1]);
    expect(r.participantes).toBe(1);
  });
});

describe("lugares", () => {
  // Desde que solo se guardan negocios con ficha real de Google, el bar necesita su nombre en Google; el museo no se guarda
  const bar = { titulo: "Bar La Tapa", tipo: "bar", placeId: "ChIJtest123", nombreGoogle: "Bar La Tapa" };
  const museo = { titulo: "Museo de León", tipo: "museo" };

  it("lee varios sitios de una vez, en el mismo orden y con null donde no hay (ni donde no es un negocio)", async () => {
    const paradas = [bar, museo].map((p) => ({ ...p, lugarId: claveLugar(p) }));
    await registrarApariciones(paradas);
    await registrarApariciones(paradas.slice(0, 1));
    const [a, nada, b] = await leerLugares([paradas[0].lugarId, "s_no-existe", paradas[1].lugarId]);
    expect(a).toMatchObject({ nombre: "Bar La Tapa", clave: "p_ChIJtest123", stats: { apariciones: 2 } });
    expect(nada).toBeNull();
    expect(b).toBeNull();
    expect(await leerLugar("clave mala")).toBeNull();
  });

  it("el ranking sale ordenado y con su ficha", async () => {
    const top = await topLugares("ranking:apariciones", 5);
    expect(top[0]).toMatchObject({ clave: "p_ChIJtest123", puntos: 2 });
  });
});

describe("freno anti-abuso", () => {
  it("deja pasar hasta el máximo y luego frena, por conexión", async () => {
    const resultados = [];
    for (let i = 0; i < 4; i++) resultados.push(await dentroDelLimite(peticionDesde("1.2.3.4"), "prueba", 3, 60));
    expect(resultados).toEqual([true, true, true, false]);
    expect(await dentroDelLimite(peticionDesde("5.6.7.8"), "prueba", 3, 60)).toBe(true);
  });
});

describe("gasto de la IA por tarea", () => {
  it("suma llamadas, tokens y coste por tarea, la más cara primero", async () => {
    const { registrarGastoIA, leerGastoIA } = await import("../src/lib/estadisticas");
    await registrarGastoIA("barrido-eventos", { entrada: 1000, salida: 20000, consultas: 3, dolares: 0.043 });
    await registrarGastoIA("barrido-eventos", { entrada: 500, salida: 4000, consultas: 1, dolares: 0.037 });
    await registrarGastoIA("planes", { entrada: 2000, salida: 800, consultas: 0, dolares: 0.004 });
    const [esteMes, mesPasado] = await leerGastoIA();
    expect(esteMes.mes).toMatch(/^\d{4}-\d{2}$/);
    expect(mesPasado.mes < esteMes.mes).toBe(true);
    expect(esteMes.tareas[0]).toMatchObject({ tarea: "barrido-eventos", llamadas: 2, entrada: 1500, salida: 24000, busquedas: 4 });
    expect(esteMes.tareas[0].dolares).toBeCloseTo(0.08, 6);
    expect(esteMes.tareas[1]).toMatchObject({ tarea: "planes", llamadas: 1 });
  });
});
