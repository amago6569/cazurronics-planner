import { NextResponse } from "next/server";
import { investigarTiendas } from "../../../../lib/despensaFichas";

export const maxDuration = 60; // 30 lecturas de reseñas (10 a la vez) y 5 consultas a la IA a la vez, ~30 s
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (vercel.json) tres veces cada noche: lee las reseñas de Google de 30 tiendas de la
// Despensa y la IA (sin búsqueda) saca sus especialidades y premios. lib/despensaFichas.js
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
