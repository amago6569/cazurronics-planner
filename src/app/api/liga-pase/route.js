// POST /api/liga-pase (formulario: clave, volver) → si la clave es la del panel, deja una cookie de un año y vuelve a la liga
import { NextResponse } from "next/server";
import { claveConFreno } from "../../../lib/freno";
import { COOKIE_PASE, destinoSeguro, firmaPase, iguales, paginaClave } from "../../../lib/liga/pase";

const html = (cuerpo, status) => new NextResponse(cuerpo, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export async function POST(request) {
  let clave = "", volver = "/liga";
  try { const f = await request.formData(); clave = String(f.get("clave") || ""); volver = destinoSeguro(f.get("volver")); } catch { /* formulario vacío */ }
  const real = process.env.PANEL_CLAVE;
  if (!real) return html(paginaClave(volver, "Falta la contraseña en el servidor (PANEL_CLAVE en Vercel)."), 503);
  const acceso = await claveConFreno(request, iguales(clave, real));
  if (acceso === "bloqueado") return html(paginaClave(volver, "Demasiados intentos. Espera 15 minutos."), 429);
  if (acceso !== "ok") return html(paginaClave(volver, "Esa contraseña no es."), 401);
  const r = NextResponse.redirect(new URL(volver, request.url), 303);
  r.cookies.set(COOKIE_PASE, await firmaPase(real), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return r;
}
