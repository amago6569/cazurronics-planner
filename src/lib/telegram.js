// ============ BOT DE TELEGRAM (ASESOR DE MÉTRICAS) ============
// Telegram avisa a /api/telegram cada vez que alguien escribe al bot. Solo se contesta al chat del dueño.
// Variables en Vercel:
//   TELEGRAM_TOKEN    el que da @BotFather al crear el bot
//   TELEGRAM_SECRETO  cualquier texto largo inventado: Telegram lo manda en cada aviso y así nadie más puede llamar al bot
//   TELEGRAM_CHAT_ID  (opcional) tu número de chat. Si no está, el bot se empareja con un enlace de un solo uso
//                     que da /api/telegram?activar=CLAVE (caduca en 15 minutos); el chat que lo abre queda como dueño.
import { timingSafeEqual } from "node:crypto";
import { comando, nuevoId } from "./almacen";

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

const CLAVE_DUENO = "telegram:dueno";
const CLAVE_EMPAREJAR = "telegram:emparejar";
const MINUTOS_EMPAREJAR = 15;

export function chatDelDueno(chatId, dueno = limpio(process.env.TELEGRAM_CHAT_ID)) {
  return Boolean(dueno) && String(chatId) === String(dueno);
}

// El chat del dueño: el de Vercel si está; si no, el que se emparejó con /start
export async function leerDueno() {
  return limpio(process.env.TELEGRAM_CHAT_ID) || limpio(await comando(["GET", CLAVE_DUENO]).catch(() => "")) || null;
}

// Código de un solo uso para el enlace t.me/<bot>?start=<código>. Solo lo ve quien tiene la clave del panel.
export async function abrirEmparejamiento() {
  const codigo = nuevoId(16);
  await comando(["SET", CLAVE_EMPAREJAR, codigo, "EX", MINUTOS_EMPAREJAR * 60]);
  return codigo;
}

// true si este chat acaba de quedar como dueño: solo con el código vigente, y se borra al usarlo
export async function emparejar(chatId, codigo) {
  const vigente = limpio(await comando(["GET", CLAVE_EMPAREJAR]).catch(() => ""));
  const a = Buffer.from(limpio(codigo)), b = Buffer.from(vigente);
  if (!vigente || a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await comando(["DEL", CLAVE_EMPAREJAR]);
  await comando(["SET", CLAVE_DUENO, String(chatId)]);
  return true;
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
  const [info, bot] = await Promise.all([llamarTelegram("getWebhookInfo", {}), llamarTelegram("getMe", {})]);
  return { ...info, usuario: bot?.username };
}
