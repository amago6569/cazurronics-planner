// ============ ORGANIZAR LA AGENDA ============
// Funciones puras (valen en el servidor y en el navegador) para que la agenda y
// "Más cosas ese día" no repitan cosas y se lean por horas de un vistazo:
//  · mismoEvento(): detecta duplicados aunque tengan distinto nombre
//    ("Mercado de la Plaza Mayor" = "Mercadillo Plaza Mayor León").
//  · leerHora(): entiende "21:00", "a las 9", "10h-14h", "mañanas", "todo el día"...
//  · agruparPorFranja(): Todo el día · Por la mañana · Por la tarde · Por la noche, en orden.

import { zonaDe } from "./zonas";

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palabras que no distinguen un evento de otro
const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "e", "a", "al", "con", "por", "para", "un", "una", "o", "u", "su", "sus", "leon", "provincia", "edicion", "i", "ii", "iii", "iv", "v", "vi", "x", "xx", "xxi", "2025", "2026", "2027"]);
// Sinónimos: se tratan como la misma palabra
const SINONIMOS = {
  mercadillo: "mercado", mercadillos: "mercado", mercados: "mercado", rastro: "mercado", rastrillo: "mercado",
  muestra: "exposicion", exposiciones: "exposicion", expo: "exposicion",
  fiestas: "fiesta", festejos: "fiesta", conciertos: "concierto", recital: "concierto",
  jornadas: "jornada", visitas: "visita", rutas: "ruta", talleres: "taller", ferias: "feria", festivales: "festival",
};
// Palabras de "tipo de evento": no bastan por sí solas para decir que dos cosas son la misma
const GENERICAS = new Set(["mercado", "exposicion", "fiesta", "concierto", "jornada", "visita", "guiada", "ruta", "taller", "feria", "festival", "evento", "espectaculo", "teatro", "cine", "ciclo", "semana", "dia", "noche", "gran", "tradicional", "popular", "plaza", "calle", "musica", "directo", "gratis", "gratuito", "abierto", "nuevo"]);

// Familias: dos eventos de familias distintas nunca son el mismo (un concierto en la Plaza Mayor ≠ el mercado de la Plaza Mayor)
const FAMILIAS = [
  ["mercado", /mercad|rastr|abastos|productores/],
  ["musica", /concierto|musica|recital|dj|orquesta|banda|coro|jazz|rock|flamenco/],
  ["expo", /exposici|muestra|museo|galeria|expo\b/],
  ["escena", /teatro|danza|monolog|espectaculo|circo|magia|cine|pelicula/],
  ["fiesta", /fiesta|romeria|verbena|patron|san froilan|carnaval/],
  ["feria", /feria|festival|jornada|semana|congreso/],
  ["visita", /visita|ruta|guiad|senderismo|excursion/],
  ["deporte", /deporte|partido|carrera|maraton|futbol|baloncesto|balonmano|cultural leonesa|ademar/],
  ["gastro", /cata|degustacion|gastronom|tapa|vino|cerveza|cocido|cecina/],
  ["infantil", /infantil|ninos|familia|cuentacuentos|ludoteca/],
];

export function familia(e) {
  const texto = normalizar(`${e?.categoria || ""} ${e?.titulo || ""}`);
  for (const [nombre, patron] of FAMILIAS) if (patron.test(texto)) return nombre;
  return null;
}

function palabras(titulo) {
  return normalizar(titulo).replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/)
    .filter((p) => p && !VACIAS.has(p))
    .map((p) => SINONIMOS[p] || p.replace(/(es|s)$/, (m) => (p.length > 5 ? "" : m)));
}

// Palabras de recinto que no distinguen un sitio de otro ("Sala Babylon" = "Babylon")
const RECINTOS = new Set(["sala", "auditorio", "teatro", "museo", "centro", "espacio", "bar", "pub", "restaurante", "iglesia", "parque", "pabellon", "palacio", "casa", "club", "local", "plaza", "calle"]);
const lugarPalabras = (e) => palabras(`${e?.lugar || ""}`).filter((p) => !GENERICAS.has(p) && !RECINTOS.has(p));
function mismoLugar(a, b) {
  const la = lugarPalabras(a), lb = lugarPalabras(b);
  if (!la.length || !lb.length) return false;
  const [corto, largo] = la.length <= lb.length ? [la, new Set(lb)] : [lb, new Set(la)];
  return corto.every((p) => largo.has(p));
}

// ¿Son el mismo evento? (se compara dentro del mismo día)
export function mismoEvento(a, b) {
  if (!a || !b) return false;
  const fa = familia(a), fb = familia(b);
  if (fa && fb && fa !== fb) return false;
  // El "mercado semanal" de Astorga no es el de La Bañeza: si los dos dicen dónde son y es en zonas distintas, son distintos
  const conSitio = (e) => Boolean(e.localidad) || e.lat != null;
  if (conSitio(a) && conSitio(b) && zonaDe(a) !== zonaDe(b)) return false;
  const la = normalizar(a.localidad).trim(), lb = normalizar(b.localidad).trim();
  if (la && lb && !la.includes(lb) && !lb.includes(la)) return false; // pueblos distintos

  const pa = new Set(palabras(a.titulo)), pb = new Set(palabras(b.titulo));
  if (!pa.size || !pb.size) return false;
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  const jaccard = comunes / new Set([...pa, ...pb]).size;
  if (jaccard >= 0.6) return true;

  // Lo distintivo de uno está contenido en el otro ("Vidrieras del Mundo" ⊂ "Exposición Vidrieras del Mundo en el Conde Luna")
  const na = [...pa].filter((p) => !GENERICAS.has(p)), nb = [...pb].filter((p) => !GENERICAS.has(p));
  // Lo distintivo de los dos nombres es exactamente lo mismo ("Catedral de León" = "Catedral de León (visita)")
  if (na.length && na.length === nb.length && na.every((p) => nb.includes(p))) return true;
  const [corto, largo] = na.length <= nb.length ? [na, new Set(nb)] : [nb, new Set(na)];
  if (corto.length >= 2 && corto.every((p) => largo.has(p))) return true;
  // Con una sola palabra distintiva ("Ringorrango") exigimos además que sean del mismo tipo de evento
  if (corto.length === 1 && corto[0].length >= 5 && largo.has(corto[0]) && fa && fa === fb) return true;

  // Mismo sitio y misma hora de inicio
  const ha = leerHora(a.hora).min, hb = leerHora(b.hora).min;
  if (ha != null && ha === hb && mismoLugar(a, b)) return true;

  return false;
}

// Puntos para quedarnos con la versión más completa de un duplicado
const puntos = (e) => (e.origen === "jcyl" ? 3 : 0) + (e.hora ? 2 : 0) + (e.lugar ? 1 : 0) + (e.lat != null ? 1 : 0) + (e.precio ? 1 : 0) + (e.descripcion ? 1 : 0);

export function deduplicar(lista) {
  const fuera = [];
  for (const e of (lista || []).filter(Boolean)) {
    const i = fuera.findIndex((x) => mismoEvento(x, e));
    if (i === -1) fuera.push(e);
    else if (puntos(e) > puntos(fuera[i])) fuera[i] = e;
  }
  return fuera;
}

// ---------- Horas ----------
// Devuelve { min: minutos desde las 00:00 o null, fin: minutos o null, franja, texto }
export function leerHora(hora) {
  const t = normalizar(hora).trim();
  if (!t || /todo el dia|todo el dia|permanente|horario de apertura|consultar/.test(t)) return { min: null, fin: null, franja: "todo", texto: null };
  const horas = [...t.matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(h|horas|:|$|\s|-|–|a)/g)]
    .map((m) => Number(m[1]) * 60 + Number(m[2] || 0))
    .filter((m) => m <= 24 * 60);
  if (horas.length) {
    const [min, fin = null] = horas;
    const largo = fin != null && fin - min >= 6 * 60; // abierto casi todo el día (p. ej. 10:00–20:00)
    return { min, fin, franja: largo ? "todo" : franjaDe(min), texto: formatoHora(min, fin) };
  }
  if (/manana/.test(t)) return { min: 10 * 60, fin: null, franja: "manana", texto: "Por la mañana" };
  if (/mediodia/.test(t)) return { min: 13 * 60 + 30, fin: null, franja: "manana", texto: "Mediodía" };
  if (/tarde/.test(t)) return { min: 17 * 60, fin: null, franja: "tarde", texto: "Por la tarde" };
  if (/noche/.test(t)) return { min: 21 * 60, fin: null, franja: "noche", texto: "Por la noche" };
  return { min: null, fin: null, franja: "todo", texto: null };
}

const franjaDe = (min) => (min < 14 * 60 ? "manana" : min < 20 * 60 ? "tarde" : "noche");
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const formatoHora = (min, fin) => (fin != null && fin > min ? `${hhmm(min)}–${hhmm(fin)}` : hhmm(min));

export const FRANJAS = [
  { id: "todo", titulo: "Todo el día", emoji: "📌" },
  { id: "manana", titulo: "Mañana y mediodía", emoji: "🌅" },
  { id: "tarde", titulo: "Por la tarde", emoji: "☀️" },
  { id: "noche", titulo: "Por la noche", emoji: "🌙" },
];

export function ordenarPorHora(lista) {
  return [...(lista || [])]
    .map((e, i) => ({ e, i, h: leerHora(e.hora) }))
    .sort((a, b) => {
      const fa = FRANJAS.findIndex((f) => f.id === a.h.franja), fb = FRANJAS.findIndex((f) => f.id === b.h.franja);
      if (fa !== fb) return fa - fb;
      if (a.h.min != null && b.h.min != null && a.h.min !== b.h.min) return a.h.min - b.h.min;
      return a.i - b.i;
    })
    .map((x) => x.e);
}

// [{ franja, titulo, emoji, eventos: [...] }] solo con las franjas que tienen algo
export function agruparPorFranja(lista) {
  const ordenada = ordenarPorHora(deduplicar(lista));
  return FRANJAS.map((f) => ({ ...f, eventos: ordenada.filter((e) => leerHora(e.hora).franja === f.id) })).filter((g) => g.eventos.length);
}

// ---------- Agenda de varios días ----------
const DIAS_SEMANA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
export const esDeVariosDias = (e) => Boolean(e?.permanente || e?.diasSemana?.length || (e?.fechaFin && e.fechaFin > e.fecha));

const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

// Texto de cuándo es algo que dura varios días
export function cuandoEs(e) {
  if (e?.diasSemana?.length) {
    const d = [...e.diasSemana].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((n) => DIAS_SEMANA[n]);
    return `Todos los ${d.length > 1 ? `${d.slice(0, -1).join(", ")} y ${d.at(-1)}` : d[0]}`;
  }
  if (e?.permanente && !e?.fechaFin) return "Abierto estos días";
  if (e?.fechaFin) return `Hasta el ${fechaCorta(e.fechaFin)}`;
  return null;
}

// De [{fecha, eventos}] a: lo que está en marcha varios días (una sola vez) + cada día con lo suyo, sin repetir
export function organizarAgenda(dias) {
  const enMarcha = deduplicar((dias || []).flatMap((d) => d.eventos.filter(esDeVariosDias)));
  const porDia = (dias || [])
    .map((d) => {
      const propios = deduplicar(d.eventos.filter((e) => !esDeVariosDias(e)));
      return { fecha: d.fecha, total: propios.length, grupos: agruparPorFranja(propios) };
    })
    .filter((d) => d.total);
  return { enMarcha: ordenarPorHora(enMarcha), porDia };
}
