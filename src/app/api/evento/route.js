import { METRICAS, registrar } from "../../../lib/estadisticas";
import { esPrueba, registrarAccionLugar } from "../../../lib/lugares";
import { sinRomper } from "../../../lib/almacen";

// POST /api/evento — analítica propia. Lo manda el navegador con navigator.sendBeacon (texto plano).
// { tipo: "visita" | "vuelve" | "compartir" | "detalle" | "llamar" | "web" | ..., fuente?, lugarId? }
const DESDE_NAVEGADOR = ["visita", "vuelve", "compartir", "abre_compartido", "detalle", "llamar", "web"];

export async function POST(request) {
  let datos = {};
  try { datos = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  const { tipo, fuente, lugarId } = datos;
  if (!DESDE_NAVEGADOR.includes(tipo) || !METRICAS.includes(tipo)) return new Response(null, { status: 400 });
  await sinRomper(registrar(tipo, { fuente }), "estadísticas");
  if (["detalle", "llamar", "web"].includes(tipo) && lugarId && !esPrueba(request)) await sinRomper(registrarAccionLugar(lugarId, tipo), "lugar");
  return new Response(null, { status: 204 });
}
