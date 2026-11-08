import { NextResponse } from "next/server";
import { dentroDelLimite } from "../../../../lib/freno";
import { enMadrid, juegosDelDia, ligaAbierta, lunesDe, domingoDe } from "../../../../lib/liga/calendario";
import { JUEGOS, EN_LIGA, comprobarPartida, semillaServidor } from "../../../../lib/liga/juegos";
import { comprobarApodo, limpiarCodigo, limpiarCorreo, SIN_PUEBLO } from "../../../../lib/liga/perfil";
import { ErrorLiga, modoLiga, servicio } from "../../../../lib/liga/servicio";

// ============ LIGA CAZURRA: la API ============
// POST /api/liga/codigo   { email }                     → manda un código de 6 cifras al correo
// POST /api/liga/entrar   { email, codigo }             → { sesion, perfil }
// POST /api/liga/renovar  { refresh }                   → { sesion }
// GET  /api/liga/hoy                                    → juegos de hoy, intentos que quedan y tu perfil
// POST /api/liga/perfil   { apodo, acepta, novedades }   (el pueblo ya no se pide)
// POST /api/liga/empezar  { juego }                     → { partida, semilla, intento, quedan }
// POST /api/liga/terminar { partida, datos }            → puntos comprobados aquí, no los del móvil
// GET  /api/liga/ranking?de=dia|semana
// POST /api/liga/borrar   { confirmar: true }           → borra la cuenta y todas sus partidas
// La sesión va en la cabecera Authorization: Bearer <access>.

export const dynamic = "force-dynamic";

const LIMITE_RANKING = 50;

function responder(datos, status = 200, cache = "no-store") {
  return NextResponse.json(datos, { status, headers: { "Cache-Control": cache } });
}
function fallo(status, error) { return responder({ error }, status); }

async function cuerpo(request) {
  try { const j = await request.json(); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}

function token(request) {
  const h = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(\S{10,4096})$/i.exec(h);
  return m ? m[1] : null;
}

// El usuario de la sesión (o null). Con «obligatorio», sin sesión válida responde 401.
async function quien(request, s, obligatorio = true) {
  const t = token(request);
  const u = t ? await s.usuario(t) : null;
  if (!u && obligatorio) throw new ErrorLiga(401, "Entra con tu correo para jugar en la liga.");
  return u;
}

function frenar(ok) { if (!ok) throw new ErrorLiga(429, "Vas muy rápido. Espera un momento y vuelve a probar."); }

function juegosDeHoy(dia) { return juegosDelDia(dia, EN_LIGA).map((id) => JUEGOS[id]); }

function fichaPublica(j) { return { id: j.id, nombre: j.nombre, sitio: j.sitio, pagina: j.pagina, foto: j.foto, habilidad: j.habilidad }; }

async function posicionDe(s, desde, hasta, jugador) {
  const filas = await s.ranking(desde, hasta, 0, jugador);
  const yo = filas.find((f) => f.yo);
  return yo ? Number(yo.posicion) : null;
}

const ACCIONES = {
  async codigo(request, s) {
    const { email } = await cuerpo(request);
    const correo = limpiarCorreo(email);
    if (!correo) throw new ErrorLiga(400, "Ese correo no parece bien escrito.");
    frenar(await dentroDelLimite(request, "liga-codigo", 6, 900));
    const r = await s.pedirCodigo(correo);
    return responder({ enviado: true, ...(modoLiga() === "memoria" ? r : {}) });
  },

  async entrar(request, s) {
    const { email, codigo } = await cuerpo(request);
    const correo = limpiarCorreo(email), cod = limpiarCodigo(codigo);
    if (!correo || !cod) throw new ErrorLiga(400, "Escribe el código de 6 cifras que te ha llegado.");
    frenar(await dentroDelLimite(request, "liga-entrar", 12, 900));
    const sesion = await s.verificar(correo, cod);
    const perfil = await s.perfil(sesion.usuario.id);
    return responder({ sesion, perfil });
  },

  async renovar(request, s) {
    const { refresh } = await cuerpo(request);
    if (typeof refresh !== "string" || refresh.length < 8 || refresh.length > 512) throw new ErrorLiga(401, "Tu sesión ha caducado. Vuelve a entrar con tu correo.");
    frenar(await dentroDelLimite(request, "liga-renovar", 60, 900));
    return responder({ sesion: await s.renovar(refresh) });
  },

  async hoy(request, s) {
    const u = await quien(request, s, false);
    const { dia } = enMadrid();
    const juegos = juegosDeHoy(dia);
    const perfil = u ? await s.perfil(u.id) : null;
    const mios = u && perfil ? await s.hoy(u.id, dia) : [];
    return responder({
      dia, abierta: ligaAbierta(), semana: { desde: lunesDe(dia), hasta: domingoDe(dia) },
      juegos: juegos.map((j) => {
        const m = mios.find((x) => x.juego === j.id);
        const usados = Number(m?.usados || 0);
        return { ...fichaPublica(j), usados, quedan: Math.max(0, 3 - usados), mejor: m?.mejor ?? null };
      }),
      conectado: Boolean(u), email: u?.email || null, perfil,
    });
  },

  async perfil(request, s) {
    const u = await quien(request, s);
    const b = await cuerpo(request);
    const a = comprobarApodo(b.apodo);
    if (a.error) throw new ErrorLiga(400, a.error);
    frenar(await dentroDelLimite(request, "liga-perfil", 20, 900));
    const previo = await s.perfil(u.id);
    if (!previo && b.acepta !== true) throw new ErrorLiga(400, "Para jugar tienes que tener 14 años o más y aceptar las bases.");
    await s.guardarPerfil(u.id, { apodo: a.apodo, clave: a.clave, pueblo: previo?.pueblo || SIN_PUEBLO, novedades: b.novedades === true }, !previo);
    return responder({ perfil: await s.perfil(u.id) });
  },

  async empezar(request, s) {
    const u = await quien(request, s);
    const { juego } = await cuerpo(request);
    const j = JUEGOS[juego];
    if (!j) throw new ErrorLiga(400, "Ese juego no existe.");
    if (!ligaAbierta()) throw new ErrorLiga(409, "La semana cerró el domingo a las 22:00. El lunes empieza otra liga.", "cerrada");
    const { dia } = enMadrid();
    if (!juegosDeHoy(dia).some((x) => x.id === j.id)) throw new ErrorLiga(409, "Hoy este juego no puntúa. Mira los juegos de hoy en la liga.", "no_toca");
    frenar(await dentroDelLimite(request, "liga-empezar", 30, 600));
    const semilla = semillaServidor();
    const r = await s.empezar(u.id, j.id, dia, semilla, j.version);
    if (r.error === "sin_perfil") throw new ErrorLiga(409, "Elige tu apodo antes de jugar.", "sin_perfil");
    if (r.error === "bloqueado") throw new ErrorLiga(403, "Tu cuenta no puede jugar en la liga. Escríbenos si crees que es un error.", "bloqueado");
    if (r.error === "sin_intentos") throw new ErrorLiga(409, "Ya has gastado tus 3 intentos de hoy en este juego. Mañana más.", "sin_intentos");
    if (r.error || !r.partida) throw new ErrorLiga(502, "No se pudo empezar la partida. Prueba otra vez.", `empezar: ${r.error}`);
    return responder({ partida: r.partida, semilla, intento: Number(r.intento), quedan: Number(r.quedan), version: j.version });
  },

  async terminar(request, s) {
    const u = await quien(request, s);
    const { partida, datos } = await cuerpo(request);
    if (typeof partida !== "string" || !/^[0-9a-f-]{36}$/i.test(partida)) throw new ErrorLiga(400, "Partida desconocida.");
    frenar(await dentroDelLimite(request, "liga-terminar", 30, 600));
    const p = await s.partida(partida, u.id);
    if (!p) throw new ErrorLiga(404, "Partida desconocida.");
    if (p.estado !== "jugando") throw new ErrorLiga(409, "Esta partida ya estaba cerrada.", "cerrada");
    const r = comprobarPartida({ juego: p.juego, version: p.version, semilla: p.semilla, empezada: p.empezada, ahora: p.ahora, datos });
    const guardado = await s.terminar(partida, u.id, r.estado, r.puntos, r.motivo, r.motivo === "demasiados datos" ? null : datos);
    if (!guardado) throw new ErrorLiga(409, "Esta partida ya estaba cerrada.", "cerrada");
    if (r.estado !== "valida") {
      console.warn("[liga] partida rechazada", partida, r.motivo);
      return responder({ estado: "rechazada", puntos: null, motivo: "Esta partida no ha contado: algo no cuadraba al repetirla. Si te pasa más veces, avísanos." });
    }
    const dia = String(p.dia).slice(0, 10);
    const [mios, posDia, posSemana] = await Promise.all([
      s.hoy(u.id, dia), posicionDe(s, dia, dia, u.id), posicionDe(s, lunesDe(dia), domingoDe(dia), u.id),
    ]);
    const m = mios.find((x) => x.juego === p.juego);
    return responder({
      estado: "valida", puntos: r.puntos, mejor: m?.mejor ?? r.puntos, quedan: Math.max(0, 3 - Number(m?.usados || 0)),
      posicionDia: posDia, posicionSemana: posSemana,
    });
  },

  async ranking(request, s) {
    const de = new URL(request.url).searchParams.get("de") === "semana" ? "semana" : "dia";
    const u = await quien(request, s, false);
    const { dia } = enMadrid();
    const desde = de === "semana" ? lunesDe(dia) : dia, hasta = de === "semana" ? domingoDe(dia) : dia;
    const filas = await s.ranking(desde, hasta, LIMITE_RANKING, u?.id);
    return responder(
      { de, desde, hasta, filas: filas.map((f) => ({ posicion: Number(f.posicion), apodo: f.apodo, puntos: Number(f.puntos), yo: Boolean(f.yo) })) },
      200,
      u ? "no-store" : "public, s-maxage=20, stale-while-revalidate=40", // sin sesión, Vercel lo guarda 20 s
    );
  },

  async borrar(request, s) {
    const u = await quien(request, s);
    const { confirmar } = await cuerpo(request);
    if (confirmar !== true) throw new ErrorLiga(400, "Confirma que quieres borrar tu cuenta.");
    await s.borrarDatos(u.id);
    await s.borrarUsuario(u.id);
    return responder({ borrada: true });
  },
};

const SOLO_GET = new Set(["hoy", "ranking"]);

async function atender(request, params, metodo) {
  const { accion } = await params;
  const f = ACCIONES[accion];
  if (!f || SOLO_GET.has(accion) !== (metodo === "GET")) return fallo(404, "No existe.");
  try {
    return await f(request, servicio());
  } catch (e) {
    if (e instanceof ErrorLiga) {
      if (e.status >= 500) console.error(`[liga] ${accion}:`, e.codigo || e.message);
      return responder({ error: e.message, codigo: e.status < 500 ? e.codigo : undefined }, e.status);
    }
    console.error(`[liga] ${accion}:`, e?.message || e);
    return fallo(500, "Algo ha fallado. Prueba otra vez en un momento.");
  }
}

export async function GET(request, { params }) { return atender(request, params, "GET"); }
export async function POST(request, { params }) { return atender(request, params, "POST"); }
