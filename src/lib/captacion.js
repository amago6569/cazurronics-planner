// ============ CAPTACIÓN DE NEGOCIOS ============
// Detecta qué locales ya rinden lo bastante en la web como para escribirles, guarda cómo va cada
// conversación (estado, contacto, fechas) y prepara los mensajes con sus cifras reales.
// NADA se envía solo a los locales: el panel deja el correo o el mensaje de Instagram preparado
// y lo mandas tú con un botón. Lo único automático es el aviso que te llega a ti (api/captacion/aviso).
import { comando, varios, leerJSON, guardarJSON, aObjeto } from "./almacen";
import { claveValida, leerLugares, slug, tokenNegocio } from "./lugares";

export const DOMINIO = (process.env.NEXT_PUBLIC_SITE_URL || "https://cazurronics.es").replace(/\/$/, "");

export const ESTADOS = ["nuevo", "contactado", "respondio", "cliente", "no"];
export const DIAS_RECORDATORIO = 7;
const DIA = 24 * 3600 * 1000;

// Solo se proponen sitios que pueden ser clientes (no monumentos, parques ni eventos sueltos)
const TIPOS_CAPTABLES = ["bar", "restaurante", "cafeteria", "cafetería", "taberna", "sidreria", "sidrería", "discoteca", "museo", "teatro", "deporte"];

// Umbral por defecto: 10 veces en planes y 3 gestos de interés (ficha abierta, llamada o web).
// Se cambia desde el panel (Captación → Ajustes) sin tocar código.
const POR_DEFECTO = { apariciones: 10, interacciones: 3 };

const entero = (v, min, max, def) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// ---------- Ajustes (umbral y nombre para firmar) ----------
export async function leerAjustes() {
  const a = (await leerJSON("captacion:ajustes")) || {};
  return {
    apariciones: entero(a.apariciones, 1, 1000, POR_DEFECTO.apariciones),
    interacciones: entero(a.interacciones, 0, 1000, POR_DEFECTO.interacciones),
    remitente: String(a.remitente || "").trim().slice(0, 60),
  };
}

export async function guardarAjustes(nuevos = {}) {
  const actual = await leerAjustes();
  const a = {
    apariciones: entero(nuevos.apariciones, 1, 1000, actual.apariciones),
    interacciones: entero(nuevos.interacciones, 0, 1000, actual.interacciones),
    remitente: nuevos.remitente === undefined ? actual.remitente : String(nuevos.remitente).trim().slice(0, 60),
  };
  await guardarJSON("captacion:ajustes", a);
  return a;
}

// ---------- Seguimiento de cada local (hash: clave del local → JSON) ----------
const CLAVE_LOCALES = "captacion:locales";

export async function leerSeguimientos() {
  const o = aObjeto(await comando(["HGETALL", CLAVE_LOCALES]));
  const r = {};
  for (const [k, v] of Object.entries(o)) {
    try { r[k] = JSON.parse(v); } catch { /* registro estropeado: se ignora */ }
  }
  return r;
}

const limpiarEmail = (v) => {
  const e = String(v || "").trim().toLowerCase().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
};

// Acepta "@bar_x", "bar_x" o "https://www.instagram.com/bar_x/?hl=es"
const NO_ES_USUARIO = ["p", "reel", "reels", "explore", "stories", "tv", "accounts"];
const limpiarInstagram = (v) => {
  let t = String(v || "").trim();
  const url = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  if (url) t = NO_ES_USUARIO.includes(url[1].toLowerCase()) ? "" : url[1];
  t = t.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : "";
};

// Guarda lo que cambia en un local. Solo acepta campos conocidos y los valida.
export async function guardarSeguimiento(clave, cambios = {}) {
  if (!claveValida(clave)) return { exito: false, mensaje: "Local no válido" };
  // Solo el registro de este local (antes se leían todos para cambiar uno)
  let antes = {};
  try { antes = JSON.parse((await comando(["HGET", CLAVE_LOCALES, clave])) || "{}") || {}; } catch { /* registro estropeado: se empieza de cero */ }
  const reg = { ...antes };

  if ("email" in cambios) {
    const v = limpiarEmail(cambios.email);
    if (String(cambios.email || "").trim() && !v) return { exito: false, mensaje: "Ese correo no parece válido" };
    reg.email = v;
  }
  if ("instagram" in cambios) {
    const v = limpiarInstagram(cambios.instagram);
    if (String(cambios.instagram || "").trim() && !v) return { exito: false, mensaje: "Ese usuario de Instagram no parece válido" };
    reg.instagram = v;
  }
  if (cambios.estado !== undefined) {
    if (!ESTADOS.includes(cambios.estado)) return { exito: false, mensaje: "Estado no válido" };
    if (cambios.estado !== (antes.estado || "nuevo")) {
      reg.estado = cambios.estado;
      reg.cambioEn = Date.now();
      if (cambios.estado === "contactado") {
        reg.contactadoEn = Date.now();
        delete reg.recordadoEn;
        reg.via = ["correo", "instagram"].includes(cambios.via) ? cambios.via : antes.via || "";
      }
    }
  }
  if (cambios.recordado === true) reg.recordadoEn = Date.now();

  await comando(["HSET", CLAVE_LOCALES, clave, JSON.stringify(reg)]);
  return { exito: true, seguimiento: reg };
}

// Apunta que ya te hemos avisado de estos locales (para no repetir el correo). campo: "avisadoEn" | "recordatorioAvisadoEn"
export async function marcarAvisados(claves, campo) {
  if (!claves.length) return;
  const todos = await leerSeguimientos();
  await varios(claves.map((k) => ["HSET", CLAVE_LOCALES, k, JSON.stringify({ ...(todos[k] || {}), [campo]: Date.now() })]));
}

// ¿Supera el umbral? Nunca se propone un local que la gente valora mal (3 o más valoraciones y menos del 60 % positivas).
export function evaluar(stats, ajustes) {
  const interacciones = (stats.detalle || 0) + (stats.llamar || 0) + (stats.web || 0);
  const valoradas = (stats.bien || 0) + (stats.mal || 0);
  const aprobacion = valoradas ? stats.bien / valoradas : null;
  const malValorado = valoradas >= 3 && aprobacion < 0.6;
  const cumple = stats.apariciones >= ajustes.apariciones && interacciones >= ajustes.interacciones;
  const casi = !cumple && stats.apariciones >= Math.ceil(ajustes.apariciones / 2);
  return { interacciones, aprobacion, listo: cumple && !malValorado, casi: casi && !malValorado };
}

// Todo lo que necesita el panel (y el aviso diario): los locales repartidos en
// listos (superan el umbral y no se les ha escrito), seguimiento, casi listos y cerrados.
export async function listarCaptacion() {
  const [ajustes, seguimientos, ranking] = await Promise.all([
    leerAjustes(),
    leerSeguimientos(),
    comando(["ZREVRANGE", "ranking:apariciones", 0, 99]),
  ]);
  const claves = [...new Set([...(ranking || []), ...Object.keys(seguimientos)])].filter(claveValida);
  // Ficha + contadores de todos en UNA sola petición al almacén
  const fichas = (await leerLugares(claves)).filter(Boolean);
  const ahora = Date.now();
  const g = { listos: [], seguimiento: [], casi: [], cerrados: [] };

  for (const f of fichas) {
    const seg = seguimientos[f.clave] || {};
    const estado = ESTADOS.includes(seg.estado) ? seg.estado : "nuevo";
    const ev = evaluar(f.stats, ajustes);
    const captable = TIPOS_CAPTABLES.includes(String(f.tipo || "").toLowerCase()) && !!f.placeId; // sin ficha de Google no es un local real
    const local = {
      clave: f.clave, nombre: f.nombre, tipo: f.tipo || null, stats: f.stats,
      interacciones: ev.interacciones, aprobacion: ev.aprobacion, estado,
      email: seg.email || "", instagram: seg.instagram || "", via: seg.via || "",
      contactadoEn: seg.contactadoEn || null, recordadoEn: seg.recordadoEn || null,
      avisadoEn: seg.avisadoEn || null, recordatorioAvisadoEn: seg.recordatorioAvisadoEn || null,
      toca: estado === "contactado" && !!seg.contactadoEn && !seg.recordadoEn && ahora - seg.contactadoEn >= DIAS_RECORDATORIO * DIA,
    };
    if (estado === "contactado" || estado === "respondio") g.seguimiento.push(local);
    else if (estado === "cliente" || estado === "no") g.cerrados.push(local);
    else if (captable && ev.listo) g.listos.push(local);
    else if (captable && ev.casi) g.casi.push(local);
  }

  const masSalen = (a, b) => b.stats.apariciones - a.stats.apariciones;
  g.listos.sort(masSalen);
  g.casi.sort(masSalen);
  // Un mismo local no se propone dos veces aunque tenga dos fichas
  // (y tampoco se vuelve a proponer uno al que ya se le ha escrito, aunque Google lo tenga con otra ficha)
  const vistos = new Set([...g.seguimiento, ...g.cerrados].map((l) => slug(l.nombre)));
  const sinRepetir = (lista) => lista.filter((l) => { const n = slug(l.nombre); if (vistos.has(n)) return false; vistos.add(n); return true; });
  g.listos = sinRepetir(g.listos);
  g.casi = sinRepetir(g.casi).slice(0, 12);
  g.seguimiento.sort((a, b) => Number(b.toca) - Number(a.toca) || (a.contactadoEn || 0) - (b.contactadoEn || 0));
  g.cerrados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  for (const l of [...g.listos, ...g.seguimiento]) l.mensajes = mensajesPara(l, { remitente: ajustes.remitente });
  return { ajustes, ...g };
}

// ---------- Los mensajes (solo informan; si quieren saber más, responden) ----------
const pl = (n, uno, muchos) => (n === 1 ? uno : muchos);

function lineasCifras(s) {
  const l = [`${s.apariciones} ${pl(s.apariciones, "vez", "veces")} recomendados en un plan`];
  if (s.detalle) l.push(`${s.detalle} ${pl(s.detalle, "persona ha abierto", "personas han abierto")} vuestra ficha`);
  if (s.llamar && s.web) l.push(`${s.llamar} ${pl(s.llamar, "ha pulsado", "han pulsado")} «Llamar» y ${s.web} ${pl(s.web, "ha entrado", "han entrado")} en vuestra web desde ahí`);
  else if (s.llamar) l.push(`${s.llamar} ${pl(s.llamar, "ha pulsado", "han pulsado")} «Llamar»`);
  else if (s.web) l.push(`${s.web} ${pl(s.web, "ha entrado", "han entrado")} en vuestra web desde ahí`);
  return l;
}

export function mensajesPara(local, { remitente = "" } = {}) {
  const s = local.stats;
  const token = tokenNegocio(local.clave);
  const enlace = token ? `${DOMINIO}/negocio/${token}` : DOMINIO;
  const quien = remitente ? `Soy ${remitente}, de Cazurronics` : "Soy del equipo de Cazurronics";
  const firma = remitente || "El equipo de Cazurronics";
  const cifras = lineasCifras(s).map((x) => `• ${x}`).join("\n");
  const breve = `${s.apariciones} ${pl(s.apariciones, "vez", "veces")} hasta hoy${s.detalle ? `, y ${s.detalle} ${pl(s.detalle, "persona ha abierto", "personas han abierto")} vuestra ficha` : ""}`;
  const asunto = `${local.nombre} ya sale en los planes de Cazurronics`;
  const baja = "Si preferís que no os escriba más, decídmelo y listo.";

  const correo = [
    `Hola, equipo de ${local.nombre}:`, "",
    `${quien} (cazurronics.es). Es una web en la que la gente de León cuenta qué le apetece hacer y por dónde se mueve, y una IA le monta el plan por horas con sitios reales de la provincia.`, "",
    `Os escribo para avisaros de que ${local.nombre} ya está saliendo en esos planes. Estas son vuestras cifras hasta hoy:`, "",
    cifras, "",
    `Las he dejado en un panel privado que solo veis vosotros y que se actualiza solo: ${enlace}`, "",
    "Si os interesa saber más, respondedme a este mismo correo y os cuento.", "",
    "Un saludo,", firma, "Cazurronics · cazurronics.es · @cazurronics", "",
    baja,
  ].join("\n");

  const correoCorto = [
    `Hola, equipo de ${local.nombre}:`, "",
    `${quien} (cazurronics.es), la web que le monta planes a la gente de León con IA. Os aviso de que ${local.nombre} ya sale en esos planes: ${breve}.`, "",
    `Aquí tenéis vuestro panel privado con las cifras: ${enlace}`, "",
    "Si queréis saber más, respondedme a este correo y os cuento.", "",
    "Un saludo,", `${firma} · cazurronics.es`, "",
    baja,
  ].join("\n");

  const chat = [
    `Hola 👋 ${quien}, la web que le monta planes a la gente de León con IA (cazurronics.es).`, "",
    `Os aviso de que ${local.nombre} está saliendo en los planes: ${breve}. Os he dejado vuestro panel privado con las cifras: ${enlace}`, "",
    "Si queréis saber más, respondedme por aquí y os cuento 🙌",
  ].join("\n");

  const recordatorio = (canal) => [
    `Hola de nuevo 🙂 Solo quería asegurarme de que os llegó mi mensaje de hace unos días. Os dejo otra vez el enlace con las cifras de ${local.nombre}: ${enlace}`, "",
    `Si queréis saber más, respondedme ${canal === "correo" ? "a este correo" : "por aquí"} y os cuento.`,
  ].join("\n");

  return {
    enlace,
    asunto, asuntoCorto: `Vuestras cifras en Cazurronics, ${local.nombre}`, asuntoRecordatorio: `Re: ${asunto}`,
    correo, correoCorto, chat,
    recordatorioCorreo: recordatorio("correo"), recordatorioChat: recordatorio("chat"),
  };
}
