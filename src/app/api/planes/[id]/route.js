import { NextResponse } from "next/server";
import { leerJSON } from "../../../../lib/almacen";
import { idPlanValido, resumenVotos } from "../../../../lib/votos";

export const dynamic = "force-dynamic";

// GET /api/planes/ID?votante=XXX → el plan guardado + votos del grupo (la página compartida lo consulta cada pocos segundos)
export async function GET(request, { params }) {
  const { id } = await params;
  if (!idPlanValido(id)) return NextResponse.json({ exito: false, mensaje: "Plan no válido" }, { status: 400 });
  const plan = await leerJSON(`plan:${id}`);
  if (!plan) return NextResponse.json({ exito: false, mensaje: "Este plan ya no existe" }, { status: 404 });
  const votante = new URL(request.url).searchParams.get("votante") || "";
  const votos = await resumenVotos(id, plan.itinerario.length, votante);
  return NextResponse.json({ exito: true, plan, votos }, { headers: { "Cache-Control": "no-store" } });
}
