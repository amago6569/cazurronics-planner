import { METRICAS, registrar } from "../../../lib/estadisticas";
import { esPrueba, registrarAccionLugar } from "../../../lib/lugares";
import { sinRomper } from "../../../lib/almacen";
import { dentroDelLimite, dentroDelTopeDiario } from "../../../lib/freno";

// POST /api/evento — analítica propia. Lo manda el navegador con navigator.sendBeacon (texto plano).
// { tipo: "visita" | "vuelve" | "compartir" | "detalle" | "llamar" | "web" | ..., fuente?, lugarId? }
const DESDE_NAVEGADOR = ["visita", "vuelve", "compartir", "abre_compartido", "detalle", "llamar", "web"];

export async function POST(request) {
  let datos = {};
  try { datos = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  const { tipo, fuente, lugarId } = datos;
  if (!DESDE_NAVEGADOR.includes(tipo) || !METRICAS.includes(tipo)) return new Response(null, { status: 400 });
  // Freno: una persona normal no manda 120 avisos por minuto. Un programa sí, y nos inflaría las cifras.
  // Se responde igual (204) para no darle pistas, pero no se apunta nada.
  if (!(await dentroDelLimite(request, "evento", 120, 60))) return new Response(null, { status: 204 });
  await sinRomper(registrar(tipo, { fuente }), "estadísticas");
  // Llamadas, visitas a la web y fichas de un local: son las cifras que ven los negocios. Como mucho 3 al día
  // por conexión, local y tipo; así nadie las infla a base de clics.
  if (["detalle", "llamar", "web"].includes(tipo) && lugarId && !esPrueba(request)
    && await dentroDelTopeDiario(`accion:${String(lugarId).slice(0, 120)}:${tipo}`, 3, request)) {
    await sinRomper(registrarAccionLugar(lugarId, tipo), "lugar");
  }
  return new Response(null, { status: 204 });
}
