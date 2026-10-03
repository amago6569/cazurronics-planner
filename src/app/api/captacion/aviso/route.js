import { NextResponse } from "next/server";
import { DOMINIO, listarCaptacion, marcarAvisados } from "../../../../lib/captacion";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel cada mañana (ver vercel.json). Si algún local acaba de superar el umbral (o le toca
// recordatorio a uno al que ya escribiste) te manda UN correo con la lista. Nada se envía a los locales: eso lo haces
// tú desde /panel con el botón. Cada local solo se avisa una vez.
// Usa las mismas variables que el resumen del finde (si faltan, no hace nada y no falla):
//   RESEND_API_KEY  clave de resend.com (plan gratuito)
//   AVISO_EMAIL     tu correo (con la cuenta gratuita de Resend solo puede ser el del registro)
//   AVISO_DE        (opcional) remitente; por defecto el de pruebas de Resend
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MAX_EN_CORREO = 15;

const cifras = (l) => {
  const s = l.stats;
  const partes = [`${s.apariciones} en planes`, `${s.detalle} fichas`];
  if (s.llamar) partes.push(`${s.llamar} llamadas`);
  if (s.web) partes.push(`${s.web} web`);
  if (l.aprobacion !== null) partes.push(`${Math.round(l.aprobacion * 100)} % 😍`);
  return partes.join(" · ");
};

export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  try {
    const g = await listarCaptacion();
    const nuevos = g.listos.filter((l) => !l.avisadoEn);
    const recordar = g.seguimiento.filter((l) => l.toca && !l.recordatorioAvisadoEn);
    if (!nuevos.length && !recordar.length) return NextResponse.json({ exito: true, enviado: false, motivo: "Nada nuevo que avisar" });

    const clave = process.env.RESEND_API_KEY, para = process.env.AVISO_EMAIL;
    if (!clave || !para) {
      return NextResponse.json({ exito: true, enviado: false, pendientes: nuevos.length + recordar.length, motivo: "Falta RESEND_API_KEY o AVISO_EMAIL en Vercel: los locales siguen apareciendo en /panel → Captación" });
    }

    const panel = `${DOMINIO}/panel#captacion`;
    const lista = (ls) => ls.slice(0, MAX_EN_CORREO).map((l) => `<li style="margin-bottom:6px"><b>${esc(l.nombre)}</b>${l.tipo ? ` <span style="color:#64748b">(${esc(l.tipo)})</span>` : ""}<br><span style="color:#475569">${esc(cifras(l))}</span></li>`).join("")
      + (ls.length > MAX_EN_CORREO ? `<li>…y ${ls.length - MAX_EN_CORREO} más en el panel</li>` : "");
    const textoLista = (ls) => ls.slice(0, MAX_EN_CORREO).map((l) => `- ${l.nombre}${l.tipo ? ` (${l.tipo})` : ""}: ${cifras(l)}`).join("\n") + (ls.length > MAX_EN_CORREO ? `\n…y ${ls.length - MAX_EN_CORREO} más en el panel` : "");

    const asunto = nuevos.length
      ? `🎯 ${nuevos.length} ${nuevos.length === 1 ? "local listo" : "locales listos"} para escribir${recordar.length ? ` y ${recordar.length} ${recordar.length === 1 ? "recordatorio" : "recordatorios"}` : ""}`
      : `⏰ Toca recordatorio a ${recordar.length} ${recordar.length === 1 ? "local" : "locales"}`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:620px;color:#0f172a">
      <h2>${esc(asunto)}</h2>
      <p>Aviso solo para ti: <b>no se ha enviado nada a ningún local</b>. Entra en el panel, mira sus cifras y pulsa el botón de cada uno cuando quieras.</p>
      ${nuevos.length ? `<h3>🎯 Han superado el umbral (${g.ajustes.apariciones}+ veces en planes y ${g.ajustes.interacciones}+ interacciones)</h3><ul style="padding-left:18px">${lista(nuevos)}</ul>` : ""}
      ${recordar.length ? `<h3>⏰ Hace más de una semana que les escribiste y no han respondido</h3><ul style="padding-left:18px">${lista(recordar)}</ul>` : ""}
      <p><a href="${panel}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Abrir Captación en el panel</a></p></div>`;
    const texto = `${asunto}\n\nNo se ha enviado nada a ningún local.\n\n${nuevos.length ? `HAN SUPERADO EL UMBRAL:\n${textoLista(nuevos)}\n\n` : ""}${recordar.length ? `TOCA RECORDATORIO:\n${textoLista(recordar)}\n\n` : ""}Panel: ${panel}`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.AVISO_DE || "Cazurronics <onboarding@resend.dev>", to: [para], subject: asunto, html, text: texto }),
    });
    if (!r.ok) return NextResponse.json({ exito: false, enviado: false, mensaje: `Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: 502 });

    // Solo si el correo salió: así no se repite y, si falla, mañana se vuelve a intentar
    await marcarAvisados(nuevos.map((l) => l.clave), "avisadoEn");
    await marcarAvisados(recordar.map((l) => l.clave), "recordatorioAvisadoEn");
    return NextResponse.json({ exito: true, enviado: true, nuevos: nuevos.length, recordatorios: recordar.length });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
