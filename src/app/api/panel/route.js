import { NextResponse } from "next/server";
import { leerJSON, usaRedis } from "../../../lib/almacen";
import { leerResumen } from "../../../lib/estadisticas";
import { claveDePanelValida, tokenNegocio, topLugares } from "../../../lib/lugares";
import { barrerEventos, eventosProximos } from "../../../lib/eventos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const autorizado = (request) => claveDePanelValida(request.headers.get("x-clave") || "");

// GET /api/panel (cabecera x-clave = PANEL_CLAVE) → todo lo que ve el equipo en /panel
export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  const [resumen, apariciones, gusta, barrido, agenda] = await Promise.all([
    leerResumen(14),
    topLugares("ranking:apariciones", 25),
    topLugares("ranking:gusta", 10),
    leerJSON("eventos:ultimoBarrido"),
    eventosProximos(14),
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
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/panel { accion: "barrido" } → lanzar el barrido de eventos a mano
export async function POST(request) {
  if (!autorizado(request)) return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  const { accion } = await request.json().catch(() => ({}));
  if (accion !== "barrido") return NextResponse.json({ exito: false }, { status: 400 });
  try {
    return NextResponse.json({ exito: true, informe: await barrerEventos() });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
