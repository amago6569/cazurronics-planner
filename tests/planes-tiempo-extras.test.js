// npm test — Cuándo un día es malo para estar fuera y qué paradas no pedidas se quitan
import { describe, expect, it } from "vitest";
import { clasificarTiempo } from "../src/lib/planUtils";
import { quitarNoPedidas } from "../src/lib/intencion";

describe("clasificarTiempo", () => {
  it("un día de lluvia seguida es malo aunque el código diga chubascos ligeros", () => {
    expect(clasificarTiempo({ codigo: 80, lluviaMm: 7.9, horasLluvia: 17, rachaKmh: 30 })).toBe("malo");
  });
  it("también la lluvia fuerte, la tormenta y el viento", () => {
    expect(clasificarTiempo({ codigo: 95 })).toBe("malo");
    expect(clasificarTiempo({ codigo: 3, rachaKmh: 60 })).toBe("malo");
  });
  it("llovizna corta, frío o datos que faltan no lo hacen malo", () => {
    expect(clasificarTiempo({ codigo: 51, lluviaMm: 1, horasLluvia: 3, rachaKmh: 20 })).toBe("normal");
    expect(clasificarTiempo({ codigo: 0, lluviaMm: 0, horasLluvia: 0, rachaKmh: 10 })).toBe("normal");
    expect(clasificarTiempo({ codigo: 3 })).toBe("normal");
    expect(clasificarTiempo()).toBe("normal");
  });
});

describe("quitarNoPedidas", () => {
  const mercado = { titulo: "Mercado del Conde Luna", tipo: "mercadillo", descripcion: "Productos frescos" };
  const tapeo = { titulo: "Tapeo por el Barrio Húmedo", tipo: "bar" };
  const cena = { titulo: "Cena de cocido", tipo: "restaurante" };

  it("quita el mercado que nadie ha pedido", () => {
    expect(quitarNoPedidas([mercado, tapeo, cena], "Tapeo por el Húmedo y cenar cocido")).toEqual([tapeo, cena]);
  });
  it("lo quita aunque la IA lo etiquete como evento", () => {
    const comoEvento = { ...mercado, tipo: "evento" };
    expect(quitarNoPedidas([comoEvento, tapeo], "tapeo y unas cañas en el bar")).toEqual([tapeo]);
  });
  it("lo deja si se pide mercado, compras o algo típico", () => {
    for (const pide of ["mercadillo y vermú", "comer y comprar productos de la tierra", "comer algo típico"]) {
      expect(quitarNoPedidas([mercado, tapeo], pide)).toEqual([mercado, tapeo]);
    }
  });
  it("lo deja en un plan abierto o sin tema reconocido", () => {
    for (const pide of ["sorpréndeme", "un plan para pasar el día comiendo bien", "Plan de naturaleza", ""]) {
      expect(quitarNoPedidas([mercado, tapeo], pide)).toEqual([mercado, tapeo]);
    }
  });
  it("no confunde un monumento o un restaurante con un mercado por su nombre", () => {
    const iglesia = { titulo: "Iglesia de Nuestra Señora del Mercado", tipo: "monumento" };
    const rest = { titulo: "Restaurante La Cocina del Mercado", tipo: "restaurante" };
    expect(quitarNoPedidas([iglesia, rest], "ver monumentos y cenar")).toEqual([iglesia, rest]);
  });
  it("entiende plurales: una feria de lo pedido se queda", () => {
    const feria = { titulo: "Feria de la Tapa", tipo: "feria" };
    expect(quitarNoPedidas([feria, tapeo], "ir de tapas y cenar")).toEqual([feria, tapeo]);
  });
  it("no le salva nombrar el barrio o la alternativa en la descripción", () => {
    const otro = { ...mercado, descripcion: "Junto al Barrio Húmedo. (Alternativa: tapeo en el centro)" };
    expect(quitarNoPedidas([otro, tapeo, cena], "Tapeo por el Húmedo y cenar cocido")).toEqual([tapeo, cena]);
  });
  it("con muchos mercados quita hasta la mitad en vez de ninguno", () => {
    const otroMercado = { titulo: "Mercadillo de Trobajo", tipo: "mercadillo" };
    expect(quitarNoPedidas([mercado, otroMercado, tapeo], "tapeo")).toEqual([otroMercado, tapeo]);
  });
  it("no toca lo que no es mercado ni deja el plan vacío", () => {
    const museo = { titulo: "Museo de León", tipo: "museo" };
    expect(quitarNoPedidas([museo, tapeo], "tapeo")).toEqual([museo, tapeo]);
    expect(quitarNoPedidas([mercado], "cenar cocido")).toEqual([mercado]);
  });
  it("una parada que dice lo pedido se queda", () => {
    const feria = { titulo: "Feria del vino", tipo: "feria" };
    expect(quitarNoPedidas([feria, tapeo], "beber vino y tapeo")).toEqual([feria, tapeo]);
  });
});
