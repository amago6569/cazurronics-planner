import { beforeEach, describe, expect, it } from "vitest";
import { comando } from "../src/lib/almacen";
import { registrarAccionTienda, topTiendas } from "../src/lib/lugares";

describe("gestos en las tiendas de la Despensa", () => {
  beforeEach(async () => { await comando(["DEL", "ranking:tiendas"]); });

  it("cuenta «Cómo llegar» y ordena por interés", async () => {
    const a = { id: "t-a", nombre: "Quesería", localidad: "Valdeón" }, b = { id: "t-b", nombre: "Cecinas", localidad: "Astorga" };
    await registrarAccionTienda(a, "como_llegar");
    await registrarAccionTienda(b, "como_llegar");
    await registrarAccionTienda(b, "web_tienda");
    const top = await topTiendas();
    expect(top[0]).toMatchObject({ id: "t-b", nombre: "Cecinas", web: 1 });
    expect(top.map((t) => t.id)).toContain("t-a");
  });

  it("no deja cambiar el nombre de una tienda ya apuntada", async () => {
    await registrarAccionTienda({ id: "t-f", nombre: "La buena", localidad: "León" }, "como_llegar");
    await registrarAccionTienda({ id: "t-f", nombre: "Otro nombre", localidad: "Otro" }, "como_llegar");
    expect((await topTiendas()).find((t) => t.id === "t-f")).toMatchObject({ nombre: "La buena", localidad: "León", llegar: 2 });
  });

  it("no apunta nada raro", async () => {
    await registrarAccionTienda({ id: "con espacios", nombre: "X" }, "como_llegar");
    await registrarAccionTienda({ id: "t-c", nombre: "Mira https://spam.example" }, "como_llegar");
    await registrarAccionTienda({ id: "t-g", nombre: "Entra en evil.com" }, "como_llegar");
    await registrarAccionTienda({ id: "t-d", nombre: "" }, "como_llegar");
    await registrarAccionTienda({ id: "t-e", nombre: "Bien" }, "borrar");
    expect(await topTiendas()).toEqual([]);
  });
});
