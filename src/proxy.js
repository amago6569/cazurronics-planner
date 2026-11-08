// La Liga Cazurra, con contraseña mientras se prueba (ver src/lib/liga/pase.js). Solo mira /liga y /api/liga.
import { NextResponse } from "next/server";
import { COOKIE_PASE, paginaClave, tienePase } from "./lib/liga/pase";

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  // el aviso diario de Vercel (que Supabase no se duerma) pasa siempre
  if (pathname.startsWith("/api/liga/") && (request.headers.get("user-agent") || "").startsWith("vercel-cron")) return NextResponse.next();
  if (await tienePase(request.cookies.get(COOKIE_PASE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "La liga aún está en pruebas." }, { status: 401 });
  const pagina = pathname === "/liga" || pathname.endsWith("/") || pathname.endsWith(".html");
  if (!pagina) return new NextResponse(null, { status: 401 });
  return new NextResponse(paginaClave(pathname + search), { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const config = { matcher: ["/liga", "/liga/:path*", "/api/liga/:path*"] };
