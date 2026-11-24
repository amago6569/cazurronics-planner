import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { leerPeticionPlan } from "../../../../lib/planUtils";
import { montarPlan } from "../../../../lib/montarPlan";
import { mensajeParaUsuario } from "../../../../lib/gemini";
import { medirGoogle } from "../../../../lib/contadorGoogle";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Los tres modos: «google» (la IA busca en Google), «ahorro» (el de la web) y «sinIA» (el plan B: 0 € de IA)
const MODOS = { google: { conGoogle: true }, ahorro: { conGoogle: false }, sinIA: { conGoogle: false, sinIA: true } };

// POST /api/panel/comparar (cabecera x-clave = PANEL_CLAVE) { modo: "google" | "ahorro" | "sinIA", ...petición del plan }
// Monta UN plan en el modo pedido y devuelve el plan, lo que ha costado (IA y llamadas a Google Maps sin caché) y lo que ha tardado.
// No guarda el plan ni suma estadísticas: es para comparar desde /panel/comparar y para las pruebas de planes (npm run evals).
export async function POST(request) {
  const acceso = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  if (acceso !== "ok") return respuestaClave(acceso);
  const inicio = Date.now();
  const body = await request.json().catch(() => null);
  const peticion = leerPeticionPlan(body);
  if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
  const modo = MODOS[body?.modo] ? body.modo : "google";
  const segundos = () => Math.round((Date.now() - inicio) / 100) / 10;
  try {
    const { resultado, google } = await medirGoogle(() => montarPlan(peticion, { ...MODOS[modo], inicio }));
    return NextResponse.json({ ...resultado, modo, segundos: segundos(), google }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[comparar]", e?.message || e);
    return NextResponse.json({ exito: false, modo, mensaje: mensajeParaUsuario(e), segundos: segundos() }, { status: 200 });
  }
}
