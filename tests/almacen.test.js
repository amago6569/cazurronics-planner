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
  const bar = { titulo: "Bar La Tapa", tipo: "bar", placeId: "ChIJtest123" };
  const museo = { titulo: "Museo de León", tipo: "museo" };

  it("lee varios sitios de una vez, en el mismo orden y con null donde no hay", async () => {
    const paradas = [bar, museo].map((p) => ({ ...p, lugarId: claveLugar(p) }));
    await registrarApariciones(paradas);
    await registrarApariciones(paradas.slice(0, 1));
    const [a, nada, b] = await leerLugares([paradas[0].lugarId, "s_no-existe", paradas[1].lugarId]);
    expect(a).toMatchObject({ nombre: "Bar La Tapa", clave: "p_ChIJtest123", stats: { apariciones: 2 } });
    expect(nada).toBeNull();
    expect(b).toMatchObject({ nombre: "Museo de León", stats: { apariciones: 1 } });
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
