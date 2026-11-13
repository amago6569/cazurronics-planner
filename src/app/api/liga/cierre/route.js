import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { cerrarSemanas } from "../../../../lib/liga/cierre";
import { correoConfigurado, correoGanador, mandarCorreo } from "../../../../lib/liga/correo";
import { codigoPremio, PREMIOS } from "../../../../lib/liga/premios";
import { servicio } from "../../../../lib/liga/servicio";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Cron diario (vercel.json): al cerrar una semana con premios, correo a los 5 ganadores y lista a Alejandro.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const informe = await cerrarSemanas(servicio());
    return NextResponse.json({ exito: true, informe });
  } catch (e) {
    console.error("[liga cierre]", e?.message || e);
    return NextResponse.json({ exito: false, mensaje: e?.message || "fallo" }, { status: 500 });
  }
}

// POST { prueba: true } con la clave del panel (cabecera x-clave): manda un correo de ganador de ejemplo
// a la propia cuenta de correo de la liga (LIGA_SMTP_USUARIO), para ver cómo llega. No toca el ranking.
export async function POST(request) {
  if (!process.env.PANEL_CLAVE) return NextResponse.json({ exito: false, mensaje: "Falta PANEL_CLAVE en el servidor." }, { status: 503 });
  const acceso = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  if (acceso !== "ok") return respuestaClave(acceso);
  const cuerpo = await request.json().catch(() => ({}));
  if (cuerpo?.prueba !== true) return NextResponse.json({ exito: false, mensaje: "Solo sirve para la prueba." }, { status: 400 });
  if (!correoConfigurado()) return NextResponse.json({ exito: false, mensaje: "Faltan LIGA_SMTP_USUARIO y LIGA_SMTP_CLAVE en Vercel (y volver a publicar)." }, { status: 503 });
  const inicio = Object.keys(PREMIOS)[0];
  const premio = PREMIOS[inicio][0];
  const codigo = await codigoPremio("prueba", 1, "prueba");
  try {
    await mandarCorreo(process.env.LIGA_SMTP_USUARIO, correoGanador({ apodo: "Prueba", puesto: 1, codigo, premio }, { desde: inicio, cierre: "2026-11-21" }));
    return NextResponse.json({ exito: true, mensaje: `Correo de prueba enviado a ${process.env.LIGA_SMTP_USUARIO}. El código de prueba no vale en la web.` });
  } catch (e) {
    console.error("[liga prueba correo]", e?.message || e);
    return NextResponse.json({ exito: false, mensaje: `No se pudo mandar: ${e?.message || e}` }, { status: 502 });
  }
}
