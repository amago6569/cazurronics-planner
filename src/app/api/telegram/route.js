import { after, NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../lib/freno";
import { claveDePanelValida } from "../../../lib/lugares";
import { abrirEmparejamiento, activarWebhook, cerrarBotones, chatDelDueno, contestarBoton, emparejar, enviarTelegram, escribiendo, leerDueno, secretoValido, telegramConfigurado } from "../../../lib/telegram";
import { cifrasInstagram, cifrasWeb, resumenSemanal } from "../../../lib/asesor";
import { cambiarMensaje, hablarConJefe, parteDiario, pulsarBoton } from "../../../lib/jefe";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const AYUDA = `👔 Soy el jefe de tu oficina. Pregúntame cifras de la web o de Instagram, o dale órdenes al equipo, por ejemplo:
· ¿Cuántos planes esta semana?
· Que Música mire los conciertos de El Gran Café
· Que Productos busque cecina de chivo por Boñar

Cada mañana te mando el parte, tu bandeja y los locales listos para escribirles, con botones.
Atajos: /jefe (parte ahora), /resumen (con recomendación), /web y /instagram (solo cifras).`;

// Telegram llama aquí con cada mensaje que recibe el bot.
// Se contesta "ok" al momento y la respuesta se manda después (si no, Telegram reintenta y llegarían duplicados).
export async function POST(request) {
  if (!secretoValido(request.headers.get("x-telegram-bot-api-secret-token") || "")) {
    return NextResponse.json({ exito: false }, { status: 401 });
  }
  const aviso = await request.json().catch(() => null);
  // Un botón pulsado (bandeja o captación)
  const boton = aviso?.callback_query;
  if (boton?.id) {
    after(async () => {
      const chat = boton.message?.chat?.id;
      try {
        if (!chatDelDueno(chat, await leerDueno())) return contestarBoton(boton.id);
        const r = await pulsarBoton(boton.data, { chatId: chat });
        await contestarBoton(boton.id, r.aviso || "");
        if (r.cierre && boton.message?.message_id) await cerrarBotones(chat, boton.message.message_id, `${boton.message.text || ""}\n\n${r.cierre}`);
        if (r.respuesta) await enviarTelegram(chat, r.respuesta, r.botones);
      } catch (e) {
        console.error("[telegram] botón", e?.message || e);
        await contestarBoton(boton.id, "No ha podido ser, prueba en el panel");
      }
    });
    return NextResponse.json({ ok: true });
  }
  const mensaje = aviso?.message;
  const chatId = mensaje?.chat?.id;
  const texto = String(mensaje?.text || "").trim();
  if (!chatId || !texto) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      const orden = texto.split(/[\s@]/)[0].toLowerCase();
      const dueno = await leerDueno();
      // Primera vez: el /start que llega justo después de abrir el enlace de activar queda como dueño
      if (!dueno) {
        if (orden === "/start" && (await emparejar(chatId, texto.split(/\s+/)[1]))) await enviarTelegram(chatId, `✅ Listo, ya te reconozco. Solo te contestaré a ti.\n\n${AYUDA}`);
        return;
      }
      if (!chatDelDueno(chatId, dueno)) return; // a cualquier otro, silencio
      if (orden === "/start" || orden === "/ayuda" || orden === "/help") return await enviarTelegram(chatId, AYUDA);
      if (orden === "/web") return await enviarTelegram(chatId, await cifrasWeb());
      if (orden === "/instagram") return await enviarTelegram(chatId, await cifrasInstagram());
      await escribiendo(chatId);
      if (orden === "/jefe") {
        for (const m of await parteDiario({ conCaptacion: false })) await enviarTelegram(chatId, m.texto, m.botones);
        return;
      }
      if (orden === "/resumen") return await enviarTelegram(chatId, await resumenSemanal());
      // Si acabas de pulsar ✏️ en un mensaje de captación, esto es cómo quieres cambiarlo
      const cambiado = await cambiarMensaje(chatId, texto);
      if (cambiado) return await enviarTelegram(chatId, cambiado.texto, cambiado.botones);
      const { respuesta } = await hablarConJefe(texto, { desde: "telegram" });
      await enviarTelegram(chatId, respuesta);
    } catch (e) {
      console.error("[telegram]", e?.message || e);
      await enviarTelegram(chatId, "No he podido sacar las cifras ahora mismo 🦁 Prueba otra vez en un minuto.").catch(() => null);
    }
  });
  return NextResponse.json({ ok: true });
}

// GET /api/telegram?activar=CLAVE_DEL_PANEL → conecta el bot con la web (una sola vez, tras poner las variables)
export async function GET(request) {
  const clave = new URL(request.url).searchParams.get("activar") || "";
  const acceso = await claveConFreno(request, claveDePanelValida(clave));
  if (acceso !== "ok") return respuestaClave(acceso);
  if (!telegramConfigurado() || !process.env.TELEGRAM_SECRETO) {
    return NextResponse.json({ exito: false, mensaje: "Faltan TELEGRAM_TOKEN o TELEGRAM_SECRETO en Vercel. Añádelas y haz Redeploy." }, { status: 503 });
  }
  try {
    // La dirección por la que se ha abierto este enlace (www.cazurronics.es): cazurronics.es sin www redirige
    // con un 308 y Telegram no sigue redirecciones, así que los mensajes se perderían.
    const info = await activarWebhook(`${new URL(request.url).origin}/api/telegram`);
    if (await leerDueno()) return NextResponse.json({ exito: true, mensaje: "Bot conectado y ya emparejado contigo.", direccion: info?.url });
    // Enlace de un solo uso: al abrirlo, Telegram manda "/start <código>" y ese chat queda como dueño
    const enlace = `https://t.me/${info.usuario}?start=${await abrirEmparejamiento()}`;
    return NextResponse.json({ exito: true, mensaje: "Bot conectado. Abre este enlace en los próximos 15 minutos para emparejarlo contigo (solo vale una vez).", enlace, direccion: info?.url });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: String(e?.message || e) }, { status: 502 });
  }
}
