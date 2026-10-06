import { NextResponse } from "next/server";
import { claveDePanelValida } from "../../../../lib/lugares";
import { leerPeticionPlan } from "../../../../lib/planUtils";
import { montarPlan } from "../../../../lib/montarPlan";
import { mensajeParaUsuario } from "../../../../lib/gemini";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST /api/panel/comparar (cabecera x-clave = PANEL_CLAVE) { modo: "google" | "ahorro", ...petición del plan }
// Monta UN plan en el modo pedido y devuelve el plan, lo que ha costado la llamada a la IA y lo que ha tardado.
// No guarda el plan ni suma estadísticas: es solo para comparar desde /panel/comparar.
export async function POST(request) {
  if (!claveDePanelValida(request.headers.get("x-clave") || "")) {
    return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  }
  const inicio = Date.now();
  const body = await request.json().catch(() => null);
  const peticion = leerPeticionPlan(body);
  if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
  const conGoogle = body?.modo !== "ahorro";
  try {
    const r = await montarPlan(peticion, { conGoogle, inicio });
    return NextResponse.json({ ...r, modo: conGoogle ? "google" : "ahorro", segundos: Math.round((Date.now() - inicio) / 100) / 10 }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[comparar]", e?.message || e);
    return NextResponse.json({ exito: false, modo: conGoogle ? "google" : "ahorro", mensaje: mensajeParaUsuario(e), segundos: Math.round((Date.now() - inicio) / 100) / 10 }, { status: 200 });
  }
}
