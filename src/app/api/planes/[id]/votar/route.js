import { NextResponse } from "next/server";
import { leerJSON, sinRomper } from "../../../../../lib/almacen";
import { idPlanValido, votanteValido, votar, resumenVotos } from "../../../../../lib/votos";
import { registrar } from "../../../../../lib/estadisticas";

// POST /api/planes/ID/votar  { indice, voto: 1 | -1 | 0, votante }
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { indice, voto, votante } = await request.json();
    if (!idPlanValido(id) || !votanteValido(votante)) return NextResponse.json({ exito: false }, { status: 400 });
    const plan = await leerJSON(`plan:${id}`);
    if (!plan || !plan.itinerario?.[Number(indice)]) return NextResponse.json({ exito: false }, { status: 404 });
    await votar(id, indice, votante, voto);
    await sinRomper(registrar("voto"), "estadísticas");
    return NextResponse.json({ exito: true, votos: await resumenVotos(id, plan.itinerario.length, votante) });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
