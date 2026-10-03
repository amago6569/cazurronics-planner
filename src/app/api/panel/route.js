import { NextResponse } from "next/server";
import { comando, leerJSON, usaRedis } from "../../../lib/almacen";
import { leerResumen } from "../../../lib/estadisticas";
import { buscarLugares, claveDePanelValida, tokenNegocio, topLugares } from "../../../lib/lugares";
import { barrerEventos, eventosProximos, IDS_TRAMOS, idTramo } from "../../../lib/eventos";

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
  if (accion !== "barrido" || tramo == null || !IDS_TRAMOS.includes(idTramo(tramo))) return NextResponse.json({ exito: false }, { status: 400 });
  try {
    // Cada tramo gasta búsquedas de pago de Google: si ya se hizo hace menos de 6 h (cron o a mano), no se repite
    const previo = await leerJSON(`eventos:tramo:${idTramo(tramo)}`).catch(() => null);
    const hace = previo?.fin ? Date.now() - Date.parse(previo.fin) : Infinity;
    if (hace < 6 * 3600 * 1000) return NextResponse.json({ exito: false, saltado: true, mensaje: "Ese tramo ya se hizo hace menos de 6 horas" });
    return NextResponse.json({ exito: true, informe: await barrerEventos({ tramo: idTramo(tramo) }) });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
