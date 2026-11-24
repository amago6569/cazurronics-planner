import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { apuntarCuadre, apuntarRecarga, leerPanelGasto } from "../../../../lib/gastoPanel";

export const dynamic = "force-dynamic";

// Nada de esto sale sin la clave del panel (cabecera x-clave = PANEL_CLAVE). Se lee de Redis: 0 € en Google.
const SIN_CACHE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const responder = (datos, status = 200) => NextResponse.json(datos, { status, headers: SIN_CACHE });

async function comprobar(request) {
  if (!process.env.PANEL_CLAVE) return responder({ exito: false, mensaje: "Falta la variable PANEL_CLAVE en el servidor." }, 503);
  const acceso = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  return acceso === "ok" ? null : respuestaClave(acceso);
}

// GET /api/admin/gasto → saldo, gasto por días, función y modelo, planes, últimas 50 llamadas, errores y recargas
export async function GET(request) {
  const fuera = await comprobar(request);
  if (fuera) return fuera;
  try {
    return responder(await leerPanelGasto());
  } catch (e) {
    console.error("[admin/gasto]", e?.message || e);
    return responder({ exito: false, mensaje: "No se han podido leer los datos de gasto." }, 500);
  }
}

// POST /api/admin/gasto { accion: "recarga", euros, fecha? }  → apunta una recarga de AI Studio
//                       { accion: "cuadre", saldo }           → apunta el saldo que marca AI Studio ahora
export async function POST(request) {
  const fuera = await comprobar(request);
  if (fuera) return fuera;
  const body = await request.json().catch(() => null);
  try {
    if (body?.accion === "recarga") {
      const t = body.fecha ? Date.parse(body.fecha) : Date.now();
      if (!Number.isFinite(t)) return responder({ exito: false, mensaje: "La fecha no se entiende." }, 400);
      const r = await apuntarRecarga(body.euros, t);
      return responder(r, r.exito ? 200 : 400);
    }
    if (body?.accion === "cuadre") {
      const r = await apuntarCuadre(body.saldo);
      return responder(r, r.exito ? 200 : 400);
    }
    return responder({ exito: false, mensaje: "accion debe ser «recarga» o «cuadre»." }, 400);
  } catch (e) {
    console.error("[admin/gasto]", e?.message || e);
    return responder({ exito: false, mensaje: "No se ha podido guardar." }, 500);
  }
}
