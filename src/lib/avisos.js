// ============ AVISOS QUE NO ESPERAN AL PARTE DE LA MAÑANA ============
// La mayoría de fallos los arregla la Repesca y van en el parte diario (y solo si se repiten dos días). Estos tres no:
//  · Google rechaza la clave de la IA (el barrido entero se para).
//  · Google ha retirado un modelo del barrido.
//  · La IA pasa de 1 € en un día.
// Cada uno te llega por Telegram como mucho una vez al día. Se mira al acabar cada turno del barrido y en las rondas
// del jefe: solo lee Redis, 0 €.
import { comando, leerJSON, sinRomper } from "./almacen";
import { hoyEnLeon, leerGastoDias } from "./estadisticas";
import { enviarTelegram, leerDueno, telegramConfigurado } from "./telegram";
import { apuntarCharla, JEFE, TU } from "./charla";
import { LIMITE_DIA_EUROS, euros } from "./euros";

export function avisosPendientes({ barrido, gasto }) {
  const tipos = new Set(Object.values(barrido?.fuentes || {}).filter((f) => !f.ok).map((f) => f.tipo));
  const avisos = [];
  if (tipos.has("clave")) avisos.push({ tipo: "clave", texto: "🔑 Google rechaza la clave de la IA y el barrido no puede buscar. Hay que cambiar GEMINI_API_KEY en Vercel (Settings → Environment Variables). La clave nueva se saca en aistudio.google.com/apikey." });
  if (tipos.has("modelo")) avisos.push({ tipo: "modelo", texto: "🧩 Google ha retirado uno de los modelos de IA del barrido. Los otros siguen trabajando; dímelo y lo cambio por otro 2.x (gratis)." });
  if (gasto?.hoy > LIMITE_DIA_EUROS) avisos.push({ tipo: "gasto", texto: `💸 La IA lleva ${euros(gasto.hoy)} hoy (el aviso salta a partir de ${euros(LIMITE_DIA_EUROS)}). Mira la tarjeta de gasto en /panel/oficina.` });
  return avisos;
}

export async function avisosUrgentes() {
  const [barrido, gasto] = await Promise.all([leerJSON("eventos:ultimoBarrido"), leerGastoDias().catch(() => null)]);
  const avisos = avisosPendientes({ barrido, gasto });
  if (!avisos.length) return [];
  const hoy = hoyEnLeon();
  const dueno = telegramConfigurado() ? await leerDueno().catch(() => null) : null;
  const enviados = [];
  for (const a of avisos) {
    if (!(await comando(["SET", `oficina:aviso:${hoy}:${a.tipo}`, "1", "NX", "EX", 2 * 24 * 3600]))) continue;
    if (dueno) await enviarTelegram(dueno, a.texto).catch(() => null);
    enviados.push(a.tipo);
  }
  if (enviados.length) await sinRomper(apuntarCharla(avisos.filter((a) => enviados.includes(a.tipo)).map((a) => ({ de: JEFE, a: TU, tipo: "fallo", texto: a.texto }))), "charla");
  return enviados;
}
