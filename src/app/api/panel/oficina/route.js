import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { leerJSON } from "../../../../lib/almacen";
import { hoyEnLeon, leerGastoIA } from "../../../../lib/estadisticas";
import { decidirDudoso, eventosProximos, leerBandeja } from "../../../../lib/eventos";
import { montarOficina } from "../../../../lib/oficina";

export const dynamic = "force-dynamic";

// /api/panel/oficina (cabecera x-clave = PANEL_CLAVE)
//  · GET  → las mesas de la oficina, el parte del jefe y la bandeja de eventos dudosos
//  · POST { id, decision: "subir" | "tirar" } → decides tú sobre un evento de la bandeja
async function acceso(request) {
  if (!process.env.PANEL_CLAVE) return NextResponse.json({ exito: false, mensaje: "Falta la variable PANEL_CLAVE en el servidor." }, { status: 503 });
  const r = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  return r === "ok" ? null : respuestaClave(r);
}

// Lo que dejan apuntado las tareas de la Despensa y los avisos, en el mismo formato que los partes del barrido
function partesDeOtros({ productos, tiendas, fichas, captacion, finde }) {
  const p = {};
  if (productos?.fin) p["despensa-productos"] = { fin: productos.fin, error: productos.combinaciones?.every((c) => c.error) ? "Fallaron todas las búsquedas" : null, texto: `${productos.combinaciones?.length || 0} búsquedas de producto` };
  if (tiendas?.fin) p["despensa-tiendas"] = { fin: tiendas.fin, error: tiendas.error || null, texto: tiendas.nada || `${tiendas.tiendas || 0} tiendas nuevas` };
  if (fichas?.fin) p["despensa-fichas"] = { fin: fichas.fin, error: fichas.fallidas && !fichas.investigadas ? fichas.error : null, texto: fichas.nada || `${fichas.investigadas || 0} tiendas investigadas` };
  if (captacion?.fin) p.captacion = { fin: captacion.fin, error: captacion.exito === false ? captacion.mensaje : null, texto: captacion.enviado ? "Te ha mandado un correo" : captacion.motivo || "Sin novedades" };
  if (finde?.fin) p.finde = { fin: finde.fin, error: finde.exito === false ? finde.mensaje : null, texto: finde.enviado ? "Te ha mandado el resumen" : finde.motivo || "Sin agenda del finde" };
  return p;
}

export async function GET(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  try {
    const [barrido, bandeja, agenda, gasto, jefe, productos, tiendas, fichas, captacion, finde] = await Promise.all([
      leerJSON("eventos:ultimoBarrido"), leerBandeja(), eventosProximos(), leerGastoIA().catch(() => null), leerJSON("oficina:jefe"),
      leerJSON("despensa:ultimoBarrido"), leerJSON("despensa:g:ultimo"), leerJSON("despensa:fichas:ultimo"),
      leerJSON("oficina:turno:captacion"), leerJSON("oficina:turno:finde"),
    ]);
    const hoy = hoyEnLeon();
    const nuevosHoy = (barrido?.tramos || []).filter((t) => t.fin && new Date(t.fin).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) === hoy).reduce((s, t) => s + (t.nuevos || 0), 0);
    const oficina = montarOficina({ ...(barrido?.empleados || {}), ...partesDeOtros({ productos, tiendas, fichas, captacion, finde }) }, {
      bandeja: bandeja.length,
      agenda: agenda.reduce((s, d) => s + d.eventos.length, 0),
      nuevosHoy,
      gastoMes: gasto?.[0]?.tareas?.reduce((s, t) => s + t.dolares, 0) ?? null,
      jefe,
    });
    return NextResponse.json({ exito: true, ...oficina, bandeja: bandeja.slice(0, 60) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[oficina]", e);
    return NextResponse.json({ exito: false, mensaje: `Error del servidor: ${e?.message || e}` }, { status: 500 });
  }
}

export async function POST(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  const { id, decision } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !["subir", "tirar"].includes(decision)) return NextResponse.json({ exito: false }, { status: 400 });
  try {
    return NextResponse.json(await decidirDudoso(id, decision));
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
