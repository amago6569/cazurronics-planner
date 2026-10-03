import { NextResponse } from "next/server";
import { comando, varios } from "../../../lib/almacen";

// POST /api/negocios — copia de seguridad de las solicitudes de negocios.
// El formulario sigue mandando cada solicitud a tu Google Apps Script (como siempre) y ADEMÁS aquí.
// Así ninguna se pierde aunque el Apps Script falle o no esté configurado en Vercel:
// todas aparecen en /panel → "Negocios que quieren hablar contigo".
const MAX_GUARDADAS = 300;
const limpiar = (v, max) => String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

export async function POST(request) {
  let d = {};
  try { d = await request.json(); } catch { return NextResponse.json({ exito: false }, { status: 400 }); }
  if (d.web) return NextResponse.json({ exito: true }); // campo trampa: solo lo rellenan los bots

  const solicitud = {
    nombreLocal: limpiar(d.nombreLocal, 120),
    email: limpiar(d.email, 160),
    telefono: limpiar(d.telefono, 30),
    mensaje: limpiar(d.mensaje, 1000),
    enviadoAlSheet: d.enviadoAlSheet === true,
    fecha: new Date().toISOString(),
  };
  if (!solicitud.nombreLocal || (!/^\S+@\S+\.\S+$/.test(solicitud.email) && solicitud.telefono.replace(/\D/g, "").length < 9)) {
    return NextResponse.json({ exito: false, mensaje: "Faltan el nombre del local o una forma de contacto" }, { status: 400 });
  }

  try {
    // Freno anti-spam: máximo una solicitud por minuto desde la misma conexión
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
    const libre = await comando(["SET", `negocios:freno:${ip}`, "1", "NX", "EX", 60]);
    if (!libre) return NextResponse.json({ exito: true, repetida: true });
    await varios([
      ["LPUSH", "negocios:solicitudes", JSON.stringify(solicitud)],
      ["LTRIM", "negocios:solicitudes", 0, MAX_GUARDADAS - 1],
    ]);
    return NextResponse.json({ exito: true });
  } catch (e) {
    console.error("[negocios]", e?.message || e);
    return NextResponse.json({ exito: false, mensaje: "No se pudo guardar" }, { status: 500 });
  }
}
