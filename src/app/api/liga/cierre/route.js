import { NextResponse } from "next/server";
import { cerrarSemanas } from "../../../../lib/liga/cierre";
import { servicio } from "../../../../lib/liga/servicio";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Cron diario (vercel.json): al cerrar una semana con premios, correo a los 5 ganadores y lista a Alejandro.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const informe = await cerrarSemanas(servicio());
    return NextResponse.json({ exito: true, informe });
  } catch (e) {
    console.error("[liga cierre]", e?.message || e);
    return NextResponse.json({ exito: false, mensaje: e?.message || "fallo" }, { status: 500 });
  }
}
