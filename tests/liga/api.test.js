// La API de la liga de punta a punta, con las cuentas y los datos en memoria (como en local).
// Las funciones de verdad de Supabase se prueban aparte en tests/liga/sql (ver sql.test.js).
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GET, POST } from "../../src/app/api/liga/[accion]/route.js";
import { servicio } from "../../src/lib/liga/servicio.js";
import { comprobarApodo, comprobarPueblo, limpiarCorreo } from "../../src/lib/liga/perfil.js";
import { juegosDelDia, ligaAbierta, lunesDe, domingoDe, enMadrid } from "../../src/lib/liga/calendario.js";
import { jugarPartida } from "./bots.js";

// Estas pruebas juegan a la canasta: que toque todos los días, salga lo que salga en la rotación de verdad
vi.mock("../../src/lib/liga/juegos.js", async (original) => ({ ...(await original()), EN_LIGA: ["canasta"] }));

let ip = 0;
function pedir(metodo, accion, { cuerpo, token, query = "", conIp } = {}) {
  const headers = { "content-type": "application/json", "x-real-ip": conIp || `10.0.0.${ip}` };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request(`http://localhost/api/liga/${accion}${query}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const f = metodo === "GET" ? GET : POST;
  return f(req, { params: Promise.resolve({ accion }) }).then(async (r) => ({ status: r.status, json: await r.json(), cache: r.headers.get("cache-control") }));
}

async function entrar(email) {
  const c = await pedir("POST", "codigo", { cuerpo: { email } });
  expect(c.status).toBe(200);
  const e = await pedir("POST", "entrar", { cuerpo: { email, codigo: c.json.codigoDePrueba } });
  expect(e.status).toBe(200);
  return e.json;
}

async function jugadorConPerfil(email, apodo) {
  const { sesion } = await entrar(email);
  const p = await pedir("POST", "perfil", { token: sesion.access, cuerpo: { apodo, pueblo: "León", acepta: true } });
  expect(p.status).toBe(200);
  return sesion.access;
}

// Las sesiones duran una hora (como en Supabase): tras saltar de día hay que renovarla, como hace la página.
async function despuesDe(fecha, email) {
  vi.setSystemTime(fecha);
  return (await entrar(email)).sesion.access;
}

const MARTES = new Date("2026-11-10T11:00:00Z"); // martes 12:00 en Madrid

beforeEach(() => {
  servicio()._reiniciar();
  ip++;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MARTES);
});
afterEach(() => vi.useRealTimers());

describe("cuenta con correo", () => {
  it("pide código, entra y sin perfil pide apodo", async () => {
    const { sesion, perfil } = await entrar("Ana@Correo.es ");
    expect(sesion.access).toBeTruthy();
    expect(sesion.usuario.email).toBe("ana@correo.es");
    expect(perfil).toBeNull();
    const hoy = await pedir("GET", "hoy", { token: sesion.access });
    expect(hoy.json.conectado).toBe(true);
    expect(hoy.json.perfil).toBeNull();
    expect(hoy.json.juegos.map((j) => j.id)).toContain("canasta");
  });

  it("un código mal escrito o equivocado no entra", async () => {
    await pedir("POST", "codigo", { cuerpo: { email: "b@x.es" } });
    expect((await pedir("POST", "entrar", { cuerpo: { email: "b@x.es", codigo: "12" } })).status).toBe(400);
    expect((await pedir("POST", "entrar", { cuerpo: { email: "b@x.es", codigo: "000000" } })).status).toBe(400);
    expect((await pedir("POST", "codigo", { cuerpo: { email: "no-es-correo" } })).status).toBe(400);
  });

  it("frena a quien pide códigos sin parar desde la misma conexión", async () => {
    const r = [];
    for (let i = 0; i < 8; i++) r.push((await pedir("POST", "codigo", { cuerpo: { email: `x${i}@x.es` } })).status);
    expect(r.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(r[7]).toBe(429);
  });

  it("renueva la sesión y la vieja de renovar ya no sirve", async () => {
    const { sesion } = await entrar("c@x.es");
    const r = await pedir("POST", "renovar", { cuerpo: { refresh: sesion.refresh } });
    expect(r.status).toBe(200);
    expect(r.json.sesion.access).not.toBe(sesion.access);
    expect((await pedir("POST", "renovar", { cuerpo: { refresh: sesion.refresh } })).status).toBe(401);
  });

  it("ranking: no enseña el pueblo", async () => {
    const { sesion } = await entrar("p@x.es");
    await pedir("POST", "perfil", { token: sesion.access, cuerpo: { apodo: "Pepe", acepta: true } });
    const r = await pedir("GET", "ranking?de=dia", { token: sesion.access });
    for (const f of r.json.filas || []) expect(f).not.toHaveProperty("pueblo");
  });

  it("perfil: pide 14 años y bases, y no deja apodos repetidos ni feos", async () => {
    const { sesion } = await entrar("d@x.es");
    const t = sesion.access;
    expect((await pedir("POST", "perfil", { token: t, cuerpo: { apodo: "Dani", pueblo: "León" } })).json.error).toMatch(/14 años/);
    expect((await pedir("POST", "perfil", { token: t, cuerpo: { apodo: "hijoputa", pueblo: "León", acepta: true } })).status).toBe(400);
    expect((await pedir("POST", "perfil", { token: t, cuerpo: { apodo: "Dani", acepta: true } })).status).toBe(200); // sin pueblo
    const otro = (await entrar("e@x.es")).sesion.access;
    const r = await pedir("POST", "perfil", { token: otro, cuerpo: { apodo: "DANÍ", pueblo: "Boñar", acepta: true } });
    expect(r.status).toBe(409);
    expect(r.json.error).toMatch(/otra persona/);
    // cambiar el suyo sin volver a aceptar
    expect((await pedir("POST", "perfil", { token: t, cuerpo: { apodo: "Dani León", pueblo: "Boñar" } })).json.perfil.apodo).toBe("Dani León");
  });

  it("sin sesión no se juega", async () => {
    expect((await pedir("POST", "empezar", { cuerpo: { juego: "canasta" } })).status).toBe(401);
    expect((await pedir("POST", "empezar", { token: "inventado-123456", cuerpo: { juego: "canasta" } })).status).toBe(401);
  });

  it("borrar la cuenta se lleva perfil, partidas y sesión", async () => {
    const t = await jugadorConPerfil("f@x.es", "Fede");
    const e = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    expect(e.status).toBe(200);
    expect((await pedir("POST", "borrar", { token: t, cuerpo: {} })).status).toBe(400);
    expect((await pedir("POST", "borrar", { token: t, cuerpo: { confirmar: true } })).status).toBe(200);
    expect((await pedir("GET", "hoy", { token: t })).json.conectado).toBe(false);
  });
});

describe("partidas", () => {
  async function jugar(t, nivel = "bueno", semillaBot = 7) {
    const e = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    if (e.status !== 200) return e;
    const partida = jugarPartida(e.json.semilla, nivel, semillaBot);
    servicio()._retrasar(e.json.partida, 45000); // como si hubieran pasado los 40 s de verdad
    const r = await pedir("POST", "terminar", { token: t, cuerpo: { partida: e.json.partida, datos: { tiros: partida.lista } } });
    return { ...r, esperado: partida.puntos };
  }

  it("los puntos los calcula el servidor y coinciden con los del juego", async () => {
    const t = await jugadorConPerfil("g@x.es", "Gema");
    const r = await jugar(t);
    expect(r.status).toBe(200);
    expect(r.json.estado).toBe("valida");
    expect(r.json.puntos).toBe(r.esperado);
    expect(r.json.posicionDia).toBe(1);
    expect(r.json.quedan).toBe(2);
  });

  it("3 intentos al día y ni uno más; el que se abandona cuenta", async () => {
    const t = await jugadorConPerfil("h@x.es", "Hugo");
    await jugar(t);
    expect((await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } })).status).toBe(200); // abandonado
    await jugar(t);
    const cuarto = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    expect(cuarto.status).toBe(409);
    expect(cuarto.json.codigo).toBe("sin_intentos");
    // al día siguiente vuelve a tener 3
    const t2 = await despuesDe(new Date("2026-11-11T09:00:00Z"), "h@x.es");
    expect((await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } })).status).toBe(401); // la vieja caducó
    const hoy = await pedir("GET", "hoy", { token: t2 });
    expect(hoy.json.juegos.find((j) => j.id === "canasta").quedan).toBe(3);
  });

  it("rechaza puntos inventados: tiros cambiados, a cámara rápida o mandados dos veces", async () => {
    const t = await jugadorConPerfil("i@x.es", "Iria");
    // tiros imposibles
    const e1 = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    servicio()._retrasar(e1.json.partida, 45000);
    const malos = await pedir("POST", "terminar", { token: t, cuerpo: { partida: e1.json.partida, datos: { tiros: [{ t: 100, s: 999999, a: 0 }] } } });
    expect(malos.json.estado).toBe("rechazada");
    // a cámara rápida: los 40 s de partida llegan a los 3 s de empezar
    const e2 = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    const p = jugarPartida(e2.json.semilla, "bueno", 3);
    servicio()._retrasar(e2.json.partida, 3000);
    const rapida = await pedir("POST", "terminar", { token: t, cuerpo: { partida: e2.json.partida, datos: { tiros: p.lista } } });
    expect(rapida.json.estado).toBe("rechazada");
    // la partida de otra semilla no vale para esta (los puntos no salen igual o el tiro no cuadra)
    const e3 = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    servicio()._retrasar(e3.json.partida, 45000);
    const buena = await pedir("POST", "terminar", { token: t, cuerpo: { partida: e3.json.partida, datos: { tiros: jugarPartida(e3.json.semilla, "bueno", 9).lista } } });
    expect(buena.json.estado).toBe("valida");
    const otraVez = await pedir("POST", "terminar", { token: t, cuerpo: { partida: e3.json.partida, datos: { tiros: [] } } });
    expect(otraVez.status).toBe(409);
    // nada rechazado suma
    const rk = await pedir("GET", "ranking", { query: "?de=dia" });
    expect(rk.json.filas[0].puntos).toBe(buena.json.puntos);
  });

  it("una partida no se puede cerrar desde otra cuenta", async () => {
    const a = await jugadorConPerfil("j@x.es", "Juan");
    const b = await jugadorConPerfil("k@x.es", "Kike");
    const e = await pedir("POST", "empezar", { token: a, cuerpo: { juego: "canasta" } });
    const r = await pedir("POST", "terminar", { token: b, cuerpo: { partida: e.json.partida, datos: { tiros: [] } } });
    expect(r.status).toBe(404);
  });

  it("ranking del día y de la semana: suma la mejor de cada día y el público no ve ids ni correos", async () => {
    const a = await jugadorConPerfil("l@x.es", "Lola");
    const b = await jugadorConPerfil("m@x.es", "Manu");
    const a1 = await jugar(a, "bueno", 1), a2 = await jugar(a, "experto", 2);
    const b1 = await jugar(b, "normal", 3);
    const a3 = await jugar(await despuesDe(new Date("2026-11-11T09:00:00Z"), "l@x.es"), "novato", 4); // miércoles
    const dia = await pedir("GET", "ranking", { query: "?de=dia" });
    expect(dia.json.filas).toHaveLength(1);
    expect(dia.json.filas[0].puntos).toBe(a3.json.puntos);
    const semana = await pedir("GET", "ranking", { query: "?de=semana" });
    const lola = semana.json.filas.find((f) => f.apodo === "Lola");
    expect(lola.puntos).toBe(Math.max(a1.json.puntos, a2.json.puntos) + a3.json.puntos);
    expect(semana.json.filas.find((f) => f.apodo === "Manu").puntos).toBe(b1.json.puntos);
    expect(JSON.stringify(semana.json)).not.toMatch(/@|jugador/);
    expect(semana.cache).toMatch(/s-maxage/);
    const mia = await pedir("GET", "ranking", { token: (await entrar("m@x.es")).sesion.access, query: "?de=semana" });
    expect(mia.cache).toBe("no-store");
    expect(mia.json.filas.find((f) => f.yo).apodo).toBe("Manu");
  });

  it("el domingo a partir de las 22:00 la semana está cerrada", async () => {
    vi.setSystemTime(new Date("2026-11-15T21:30:00Z")); // domingo 22:30 en Madrid
    const t = await jugadorConPerfil("n@x.es", "Nico");
    const r = await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } });
    expect(r.status).toBe(409);
    expect(r.json.codigo).toBe("cerrada");
  });

  it("un bloqueado no juega ni sale en el ranking", async () => {
    const t = await jugadorConPerfil("o@x.es", "Olga");
    await jugar(t);
    const yo = (await pedir("POST", "entrar", { cuerpo: { email: "o@x.es", codigo: (await pedir("POST", "codigo", { cuerpo: { email: "o@x.es" } })).json.codigoDePrueba } })).json;
    servicio()._bloquear(yo.sesion.usuario.id);
    expect((await pedir("GET", "ranking", { query: "?de=dia" })).json.filas).toHaveLength(0);
    expect((await pedir("POST", "empezar", { token: t, cuerpo: { juego: "canasta" } })).status).toBe(403);
  });
});

describe("piezas sueltas", () => {
  it("correo", () => {
    expect(limpiarCorreo(" Pepe@León.es ")).toBe("pepe@león.es");
    expect(limpiarCorreo("pepe@")).toBeNull();
  });
  it("apodos: letras, números y sin insultos, pero sin pasarse", () => {
    expect(comprobarApodo("Pepé").clave).toBe("pepe");
    expect(comprobarApodo("ab").error).toBeTruthy();
    expect(comprobarApodo("x".repeat(17)).error).toBeTruthy();
    expect(comprobarApodo("<script>").error).toBeTruthy();
    for (const feo of ["Put0", "MIERDA", "h1joputa", "hijoputa", "Cazurronics", "el admin", "coño"]) expect(comprobarApodo(feo).error, feo).toBeTruthy();
    for (const bien of ["Cómputo", "Conor", "Zorrilla", "Peta", "Francoise", "La Cecina 23", "Mari_Luz", "Sergio.R"]) expect(comprobarApodo(bien).error, bien).toBeUndefined();
  });
  it("pueblo", () => {
    expect(comprobarPueblo("San Andrés del Rabanedo").pueblo).toBe("San Andrés del Rabanedo");
    expect(comprobarPueblo("Fuera de León").pueblo).toBe("Fuera de León");
    expect(comprobarPueblo("x").error).toBeTruthy();
  });
  it("calendario de Madrid, cierre y juegos que rotan", () => {
    expect(enMadrid(new Date("2026-11-09T23:30:00Z")).dia).toBe("2026-11-10"); // 00:30 del martes aquí
    expect(lunesDe("2026-11-15")).toBe("2026-11-09");
    expect(domingoDe("2026-11-09")).toBe("2026-11-15");
    expect(ligaAbierta(new Date("2026-11-15T20:59:00Z"))).toBe(true); // domingo 21:59
    expect(ligaAbierta(new Date("2026-11-15T21:00:00Z"))).toBe(false); // domingo 22:00
    expect(ligaAbierta(new Date("2026-11-15T23:00:00Z"))).toBe(true); // lunes 00:00
    const siete = ["a", "b", "c", "d", "e", "f", "g"];
    const veces = {};
    for (let i = 0; i < 7; i++) for (const j of juegosDelDia(`2026-11-${String(9 + i).padStart(2, "0")}`, siete)) veces[j] = (veces[j] || 0) + 1;
    expect(Object.values(veces)).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(juegosDelDia("2026-11-09", ["solo"])).toEqual(["solo"]);
  });
});
