import { NextResponse } from "next/server";
import { asegurarBarridoReciente, barrerEventos, HORAS_MIN_CRON, IDS_TRAMOS, idTramo, tramoReciente } from "../../../lib/eventos";

export const maxDuration = 60; // cada tramo del barrido cabe en un minuto
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (ver vercel.json), un tramo cada vez:
//  · ?tramo=d0..d5  barrido diario de madrugada (d5: teatros y auditorios)
//  · ?tramo=r       repaso de novedades (mediodía y tarde)
//  · ?tramo=m0..m7  barrido GORDO municipio a municipio (cada domingo)
// Sin ?tramo, hace el tramo más atrasado.
// Vercel envía "Authorization: Bearer <CRON_SECRET>" si defines CRON_SECRET en las variables de entorno.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const t = new URL(request.url).searchParams.get("tramo");
    const tramo = t == null ? null : idTramo(t);
    if (tramo != null && !IDS_TRAMOS.includes(tramo)) {
      return NextResponse.json({ exito: false, mensaje: `tramo debe ser uno de: ${IDS_TRAMOS.join(", ")}` }, { status: 400 });
    }
    // Si ese tramo ya se hizo hace poco (por ejemplo a mano desde el panel), no se repite: cada búsqueda se paga
    if (tramo != null) {
      const reciente = await tramoReciente(tramo, HORAS_MIN_CRON[String(tramo)[0]] ?? 4);
      if (reciente) return NextResponse.json({ exito: true, saltado: true, informe: { tramo, hechoHaceHoras: Math.round(reciente.hace / 3600000) } });
    }
    const informe = tramo == null ? { lanzado: await asegurarBarridoReciente() } : await barrerEventos({ tramo });
    return NextResponse.json({ exito: true, informe });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
