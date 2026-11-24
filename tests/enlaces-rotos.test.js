// npm test — Enlaces inventados: la IA acierta la web pero no la página (Expojoven «hasta el 27» con un 404)
import { describe, expect, it, vi } from "vitest";

const webs = { "https://leonjoven.example/agenda/expojoven": 404, "https://leonjoven.example/agenda/bien": 200 };
vi.stubGlobal("fetch", vi.fn(async (url) => {
  const estado = webs[url];
  if (estado == null) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  return { status: estado, ok: estado < 400, body: null };
}));

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon } = await import("../src/lib/estadisticas");
const { verificarFuentes, quitarEnlacesRotos, eventosDelDia } = await import("../src/lib/eventos");

describe("enlaces de una web consultada", () => {
  it("un 404 se tira aunque Google consultara esa web; si no contesta, entra", async () => {
    const lista = [
      { titulo: "Expojoven", fecha: "2030-11-21", fuente: "https://leonjoven.example/agenda/expojoven" },
      { titulo: "Taller", fecha: "2030-11-21", fuente: "https://leonjoven.example/agenda/bien" },
      { titulo: "Charla", fecha: "2030-11-21", fuente: "https://leonjoven.example/agenda/lenta" },
    ];
    const { buenos, descartados } = await verificarFuentes(lista, new Set(["leonjoven.example"]));
    expect(buenos.map((e) => e.titulo)).toEqual(["Taller", "Charla"]);
    expect(descartados.map((e) => e.motivo)).toEqual(["mal"]);
  });

  it("lo ya subido con enlace roto sale de la agenda", async () => {
    const hoy = hoyEnLeon();
    await comando(["SET", `eventos:${hoy}`, JSON.stringify([
      { titulo: "Expojoven 2026", fecha: hoy, fuente: "https://leonjoven.example/agenda/expojoven", localidad: "León" },
      { titulo: "Concierto", fecha: hoy, fuente: "https://leonjoven.example/agenda/bien", localidad: "León" },
    ])]);
    const r = await quitarEnlacesRotos({ dias: 1 });
    expect(r.quitados).toBe(1);
    expect((await eventosDelDia(hoy)).map((e) => e.titulo)).toEqual(["Concierto"]);
  });
});
