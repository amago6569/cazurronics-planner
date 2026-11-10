import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { guardarPremio, leerPremios, quitarPremio } from "../../../../lib/premiosLiga";

export const dynamic = "force-dynamic";

// /api/panel/premios (cabecera x-clave = PANEL_CLAVE): negocios que dan premio en la Liga Cazurra
//  · GET → la lista, con logo
//  · POST { premio: { nombre, premio, estado, instagram, pueblo, notas, logo }, id? } → añade o cambia uno
//  · POST { quitar: id } → lo borra
async function acceso(request) {
  if (!process.env.PANEL_CLAVE) return NextResponse.json({ exito: false, mensaje: "Falta la variable PANEL_CLAVE en el servidor." }, { status: 503 });
  const r = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  return r === "ok" ? null : respuestaClave(r);
}

const fallo = (e) => {
  console.error("[premios]", e);
  return NextResponse.json({ exito: false, mensaje: "No se ha podido guardar. Prueba otra vez en un momento." }, { status: 500 });
};

export async function GET(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  try {
    return NextResponse.json({ exito: true, premios: await leerPremios() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fallo(e); }
}

export async function POST(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  const cuerpo = await request.json().catch(() => null);
  if (!cuerpo) return NextResponse.json({ exito: false, mensaje: "Petición vacía." }, { status: 400 });
  try {
    if (cuerpo.quitar) {
      const ok = await quitarPremio(cuerpo.quitar);
      return NextResponse.json(ok ? { exito: true } : { exito: false, mensaje: "Ese negocio ya no estaba." }, { status: ok ? 200 : 404 });
    }
    const r = await guardarPremio(cuerpo.premio, cuerpo.id);
    if (r.error) return NextResponse.json({ exito: false, mensaje: r.error }, { status: 400 });
    return NextResponse.json({ exito: true, premio: r.premio });
  } catch (e) { return fallo(e); }
}
