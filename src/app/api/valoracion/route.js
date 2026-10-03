import { NextResponse } from "next/server";
import { enSegundoPlano, leerJSON } from "../../../lib/almacen";
import { esPrueba, registrarValoracion } from "../../../lib/lugares";
import { idPlanValido, votanteValido } from "../../../lib/votos";
import { registrar } from "../../../lib/estadisticas";

// POST /api/valoracion  { planId, indice, valor: "bien" | "mal" | "nofui", votante }
// "¿Fuiste? ¿Qué tal?" — alimenta el ranking que usa el planificador y el panel de cada negocio.
export async function POST(request) {
  try {
    const { planId, indice, valor, votante } = await request.json();
    if (!idPlanValido(planId) || !votanteValido(votante)) return NextResponse.json({ exito: false }, { status: 400 });
    const plan = await leerJSON(`plan:${planId}`);
    const parada = plan?.itinerario?.[Number(indice)];
    if (!parada) return NextResponse.json({ exito: false }, { status: 404 });
    // Modo prueba (ver lib/lugares.js): se responde igual, pero no se apunta nada
    if (esPrueba(request)) return NextResponse.json({ exito: true, nueva: true });
    // El lugar sale del plan guardado, no de lo que mande el navegador
    const nueva = await registrarValoracion({ planId, indice: Number(indice), votante, valor, lugarId: parada.lugarId });
    if (nueva) enSegundoPlano(() => registrar("valoracion"), "estadísticas");
    return NextResponse.json({ exito: true, nueva });
  } catch (e) {
    console.error("[valoración]", e?.message || e);
    return NextResponse.json({ exito: false }, { status: 500 });
  }
}
