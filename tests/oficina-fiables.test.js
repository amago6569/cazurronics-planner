// npm test — Fuentes fiables (lista blanca, páginas que nombran el evento, dos webs), avisos que no esperan
// y la tarjeta de gasto. Sin Google de verdad: la IA y las webs se simulan.
import { beforeEach, describe, expect, it, vi } from "vitest";

const prompts = [];
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async (prompt) => { prompts.push(prompt); return { texto: "[]", dominios: new Set() }; }),
}));
const paginas = {}; // url → texto (las que no están, tardan)
vi.stubGlobal("fetch", vi.fn(async (url) => {
  if (paginas[url] == null) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  return { status: 200, ok: true, body: null, json: async () => ({}), text: async () => paginas[url] };
}));

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon, registrarGastoIA, leerGastoDias, EUROS_POR_DOLAR } = await import("../src/lib/estadisticas");
const ev = await import("../src/lib/eventos");
const { segundaComprobacion, ordenarRepesca } = await import("../src/lib/guardia");
const { esOficial, paginaLoNombra, websDistintas, textoDeHtml } = await import("../src/lib/fiables");
const { avisosPendientes } = await import("../src/lib/avisos");
const { montarOficina } = await import("../src/lib/oficina");
const { apuntarRendimiento, fallanSeguido } = await import("../src/lib/novedades");

const dia = (n, desde = hoyEnLeon()) => { const d = new Date(`${desde}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const evento = (titulo, fuente, extra = {}) => ({ titulo, fecha: dia(3), localidad: "Boñar", lugar: "Plaza", fuente, empleado: "fiestas", ...extra });

beforeEach(async () => {
  prompts.length = 0;
  for (const k of Object.keys(paginas)) delete paginas[k];
  for (const k of ["eventos:bandeja", "eventos:tirados", "eventos:sinConfirmar", "oficina:charla", `ia:gratis:${hoyEnLeon()}`, `ia:dia:${hoyEnLeon()}`]) await comando(["DEL", k]);
});

describe("¿la página nombra el evento?", () => {
  const e = { fecha: "2026-11-21", localidad: "Boñar" };
  it("vale con la fecha escrita de varias formas, el pueblo y el año que toca", () => {
    expect(paginaLoNombra("Sábado 21 de noviembre de 2026 en Boñar, magosto popular con castañas.", e)).toBe(true);
    expect(paginaLoNombra("Fiestas en BOÑAR · 21/11/2026 · música y castañas para todos los vecinos", e)).toBe(true);
    expect(paginaLoNombra("Programa de Boñar: 2026-11-21 magosto en la plaza a partir de las seis", e)).toBe(true);
  });
  it("no vale si falta la fecha, el pueblo o la página es de otro año", () => {
    expect(paginaLoNombra("Magosto en Boñar el 22 de noviembre de 2026, con castañas y música.", e)).toBe(false);
    expect(paginaLoNombra("Magosto en Cistierna el 21 de noviembre de 2026, con castañas y música.", e)).toBe(false);
    expect(paginaLoNombra("Magosto en Boñar el 21 de noviembre de 2025, con castañas y música.", e)).toBe(false);
    expect(paginaLoNombra("1 de noviembre", { fecha: "2026-11-21" })).toBe(false);
  });
  it("lee el texto visible, sin scripts", () => {
    expect(textoDeHtml("<p>Hola&nbsp;León</p><script>var a='21 de noviembre'</script>")).not.toMatch(/noviembre/);
  });
});

describe("lista blanca y dos webs", () => {
  it("reconoce ayuntamientos, Diputación, Junta y prensa local", () => {
    for (const u of ["https://www.aytoleon.es/x", "https://aytoastorga.es/agenda", "https://www.dipuleon.es/a", "https://cultura.jcyl.es/b", "https://www.diariodeleon.es/c"]) expect(esOficial(u)).toBe(true);
    for (const u of ["https://www.facebook.com/x", "https://agendaleon.example/x", "nada"]) expect(esOficial(u)).toBe(false);
  });
  it("cuenta webs distintas", () => {
    expect(websDistintas({ fuente: "https://a.es/1", fuentesVistas: ["https://www.a.es/2"] })).toBe(1);
    expect(websDistintas({ fuente: "https://a.es/1", fuentesVistas: ["https://b.es/2"] })).toBe(2);
  });
  it("si el mismo evento llega de otra web, la bandeja lo apunta sin perder sus vueltas", async () => {
    await ev.guardarDudosos([evento("Magosto", "https://a.example/1")]);
    const id = (await ev.leerBandeja())[0].id;
    const crudo = JSON.parse(await comando(["HGET", "eventos:bandeja", id]));
    await comando(["HSET", "eventos:bandeja", id, JSON.stringify({ ...crudo, vueltas: 1 })]);
    await ev.guardarDudosos([evento("Magosto", "https://www.a.example/otra"), evento("Magosto", "https://b.example/2")]);
    const [e] = await ev.leerBandeja();
    expect(e.vueltas).toBe(1);
    expect(websDistintas(e)).toBe(2);
  });
});

describe("🕵️ Verificador sin Google", () => {
  it("confirma por dos webs, por web oficial o porque la página lo dice; lo demás va a Google", async () => {
    await ev.guardarDudosos([
      evento("Magosto doble", "https://a.example/1"), evento("Magosto doble", "https://b.example/2"),
      evento("Feria oficial", "https://aytobonar.es/feria"),
      evento("Concierto con página", "https://sala.example/concierto"),
      evento("Ruta muda", "https://club.example/ruta"),
    ]);
    paginas["https://sala.example/concierto"] = `<p>${Number(dia(3).slice(8))}/${Number(dia(3).slice(5, 7))}/${dia(3).slice(0, 4)} concierto en Boñar, entrada libre para todos.</p>`;
    paginas["https://club.example/ruta"] = "<p>Bienvenidos a nuestro club de montaña. Próximas rutas muy pronto, estad atentos.</p>";
    const parte = await segundaComprobacion();
    expect(parte).toMatchObject({ confirmados: 3, sinGoogle: 3, preguntas: 1 });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatch(/Ruta muda/);
    expect(prompts[0]).not.toMatch(/Magosto doble|Feria oficial|Concierto con página/);
  });
});

describe("👍 Vale quita la marca «por confirmar»", () => {
  it("lo deja en la web sin la marca", async () => {
    const e = evento("Filandón", "https://club.example/filandon");
    await ev.sumarALaAgenda([{ ...e, verificado: true, porConfirmar: true }], hoyEnLeon(), dia(20));
    await ev.apuntarSinConfirmar([e]);
    const [aviso] = await ev.leerSinConfirmar();
    expect((await ev.decidirSinConfirmar(aviso.id, "vale")).exito).toBe(true);
    const enWeb = (await ev.eventosProximos()).flatMap((d) => d.eventos).find((x) => x.titulo === "Filandón");
    expect(enWeb).toBeTruthy();
    expect(enWeb.porConfirmar).toBeUndefined();
  });
});

describe("🚑 Repesca: primero el finde", () => {
  it("pone delante lo que cubre este fin de semana", () => {
    const lunes = "2026-11-02";
    const cola = [{ b: { nombre: "lejos", desde: "2026-11-16" } }, { b: { nombre: "cerca", desde: "2026-11-02" } }, { b: { nombre: "domingo", desde: "2026-11-08" } }];
    expect(ordenarRepesca(cola, lunes).map((r) => r.b.nombre)).toEqual(["cerca", "domingo", "lejos"]);
  });
});

describe("avisos y gasto", () => {
  it("avisa ya de la clave, del modelo retirado y de un día de más de 1 €", () => {
    const barrido = { fuentes: { a: { ok: false, tipo: "clave" }, b: { ok: false, tipo: "lento" }, c: { ok: true } } };
    expect(avisosPendientes({ barrido, gasto: { hoy: 0.4 } }).map((a) => a.tipo)).toEqual(["clave"]);
    expect(avisosPendientes({ barrido: { fuentes: { a: { ok: false, tipo: "modelo" } } }, gasto: { hoy: 1.2 } }).map((a) => a.tipo)).toEqual(["modelo", "gasto"]);
    expect(avisosPendientes({ barrido: { fuentes: { a: { ok: false, tipo: "saturado" } } }, gasto: { hoy: 0.2 } })).toEqual([]);
  });
  it("suma el gasto del día en euros y estira el mes", async () => {
    await registrarGastoIA("planes", { dolares: 0.5 });
    const g = await leerGastoDias(10);
    expect(g.hoy).toBeCloseTo(0.5 * EUROS_POR_DOLAR, 2);
    expect(g.mes).toBeCloseTo(10 * EUROS_POR_DOLAR, 2);
    expect(g.prevision).toBeGreaterThanOrEqual(g.mes);
  });
  it("el jefe solo nombra a quien falla dos días seguidos, y avisa si el día pasa de 1 €", async () => {
    const ahora = Date.now();
    await apuntarRendimiento({ musica: { fallos: 1 }, teatro: { fallos: 2 } }, ahora - 86400000);
    await apuntarRendimiento({ musica: { fallos: 1 }, deporte: { fallos: 1 } }, ahora);
    const seguidos = await fallanSeguido(ahora);
    expect(seguidos).toEqual(["musica"]);
    const partes = { musica: { fin: new Date().toISOString(), error: "lento" }, deporte: { fin: new Date().toISOString(), error: "lento" } };
    const lineas = montarOficina(partes, { fallanSeguido: seguidos, gasto: { hoy: 1.3, ayer: 0, mes: 2, prevision: 6 } }).jefe.lineas.join(" ");
    expect(lineas).toMatch(/dos días seguidos: Música/i);
    expect(lineas).not.toMatch(/Deporte/);
    expect(lineas).toMatch(/1,30 €/);
  });
});
