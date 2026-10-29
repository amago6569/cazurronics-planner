import { NextResponse } from "next/server";
import { asegurarBarridoReciente, barrerEventos, HORAS_MIN_CRON, IDS_TRAMOS, idTramo, jefeRepasa, tramoReciente } from "../../../lib/eventos";
import { segundaComprobacion, turnoDeRepesca } from "../../../lib/guardia";

export const maxDuration = 60; // cada tramo del barrido cabe en un minuto
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (ver vercel.json), un tramo cada vez:
//  · ?tramo=t0..t7  los 12 empleados por tipo de plan (de madrugada)
//  · ?tramo=d2..d5  comarcas y teatros (de madrugada)
//  · ?tramo=r       repaso de novedades (mediodía y tarde)
//  · ?tramo=m0..m22 pueblos, municipio a municipio (domingos y miércoles)
//  · ?jefe=1        el jefe: repite el turno que alguien se haya saltado (2 veces al día)
//  · ?guardia=verificador  segunda comprobación de los eventos sin fuente segura (3 veces al día)
//  · ?guardia=repesca      repite las búsquedas que fallaron (2 veces al día)
// Sin ?tramo, hace el tramo más atrasado.
// Vercel envía "Authorization: Bearer <CRON_SECRET>" si defines CRON_SECRET en las variables de entorno.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("jefe")) return NextResponse.json({ exito: true, jefe: await jefeRepasa() });
    if (params.get("guardia") === "verificador") return NextResponse.json({ exito: true, verificador: await segundaComprobacion() });
    if (params.get("guardia") === "repesca") return NextResponse.json({ exito: true, repesca: await turnoDeRepesca() });
    const t = params.get("tramo");
    const tramo = t == null ? null : idTramo(t);
    if (tramo != null && !IDS_TRAMOS.includes(tramo)) {
      return NextResponse.json({ exito: false, mensaje: `tramo debe ser uno de: ${IDS_TRAMOS.join(", ")}` }, { status: 400 });
    }
    // Si ese tramo ya se hizo hace poco (por ejemplo a mano desde el panel), no se repite: cada búsqueda se paga
    if (tramo != null) {
      const reciente = await tramoReciente(tramo, HORAS_MIN_CRON[String(tramo)[0]] ?? 4);
      if (reciente) return NextResponse.json({ exito: true, saltado: true, informe: { tramo, hechoHaceHoras: Math.round(reciente.hace / 3600000) } });
    }
    const informe = tramo == null ? { lanzado: await asegurarBarridoReciente() } : await barrerEventos({ tramo, respetarPausas: true });
    return NextResponse.json({ exito: true, informe });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
