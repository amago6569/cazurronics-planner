// ============ EL JEFE DE LA OFICINA, POR TELEGRAM Y EN EL PANEL ============
// · Parte diario: UN mensaje por la mañana con lo que ha hecho el equipo, lo que hay en tu bandeja (con botones para
//   subir o tirar cada evento) y los locales listos para escribirles, cada uno con su mensaje ya hecho con sus cifras
//   reales y tres botones: ✅ Enviar · ✏️ Cambiar · ✖ No. Sustituye al correo de captación de las 7:30.
// · ✅ nunca manda nada solo (LSSI): te deja el texto y un botón que abre Instagram o Gmail con él puesto; lo envías tú.
// · Chat: lo que le escribes lo entiende una IA barata (flash-lite, sin Google, ~0,0001 $ por mensaje) y lo convierte
//   en una orden a un empleado o en una pregunta de cifras (el asesor de siempre).
import { comando } from "./almacen";
import { llamarGemini, extraerJSON } from "./gemini";
import { datosOficina } from "./oficinaDatos";
import { decidirDudoso, eventosProximos, ordenar, EMPLEADOS_BUSCADORES } from "./eventos";
import { EMPLEADO_DESPENSA, ordenarDespensa } from "./despensa";
import { guardarSeguimiento, listarCaptacion, marcarAvisados, DOMINIO } from "./captacion";
import { leerLugares } from "./lugares";
import { haversineKm } from "./planUtils";
import { apuntarCharla, JEFE, TU } from "./charla";
import { DEPARTAMENTOS } from "./oficina";
import { responderPregunta } from "./asesor";
import { ZONAS } from "./zonas";

const MAX_BANDEJA = 5, MAX_LOCALES = 3;
const EMPLEADOS = DEPARTAMENTOS.flatMap((d) => d.empleados);
const nombreDe = (id) => { const e = EMPLEADOS.find((x) => x.id === id); return e ? `${e.emoji} ${e.nombre}` : id; };
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

// ---------- Parte diario ----------
// Devuelve [{ texto, botones? }] en el orden en que se mandan
export async function parteDiario({ conCaptacion = true } = {}) {
  const ofi = await datosOficina();
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const nuevasHoy = ofi.novedades.filter((n) => new Date(n.cuando).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) === hoy);
  const lineas = [...ofi.jefe.lineas];
  if (nuevasHoy.length) lineas.push(`Novedades de hoy: ${nuevasHoy.filter((n) => n.tipo === "evento").length} eventos y ${nuevasHoy.filter((n) => n.tipo === "tienda").length} tiendas.`);
  if (ofi.jefe.cifras.gastoMes != null) lineas.push(`IA este mes: ${ofi.jefe.cifras.gastoMes.toFixed(2).replace(".", ",")} $.`);
  const mensajes = [{ texto: `👔 Parte del jefe\n\n${lineas.map((l) => `· ${l}`).join("\n")}\n\nPanel: ${DOMINIO}/panel/oficina` }];

  for (const e of ofi.bandeja.slice(0, MAX_BANDEJA)) {
    mensajes.push({
      texto: `📥 Bandeja · ${diaCorto(e.fecha)}${e.hora ? ` ${e.hora}` : ""}\n${e.titulo}\n${[e.lugar, e.localidad].filter(Boolean).join(", ")}\nLo trajo ${nombreDe(e.empleado)}. No se pudo comprobar la fuente${e.fuente ? `: ${e.fuente}` : "."}`,
      botones: [[{ text: "✅ Subir a la web", callback_data: `b:s:${e.id}` }, { text: "🗑 Tirar", callback_data: `b:t:${e.id}` }]],
    });
  }
  if (ofi.bandeja.length > MAX_BANDEJA) mensajes.push({ texto: `…y ${ofi.bandeja.length - MAX_BANDEJA} más en la bandeja del panel.` });
  if (conCaptacion) mensajes.push(...(await tarjetasCaptacion()));
  return mensajes;
}

// ---------- Captación ----------
// Lo que pasa cerca del local en los próximos días: un detalle real que hace el mensaje suyo y no genérico
async function cercaDe(ficha) {
  if (ficha?.lat == null) return null;
  const dias = await eventosProximos(10).catch(() => []);
  for (const d of dias) {
    const e = d.eventos.find((x) => x.lat != null && haversineKm(ficha.lat, ficha.lon, x.lat, x.lon) <= 1.5);
    if (e) return { ...e, fecha: d.fecha };
  }
  return null;
}

const BORRADOR = (clave) => `captacion:borrador:${clave}`;
const canal = (l) => (l.instagram ? "instagram" : l.email ? "correo" : null);

function textoBase(l, recordar) {
  const m = l.mensajes;
  if (recordar) return canal(l) === "correo" ? m.recordatorioCorreo : m.recordatorioChat;
  return canal(l) === "correo" ? m.correoCorto : m.chat;
}

async function tarjeta(l, { recordar = false } = {}) {
  const [borrador, [ficha]] = await Promise.all([comando(["GET", BORRADOR(l.clave)]).catch(() => null), leerLugares([l.clave]).catch(() => [null])]);
  let texto = borrador || textoBase(l, recordar);
  const cerca = !borrador && !recordar ? await cercaDe(ficha).catch(() => null) : null;
  // Un detalle de su zona, solo si es real (de la agenda verificada)
  if (cerca) texto = texto.replace(/\n\n(Si queréis saber más|Aquí tenéis vuestro panel)/, `\n\nPor cierto, el ${diaCorto(cerca.fecha)} hay «${cerca.titulo}» a dos pasos de vosotros: buen día para que os encuentren.\n\n$1`);
  const s = l.stats;
  const cabeza = recordar
    ? `⏰ Recordatorio · ${l.nombre}\nLe escribiste hace más de 7 días y no ha contestado.`
    : `🎯 Listo para escribirle · ${l.nombre}${l.tipo ? ` (${l.tipo})` : ""}\n${s.apariciones} veces en planes · ${s.detalle || 0} fichas abiertas${s.llamar ? ` · ${s.llamar} llamadas` : ""}${s.web ? ` · ${s.web} visitas a su web` : ""}`;
  const via = canal(l) === "instagram" ? `Por Instagram a @${l.instagram}` : canal(l) === "correo" ? `Por correo a ${l.email}` : "⚠️ No tengo su Instagram ni su correo: apúntalo en el panel → Captación.";
  return {
    texto: `${cabeza}\n${via}\n\n— Mensaje —\n${texto}`,
    botones: [[
      { text: "✅ Enviar", callback_data: `c:${recordar ? "r" : "s"}:${l.clave}` },
      { text: "✏️ Cambiar", callback_data: `c:e:${l.clave}` },
      { text: "✖ No", callback_data: `c:n:${l.clave}` },
    ]],
  };
}

export async function tarjetasCaptacion({ marcar = true } = {}) {
  const g = await listarCaptacion();
  const nuevos = g.listos.filter((l) => !l.avisadoEn).slice(0, MAX_LOCALES);
  const recordar = g.seguimiento.filter((l) => l.toca && !l.recordatorioAvisadoEn).slice(0, MAX_LOCALES);
  const tarjetas = [...(await Promise.all(nuevos.map((l) => tarjeta(l)))), ...(await Promise.all(recordar.map((l) => tarjeta(l, { recordar: true }))))];
  if (marcar) {
    await marcarAvisados(nuevos.map((l) => l.clave), "avisadoEn");
    await marcarAvisados(recordar.map((l) => l.clave), "recordatorioAvisadoEn");
  }
  if (nuevos.length) {
    await apuntarCharla(nuevos.flatMap((l) => [
      { de: "captacion", a: JEFE, tipo: "aviso", texto: `${l.nombre} ya sale ${l.stats.apariciones} veces en planes. ¿Le escribimos?` },
      { de: JEFE, a: TU, tipo: "aviso", texto: `Te paso el mensaje de ${l.nombre} por Telegram para que le des el visto bueno.` },
    ])).catch(() => null);
  }
  return tarjetas;
}

// Enlace que abre el mensaje ya escrito para que lo mandes tú
function enlaceEnviar(l, texto, recordar) {
  if (canal(l) === "instagram") return { url: `https://ig.me/m/${l.instagram}`, nota: "Copia el mensaje de arriba y pégalo en el chat de Instagram que se abre." };
  if (canal(l) === "correo") {
    const asunto = recordar ? l.mensajes.asuntoRecordatorio : l.mensajes.asuntoCorto;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(l.email)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
    return url.length < 1900 ? { url, nota: "Se abre Gmail con el correo escrito: revisa y pulsa Enviar." } : { url: `${DOMINIO}/panel#captacion`, nota: "El correo es largo para un enlace: ábrelo desde el panel." };
  }
  return null;
}

// ---------- Botones ----------
// datos = callback_data del botón. Devuelve { aviso, cierre?, respuesta?, botones? }
export async function pulsarBoton(datos, { chatId } = {}) {
  const [grupo, accion, ...resto] = String(datos || "").split(":");
  const id = resto.join(":");
  if (grupo === "b") {
    const r = await decidirDudoso(id, accion === "s" ? "subir" : "tirar");
    if (!r.exito) return { aviso: r.mensaje || "Ya no está" };
    await apuntarCharla([{ de: TU, a: JEFE, tipo: "orden", texto: accion === "s" ? "Ese evento de la bandeja, súbelo." : "Ese de la bandeja, fuera." }]).catch(() => null);
    return { aviso: accion === "s" ? "Subido a la web" : "Tirado", cierre: accion === "s" ? "✅ Subido a la web" : "🗑 Tirado (no vuelve en 30 días)" };
  }
  if (grupo !== "c") return { aviso: "Botón caducado" };
  const g = await listarCaptacion();
  const l = [...g.listos, ...g.seguimiento, ...g.casi, ...g.cerrados].find((x) => x.clave === id);
  if (!l) return { aviso: "Ya no encuentro ese local" };
  if (accion === "n") {
    await guardarSeguimiento(id, { estado: "no" });
    await apuntarCharla([{ de: TU, a: "captacion", tipo: "orden", texto: `A ${l.nombre} no le escribimos.` }]).catch(() => null);
    return { aviso: "Hecho", cierre: `✖ ${l.nombre}: no se le escribe. No vuelve a salir.` };
  }
  if (accion === "e") {
    await comando(["SET", `telegram:editando:${chatId}`, id, "EX", 3600]);
    return { aviso: "Dime qué cambio", respuesta: `✏️ ¿Qué le cambio al mensaje de ${l.nombre}? Escríbemelo (por ejemplo: «más corto», «tutéales», «menciona que su cecina sale mucho»).` };
  }
  const recordar = accion === "r";
  const texto = (await comando(["GET", BORRADOR(id)]).catch(() => null)) || textoBase(l, recordar);
  const abrir = enlaceEnviar(l, texto, recordar);
  if (!abrir) return { aviso: "Falta su contacto", respuesta: `Para ${l.nombre} no tengo Instagram ni correo. Apúntalo en ${DOMINIO}/panel#captacion y te vuelvo a pasar el mensaje.` };
  await guardarSeguimiento(id, recordar ? { recordado: true } : { estado: "contactado", via: canal(l) });
  await apuntarCharla([{ de: TU, a: "captacion", tipo: "orden", texto: `Vale, le escribo a ${l.nombre}.` }]).catch(() => null);
  return {
    aviso: "Apuntado como enviado",
    cierre: `✅ ${l.nombre}: ${recordar ? "recordatorio" : "mensaje"} listo. Te recuerdo en 7 días si no contesta.`,
    respuesta: `${texto}\n\n👉 ${abrir.nota}`,
    botones: [[{ text: canal(l) === "instagram" ? "Abrir Instagram" : "Abrir Gmail", url: abrir.url }]],
  };
}

// El texto que escribes después de pulsar ✏️: la IA reescribe el mensaje y te lo vuelve a enseñar con los botones
export async function cambiarMensaje(chatId, instruccion) {
  const id = await comando(["GET", `telegram:editando:${chatId}`]);
  if (!id) return null;
  await comando(["DEL", `telegram:editando:${chatId}`]);
  const g = await listarCaptacion();
  const l = [...g.listos, ...g.seguimiento].find((x) => x.clave === id);
  if (!l) return { texto: "Ese local ya no está en la lista." };
  const actual = (await comando(["GET", BORRADOR(id)])) || textoBase(l, l.estado === "contactado");
  const prompt = `Reescribe este mensaje para un negocio de León siguiendo la indicación de Alejandro. Mantén las cifras y el enlace EXACTOS, no inventes datos nuevos, español de España, sin comillas ni explicaciones: devuelve solo el mensaje.\n\nINDICACIÓN: ${String(instruccion).slice(0, 300)}\n\nMENSAJE:\n${actual}`;
  const { texto } = await llamarGemini(prompt, { para: "asesor", tarea: "captacion", google: false, temperatura: 0.4, msMax: 20000 });
  const nuevo = texto.replace(/\*\*?/g, "").trim();
  // Si la IA se ha comido el enlace al panel del local, no vale
  if (l.mensajes.enlace && !nuevo.includes(l.mensajes.enlace)) return { texto: "La IA ha quitado el enlace a su panel y así no vale. Pídemelo de otra forma." };
  await comando(["SET", BORRADOR(id), nuevo, "EX", 14 * 24 * 3600]);
  return tarjeta(l, { recordar: l.estado === "contactado" });
}

// ---------- Hablar con el jefe ----------
const LISTA_EMPLEADOS = [...EMPLEADOS_BUSCADORES, EMPLEADO_DESPENSA].map((id) => `${id} (${nombreDe(id)})`).join(", ");

// Devuelve { respuesta, orden? }. desde = "telegram" | "panel"
export async function hablarConJefe(texto, { desde = "panel" } = {}) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!limpio) return { respuesta: "Dime qué necesitas." };
  await apuntarCharla([{ de: TU, a: JEFE, tipo: "chat", texto: limpio }]).catch(() => null);
  const prompt = `Eres el jefe de una oficina de empleados que buscan eventos y tiendas en León para la web Cazurronics. Alejandro (el dueño) te escribe.
Empleados que reciben órdenes: ${LISTA_EMPLEADOS}.
Decide si es una ORDEN para un empleado (buscar algo concreto, ponerse a trabajar) o una PREGUNTA (cifras, cómo va algo, cualquier otra cosa).
Devuelve SOLO JSON: {"tipo":"orden","empleado":"<id exacto>","accion":"encargo"|"trabajar","texto":"<qué buscar, si es encargo>","ya":<true solo si pide que sea ahora mismo>,"zona":"<solo para ${EMPLEADO_DESPENSA}: una de ${ZONAS.map((z) => z.id).join(", ")}>"} o {"tipo":"pregunta"}.
MENSAJE: ${limpio}`;
  let decision = { tipo: "pregunta" };
  try {
    const { texto: t } = await llamarGemini(prompt, { para: "asesor", tarea: "jefe", google: false, json: true, temperatura: 0, msMax: 15000 });
    decision = extraerJSON(t, "{") || decision;
  } catch { /* si la IA falla, se trata como pregunta */ }

  if (decision.tipo === "orden" && [...EMPLEADOS_BUSCADORES, EMPLEADO_DESPENSA].includes(decision.empleado)) {
    const emp = decision.empleado;
    // Por Telegram no se espera a un turno entero (no cabe en el tiempo del bot): se deja para su próximo turno
    const ya = decision.ya === true && desde === "panel";
    const orden = decision.accion === "trabajar" && desde === "panel"
      ? { accion: "trabajar" }
      : { accion: "encargo", texto: decision.texto || limpio, ya };
    const r = emp === EMPLEADO_DESPENSA
      ? await ordenarDespensa({ ...orden, zona: ZONAS.some((z) => z.id === decision.zona) ? decision.zona : "leon" })
      : await ordenar({ empleado: emp, ...orden });
    const respuesta = !r.exito
      ? `No he podido: ${r.mensaje}`
      : orden.accion === "trabajar"
        ? `Hecho. ${nombreDe(emp)} ha repetido su turno: ${r.parte?.nuevos || 0} ${r.parte?.tipo === "tiendas" ? "tiendas nuevas" : "eventos nuevos"}.`
        : orden.ya
          ? `Hecho. ${nombreDe(emp)} lo ha buscado ya: ${r.parte?.nuevos || 0} nuevos.`
          : `Apuntado. ${nombreDe(emp)} buscará «${orden.texto}» en su próximo turno (0 €).`;
    await apuntarCharla([
      { de: JEFE, a: emp, tipo: "orden", texto: orden.accion === "trabajar" ? "Alejandro quiere que repitas tu turno ya." : `Alejandro te pide: «${String(orden.texto).slice(0, 80)}».` },
      { de: JEFE, a: TU, tipo: "chat", texto: respuesta },
    ]).catch(() => null);
    return { respuesta, orden: { empleado: emp, ...orden, exito: !!r.exito, parte: r.parte || null } };
  }
  const respuesta = await responderPregunta(limpio);
  await apuntarCharla([{ de: JEFE, a: TU, tipo: "chat", texto: respuesta.slice(0, 220) }]).catch(() => null);
  return { respuesta };
}
