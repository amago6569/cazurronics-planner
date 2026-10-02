import { NextResponse } from "next/server";
import { barrerEventos } from "../../../lib/eventos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel una vez al día (ver vercel.json).
// Vercel envía "Authorization: Bearer <CRON_SECRET>" si defines CRON_SECRET en las variables de entorno.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const informe = await barrerEventos();
    return NextResponse.json({ exito: true, informe });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
