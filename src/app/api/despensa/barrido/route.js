import { NextResponse } from "next/server";
import { barrerDespensa } from "../../../../lib/despensa";

export const maxDuration = 60; // 6 búsquedas a la vez + la comprobación en Google Places
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (vercel.json) tres veces cada noche: cada pasada busca 6 combinaciones
// de producto y comarca que falten o tengan más de 90 días. Con 153 combinaciones, la Despensa se llena en ~9 días.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json({ exito: true, informe: await barrerDespensa() });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
