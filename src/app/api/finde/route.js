import { NextResponse } from "next/server";
import { eventosProximos } from "../../../lib/eventos";
import { hoyEnLeon } from "../../../lib/estadisticas";
import { calcularFinde } from "../../../lib/finde";

export const dynamic = "force-dynamic";

// El resumen del finde en JSON: textos para WhatsApp e Instagram + direcciones de las imágenes.
// Es información pública (la misma de /finde), así que no pide clave. Sirve para el panel
// y para conectarlo con Make.com u otra herramienta si algún día quieres publicar solo.
export async function GET() {
  try {
    const pack = calcularFinde(await eventosProximos(10), hoyEnLeon());
    return NextResponse.json({ exito: true, ...pack }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
