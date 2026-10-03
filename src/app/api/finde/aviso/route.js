import { NextResponse } from "next/server";
import { eventosProximos } from "../../../../lib/eventos";
import { hoyEnLeon } from "../../../../lib/estadisticas";
import { calcularFinde, DOMINIO } from "../../../../lib/finde";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel cada jueves por la mañana (ver vercel.json) y te manda UN correo con el
// resumen del finde ya redactado: texto de WhatsApp, pie de Instagram y las imágenes. Solo hay que copiar y publicar.
// Es opcional y gratis: necesita estas variables de entorno (si faltan, no hace nada y no falla):
//   RESEND_API_KEY  clave de resend.com (plan gratuito: 3.000 correos al mes)
//   AVISO_EMAIL     tu correo (con la cuenta gratuita de Resend solo puede ser el del registro)
//   AVISO_DE        (opcional) remitente; por defecto el de pruebas de Resend
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  const clave = process.env.RESEND_API_KEY, para = process.env.AVISO_EMAIL;
  if (!clave || !para) return NextResponse.json({ exito: true, enviado: false, motivo: "Falta RESEND_API_KEY o AVISO_EMAIL en Vercel: el resumen sigue disponible en /panel y en /finde" });

  try {
    const p = calcularFinde(await eventosProximos(10), hoyEnLeon());
    if (!p.hayContenido) return NextResponse.json({ exito: true, enviado: false, motivo: "Todavía no hay agenda del finde" });

    const miniaturas = p.imagenes.map((u) => `<a href="${u}"><img src="${u}" width="150" style="border-radius:10px;margin:0 6px 6px 0" alt=""></a>`).join("");
    const html = `<div style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a">
      <h2>🦁 Tu resumen del finde está listo (${esc(p.rango)})</h2>
      <p>Solo tienes que copiar y publicar. Las imágenes se guardan pulsando sobre ellas (carrusel de Instagram); para historias, usa los enlaces de abajo.</p>
      <h3>💬 WhatsApp</h3><pre style="white-space:pre-wrap;background:#f1f5f9;padding:14px;border-radius:12px;font-family:inherit">${esc(p.whatsapp)}</pre>
      <h3>📸 Instagram (pie de foto)</h3><pre style="white-space:pre-wrap;background:#f1f5f9;padding:14px;border-radius:12px;font-family:inherit">${esc(p.instagram)}</pre>
      <h3>🖼️ Carrusel (${p.imagenes.length} imágenes)</h3><div>${miniaturas}</div>
      <p><b>Historias:</b><br>${p.historias.map((u, i) => `<a href="${u}">Historia ${i + 1}</a>`).join(" · ")}</p>
      <p><a href="${DOMINIO}/finde">${DOMINIO}/finde</a> · <a href="${DOMINIO}/panel">Panel</a></p></div>`;
    const texto = `Tu resumen del finde está listo (${p.rango})\n\n=== WHATSAPP ===\n${p.whatsapp}\n\n=== INSTAGRAM ===\n${p.instagram}\n\n=== IMÁGENES ===\n${p.imagenes.join("\n")}\n\nHistorias:\n${p.historias.join("\n")}`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.AVISO_DE || "Cazurronics <onboarding@resend.dev>", to: [para], subject: `🦁 Tu resumen del finde está listo (${p.rango})`, html, text: texto }),
    });
    if (!r.ok) return NextResponse.json({ exito: false, enviado: false, mensaje: `Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: 502 });
    return NextResponse.json({ exito: true, enviado: true });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: e.message }, { status: 500 });
  }
}
