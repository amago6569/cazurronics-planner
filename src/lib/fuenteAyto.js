// ============ AGENDA DEL AYUNTAMIENTO DE LEÓN (sin IA, 0 €) ============
// aytoleon.es publica dos listas con fecha, hora y lugar: «Agenda» (actos del Ayuntamiento, p. ej. Expojoven) y
// «Eventos» (fiestas, encendido navideño, Semana Santa...). Se leen tal cual del HTML de la página, sin Gemini ni
// búsquedas de Google, en el barrido diario y en el repaso de novedades. Lo de despacho (plenos, consejos de
// administración, juntas de gobierno) no es ocio y se tira.
export const PAGINAS_AYTO = [
  "https://www.aytoleon.es/es/actualidad/agenda/Paginas/default.aspx",
  "https://www.aytoleon.es/es/actualidad/eventos/Paginas/default.aspx",
];

const MESES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 };
const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const DESPACHO = /^(?:consejo|junta (?:de gobierno|local)|pleno|comision|mesa |sorteo|minuto de silencio|reunion|acto institucional|toma de posesion|firma|rueda de prensa|recepcion oficial)|consejo de administracion|pleno (?:extra)?ordinario/;
const SALA_DE_DESPACHO = /sala de comisiones|salon de plenos/;

const textoPlano = (t) => String(t || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'")
  .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ")
  .replace(/\s+/g, " ").trim();

// «9.30», «8;30», «12:30 horas», «24:00» → «09:30», «08:30», «12:30», «00:00»
export function horaAyto(t) {
  const m = String(t || "").match(/(\d{1,2})\s*[:.;h]\s*(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]) % 24, min = Number(m[2]);
  return min < 60 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
}

// La página no da el año: el que deja la fecha más cerca de hoy (en diciembre, «03 ENE.» es del año que viene)
export function fechaAyto(dia, mes, hoy) {
  const [a] = String(hoy).split("-").map(Number);
  const opciones = [a - 1, a, a + 1].map((y) => `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  const ms = (f) => Math.abs(new Date(`${f}T12:00:00Z`) - new Date(`${hoy}T12:00:00Z`));
  return opciones.sort((x, y) => ms(x) - ms(y))[0];
}

function categoriaDe(titulo) {
  const t = normalizar(titulo);
  if (/\bexpo|feria|salon\b|muestra/.test(t)) return "feria";
  if (/mercad|rastro/.test(t)) return "mercado";
  if (/concierto|musica|banda|coro|orquesta/.test(t)) return "concierto";
  if (/teatro|espectaculo|danza|cine/.test(t)) return "teatro";
  if (/exposicion/.test(t)) return "exposicion";
  if (/carrera|partido|torneo|campeonato|deporte/.test(t)) return "deporte";
  if (/procesion|pregon|fiesta|encendido|cabalgata|desfile|ronda|cantaderas|cabezadas|pendones|carros|magosto|verbena/.test(t)) return "fiesta";
  return "otro";
}

// Lee las filas de la lista (día, mes, título, hora y lugar) del HTML de aytoleon.es
export function leerAgendaAyto(html, { hoy, fuente, desde = hoy, hasta = null } = {}) {
  const eventos = [];
  const filas = String(html || "").split(/class="row listitem-row"/).slice(1);
  for (const fila of filas) {
    const dia = Number(fila.match(/listitem-date-day">\s*(\d{1,2})\s*</)?.[1]);
    const mes = MESES[String(fila.match(/listitem-date-month">\s*([A-Za-zÁÉÍÓÚáéíóú]{3})/)?.[1] || "").toUpperCase()];
    const titulo = textoPlano(fila.match(/listitem-title">([\s\S]*?)<\/div>/)?.[1]).replace(/\.$/, "");
    if (!dia || !mes || !titulo) continue;
    const sub = fila.match(/listitem-subtitle"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
    const [antesLugar, trasLugar = ""] = sub.split(/bi-geo-alt/);
    const lugar = textoPlano(trasLugar.replace(/^"[^>]*>/, "").replace(/^[^>]*<\/i>/, "")) || null;
    const fecha = fechaAyto(dia, mes, hoy);
    if (fecha < desde || (hasta && fecha > hasta)) continue;
    if (DESPACHO.test(normalizar(titulo)) || SALA_DE_DESPACHO.test(normalizar(lugar))) continue;
    eventos.push({
      titulo, fecha, fechaFin: null, hora: horaAyto(textoPlano(antesLugar)), lugar, localidad: "León",
      precio: null, categoria: categoriaDe(titulo), descripcion: "Publicado en la agenda del Ayuntamiento de León.", fuente,
      lat: null, lon: null, origen: "ayto",
    });
  }
  return eventos;
}

// Las dos páginas, a la vez. Si una no contesta, vale la otra; si fallan las dos, error (lo apunta la oficina)
export async function fuenteAytoLeon(desde, hasta, { hoy = desde, ms = 8000 } = {}) {
  const res = await Promise.allSettled(PAGINAS_AYTO.map(async (url) => {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms), headers: { "User-Agent": "Mozilla/5.0 (compatible; CazurronicsBot/1.0; +https://cazurronics.es)" } });
    if (!r.ok) throw new Error(`aytoleon.es respondió ${r.status}`);
    return leerAgendaAyto(await r.text(), { hoy, fuente: url, desde, hasta });
  }));
  if (res.every((r) => r.status === "rejected")) throw res[0].reason;
  return res.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
