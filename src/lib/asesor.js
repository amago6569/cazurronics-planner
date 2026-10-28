// ============ ASESOR DE MÉTRICAS (BOT DE TELEGRAM) ============
// Junta las cifras de la web (las mismas del panel) y las de Instagram (fotos diarias guardadas) en un texto
// corto y se lo pasa a Gemini, SIN búsqueda en Google: solo puede contestar con estos datos.
// Coste: ~3.000 tokens de entrada y ~300 de salida con gemini-2.5-flash-lite ≈ 0,0005 $ por pregunta.
import { llamarGemini } from "./gemini";
import { leerGastoIA, leerResumen } from "./estadisticas";
import { topLugares } from "./lugares";
import { eventosProximos } from "./eventos";
import { listarCaptacion } from "./captacion";
import { leerFotosInstagram } from "./instagram";

const ETIQUETAS = {
  visita: "visitas", vuelve: "gente que vuelve", plan: "planes", retoque: "retoques", compartir: "planes compartidos",
  abre_compartido: "abren un plan compartido", voto: "votos", valoracion: "valoraciones", detalle: "fichas de local abiertas",
  llamar: "clics en Llamar", web: "clics a la web del local", despensa: "búsquedas en la Despensa",
};

const sumar = (dias) => dias.reduce((t, d) => {
  for (const k of Object.keys(ETIQUETAS)) t[k] = (t[k] || 0) + (Number(d[k]) || 0);
  return t;
}, {});

const variacion = (ahora, antes) => (antes ? `${ahora >= antes ? "+" : ""}${Math.round(((ahora - antes) / antes) * 100)} %` : "sin datos de antes");

// resumen = leerResumen(14): porDia[0] es hoy. Compara los últimos 7 días (hoy incluido) con los 7 anteriores.
export function resumirWeb(resumen) {
  const dias = resumen?.porDia || [];
  const esta = sumar(dias.slice(0, 7)), anterior = sumar(dias.slice(7, 14));
  const lineas = Object.entries(ETIQUETAS)
    .filter(([k]) => esta[k] || anterior[k])
    .map(([k, nombre]) => `- ${nombre}: ${esta[k] || 0} (semana anterior ${anterior[k] || 0}, ${variacion(esta[k] || 0, anterior[k] || 0)})`);
  return { esta, anterior, texto: lineas.join("\n") || "- sin datos esta semana" };
}

export function resumirInstagram(fotos) {
  const [hoy] = fotos || [];
  if (!hoy) return "Instagram: todavía no hay datos guardados (falta INSTAGRAM_TOKEN o aún no ha pasado el cron de la mañana).";
  const haceUnaSemana = fotos.find((f) => f.fecha <= restarDias(hoy.fecha, 7));
  const seguidores = haceUnaSemana?.seguidores != null && hoy.seguidores != null
    ? `${hoy.seguidores} (hace 7 días ${haceUnaSemana.seguidores}, ${hoy.seguidores - haceUnaSemana.seguidores >= 0 ? "+" : ""}${hoy.seguidores - haceUnaSemana.seguidores})`
    : `${hoy.seguidores ?? "?"}`;
  const alcanceDiario = fotos.slice(0, 14).filter((f) => f.ayer?.alcance != null).map((f) => `${restarDias(f.fecha, 1)}: ${f.ayer.alcance}`).join(", ");
  const ultimaPublicacion = hoy.publicaciones?.[0]?.fecha;
  const pubs = (hoy.publicaciones || []).map((p) =>
    `- ${p.fecha} ${p.tipo}: alcance ${p.alcance ?? "?"}, vistas ${p.vistas ?? "?"}, likes ${p.likes ?? "?"}, comentarios ${p.comentarios ?? "?"}, guardados ${p.guardados ?? "?"}, compartidos ${p.compartidos ?? "?"} · "${p.texto}"`);
  return [
    `Instagram @${hoy.usuario} (datos del ${hoy.fecha}):`,
    `- seguidores: ${seguidores}`,
    `- última publicación: ${ultimaPublicacion || "?"}`,
    alcanceDiario ? `- alcance de la cuenta por día: ${alcanceDiario}` : "",
    `Últimas publicaciones:`,
    ...pubs,
  ].filter(Boolean).join("\n");
}

function restarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const conFallo = (p) => p.catch((e) => { console.error("[asesor]", e?.message || e); return null; });

export async function contextoMetricas() {
  const [resumen, top, agenda, captacion, gasto, fotos] = await Promise.all([
    conFallo(leerResumen(14)),
    conFallo(topLugares("ranking:apariciones", 10)),
    conFallo(eventosProximos(7)),
    conFallo(listarCaptacion()),
    conFallo(leerGastoIA()),
    conFallo(leerFotosInstagram(15)),
  ]);
  const web = resumirWeb(resumen);
  const fuentes = Object.entries(resumen?.fuentes || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `${f} ${n}`).join(", ");
  const locales = (top || []).map((l) => `- ${l.nombre}: ${l.stats.apariciones} veces en planes, ${l.stats.detalle} fichas abiertas, ${l.stats.llamar} llamadas, ${l.stats.web} clics a su web`).join("\n");
  const eventos = (agenda || []).reduce((t, d) => t + d.eventos.length, 0);
  const mes = gasto?.[0];
  const dolares = mes ? mes.tareas.reduce((t, x) => t + x.dolares, 0) : null;
  return [
    `WEB cazurronics.es, últimos 7 días (hoy incluido) frente a los 7 anteriores:`,
    web.texto,
    `Planes por día (14 días, hoy primero): ${(resumen?.porDia || []).map((d) => `${d.fecha.slice(5)} ${d.plan || 0}`).join(", ")}`,
    `Visitas por día (14 días, hoy primero): ${(resumen?.porDia || []).map((d) => `${d.fecha.slice(5)} ${d.visita || 0}`).join(", ")}`,
    `Totales desde el principio: ${resumen?.total?.visita || 0} visitas, ${resumen?.total?.plan || 0} planes, ${resumen?.total?.compartir || 0} compartidos.`,
    fuentes ? `De dónde llegan las visitas con campaña (total): ${fuentes}` : "",
    locales ? `Locales que más salen en planes:\n${locales}` : "",
    captacion ? `Captación de negocios: ${captacion.listos.length} listos para escribirles, ${captacion.seguimiento.length} en seguimiento, ${captacion.cerrados.filter((l) => l.estado === "cliente").length} clientes.` : "",
    `Agenda: ${eventos} eventos comprobados en los próximos 7 días.`,
    dolares != null ? `Gasto de IA este mes (${mes.mes}): ${dolares.toFixed(2)} $.` : "",
    "",
    resumirInstagram(fotos || []),
  ].filter((l) => l !== "").join("\n");
}

const INSTRUCCIONES = `Eres el asesor de métricas de Alejandro, dueño de Cazurronics (web gratuita de planes de ocio en León con IA, cazurronics.es, y cuenta de Instagram @cazurronics).
Contesta en español de España, frases cortas, al grano, en texto plano para Telegram (sin Markdown, sin asteriscos). Usa algún emoji, pocos.
Usa SOLO las cifras de abajo. Si te pide algo que no está, dilo claro ("eso no lo tengo") y no inventes. TikTok y Facebook todavía no están conectados.
Datos concretos antes que adjetivos. Si das un consejo, da UNA sola recomendación, concreta y medible.`;

export async function responderPregunta(pregunta) {
  const datos = await contextoMetricas();
  const prompt = `${INSTRUCCIONES}\n\nCIFRAS DE HOY:\n${datos}\n\nPREGUNTA DE ALEJANDRO:\n${String(pregunta).slice(0, 1000)}\n\nRespuesta (máximo 12 líneas):`;
  const { texto } = await llamarGemini(prompt, { para: "asesor", tarea: "asesor", google: false, temperatura: 0.3, msMax: 25000 });
  return texto.replace(/\*\*?/g, "").trim();
}

export function resumenSemanal() {
  return responderPregunta("Hazme el resumen de la semana: 3-5 cifras clave de la web y de Instagram con su variación frente a la semana anterior, qué ha ido mejor, y UNA recomendación concreta para esta semana.");
}

// Cifras sin IA (gratis): para /web y /instagram
export async function cifrasWeb() {
  const r = await leerResumen(14);
  return `🌐 Web, últimos 7 días (hoy incluido) frente a los 7 anteriores:\n${resumirWeb(r).texto}`;
}

export async function cifrasInstagram() {
  return `📸 ${resumirInstagram(await leerFotosInstagram(15))}`;
}
