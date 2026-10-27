import { NextResponse } from "next/server";
import { enSegundoPlano, leerJSON } from "../../../../../lib/almacen";
import { idPlanValido, votanteValido, votar, resumenVotos } from "../../../../../lib/votos";
import { registrar } from "../../../../../lib/estadisticas";
import { dentroDelLimite } from "../../../../../lib/freno";

// POST /api/planes/ID/votar  { indice, voto: 1 | -1 | 0, votante }
export async function POST(request, { params }) {
  try {
    // Nadie vota más de 60 veces por minuto a mano: así un script no puede inflar los votos de un plan
    if (!(await dentroDelLimite(request, "voto", 60, 60))) return NextResponse.json({ exito: false }, { status: 429 });
    const { id } = await params;
    const { indice, voto, votante } = await request.json();
    if (!idPlanValido(id) || !votanteValido(votante)) return NextResponse.json({ exito: false }, { status: 400 });
    const plan = await leerJSON(`plan:${id}`);
    if (!plan || !plan.itinerario?.[Number(indice)]) return NextResponse.json({ exito: false }, { status: 404 });
    await votar(id, indice, votante, voto);
    enSegundoPlano(() => registrar("voto"), "estadísticas");
    return NextResponse.json({ exito: true, votos: await resumenVotos(id, plan.itinerario.length, votante) });
  } catch (e) {
    console.error("[votar]", e?.message || e);
    return NextResponse.json({ exito: false }, { status: 500 });
  }
}
