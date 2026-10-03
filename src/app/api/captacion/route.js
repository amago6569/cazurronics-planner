import { NextResponse } from "next/server";
import { claveDePanelValida } from "../../../lib/lugares";
import { guardarAjustes, guardarSeguimiento, listarCaptacion } from "../../../lib/captacion";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Captación de negocios (solo equipo: cabecera x-clave = PANEL_CLAVE, igual que /api/panel).
//   GET  → los locales listos para escribirles, en seguimiento, casi listos y cerrados, con los mensajes ya preparados
//   POST { accion: "local", clave, cambios: { email?, instagram?, estado?, via?, recordado? } }
//        { accion: "ajustes", apariciones?, interacciones?, remitente? }
//        { accion: "prueba", activar: true | false }   (modo prueba de este navegador)
const autorizado = (request) => claveDePanelValida(request.headers.get("x-clave") || "");
const SIN_CACHE = { "Cache-Control": "no-store" };
const COOKIE_PRUEBA = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" };

function rechazar(request) {
  if (!process.env.PANEL_CLAVE) return NextResponse.json({ exito: false, mensaje: "Falta la variable PANEL_CLAVE en el servidor." }, { status: 503 });
  if (!autorizado(request)) return NextResponse.json({ exito: false, mensaje: "Clave incorrecta" }, { status: 401 });
  return null;
}

export async function GET(request) {
  const no = rechazar(request);
  if (no) return no;
  try {
    const res = NextResponse.json({ exito: true, ...(await listarCaptacion()) }, { headers: SIN_CACHE });
    // La primera vez que entras, este navegador pasa a "modo prueba": tus pruebas no suman cifras a los locales
    if (!/(?:^|;\s*)cz_prueba=/.test(request.headers.get("cookie") || "")) res.cookies.set("cz_prueba", "1", COOKIE_PRUEBA);
    return res;
  } catch (e) {
    console.error("[captación]", e);
    return NextResponse.json({ exito: false, mensaje: `Error del servidor: ${e?.message || e}` }, { status: 500 });
  }
}

export async function POST(request) {
  const no = rechazar(request);
  if (no) return no;
  const cuerpo = await request.json().catch(() => ({}));
  try {
    if (cuerpo.accion === "local") {
      const r = await guardarSeguimiento(cuerpo.clave, cuerpo.cambios || {});
      return NextResponse.json(r, { status: r.exito ? 200 : 400, headers: SIN_CACHE });
    }
    if (cuerpo.accion === "ajustes") {
      return NextResponse.json({ exito: true, ajustes: await guardarAjustes(cuerpo) }, { headers: SIN_CACHE });
    }
    if (cuerpo.accion === "prueba") {
      const res = NextResponse.json({ exito: true }, { headers: SIN_CACHE });
      res.cookies.set("cz_prueba", cuerpo.activar ? "1" : "0", COOKIE_PRUEBA);
      return res;
    }
    return NextResponse.json({ exito: false, mensaje: "Acción no válida" }, { status: 400 });
  } catch (e) {
    console.error("[captación]", e);
    return NextResponse.json({ exito: false, mensaje: e?.message || "Error del servidor" }, { status: 500 });
  }
}
