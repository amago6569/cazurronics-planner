import { after, NextResponse } from "next/server";
import { claveConFreno, respuestaClave } from "../../../lib/freno";
import { claveDePanelValida } from "../../../lib/lugares";
import { activarWebhook, chatDelDueno, enviarTelegram, escribiendo, secretoValido, telegramConfigurado } from "../../../lib/telegram";
import { cifrasInstagram, cifrasWeb, resumenSemanal, responderPregunta } from "../../../lib/asesor";

export const maxDuration = 45;
export const dynamic = "force-dynamic";

const AYUDA = `🦁 Soy tu asesor de métricas. Pregúntame lo que quieras de la web o de Instagram, por ejemplo:
· ¿Cuántos planes esta semana?
· ¿Qué publicación funcionó mejor?
· ¿Qué local sale más en los planes?

Atajos: /resumen (con recomendación), /web y /instagram (solo cifras).`;

// Telegram llama aquí con cada mensaje que recibe el bot.
// Se contesta "ok" al momento y la respuesta se manda después (si no, Telegram reintenta y llegarían duplicados).
export async function POST(request) {
  if (!secretoValido(request.headers.get("x-telegram-bot-api-secret-token") || "")) {
    return NextResponse.json({ exito: false }, { status: 401 });
  }
  const aviso = await request.json().catch(() => null);
  const mensaje = aviso?.message;
  const chatId = mensaje?.chat?.id;
  const texto = String(mensaje?.text || "").trim();
  if (!chatId || !texto) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      // Primera vez: aún no sabemos cuál es tu chat. Te lo dice para que lo pongas en Vercel, y nada más.
      if (!process.env.TELEGRAM_CHAT_ID) {
        await enviarTelegram(chatId, `Tu número de chat es ${chatId}. Ponlo en Vercel como TELEGRAM_CHAT_ID y haz Redeploy. Hasta entonces no contesto a nadie.`);
        return;
      }
      if (!chatDelDueno(chatId)) return; // a cualquier otro, silencio
      const orden = texto.split(/[\s@]/)[0].toLowerCase();
      if (orden === "/start" || orden === "/ayuda" || orden === "/help") return await enviarTelegram(chatId, AYUDA);
      if (orden === "/web") return await enviarTelegram(chatId, await cifrasWeb());
      if (orden === "/instagram") return await enviarTelegram(chatId, await cifrasInstagram());
      await escribiendo(chatId);
      const respuesta = orden === "/resumen" ? await resumenSemanal() : await responderPregunta(texto);
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
    return NextResponse.json({ exito: true, mensaje: "Bot conectado. Escríbele /start en Telegram.", direccion: info?.url, pendientes: info?.pending_update_count ?? 0 });
  } catch (e) {
    return NextResponse.json({ exito: false, mensaje: String(e?.message || e) }, { status: 502 });
  }
}
