// ============ EL JEFE DE LA OFICINA, POR TELEGRAM Y EN EL PANEL ============
// · Parte diario: UN mensaje por la mañana con lo que ha hecho el equipo (lo subido «por confirmar» va en una línea: lo
//   sigue mirando el Verificador solo, no hay que decidir nada) y los locales listos para escribirles, cada uno con su mensaje ya hecho con sus cifras
//   reales y tres botones: ✅ Enviar · ✏️ Cambiar · ✖ No. Sustituye al correo de captación de las 7:30.
// · ✅ nunca manda nada solo (LSSI): te deja el texto y un botón que abre Instagram o Gmail con él puesto; lo envías tú.
// · Chat: lo que le escribes lo entiende una IA barata (flash-lite, sin Google, ~0,0001 $ por mensaje) y lo convierte
//   en una orden a un empleado, en «quita tal evento» o en una pregunta. Las preguntas se contestan con lo que sabe la
//   oficina y, si no hay nada, buscando en ese momento (lib/jefeSabe.js).
import { comando } from "./almacen";
import { llamarGemini, extraerJSON } from "./gemini";
import { datosOficina } from "./oficinaDatos";
import { decidirDudoso, decidirSinConfirmar, eventosProximos, ordenar, pausar, EMPLEADOS_BUSCADORES } from "./eventos";
import { segundaComprobacion, turnoDeRepesca } from "./guardia";
import { EMPLEADO_DESPENSA, ordenarDespensa } from "./despensa";
import { guardarSeguimiento, listarCaptacion, marcarAvisados, DOMINIO } from "./captacion";
import { BORRADOR, canal, enlaceEnviar, textoBase } from "./mensajeCaptacion";
import { leerLugares } from "./lugares";
import { haversineKm } from "./planUtils";
import { apuntarCharla, JEFE, TU } from "./charla";
import { DEPARTAMENTOS } from "./oficina";
import { euros } from "./euros";
import { contextoMetricas, responderPregunta } from "./asesor";
import { puebloEnTexto, quitarPorNombre, rangoDeFechas, redactar, reunirDatos, respuestaSinIA } from "./jefeSabe";
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
  const g = ofi.jefe.cifras.gasto;
  if (g) lineas.push(`IA: ayer ${euros(g.ayer)}, este mes ${euros(g.mes)} (previsión ${euros(g.prevision)}).`);
  else if (ofi.jefe.cifras.gastoMes != null) lineas.push(`IA este mes: ${ofi.jefe.cifras.gastoMes.toFixed(2).replace(".", ",")} $.`);
  const mensajes = [{ texto: `👔 Parte del jefe\n\n${lineas.map((l) => `· ${l}`).join("\n")}\n\nPanel: ${DOMINIO}/panel/oficina` }];

  // Lo subido «por confirmar» ya no espera tu sí: el Verificador lo sigue mirando solo. Solo te lo cuento.
  const n = ofi.flujo?.sinConfirmar ?? ofi.sinConfirmar.length;
  if (n) {
    mensajes[0].texto = mensajes[0].texto.replace(`\n\nPanel:`, `\n· 🕵️ ${n} ${n === 1 ? "evento está" : "eventos están"} en la web «por confirmar» (${ofi.sinConfirmar.slice(0, MAX_BANDEJA).map((e) => `${e.titulo.slice(0, 40)}, ${diaCorto(e.fecha)}`).join("; ")}${n > MAX_BANDEJA ? "…" : ""}). Los sigo mirando yo; si alguno no te cuadra, dime «quita …».\n\nPanel:`);
  }
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

// ---------- Botones ----------
// datos = callback_data del botón. Devuelve { aviso, cierre?, respuesta?, botones? }
export async function pulsarBoton(datos, { chatId } = {}) {
  const [grupo, accion, ...resto] = String(datos || "").split(":");
  const id = resto.join(":");
  if (grupo === "q") {
    const r = await decidirSinConfirmar(id, accion === "q" ? "quitar" : "vale");
    if (!r.exito) return { aviso: r.mensaje || "Ya no está" };
    await apuntarCharla([{ de: TU, a: "verificador", tipo: "orden", texto: accion === "q" ? "Ese no cuadra: quítalo de la web." : "Ese está bien, déjalo." }]).catch(() => null);
    return { aviso: accion === "q" ? "Quitado" : "Hecho", cierre: accion === "q" ? "🗑 Quitado de la web (no vuelve en 30 días)" : "👍 Se queda en la web" };
  }
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
  const r = await reescribirMensaje(id, instruccion);
  return r.exito ? tarjeta(r.local, { recordar: r.recordar }) : { texto: r.mensaje };
}

// Reescribe el mensaje de un local con la indicación de Alejandro (flash-lite, sin Google, ~0,0001 $).
// Lo usan Telegram (✏️ Cambiar) y «Hoy te toca» del panel. Devuelve { exito, texto, local, recordar } o { exito: false, mensaje }
export async function reescribirMensaje(id, instruccion) {
  const g = await listarCaptacion();
  const l = [...g.listos, ...g.seguimiento].find((x) => x.clave === id);
  if (!l) return { exito: false, mensaje: "Ese local ya no está en la lista." };
  const recordar = l.estado === "contactado";
  const actual = (await comando(["GET", BORRADOR(id)])) || textoBase(l, recordar);
  const prompt = `Reescribe este mensaje para un negocio de León siguiendo la indicación de Alejandro. Mantén las cifras y el enlace EXACTOS, no inventes datos nuevos, español de España, sin comillas ni explicaciones: devuelve solo el mensaje.\n\nINDICACIÓN: ${String(instruccion).slice(0, 300)}\n\nMENSAJE:\n${actual}`;
  const { texto } = await llamarGemini(prompt, { para: "asesor", tarea: "captacion", google: false, temperatura: 0.4, msMax: 20000 });
  const nuevo = texto.replace(/\*\*?/g, "").trim();
  // Si la IA se ha comido el enlace al panel del local, no vale
  if (l.mensajes.enlace && !nuevo.includes(l.mensajes.enlace)) return { exito: false, mensaje: "La IA ha quitado el enlace a su panel y así no vale. Pídemelo de otra forma." };
  await comando(["SET", BORRADOR(id), nuevo, "EX", 14 * 24 * 3600]);
  return { exito: true, texto: nuevo, local: l, recordar };
}

// ---------- Hablar con cualquier empleado (0 €: sin IA) ----------
// «busca…/mira…» → encargo para su próximo turno · «ponte/repite/trabaja ya» → repite su turno · lo demás → te cuenta cómo va
const PIDE_BUSCAR = /^(busca|buscad|mira|mirad|investiga|encuentra|apunta|averigua)\b|\b(que busques|puedes buscar|podrías buscar|búscame|mírame)\b/i;
const PIDE_TRABAJAR = /\b(ponte|repite|repítelo|trabaja|curra|ahora mismo|ya mismo|dale caña)\b/i;
const hace = (iso) => { if (!iso) return "todavía no"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `hace ${m} min` : m < 2880 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };

export function estadoEnPalabras(e) {
  const p = e.parte || {};
  const l = [];
  if (e.descanso) l.push(`Estoy de descanso hasta el ${e.descanso}.`);
  if (e.enCurso) l.push("Ahora mismo estoy trabajando.");
  l.push(p.fin ? `Mi último turno fue ${hace(p.fin)}${p.busquedas != null ? `: ${p.busquedas} búsquedas, ${p.eventos || 0} eventos con fuente${p.descartados ? ` y ${p.descartados} sin fuente segura` : ""}` : p.texto ? `: ${p.texto}` : ""}.` : "Aún no he trabajado ningún turno.");
  if (p.motivos?.length) l.push(`Lo que falló: ${p.motivos[0].texto}`);
  else if (p.error) l.push(`Lo que falló: ${p.error}`);
  if (e.rinde?.busquedas) l.push(`En ${e.rinde.dias} días llevo ${e.rinde.nuevos} eventos nuevos.`);
  if (e.encargos?.length) l.push(`Tengo pendiente: ${e.encargos.map((t) => `«${t}»`).join(", ")}.`);
  l.push(`Trabajo: ${String(e.horario || "").toLowerCase()}.`);
  if (e.ordenes) l.push("Si quieres que busque algo, dime «busca …».");
  return l.join(" ");
}

// Devuelve { respuesta, orden? }
export async function hablarConEmpleado(id, texto) {
  const e = EMPLEADOS.find((x) => x.id === id);
  if (!e) return { respuesta: "No encuentro a ese empleado." };
  const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!limpio) return { respuesta: "Dime." };
  await apuntarCharla([{ de: TU, a: id, tipo: "chat", texto: limpio }]).catch(() => null);
  let respuesta, orden = null;
  if ((id === "verificador" || id === "repesca") && PIDE_TRABAJAR.test(limpio)) {
    const r = id === "verificador" ? await segundaComprobacion() : await turnoDeRepesca();
    respuesta = `Hecho. ${r.texto}.`;
    orden = { empleado: id, accion: "trabajar", exito: true };
  } else if (EMPLEADOS_BUSCADORES.includes(id) && PIDE_BUSCAR.test(limpio)) {
    const r = await ordenar({ empleado: id, accion: "encargo", texto: limpio, ya: false });
    respuesta = r.exito ? `Apuntado: lo busco en mi próximo turno (0 €). ${String(e.horario || "")}.` : `No puedo: ${r.mensaje}`;
    orden = { empleado: id, accion: "encargo", exito: !!r.exito };
  } else if (id === EMPLEADO_DESPENSA && PIDE_BUSCAR.test(limpio)) {
    const r = await ordenarDespensa({ accion: "encargo", texto: limpio, ya: false, zona: "leon" });
    respuesta = r.exito ? "Apuntado: lo busco esta noche (0 €)." : `No puedo: ${r.mensaje}`;
    orden = { empleado: id, accion: "encargo", exito: !!r.exito };
  } else if (EMPLEADOS_BUSCADORES.includes(id) && PIDE_TRABAJAR.test(limpio)) {
    const r = await ordenar({ empleado: id, accion: "trabajar" });
    respuesta = r.exito ? `Hecho: ${r.parte?.nuevos || 0} eventos nuevos en ${r.parte?.busquedas || 0} búsquedas.` : `No puedo: ${r.mensaje}`;
    orden = { empleado: id, accion: "trabajar", exito: !!r.exito };
  } else {
    const ofi = await datosOficina();
    const yo = ofi.departamentos.flatMap((d) => d.empleados).find((x) => x.id === id);
    respuesta = yo ? estadoEnPalabras(yo) : "Ahora no puedo mirar mis datos.";
  }
  await apuntarCharla([{ de: id, a: TU, tipo: "chat", texto: respuesta.slice(0, 220) }]).catch(() => null);
  return { respuesta, orden };
}

// Las decisiones de la reunión: { tipo: "descanso" | "volver", empleado, dias } · { tipo: "guardia", que }
export async function decidirReunion(accion = {}) {
  if (accion.tipo === "descanso" || accion.tipo === "volver") {
    const r = await pausar(accion.empleado, accion.tipo === "descanso" ? accion.dias || 7 : 0);
    if (!r.exito) return r;
    await apuntarCharla([
      { de: TU, a: accion.empleado, tipo: "orden", texto: accion.tipo === "descanso" ? "Vale, descansa unos días." : "Vuelve a tu turno." },
      { de: accion.empleado, a: TU, tipo: "chat", texto: accion.tipo === "descanso" ? `Gracias. Vuelvo el ${r.hasta}.` : "Mañana estoy en mi mesa." },
    ]).catch(() => null);
    return { exito: true, mensaje: accion.tipo === "descanso" ? `${nombreDe(accion.empleado)} descansa hasta el ${r.hasta}.` : `${nombreDe(accion.empleado)} vuelve a su turno.` };
  }
  if (accion.tipo === "guardia") {
    const r = accion.que === "verificador" ? await segundaComprobacion() : await turnoDeRepesca();
    return { exito: true, mensaje: r.texto };
  }
  return { exito: false, mensaje: "Esa propuesta no se puede aplicar desde aquí" };
}

// ---------- Hablar con el jefe ----------
const LISTA_EMPLEADOS = [...EMPLEADOS_BUSCADORES, EMPLEADO_DESPENSA].map((id) => `${id} (${nombreDe(id)})`).join(", ");
const TEMAS = ["agenda", "planes", "sitios", "tiendas", "cifras", "oficina", "otro"];
const MS_TOTAL = 56000; // lo que da Vercel (60 s) menos un margen para mandar la respuesta

// Cómo va el equipo, en pocas líneas (0 €): para cuando le preguntas por la oficina
export function oficinaEnPocasLineas(ofi) {
  const empleados = ofi.departamentos.flatMap((d) => d.empleados)
    .map((e) => `- ${e.emoji} ${e.nombre}: ${{ ok: "al día", tarde: "con retraso", error: "ha fallado", nuevo: "sin turnos aún", descanso: "de descanso" }[e.estado] || e.estado}${e.parte?.fin ? `, último turno ${hace(e.parte.fin)}` : ""}${e.parte?.texto ? ` (${String(e.parte.texto).slice(0, 80)})` : ""}${e.estado === "error" && (e.parte?.motivos?.[0]?.texto || e.parte?.error) ? ` · motivo: ${e.parte.motivos?.[0]?.texto || e.parte.error}` : ""}`);
  return [
    ...ofi.jefe.lineas.map((l) => `· ${l}`),
    ofi.sinConfirmar?.length ? `· Subidos «por confirmar»: ${ofi.sinConfirmar.slice(0, 8).map((e) => `${e.titulo} (${e.fecha}, ${e.localidad || "?"})`).join("; ")}` : "",
    ofi.repesca?.length ? `· En la cola de la Repesca: ${ofi.repesca.length} búsquedas` : "",
    "Empleados:", ...empleados,
  ].filter(Boolean).join("\n");
}

// Devuelve { respuesta, orden?, buscado? }. desde = "telegram" | "panel"
// avisar(texto): para decirte «lo busco ahora, dame medio minuto» mientras busca (Telegram)
export async function hablarConJefe(texto, { desde = "panel", avisar = null } = {}) {
  const inicio = Date.now();
  const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!limpio) return { respuesta: "Dime qué necesitas." };
  await apuntarCharla([{ de: TU, a: JEFE, tipo: "chat", texto: limpio }]).catch(() => null);
  const prompt = `Eres el jefe de una oficina de empleados que buscan eventos y tiendas en León para la web Cazurronics. Alejandro (el dueño) te escribe.
Empleados que reciben órdenes: ${LISTA_EMPLEADOS}.
Decide qué es:
- ORDEN: le pide a un empleado concreto que busque algo en su turno o que se ponga a trabajar («que Música mire…», «dile a Pueblos que…»).
- QUITAR: quiere quitar un evento de la web («quita el concierto de…», «ese mercadillo no es cierto, fuera»).
- PREGUNTA: todo lo demás. Ojo: «¿qué planes hay en Boñar?», «búscame qué hay en Boñar», «¿puedes buscar algo sobre Boñar ahora?» son PREGUNTA (quiere la respuesta ya, no un encargo).
Devuelve SOLO JSON, uno de estos:
{"tipo":"orden","empleado":"<id exacto>","accion":"encargo"|"trabajar","texto":"<qué buscar, si es encargo>","ya":<true solo si pide que sea ahora mismo>,"zona":"<solo para ${EMPLEADO_DESPENSA}: una de ${ZONAS.map((z) => z.id).join(", ")}>"}
{"tipo":"quitar","texto":"<nombre del evento tal como lo dice>"}
{"tipo":"pregunta","tema":"agenda|planes|sitios|tiendas|cifras|oficina|otro","sitio":"<pueblo o lugar de León que nombra, o null>","que":"<qué busca en 2-4 palabras (conciertos, fiestas, comer…) o null>"}
tema: agenda = eventos, fiestas, conciertos, qué hay · planes = qué hacer en un sitio (eventos y dónde comer) · sitios = bares, restaurantes · tiendas = dónde comprar un producto · cifras = visitas, planes hechos, Instagram, gasto · oficina = cómo va el equipo, qué has subido, qué ha fallado · otro = lo demás.
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
  if (decision.tipo === "quitar") {
    const r = await quitarPorNombre(decision.texto || limpio);
    await apuntarCharla([{ de: JEFE, a: TU, tipo: "chat", texto: r.respuesta.slice(0, 220) }]).catch(() => null);
    return { respuesta: r.respuesta, orden: { accion: "quitar", exito: r.exito } };
  }

  // Una pregunta: se contesta con lo que tiene la oficina y, si de eso no hay nada, se busca ahora
  const sitioIA = typeof decision.sitio === "string" && decision.sitio.trim() && !/^(null|leon provincia|provincia)$/i.test(decision.sitio.trim()) ? decision.sitio.trim().slice(0, 60) : null;
  const sitio = puebloEnTexto(limpio) || sitioIA;
  // Si nombra un pueblo y no se sabe qué quiere, se le cuenta qué hay allí
  const tema = TEMAS.includes(decision.tema) && !(decision.tema === "otro" && sitio) ? decision.tema : sitio ? "planes" : "otro";
  let respuesta;
  if (tema === "cifras") respuesta = await responderPregunta(limpio);
  else {
    const pregunta = { tema, sitio, que: typeof decision.que === "string" ? decision.que.slice(0, 60) : null, ...rangoDeFechas(limpio) };
    const [ofi, cifras] = await Promise.all([
      ["oficina", "otro"].includes(tema) ? datosOficina().catch(() => null) : null,
      tema === "otro" ? contextoMetricas().catch(() => null) : null,
    ]);
    const queda = MS_TOTAL - (Date.now() - inicio) - 16000; // lo que queda, menos lo que tarda en redactar
    const datos = await reunirDatos(pregunta, {
      buscar: queda >= 15000, msBuscar: Math.min(32000, queda), avisar: desde === "telegram" ? avisar : null,
      extra: { oficina: ofi ? oficinaEnPocasLineas(ofi) : null, cifras },
    });
    respuesta = await redactar(limpio, datos.texto, { msMax: Math.max(5000, Math.min(15000, MS_TOTAL - (Date.now() - inicio))) })
      .catch(() => respuestaSinIA(pregunta, datos.eventos));
    await apuntarCharla([{ de: JEFE, a: TU, tipo: "chat", texto: respuesta.slice(0, 220) }]).catch(() => null);
    return { respuesta, buscado: datos.buscado };
  }
  await apuntarCharla([{ de: JEFE, a: TU, tipo: "chat", texto: respuesta.slice(0, 220) }]).catch(() => null);
  return { respuesta };
}
