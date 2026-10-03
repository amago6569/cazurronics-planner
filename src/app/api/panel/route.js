import { NextResponse } from "next/server";
import { comando, leerJSON, usaRedis, varios } from "../../../lib/almacen";
import { leerResumen } from "../../../lib/estadisticas";
import { buscarLugares, claveDePanelValida, claveValida, tokenNegocio, topLugares } from "../../../lib/lugares";
import { barrerEventos, eventosProximos, HORAS_MIN_MANUAL, IDS_TRAMOS, idTramo, tramoReciente } from "../../../lib/eventos";

export const maxDuration = 60; // el panel lanza el barrido tramo a tramo
export const dynamic = "force-dynamic";

const autorizado = (request) => claveDePanelValida(request.headers.get("x-clave") || "");

// Antes de comprobar la clave: ¿está configurado el servidor? (típico al subir a Vercel)
function faltaConfiguracion() {
  if (!process.env.PANEL_CLAVE) return "Falta la variable PANEL_CLAVE en el servidor. En Vercel: Settings → Environment Variables → añádela y haz Redeploy.";
  return null;
}

// GET /api/panel (cabecera x-clave = PANEL_CLAVE) → todo lo que ve el equipo en /panel
export async function GET(request) {
  const falta = faltaConfiguracion();
  if (falta) return NextResponse.json({ exito: false, mensaje: falta }, { status: 503 });
  if (!autorizado(request)) return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  try {
    return await datosDelPanel(request);
  } catch (e) {
    console.error("[panel]", e);
    return NextResponse.json({ exito: false, mensaje: `Error del servidor: ${e?.message || e}` }, { status: 500 });
  }
}

async function datosDelPanel(request) {
  // GET /api/panel?buscar=nombre → solo la búsqueda de locales
  const buscar = new URL(request.url).searchParams.get("buscar");
  if (buscar) {
    const lugares = await buscarLugares(buscar);
    return NextResponse.json({ exito: true, lugares: lugares.map((l) => ({ ...l, enlaceNegocio: tokenNegocio(l.clave) })) }, { headers: { "Cache-Control": "no-store" } });
  }
  const [resumen, apariciones, gusta, barrido, agenda, solicitudes] = await Promise.all([
    leerResumen(14),
    topLugares("ranking:apariciones", 25),
    topLugares("ranking:gusta", 10),
    leerJSON("eventos:ultimoBarrido"),
    eventosProximos(14),
    comando(["LRANGE", "negocios:solicitudes", 0, 99]).catch(() => []),
  ]);
  const conEnlace = (l) => ({ ...l, enlaceNegocio: tokenNegocio(l.clave) });
  return NextResponse.json({
    exito: true,
    almacen: usaRedis ? "redis" : "memoria",
    resumen,
    lugares: apariciones.map(conEnlace),
    favoritos: gusta.map(conEnlace),
    barrido,
    agenda: agenda.map((d) => ({ fecha: d.fecha, eventos: d.eventos.length })),
    solicitudes: (solicitudes || []).map((t) => { try { return JSON.parse(t); } catch { return null; } }).filter(Boolean),
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/panel { accion: "barrido" } → lanzar el barrido de eventos a mano
export async function POST(request) {
  const falta = faltaConfiguracion();
  if (falta) return NextResponse.json({ exito: false, mensaje: falta }, { status: 503 });
  if (!autorizado(request)) return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  const { accion, tramo } = await request.json().catch(() => ({}));
  // Empezar de cero las estadísticas de locales (apariciones, fichas, llamadas, valoraciones). No toca captación ni la agenda.
  if (accion === "reiniciar-locales") {
    try {
      const rankings = ["ranking:apariciones", "ranking:comer", "ranking:gusta"];
      const miembros = await Promise.all(rankings.map((r) => comando(["ZREVRANGE", r, 0, -1]).catch(() => [])));
      const claves = [...new Set(miembros.flat().filter(claveValida))];
      for (let i = 0; i < claves.length; i += 100) {
        await varios(claves.slice(i, i + 100).flatMap((k) => [["DEL", `lugar:${k}`], ["DEL", `lugarstats:${k}`]]));
      }
      await varios(rankings.map((r) => ["DEL", r]));
      return NextResponse.json({ exito: true, borrados: claves.length });
    } catch (e) {
      return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
    }
  }
  if (accion !== "barrido" || tramo == null || !IDS_TRAMOS.includes(idTramo(tramo))) return NextResponse.json({ exito: false }, { status: 400 });
  try {
    // Cada tramo gasta búsquedas de pago de Google: si ya se hizo hace poco (cron o a mano), no se repite
    const id = idTramo(tramo);
    const reciente = await tramoReciente(id, HORAS_MIN_MANUAL[String(id)[0]] ?? 6);
    if (reciente) return NextResponse.json({ exito: false, saltado: true, horas: Math.max(1, Math.round(reciente.hace / 3600000)), mensaje: "Ya se hizo hace poco; no se repite para no gastar búsquedas de Google" });
    return NextResponse.json({ exito: true, informe: await barrerEventos({ tramo: idTramo(tramo) }) });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
