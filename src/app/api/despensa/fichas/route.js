import { NextResponse } from "next/server";
import { investigarTiendas } from "../../../../lib/despensaFichas";

export const maxDuration = 60; // 4 consultas a la IA a la vez (6 tiendas cada una), ~40 s
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (vercel.json) tres veces cada noche: investiga premios y especialidades de 24 tiendas
// de la Despensa con la IA y búsqueda en Google (modelos 2.x, búsquedas gratis). lib/despensaFichas.js
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json({ exito: true, informe: await investigarTiendas() });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: String(e?.message || e).slice(0, 160) }, { status: 500 });
  }
}
