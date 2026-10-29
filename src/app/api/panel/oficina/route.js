import { NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../../lib/freno";
import { claveDePanelValida } from "../../../../lib/lugares";
import { decidirDudoso, ordenar } from "../../../../lib/eventos";
import { EMPLEADO_DESPENSA, ordenarDespensa } from "../../../../lib/despensa";
import { datosOficina } from "../../../../lib/oficinaDatos";
import { hablarConJefe, pulsarBoton, reescribirMensaje } from "../../../../lib/jefe";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // una orden de "trabajar ya" es un turno entero

// /api/panel/oficina (cabecera x-clave = PANEL_CLAVE)
//  · GET  → las mesas de la oficina, el parte del jefe y la bandeja de eventos dudosos
//  · POST { id, decision: "subir" | "tirar" } → decides tú sobre un evento de la bandeja
//  · POST { empleado, accion: "trabajar" }         → ese empleado repite su turno ya (máx. 1 cada 6 h)
//  · POST { empleado, accion: "encargo", texto, ya } → encargo para su próximo turno, o al momento si ya = true
//    (a "despensa-productos" el encargo lleva también la comarca: { zona })
//  · POST { chat: "texto" } → le escribes al jefe: responde o lo convierte en una orden (~0,0001 $)
//  · POST { local, accion: "enviado" | "recordado" | "no" } → «Hoy te toca»: le has escrito (o no se le escribe)
//  · POST { local, accion: "cambiar", texto } → la IA reescribe su mensaje con tu indicación (~0,0001 $)
async function acceso(request) {
  if (!process.env.PANEL_CLAVE) return NextResponse.json({ exito: false, mensaje: "Falta la variable PANEL_CLAVE en el servidor." }, { status: 503 });
  const r = await claveConFreno(request, claveDePanelValida(request.headers.get("x-clave") || ""));
  return r === "ok" ? null : respuestaClave(r);
}

export async function GET(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  try {
    const { bandeja, ...oficina } = await datosOficina();
    return NextResponse.json({ exito: true, ...oficina, bandeja: bandeja.slice(0, 60) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[oficina]", e);
    return NextResponse.json({ exito: false, mensaje: `Error del servidor: ${e?.message || e}` }, { status: 500 });
  }
}

export async function POST(request) {
  const bloqueo = await acceso(request);
  if (bloqueo) return bloqueo;
  const cuerpo = await request.json().catch(() => ({}));
  if (typeof cuerpo.chat === "string") {
    try {
      return NextResponse.json({ exito: true, ...(await hablarConJefe(cuerpo.chat, { desde: "panel" })) });
    } catch (e) {
      console.error("[oficina] chat", e);
      return NextResponse.json({ exito: false, mensaje: "El jefe no contesta ahora mismo. Prueba en un minuto." }, { status: 500 });
    }
  }
  if (typeof cuerpo.local === "string") {
    try {
      if (cuerpo.accion === "cambiar") {
        const r = await reescribirMensaje(cuerpo.local, String(cuerpo.texto || ""));
        return NextResponse.json(r.exito ? { exito: true, texto: r.texto } : r);
      }
      const letra = { enviado: "s", recordado: "r", no: "n" }[cuerpo.accion];
      if (!letra) return NextResponse.json({ exito: false }, { status: 400 });
      const r = await pulsarBoton(`c:${letra}:${cuerpo.local}`);
      return NextResponse.json({ exito: !!r.cierre, mensaje: r.cierre || r.aviso });
    } catch (e) {
      console.error("[oficina] captación", e);
      return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
    }
  }
  if (typeof cuerpo.empleado === "string") {
    try {
      const orden = { accion: cuerpo.accion, texto: cuerpo.texto, ya: cuerpo.ya === true };
      if (cuerpo.empleado === EMPLEADO_DESPENSA) return NextResponse.json(await ordenarDespensa({ ...orden, zona: cuerpo.zona }));
      return NextResponse.json(await ordenar({ empleado: cuerpo.empleado, ...orden }));
    } catch (e) {
      console.error("[oficina] orden", e);
      return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
    }
  }
  const { id, decision } = cuerpo;
  if (typeof id !== "string" || !["subir", "tirar"].includes(decision)) return NextResponse.json({ exito: false }, { status: 400 });
  try {
    return NextResponse.json(await decidirDudoso(id, decision));
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
