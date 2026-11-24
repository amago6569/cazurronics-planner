import { dentroDelLimite } from "../../../lib/freno";
import { apuntarAvisosCSP, clavesDeInforme } from "../../../lib/csp";
import { sinRomper } from "../../../lib/almacen";

export const dynamic = "force-dynamic";

// POST /api/csp — aquí manda el navegador cada aviso de la CSP (report-uri y report-to). Se cuentan por día, nada más:
// ni IP ni página. Como mucho 30 envíos por conexión y hora, y 20 KB por envío. Siempre contesta 204.
export async function POST(request) {
  const nada = new Response(null, { status: 204 });
  if (!(await dentroDelLimite(request, "csp", 30, 3600))) return nada;
  const texto = (await request.text().catch(() => "")).slice(0, 20000);
  await sinRomper(apuntarAvisosCSP(clavesDeInforme(texto)), "avisos csp");
  return nada;
}
