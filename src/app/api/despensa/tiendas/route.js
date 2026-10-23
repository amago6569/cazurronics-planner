import { NextResponse } from "next/server";
import { barrerTiendas } from "../../../../lib/despensaTiendas";
import { barrerMercadillos } from "../../../../lib/despensaMercados";

export const maxDuration = 60; // ~120 búsquedas en Google Maps (8 a la vez) + una comarca de mercadillos con la IA
export const dynamic = "force-dynamic";

// Lo llaman los crons de Vercel (vercel.json) dos veces cada noche: barrido gordo de tiendas de la Despensa por
// cuadrículas de Google Maps y, a la vez, los mercadillos de una comarca. Todo se renueva cada 30 días.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  const [tiendas, mercadillos] = await Promise.allSettled([barrerTiendas(), barrerMercadillos()]);
  const leer = (r) => (r.status === "fulfilled" ? r.value : { error: String(r.reason?.message || r.reason).slice(0, 160) });
  return NextResponse.json({ exito: tiendas.status === "fulfilled", tiendas: leer(tiendas), mercadillos: leer(mercadillos) });
}
