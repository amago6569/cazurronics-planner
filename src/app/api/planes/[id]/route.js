import { NextResponse } from "next/server";
import { leerJSON } from "../../../../lib/almacen";
import { idPlanValido, leerVotos, resumirVotos } from "../../../../lib/votos";

export const dynamic = "force-dynamic";

// GET /api/planes/ID?votante=XXX&v=VERSION → el plan guardado + votos del grupo (la página compartida lo consulta cada pocos segundos)
// Plan y votos se leen a la vez. Si el navegador ya tiene esta versión del plan (v = cuándo se creó o se retocó
// por última vez), no se reenvía: solo viajan los votos, que es lo único que cambia casi siempre.
export async function GET(request, { params }) {
  const { id } = await params;
  if (!idPlanValido(id)) return NextResponse.json({ exito: false, mensaje: "Plan no válido" }, { status: 400 });
  const [plan, crudo] = await Promise.all([leerJSON(`plan:${id}`), leerVotos(id)]);
  if (!plan) return NextResponse.json({ exito: false, mensaje: "Este plan ya no existe" }, { status: 404 });
  const q = new URL(request.url).searchParams;
  const votos = resumirVotos(crudo, plan.itinerario.length, q.get("votante") || "");
  const version = String(plan.editado || plan.creado || "");
  const yaLoTiene = version && q.get("v") === version;
  return NextResponse.json({ exito: true, ...(yaLoTiene ? {} : { plan }), votos }, { headers: { "Cache-Control": "no-store" } });
}
