// npm test — La guardia de la oficina (Verificador y Repesca), la reunión, los chats con cada empleado y que un
// empleado nuevo tenga su mesa. Sin llamar a Google de verdad: la IA y las webs se simulan.
import { beforeEach, describe, expect, it, vi } from "vitest";

const respuestas = []; // lo que contestará la IA, en orden
const prompts = [];
vi.mock("../src/lib/gemini", async (original) => ({
  ...(await original()),
  llamarGemini: vi.fn(async (prompt) => {
    prompts.push(prompt);
    const r = respuestas.shift();
    if (r instanceof Error) throw r;
    return r || { texto: "[]", dominios: new Set() };
  }),
}));

// Las webs: lo que acaba en /no-existe da 404; facebook no se mira; lo demás tarda (y se queda en duda)
const webs = { "https://ayto.example/ok": 200, "https://ayto.example/no-existe": 404, "https://diario.example/confirmado": 200 };
vi.stubGlobal("fetch", vi.fn(async (url) => {
  const estado = webs[url];
  if (estado == null) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  return { status: estado, ok: estado < 400, body: null, json: async () => ({}), text: async () => paginas[url] || "" };
}));
// Lo que dice cada página (para ver si nombra el evento: fecha, pueblo y año)
const paginas = {};

const { comando } = await import("../src/lib/almacen");
const { hoyEnLeon } = await import("../src/lib/estadisticas");
const ev = await import("../src/lib/eventos");
const { segundaComprobacion, turnoDeRepesca, leerVeredictos } = await import("../src/lib/guardia");
const { motivoClaro, ErrorIA } = await import("../src/lib/gemini");
const { montarReunion } = await import("../src/lib/reunion");
const { DEPARTAMENTOS, montarOficina } = await import("../src/lib/oficina");
const { hablarConEmpleado, estadoEnPalabras } = await import("../src/lib/jefe");
const { planta, SALAS } = await import("../src/app/panel/oficina/guion");
const { dondeEsta } = await import("../src/lib/turnos");
const vida = await import("../src/app/panel/oficina/vida");

const dia = (n) => { const d = new Date(`${hoyEnLeon()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const evento = (titulo, fuente, extra = {}) => ({ titulo, fecha: dia(3), localidad: "León", lugar: "Plaza Mayor", fuente, empleado: "fiestas", ...extra });
async function aLaBandeja(lista) {
  await comando(["HSET", "eventos:bandeja", ...lista.flatMap((e) => [ev.idDudoso(e), JSON.stringify({ ...e, encontrado: new Date().toISOString() })])]);
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const paginaQueNombra = (fecha, pueblo) => `<html><body><h1>Fiestas</h1><p>El ${Number(fecha.slice(8))} de ${MESES[Number(fecha.slice(5, 7)) - 1]} de ${fecha.slice(0, 4)}, en ${pueblo}, gran magosto popular con castañas y música.</p><script>var x = 1;</script></body></html>`;
const enAgenda = async () => ((await ev.eventosProximos()).flatMap((d) => d.eventos));

beforeEach(async () => {
  respuestas.length = 0; prompts.length = 0;
  for (const k of ["eventos:bandeja", "eventos:tirados", "eventos:sinConfirmar", "oficina:repesca", "oficina:charla", "oficina:pausas", "oficina:encargos", "oficina:enCurso", `ia:gratis:${hoyEnLeon()}`]) await comando(["DEL", k]);
  for (let i = 0; i < 21; i++) await comando(["DEL", `eventos:${dia(i)}`]);
});

describe("motivo de los fallos, en cristiano", () => {
  const err = (...fallos) => Object.assign(new ErrorIA("x", 502), { fallos });
  it("distingue Google lento, saturado, cupo, clave y caído", () => {
    expect(motivoClaro(err("gemini-2.5-flash-lite: tardó demasiado")).tipo).toBe("lento");
    expect(motivoClaro(err("gemini-2.5-flash-lite: 429 Resource exhausted")).tipo).toBe("saturado");
    expect(motivoClaro(err("gemini-2.0-flash: 429 Quota exceeded for metric generate_requests_per_day")).tipo).toBe("cupo");
    expect(motivoClaro(err("gemini-2.0-flash: 403 API key not valid")).tipo).toBe("clave");
    expect(motivoClaro(err("gemini-2.0-flash: 503 overloaded")).tipo).toBe("caido");
    expect(motivoClaro(new Error("fetch failed")).tipo).toBe("red");
    expect(motivoClaro(err("gemini-2.5-flash-lite: tardó demasiado")).texto).toMatch(/Repesca/);
  });
});

describe("🕵️ Verificador", () => {
  it("confirma lo que existe, tira lo falso y sube el resto «por confirmar» avisándote", async () => {
    await aLaBandeja([
      evento("Magosto en la Plaza", "https://ayto.example/ok"),
      evento("Concierto fantasma", "https://ayto.example/no-existe"),
      evento("Feria del Pimiento", "https://www.facebook.com/feria"),
      evento("Teatro cancelado", "https://lenta.example/teatro"),
      evento("Ruta sin pistas", "https://lenta.example/ruta"),
    ]);
    respuestas.push({ texto: JSON.stringify([
      { n: 1, veredicto: "si", fuente: "https://diario.example/confirmado" },
      { n: 2, veredicto: "no", nota: "cancelado por lluvia" },
      { n: 3, veredicto: "nose" },
    ]), dominios: new Set(["diario.example"]) });
    paginas["https://ayto.example/ok"] = paginaQueNombra(dia(3), "León");
    const parte = await segundaComprobacion();
    expect(parte).toMatchObject({ confirmados: 2, falsos: 2, porConfirmar: 1, preguntas: 1, sinGoogle: 1 });
    const titulos = (await enAgenda()).map((e) => `${e.titulo}${e.porConfirmar ? " (por confirmar)" : ""}`);
    expect(titulos).toEqual(expect.arrayContaining(["Magosto en la Plaza", "Feria del Pimiento", "Ruta sin pistas (por confirmar)"]));
    expect(titulos.join()).not.toMatch(/fantasma|cancelado/);
    expect(await ev.leerBandeja()).toEqual([]);
    const aviso = await ev.leerSinConfirmar();
    expect(aviso.map((e) => e.titulo)).toEqual(["Ruta sin pistas"]);
    // Y te lo cuenta en el chat
    const { leerCharla } = await import("../src/lib/charla");
    expect((await leerCharla()).some((l) => l.a === "tu" && /sin fuente segura/.test(l.texto))).toBe(true);

    // Quitar: fuera de la agenda y no vuelve a la bandeja en 30 días
    expect((await ev.decidirSinConfirmar(aviso[0].id, "quitar")).exito).toBe(true);
    expect((await enAgenda()).some((e) => e.titulo === "Ruta sin pistas")).toBe(false);
    expect(await ev.leerSinConfirmar()).toEqual([]);
  });

  it("si Google falla, lo deja para su siguiente turno y a la segunda lo sube igual", async () => {
    await aLaBandeja([evento("Mercado medieval", "https://lenta.example/mercado")]);
    respuestas.push(Object.assign(new ErrorIA("saturado", 429), { fallos: ["gemini-2.5-flash-lite: 429 busy"] }));
    let p = await segundaComprobacion();
    expect(p).toMatchObject({ revisados: 0, pendientes: 1 });
    expect((await ev.leerBandeja())[0].vueltas).toBe(1);
    respuestas.push(Object.assign(new ErrorIA("saturado", 429), { fallos: ["gemini-2.5-flash-lite: 429 busy"] }));
    p = await segundaComprobacion();
    expect(p).toMatchObject({ porConfirmar: 1, pendientes: 0 });
    expect((await enAgenda())[0]).toMatchObject({ titulo: "Mercado medieval", porConfirmar: true });
  });

  it("un «sí» con una URL que Google no ha mirado ni existe no vale como confirmado", async () => {
    const g = [evento("A", "x"), evento("B", "y")];
    const r = await leerVeredictos(JSON.stringify([{ n: 1, veredicto: "si", fuente: "https://inventada.example/a" }, { n: 2, veredicto: "si", fuente: "https://diario.example/b" }]), new Set(["diario.example"]), g, async () => "duda");
    expect(r.map((x) => x.decision)).toEqual(["porConfirmar", "confirmado"]);
  });
});

describe("🚑 Repesca", () => {
  it("lo que falla se apunta con su motivo y la Repesca lo repite hasta que sale", async () => {
    const b = { nombre: "Fiestas · provincia · esta semana", empleado: "fiestas", tema: "fiestas", pistas: "x", donde: "León", desde: dia(0), hasta: dia(6) };
    respuestas.push(Object.assign(new ErrorIA("x", 502), { fallos: ["gemini-2.5-flash-lite: tardó demasiado"] }));
    const parte = await ev.trabajarEn({ busquedas: [b] }, { desde: dia(0), hasta: dia(20), inicio: Date.now() });
    expect(parte.errores).toBe(1);
    expect(parte.fuentes[b.nombre]).toMatchObject({ ok: false, tipo: "lento" });
    expect(parte.fuentes[b.nombre].error).toMatch(/tardó demasiado/);
    expect((await ev.leerRepesca()).map((r) => [r.nombre, r.intentos])).toEqual([[b.nombre, 1]]);

    respuestas.push({ texto: JSON.stringify([{ titulo: "Fiesta de San Froilán", fecha: dia(2), localidad: "León", fuente: "https://ayto.example/ok" }]), dominios: new Set() });
    const r = await turnoDeRepesca();
    expect(r).toMatchObject({ busquedas: 1, errores: 0, nuevos: 1, quedan: 0 });
    expect(await ev.leerRepesca()).toEqual([]);
    expect((await enAgenda()).map((e) => e.titulo)).toContain("Fiesta de San Froilán");
  });

  it("sin nada en cola no gasta ni una búsqueda", async () => {
    const r = await turnoDeRepesca();
    expect(r.busquedas).toBe(0);
    expect(prompts).toHaveLength(0);
  });
});

describe("🤝 Reunión", () => {
  const conRinde = (rinde) => montarOficina({}, { rendimiento: rinde }).departamentos;
  it("propone descanso a quien no trae nada, encargo al que más trae y repetir lo que falló", () => {
    const deps = conRinde({ pueblos: { busquedas: 40, nuevos: 0, dias: 8 }, musica: { busquedas: 40, nuevos: 23, dias: 8, porBusqueda: 0.6 } });
    const r = montarReunion({ departamentos: deps, flujo: { buscan: 50, entran: 3, bandeja: 2 }, repesca: 3, sinConfirmar: 1, captacion: 2 });
    const ids = r.propuestas.map((p) => p.id.split(":")[0]);
    expect(ids).toEqual(expect.arrayContaining(["descanso", "estrella", "repesca", "verificar", "sinconfirmar", "captacion"]));
    expect(r.propuestas.find((p) => p.id === "descanso:pueblos").propuesta).toMatch(/35 búsquedas/);
    expect(r.propuestas[0].accion.tipo).toBe("guardia"); // lo que se arregla solo, primero
    expect(r.abre).toMatch(/propuestas/);
  });
  it("lo que dices que no, no vuelve a salir", () => {
    const deps = conRinde({ pueblos: { busquedas: 40, nuevos: 0, dias: 8 } });
    expect(montarReunion({ departamentos: deps, descartadas: ["descanso:pueblos"] }).propuestas).toEqual([]);
  });
  it("de descanso: sus turnos no buscan y en la oficina está en la cafetería", async () => {
    expect((await ev.pausar("pueblos", 7)).exito).toBe(true);
    expect(Object.keys(await ev.leerPausas())).toEqual(["pueblos"]);
    const o = montarOficina({}, { pausas: await ev.leerPausas() });
    const p = o.departamentos.flatMap((d) => d.empleados).find((e) => e.id === "pueblos");
    expect(p.estado).toBe("descanso");
    expect(dondeEsta({ ...p, turnos: [] }, Date.now())).toBe("cafe");
    expect(montarReunion({ departamentos: o.departamentos }).propuestas[0].id).toBe("volver:pueblos");
  });
});

describe("💬 Chat con cada empleado (0 €)", () => {
  it("«busca …» es un encargo para su próximo turno; «¿cómo vas?» te cuenta su último turno", async () => {
    const r = await hablarConEmpleado("musica", "busca el concierto de Fresno");
    expect(r.orden).toMatchObject({ accion: "encargo", exito: true });
    expect((await ev.leerEncargos()).musica[0].texto).toMatch(/Fresno/);
    expect(prompts).toHaveLength(0);
    const e = { nombre: "Música", horario: "Cada madrugada", ordenes: true, parte: { fin: new Date().toISOString(), busquedas: 6, eventos: 4, motivos: [{ texto: "Google tardó demasiado en contestar." }] }, rinde: { busquedas: 30, nuevos: 9, dias: 5 } };
    const t = estadoEnPalabras(e);
    expect(t).toMatch(/6 búsquedas, 4 eventos/);
    expect(t).toMatch(/Lo que falló: Google tardó demasiado/);
    expect(t).toMatch(/9 eventos nuevos/);
  });
});

describe("➕ Un empleado nuevo tiene su monigote", () => {
  it("cada empleado tiene mesa; un departamento nuevo (o una sala llena) va al anexo", () => {
    const nuevo = { id: "redes", nombre: "Redes", empleados: [{ id: "tiktok", emoji: "🎵", nombre: "TikTok" }, { id: "insta", emoji: "📸", nombre: "Instagram" }] };
    const extra = { ...DEPARTAMENTOS.find((d) => d.id === "negocio"), empleados: [...DEPARTAMENTOS.find((d) => d.id === "negocio").empleados, { id: "prensa", emoji: "📰", nombre: "Prensa" }] };
    const deps = [...DEPARTAMENTOS.filter((d) => d.id !== "negocio"), extra, nuevo];
    const s = planta(deps);
    for (const e of deps.flatMap((d) => d.empleados)) expect(s[e.id], e.id).toBeTruthy();
    expect(s.verificador.sala).toBe("control");
    expect(s.prensa.sala).toBe("escaparate");
    expect(s.tiktok.sala).toBe("escaparate");
    const dentro = ([x, z], sala) => x >= sala.x0 && x <= sala.x1 && z >= sala.z0 && z <= sala.z1;
    for (const m of Object.values(s)) expect(dentro(m.mesa, SALAS[m.sala]), m.id).toBe(true);
  });
});

describe("🚶 Vida en directo", () => {
  const s = planta(DEPARTAMENTOS);
  const vivos = { musica: { sitio: s.musica, modo: "sentado" }, noche: { sitio: s.noche, modo: "sentado" }, pueblos: { sitio: s.pueblos, modo: "teclea" } };
  it("un paseo va, habla y vuelve a su sitio", () => {
    const p = vida.montarPaseo({ id: "musica", desde: s.musica, hacia: s.noche, t0: 10, texto: "Hola" });
    expect(vida.poseDePaseo(p, 9)).toBeNull();
    expect(vida.poseDePaseo(p, (p.t0 + p.t1) / 2).modo).toBe("anda");
    expect(vida.poseDePaseo(p, (p.t1 + p.t2) / 2).modo).toBe("habla");
    expect(vida.hablandoEn(p, (p.t1 + p.t2) / 2)).toBe(true);
    const fin = vida.poseDePaseo(p, p.t3 - 0.001);
    expect(Math.hypot(fin.x - s.musica.pos[0], fin.z - s.musica.pos[1])).toBeLessThan(0.05);
  });
  it("elige conversaciones reales y no molesta a quien está trabajando", () => {
    const charla = [{ de: "pueblos", a: "jefe", texto: "Traigo 3" }, { de: "musica", a: "noche", texto: "¿Tienes lo de Babia?" }];
    const r = vida.siguientePaseo({ charla, vivos, t0: 0, jefe: s.jefe });
    expect(r.paseo).toMatchObject({ id: "musica", texto: "¿Tienes lo de Babia?" });
  });
  it("la reunión sienta a todos y cada uno habla por turnos", () => {
    const e = vida.montarReunionEscena([{ id: "jefe", texto: "Empezamos" }, { id: "musica", texto: "Dame un encargo" }], vivos, s.jefe, 0);
    expect(e.paseos).toHaveLength(2);
    expect(e.bocadillos.map((b) => b.quien)).toEqual(["jefe", "musica"]);
    expect(vida.poseDeReunion(e.paseos[1], e.bocadillos[1].s0).modo).toBe("reunion");
    expect(e.fin).toBeGreaterThan(e.bocadillos[1].s1);
  });
});
