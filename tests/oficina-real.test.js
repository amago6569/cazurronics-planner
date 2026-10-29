// npm test — Oficina real: lo que se dicen los empleados, cuánto rinde cada uno, el jefe por chat y el gasto de búsquedas
import { beforeEach, describe, expect, it, vi } from "vitest";

const respuestas = [];
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async () => ({ texto: respuestas.shift() ?? "[]", dominios: new Set() })),
}));

const { apuntarCharla, charlaDeTurno, leerCharla } = await import("../src/lib/charla");
const { apuntarRendimiento, leerRendimiento } = await import("../src/lib/novedades");
const { registrarGastoIA, leerGastoIA, hoyEnLeon, BUSQUEDAS_GRATIS_DIA } = await import("../src/lib/estadisticas");
const { hablarConJefe } = await import("../src/lib/jefe");
const { leerEncargos } = await import("../src/lib/eventos");
const { montarOficina } = await import("../src/lib/oficina");
const { comando } = await import("../src/lib/almacen");

beforeEach(async () => {
  respuestas.length = 0;
  for (const k of ["oficina:charla", "oficina:encargos", `oficina:rinde:${hoyEnLeon()}`, `ia:gratis:${hoyEnLeon()}`]) await comando(["DEL", k]);
});

describe("charla de la oficina", () => {
  it("cada caso del turno sale como una conversación con datos reales", () => {
    const l = charlaDeTurno({
      musica: { busquedas: 6, entran: [{ titulo: "Concierto en El Gran Café" }, { titulo: "Jazz en Bebop" }, { titulo: "Folk en Boñar" }], repetidos: [], dudosos: [] },
      noche: { busquedas: 6, entran: [], repetidos: [{ titulo: "Sesión DJ en Babia" }], dudosos: [] },
      fiestas: { busquedas: 6, entran: [], repetidos: [], dudosos: [{ titulo: "Magosto de Vegacervera" }] },
      expo: { busquedas: 6, entran: [], repetidos: [], dudosos: [] },
      teatros: { busquedas: 1, error: "tardó demasiado", entran: [], repetidos: [], dudosos: [] },
    });
    const de = (id) => l.filter((x) => x.de === id || x.a === id).map((x) => x.texto).join(" | ");
    expect(de("musica")).toMatch(/Traigo 3 eventos nuevos: «Concierto en El Gran Café» y «Jazz en Bebop» y 1 más/);
    expect(de("noche")).toMatch(/¿Tenemos ya «Sesión DJ en Babia»\?.*Sí, ya estaba/);
    expect(de("fiestas")).toMatch(/Magosto de Vegacervera/);
    expect(l.some((x) => x.a === "tu" && /bandeja/.test(x.texto))).toBe(true);
    expect(de("expo")).toMatch(/¿Cómo vas\?.*Nada nuevo en 6 búsquedas/);
    expect(de("teatros")).toMatch(/No he podido terminar: tardó demasiado/);
  });

  it("se guarda y se lee de la más antigua a la más reciente", async () => {
    await apuntarCharla([{ de: "musica", texto: "uno" }, { de: "jefe", a: "musica", texto: "dos" }]);
    await apuntarCharla([{ de: "noche", texto: "tres" }]);
    expect((await leerCharla()).map((x) => x.texto)).toEqual(["uno", "dos", "tres"]);
    expect((await leerCharla())[0].a).toBe("jefe");
  });
});

describe("rendimiento por empleado", () => {
  it("suma búsquedas y eventos nuevos y saca los nuevos por búsqueda", async () => {
    await apuntarRendimiento({ musica: { busquedas: 6 }, pueblos: { busquedas: 10 } });
    await apuntarRendimiento({ musica: { nuevos: 3 } });
    const r = await leerRendimiento(14);
    expect(r.musica).toMatchObject({ busquedas: 6, nuevos: 3, porBusqueda: 0.5, dias: 1 });
    expect(r.pueblos).toMatchObject({ busquedas: 10, nuevos: 0, porBusqueda: 0 });
  });

  it("el jefe avisa de quien lleva una semana sin traer nada", () => {
    const o = montarOficina({}, { rendimiento: { pueblos: { busquedas: 40, nuevos: 0, dias: 8 }, musica: { busquedas: 40, nuevos: 9, dias: 8 } } });
    const texto = o.jefe.lineas.join(" ");
    expect(texto).toMatch(/no han traído nada nuevo: Pueblos/);
    expect(texto).not.toMatch(/Música en directo\. Se les/);
  });
});

describe("gasto de búsquedas de los 2.x", () => {
  it("son gratis hasta 1.500 al día y se cobran a partir de ahí", async () => {
    const antes = (await leerGastoIA())[0].tareas.find((t) => t.tarea === "prueba-gratis")?.dolares || 0;
    await registrarGastoIA("prueba-gratis", { dolares: 0, peticionGratis: 1, precioPeticion: 0.035 });
    let ahora = (await leerGastoIA())[0].tareas.find((t) => t.tarea === "prueba-gratis").dolares;
    expect(ahora - antes).toBeCloseTo(0, 6);
    await comando(["SET", `ia:gratis:${hoyEnLeon()}`, String(BUSQUEDAS_GRATIS_DIA)]);
    await registrarGastoIA("prueba-gratis", { dolares: 0, peticionGratis: 1, precioPeticion: 0.035 });
    ahora = (await leerGastoIA())[0].tareas.find((t) => t.tarea === "prueba-gratis").dolares;
    expect(ahora - antes).toBeCloseTo(0.035, 6);
  });
});

describe("hablar con el jefe", () => {
  it("una orden por chat se convierte en un encargo para el empleado (0 €) y queda en la charla", async () => {
    respuestas.push(JSON.stringify({ tipo: "orden", empleado: "musica", accion: "encargo", texto: "conciertos en El Gran Café", ya: false }));
    const r = await hablarConJefe("Que Música mire los conciertos de El Gran Café", { desde: "telegram" });
    expect(r.respuesta).toMatch(/Apuntado\. 🎸 Música en directo buscará «conciertos en El Gran Café»/);
    expect((await leerEncargos()).musica.map((x) => x.texto)).toEqual(["conciertos en El Gran Café"]);
    const charla = await leerCharla();
    expect(charla[0]).toMatchObject({ de: "tu", a: "jefe" });
    expect(charla.some((x) => x.de === "jefe" && x.a === "musica")).toBe(true);
  });

  it("por Telegram no lanza un turno entero: lo deja para su próximo turno", async () => {
    respuestas.push(JSON.stringify({ tipo: "orden", empleado: "noche", accion: "trabajar" }));
    const r = await hablarConJefe("pon a trabajar a Noche", { desde: "telegram" });
    expect(r.orden.accion).toBe("encargo");
  });

  it("un empleado que no existe no se inventa: va como pregunta", async () => {
    respuestas.push(JSON.stringify({ tipo: "orden", empleado: "becario", accion: "encargo", texto: "x" }), "Esta semana 120 planes.");
    const r = await hablarConJefe("¿cuántos planes?", { desde: "panel" });
    expect(r.orden).toBeUndefined();
    expect(r.respuesta).toBe("Esta semana 120 planes.");
  });
});

describe("captación por Telegram", () => {
  it("tarjeta con sus cifras, ✅ sin contacto avisa, con correo abre Gmail con el texto y lo marca como contactado", async () => {
    const { registrarApariciones, registrarAccionLugar } = await import("../src/lib/lugares");
    const { guardarAjustes, guardarSeguimiento, leerSeguimientos } = await import("../src/lib/captacion");
    const { tarjetasCaptacion, pulsarBoton } = await import("../src/lib/jefe");
    await guardarAjustes({ apariciones: 2, interacciones: 1 });
    const parada = { lugarId: "p_mesonprueba", titulo: "Mesón Prueba", placeId: "mesonprueba", nombreGoogle: "Mesón Prueba", tipo: "restaurante", tiposGoogle: ["restaurant"], lat: 42.6, lon: -5.57 };
    await registrarApariciones([parada]);
    await registrarApariciones([parada]);
    await registrarAccionLugar("p_mesonprueba", "detalle");

    const tarjetas = await tarjetasCaptacion();
    const t = tarjetas.find((x) => x.texto.includes("Mesón Prueba"));
    expect(t.texto).toMatch(/2 veces en planes · 1 fichas abiertas/);
    expect(t.botones[0].map((b) => b.text)).toEqual(["✅ Enviar", "✏️ Cambiar", "✖ No"]);
    // Ya avisado: mañana no se repite
    expect((await tarjetasCaptacion()).some((x) => x.texto.includes("Mesón Prueba"))).toBe(false);

    expect((await pulsarBoton("c:s:p_mesonprueba")).respuesta).toMatch(/no tengo Instagram ni correo/);
    await guardarSeguimiento("p_mesonprueba", { email: "hola@mesonprueba.es" });
    const r = await pulsarBoton("c:s:p_mesonprueba");
    expect(r.botones[0][0].url).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=hola%40mesonprueba\.es/);
    expect(r.respuesta).toMatch(/Mesón Prueba ya sale en esos planes/);
    expect((await leerSeguimientos()).p_mesonprueba.estado).toBe("contactado");
  });
});
