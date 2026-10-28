// ============ BOT DE TELEGRAM (ASESOR DE MÉTRICAS) ============
// Telegram avisa a /api/telegram cada vez que alguien escribe al bot. Solo se contesta al chat del dueño.
// Variables en Vercel:
//   TELEGRAM_TOKEN    el que da @BotFather al crear el bot
//   TELEGRAM_SECRETO  cualquier texto largo inventado: Telegram lo manda en cada aviso y así nadie más puede llamar al bot
//   TELEGRAM_CHAT_ID  tu número de chat (el bot te lo dice la primera vez que le escribes)
import { timingSafeEqual } from "node:crypto";

const API = "https://api.telegram.org";
const MAX_MENSAJE = 4000; // Telegram corta en 4096

const limpio = (v) => String(v || "").trim();

export const telegramConfigurado = () => Boolean(limpio(process.env.TELEGRAM_TOKEN));

// La cabecera que Telegram añade a cada aviso, comparada sin filtrar información por tiempos
export function secretoValido(recibido) {
  const real = limpio(process.env.TELEGRAM_SECRETO);
  if (!real || typeof recibido !== "string") return false;
  const a = Buffer.from(recibido), b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function chatDelDueno(chatId) {
  const dueno = limpio(process.env.TELEGRAM_CHAT_ID);
  return Boolean(dueno) && String(chatId) === dueno;
}

// Parte un texto largo en trozos que Telegram acepta, cortando por saltos de línea cuando se puede
export function trocear(texto, max = MAX_MENSAJE) {
  const t = String(texto || "").trim();
  if (!t) return [];
  const trozos = [];
  let resto = t;
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max);
    if (corte < max / 2) corte = max;
    trozos.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) trozos.push(resto);
  return trozos;
}

async function llamarTelegram(metodo, cuerpo) {
  const res = await fetch(`${API}/bot${limpio(process.env.TELEGRAM_TOKEN)}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const datos = await res.json().catch(() => ({}));
  if (!datos.ok) throw new Error(`Telegram ${metodo}: ${res.status} ${String(datos.description || "").slice(0, 160)}`);
  return datos.result;
}

// Texto plano (sin Markdown): así un asterisco o un guion bajo en un nombre nunca rompe el envío
export async function enviarTelegram(chatId, texto) {
  for (const trozo of trocear(texto)) {
    await llamarTelegram("sendMessage", { chat_id: chatId, text: trozo, link_preview_options: { is_disabled: true } });
  }
}

export const escribiendo = (chatId) => llamarTelegram("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);

// Le dice a Telegram a qué dirección mandar los mensajes del bot (se hace una vez, desde /api/telegram?activar=CLAVE)
export async function activarWebhook(url) {
  await llamarTelegram("setWebhook", { url, secret_token: limpio(process.env.TELEGRAM_SECRETO), allowed_updates: ["message"], drop_pending_updates: true });
  await llamarTelegram("setMyCommands", {
    commands: [
      { command: "resumen", description: "Resumen de la semana con una recomendación" },
      { command: "web", description: "Cifras de la web (últimos 7 días)" },
      { command: "instagram", description: "Cifras de Instagram" },
    ],
  }).catch(() => null);
  return llamarTelegram("getWebhookInfo", {});
}
