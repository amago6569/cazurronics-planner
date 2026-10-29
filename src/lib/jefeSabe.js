// ============ EL JEFE SABE: CONTESTA CON LO QUE TIENE LA OFICINA ============
// Cuando le preguntas algo («¿qué planes hay esta semana en Boñar?»), el jefe no contesta de memoria:
//   1. Entiende dónde y cuándo (pueblo y fechas, sin IA: 0 €).
//   2. Mira lo que ya tiene la oficina (0 €, todo en Redis): la agenda comprobada, lo que espera al Verificador,
//      lo subido «por confirmar», los bares y restaurantes reales de la zona, las tiendas de la Despensa,
//      cómo va el equipo y las cifras de la web.
//   3. Si de ese sitio y esas fechas no hay ningún evento, lo busca en ese momento en Google con un modelo 2.x
//      (dentro de las 1.500 peticiones gratis al día; ~0,003 € de texto), lo comprueba igual que el barrido y lo
//      suma a la agenda. Como mucho BUSCA_AL_DIA búsquedas así al día y la misma pregunta no se repite en 6 h.
//   4. Redacta la respuesta con esos datos (flash-lite, sin Google, ~0,0005 $). Si después de buscar sigue sin
//      haber nada, lo dice claro y deja el encargo a los Pueblos para su próximo turno (0 €).
import { comando, guardarJSON, leerJSON, sinRomper } from "./almacen";
import { hoyEnLeon } from "./estadisticas";
import { llamarGemini } from "./gemini";
import { quedaCupo } from "./guardia";
import {
  DIAS_AGENDA, claveEvento, decidirSinConfirmar, eventosProximos, idDudoso, leerBandeja, leerSinConfirmar,
  ordenar, quitarDeLaAgenda, tirarParaSiempre, trabajarEn,
} from "./eventos";
import { sitiosComprobados } from "./lugares";
import { leerTiendasGoogle, ubicarEnMaps } from "./despensaTiendas";
import { MUNICIPIOS, ZONAS, zonaDe, zonaMasCercana, zonaPorId } from "./zonas";
import { haversineKm } from "./planUtils";

export const BUSCA_AL_DIA = 8;
const RADIO_PUEBLO = 5, RADIO_CERCA = 15;
const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay(); // 0 domingo … 6 sábado
const diaCorto = (f) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// ---------- 1. Cuándo ----------
const SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

// «esta semana», «el finde», «mañana», «el sábado»… → { desde, hasta, nombre }. Por defecto, los próximos 7 días.
export function rangoDeFechas(texto, hoy = hoyEnLeon()) {
  const t = ` ${normalizar(texto)} `;
  const dow = diaSemana(hoy);
  const tope = sumarDias(hoy, DIAS_AGENDA - 1);
  const r = (desde, hasta, nombre) => ({ desde, hasta: hasta > tope ? tope : hasta, nombre });
  const domingo = sumarDias(hoy, dow === 0 ? 0 : 7 - dow);
  const siguiente = / (que viene|proxim[oa]|siguiente) /.test(t);
  if (/ pasado manana /.test(t)) return r(sumarDias(hoy, 2), sumarDias(hoy, 2), "pasado mañana");
  if (/ (fin de semana|finde) /.test(t)) {
    const viernes = dow === 0 ? hoy : sumarDias(hoy, Math.max(0, 5 - dow));
    const desde = siguiente ? sumarDias(domingo, 5) : dow === 6 || dow === 0 ? hoy : viernes;
    return r(desde, siguiente ? sumarDias(domingo, 7) : domingo, siguiente ? "el fin de semana que viene" : "este fin de semana");
  }
  if (/ (semana que viene|proxima semana|siguiente semana) /.test(t)) return r(sumarDias(domingo, 1), sumarDias(domingo, 7), "la semana que viene");
  if (/ esta semana /.test(t)) return r(hoy, domingo, "esta semana");
  if (/ (este mes|proximas semanas|todo el mes) /.test(t)) return r(hoy, tope, "las próximas 3 semanas");
  const dia = SEMANA.findIndex((d) => t.includes(` ${d} `));
  if (dia >= 0) {
    const f = sumarDias(hoy, (dia - dow + 7) % 7 + (siguiente && dia === dow ? 7 : 0));
    return r(f, f, `el ${SEMANA[dia].replace("miercoles", "miércoles").replace("sabado", "sábado")} ${diaCorto(f).split(" ").slice(1).join(" ")}`);
  }
  if (/ manana /.test(t) && !/ por la manana /.test(t)) return r(sumarDias(hoy, 1), sumarDias(hoy, 1), "mañana");
  if (/ (hoy|esta noche|esta tarde|ahora) /.test(t)) return r(hoy, hoy, "hoy");
  return r(hoy, sumarDias(hoy, 6), "los próximos 7 días");
}

// ---------- 2. Dónde ----------
// Nombres de pueblo que también son palabras corrientes: solo cuentan detrás de «en», «de», «por»… («fiestas en Cea»)
const CORRIENTES = new Set(["matanza", "cuadros", "la antigua", "cea", "sobrado", "turcia", "carrizo", "balboa", "reyero", "prioro", "candin", "cabrera", "la cabrera", "ardon", "sena"]);
const bonitoDe = (p) => p.replace(/(^|\s)(\p{L})/gu, (_, s, l) => s + l.toUpperCase()).replace(/ (De|Del|La|Las|Los|Y) /g, (m) => m.toLowerCase());
const CATALOGO = (() => {
  const vistos = new Map();
  for (const lista of Object.values(MUNICIPIOS)) for (const m of lista) vistos.set(normalizar(m), m);
  for (const z of ZONAS) for (const p of z.pueblos) if (!vistos.has(normalizar(p))) vistos.set(normalizar(p), bonitoDe(p));
  vistos.set("leon", "León");
  for (const p of ["leon capital", "leon ciudad", "ciudad de leon"]) vistos.delete(p);
  return [...vistos.entries()].sort((a, b) => b[0].length - a[0].length);
})();

// El pueblo que nombra el texto (o null). «Provincia de León» no cuenta como la capital.
export function puebloEnTexto(texto) {
  const t = ` ${normalizar(texto)} `;
  let capital = false;
  for (const [n, nombre] of CATALOGO) {
    if (!t.includes(` ${n} `)) continue;
    if (n === "leon") { capital = !/ provincia de leon /.test(t); continue; }
    if (CORRIENTES.has(n) && !new RegExp(` (en|de|por|sobre|cerca de|a) ${n} `).test(t)) continue;
    return nombre;
  }
  return capital ? "León" : null;
}

const esCapital = (sitio) => normalizar(sitio) === "leon";

// Dónde está ese pueblo: por los eventos que ya tenemos de allí, por lo guardado o (una vez por pueblo) por Google Maps
async function coordenadasDe(sitio, eventos) {
  if (esCapital(sitio)) { const z = zonaPorId("leon"); return { lat: z.lat, lon: z.lon }; }
  const n = normalizar(sitio);
  const conPunto = eventos.find((e) => e.lat != null && normalizar(e.localidad) === n);
  if (conPunto) return { lat: Number(conPunto.lat), lon: Number(conPunto.lon) };
  const clave = `jefe:sitio:${n.replace(/ /g, "-")}`;
  const guardado = await leerJSON(clave).catch(() => null);
  if (guardado) return guardado.lat != null ? guardado : null;
  const p = await ubicarEnMaps(sitio).catch(() => null);
  await sinRomper(guardarJSON(clave, p ? { lat: p.lat, lon: p.lon } : { nada: true }, p ? 180 * 86400 : 7 * 86400), "sitio del jefe");
  return p ? { lat: p.lat, lon: p.lon } : null;
}

// ¿Es de ese pueblo? Por el nombre (municipio, sitio o título) o, si tiene coordenadas, por la distancia
export function esDelSitio(e, sitio, punto = null) {
  if (!sitio) return true;
  if (esCapital(sitio)) return zonaDe(e) === "leon";
  const n = normalizar(sitio);
  if (` ${normalizar(`${e.localidad} ${e.lugar} ${e.titulo}`)} `.includes(` ${n} `)) return true;
  return !!(punto && e.lat != null && e.lon != null && haversineKm(punto.lat, punto.lon, Number(e.lat), Number(e.lon)) <= RADIO_PUEBLO);
}
const estaCerca = (e, punto) => !!(punto && e.lat != null && e.lon != null && haversineKm(punto.lat, punto.lon, Number(e.lat), Number(e.lon)) <= RADIO_CERCA);

// La agenda de esas fechas, un evento una sola vez (los de varios días salen en cada día)
export function agendaEntre(dias, desde, hasta) {
  const vistos = new Set(), lista = [];
  for (const d of dias) {
    if (d.fecha < desde || d.fecha > hasta) continue;
    for (const e of d.eventos) {
      const k = `${normalizar(e.titulo)}|${normalizar(e.localidad)}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      lista.push({ ...e, dia: d.fecha });
    }
  }
  return lista;
}

// Una línea corta por evento para la IA (pocos tokens)
export const lineaEvento = (e) => `- ${diaCorto(e.dia || e.fecha)}${e.fechaFin && e.fechaFin > e.fecha ? ` (hasta ${diaCorto(e.fechaFin)})` : ""}${e.hora ? ` ${e.hora}` : ""} · ${e.titulo}${e.lugar ? ` · ${e.lugar}` : ""}${e.localidad ? `, ${e.localidad}` : ""}${e.precio ? ` · ${e.precio}` : ""}${e.porConfirmar ? " · POR CONFIRMAR" : ""}${e.fuente ? ` · ${e.fuente}` : ""}`;

// ---------- 3. Buscar ahora, si no hay nada ----------
// Una búsqueda en Google para ese sitio y esas fechas, con las mismas comprobaciones que el barrido.
// Devuelve { hecho, motivo?, nuevos?, dudosos? }
async function buscarAhora({ sitio, desde, hasta, que, msMax }) {
  const hoy = hoyEnLeon();
  const memo = `jefe:buscado:${normalizar(`${sitio || "provincia"} ${desde} ${hasta} ${que || ""}`).replace(/ /g, "-").slice(0, 120)}`;
  if (await comando(["GET", memo]).catch(() => null)) return { hecho: false, motivo: "ya" };
  if (!(await quedaCupo())) return { hecho: false, motivo: "cupo" };
  const n = await comando(["INCRBY", `jefe:busquedas:${hoy}`, 1]);
  await comando(["EXPIRE", `jefe:busquedas:${hoy}`, 2 * 86400]);
  if (n > BUSCA_AL_DIA) return { hecho: false, motivo: "tope" };
  const zona = sitio ? zonaPorId(zonaDe({ localidad: sitio })) || null : null;
  const empleado = !sitio || esCapital(sitio) ? "capital" : "pueblos";
  const donde = sitio ? `${sitio}${esCapital(sitio) ? " capital" : " y los pueblos de alrededor"} (provincia de León, España)` : "León capital y la provincia de León (España)";
  const inicio = Date.now();
  const parte = await trabajarEn({
    busquedas: [{
      nombre: `Pregunta al jefe · ${sitio || "provincia"}`, empleado,
      tema: `${que ? `${que} y también ` : ""}fiestas, conciertos, mercados y mercadillos, ferias, teatro, rutas, exposiciones, actividades culturales y deportivas y cualquier plan de ocio`,
      pistas: `${zona?.pistas || "prensa local (Diario de León, Leonoticias, iLeón)"}; web y redes del ayuntamiento${sitio ? ` de ${sitio}` : ""}; asociaciones y organizadores`,
      donde, desde, hasta, municipio: sitio || undefined, zona: zona?.id, msMax: Math.max(8000, msMax - 8000),
      extra: "Es una pregunta directa de Alejandro: busca a fondo en ese sitio y esas fechas, también lo pequeño (misas de fiesta, verbenas, rutas guiadas, mercadillos).",
    }],
  }, { desde, hasta, inicio: inicio - Math.max(0, 54000 - msMax) });
  await sinRomper(comando(["SET", memo, "1", "EX", 6 * 3600]), "memo del jefe");
  return { hecho: true, nuevos: parte.nuevos || 0, dudosos: parte.dudosos || 0, error: parte.busquedas && parte.errores >= parte.busquedas };
}

// ---------- 4. Lo que sabe la oficina de eso ----------
// pregunta = { tema, sitio, que, desde, hasta, nombre }. Devuelve { texto, buscado, eventos }
export async function reunirDatos(pregunta, { buscar = true, msBuscar = 30000, avisar = null, extra = {} } = {}) {
  const { tema = "agenda", sitio = null, desde, hasta } = pregunta;
  const quiereAgenda = ["agenda", "planes", "otro"].includes(tema);
  const quiereSitios = ["planes", "sitios", "otro"].includes(tema) && sitio;
  const quiereTiendas = tema === "tiendas" && sitio;
  let dias = await eventosProximos(DIAS_AGENDA).catch(() => []);
  let todos = agendaEntre(dias, desde, hasta);
  const punto = sitio ? await coordenadasDe(sitio, todos).catch(() => null) : null;
  let delSitio = todos.filter((e) => esDelSitio(e, sitio, punto));
  let buscado = null;

  // Solo se busca si la pregunta es de planes o eventos (una pregunta suelta no gasta búsquedas)
  if (["agenda", "planes"].includes(tema) && buscar && !delSitio.length) {
    await avisar?.(`🔎 De ${sitio || "eso"} no tengo nada para ${pregunta.nombre}. Lo busco ahora en Google, dame medio minuto.`);
    buscado = await buscarAhora({ ...pregunta, msMax: msBuscar }).catch((e) => ({ hecho: false, motivo: "fallo", detalle: String(e?.message || e) }));
    if (buscado.hecho) {
      dias = await eventosProximos(DIAS_AGENDA).catch(() => dias);
      todos = agendaEntre(dias, desde, hasta);
      delSitio = todos.filter((e) => esDelSitio(e, sitio, punto));
    }
    // Si ni así: que lo mire el empleado de Pueblos en su turno de esta noche (0 €)
    if (!delSitio.length && sitio && !esCapital(sitio)) {
      const r = await ordenar({ empleado: "pueblos", accion: "encargo", texto: `Planes en ${sitio} entre el ${desde} y el ${hasta}` }).catch(() => ({ exito: false }));
      buscado = { ...(buscado || {}), encargo: !!r.exito };
    }
  }

  const bloques = [];
  if (quiereAgenda) {
    const [bandeja, subidos] = await Promise.all([leerBandeja().catch(() => []), leerSinConfirmar().catch(() => [])]);
    const enFechas = (e) => (e.fechaFin || e.fecha) >= desde && e.fecha <= hasta;
    const esperando = bandeja.filter((e) => enFechas(e) && esDelSitio(e, sitio, punto)).slice(0, 10);
    const cerca = sitio && !esCapital(sitio) && delSitio.length < 4 ? todos.filter((e) => !delSitio.includes(e) && estaCerca(e, punto)).slice(0, 10) : [];
    const max = sitio ? 40 : 60;
    bloques.push(`AGENDA COMPROBADA ${sitio ? `DE ${sitio.toUpperCase()}` : "DE LA PROVINCIA"} (${pregunta.nombre}, del ${desde} al ${hasta}): ${delSitio.length} eventos${delSitio.length > max ? `, van los ${max} primeros` : ""}`);
    bloques.push(delSitio.length ? delSitio.slice(0, max).map(lineaEvento).join("\n") : "- ninguno");
    if (cerca.length) bloques.push(`CERCA (a menos de ${RADIO_CERCA} km):\n${cerca.map(lineaEvento).join("\n")}`);
    if (esperando.length) bloques.push(`VISTOS PERO SIN FUENTE SEGURA TODAVÍA (el Verificador los mira hoy; si los nombras, dilo así):\n${esperando.map(lineaEvento).join("\n")}`);
    if (tema === "otro" && subidos.length) bloques.push(`SUBIDOS «POR CONFIRMAR» EN LA WEB (${subidos.length}): ${subidos.slice(0, 8).map((e) => `${e.titulo} (${e.fecha})`).join("; ")}`);
  }
  if (quiereSitios && punto) {
    const locales = await sitiosComprobados(punto.lat, punto.lon, esCapital(sitio) ? 2 : 4, 12).catch(() => []);
    bloques.push(locales.length
      ? `BARES Y RESTAURANTES REALES DE ${sitio.toUpperCase()} (ficha de Google comprobada, ya han salido en planes):\n${locales.map((s) => `- ${s.n} [${s.t}]${s.r ? ` · ${s.r} reseñas` : ""}${s.p ? ` · ${s.p}` : ""}`).join("\n")}`
      : `BARES Y RESTAURANTES DE ${sitio.toUpperCase()}: ninguno ha salido todavía en un plan.`);
  }
  if (quiereTiendas) {
    const zona = zonaDe({ localidad: sitio }) !== "otros" ? zonaDe({ localidad: sitio }) : punto ? zonaMasCercana(punto.lat, punto.lon) : null;
    const tiendas = zona ? (await leerTiendasGoogle([zona]).catch(() => [])).filter((t) => normalizar(t.localidad) === normalizar(sitio) || (punto && haversineKm(punto.lat, punto.lon, t.lat, t.lon) <= RADIO_PUEBLO)) : [];
    bloques.push(tiendas.length
      ? `TIENDAS DE LA DESPENSA EN ${sitio.toUpperCase()}:\n${tiendas.sort((a, b) => (b.nota || 0) - (a.nota || 0)).slice(0, 12).map((t) => `- ${t.nombre} (${(t.cats || []).join(", ")})${t.nota ? ` · ${t.nota}★ (${t.resenas})` : ""} · ${t.direccion}`).join("\n")}`
      : `TIENDAS DE LA DESPENSA EN ${sitio.toUpperCase()}: ninguna guardada todavía.`);
  }
  if (extra.oficina) bloques.push(`CÓMO VA LA OFICINA:\n${extra.oficina}`);
  if (extra.cifras) bloques.push(`CIFRAS DE LA WEB E INSTAGRAM:\n${extra.cifras}`);
  if (!bloques.length) bloques.push("No hay datos para esto: pídele a Alejandro el pueblo o el sitio concreto.");
  if (buscado) {
    bloques.push(`BÚSQUEDA DE AHORA: ${buscado.hecho
      ? `se ha buscado en Google ahora mismo${buscado.error ? " pero Google ha fallado" : `: ${buscado.nuevos} eventos nuevos con fuente comprobada${buscado.dudosos ? ` y ${buscado.dudosos} sin fuente segura (al Verificador)` : ""}`}.`
      : { ya: "ya se buscó en Google hace menos de 6 horas.", cupo: "hoy no queda cupo gratis de Google, no se ha buscado.", tope: `hoy ya van ${BUSCA_AL_DIA} búsquedas desde el chat, no se ha buscado.`, fallo: "Google ha fallado al buscar." }[buscado.motivo] || "no se ha buscado."}${buscado.encargo ? " Encargo apuntado al empleado de Pueblos para su próximo turno." : ""}`);
  }
  return { texto: bloques.join("\n\n"), buscado, eventos: delSitio };
}

// ---------- 5. La respuesta ----------
const INSTRUCCIONES = `Eres el jefe de la oficina de Cazurronics (web gratuita de planes de ocio en León con IA). Alejandro, el dueño, te pregunta.
Contesta con los DATOS de abajo, que son lo que tiene ahora la oficina. Nunca digas «no tengo esa información» si abajo hay algo que sirva: dalo.
Si te pregunta por planes o eventos, lista los que haya (día, hora, sitio, precio si lo hay) y pon el enlace de la fuente al final de cada uno.
Lo marcado POR CONFIRMAR o SIN FUENTE SEGURA, dilo así. Si hay bares o tiendas, recomienda 2-3 con su nota.
Si no hay nada ni después de buscar, dilo claro en una frase, di qué se ha buscado y qué pasa ahora (encargo, próximo turno).
No inventes nada que no esté abajo. Español de España, frases cortas, texto plano para Telegram (sin Markdown ni asteriscos), algún emoji, pocos. Máximo 18 líneas.`;

export async function redactar(preguntaTexto, datos, { msMax = 15000 } = {}) {
  const prompt = `${INSTRUCCIONES}\n\nDATOS DE LA OFICINA:\n${datos}\n\nPREGUNTA DE ALEJANDRO:\n${String(preguntaTexto).slice(0, 500)}\n\nRespuesta:`;
  const { texto } = await llamarGemini(prompt, { para: "asesor", tarea: "jefe", google: false, temperatura: 0.3, msMax });
  return texto.replace(/\*\*?/g, "").trim();
}

// Si la IA no contesta, al menos la lista tal cual (sin IA)
export function respuestaSinIA(pregunta, eventos) {
  if (!eventos.length) return `De ${pregunta.sitio || "eso"} no tengo nada para ${pregunta.nombre}. Lo vuelve a mirar el equipo en su próximo turno.`;
  return `📅 ${pregunta.sitio ? `${pregunta.sitio}, ` : ""}${pregunta.nombre}:\n${eventos.slice(0, 15).map(lineaEvento).map((l) => l.slice(2)).join("\n")}`;
}

// ---------- Quitar un evento de la web, si se lo pides ----------
const palabras = (t) => new Set(normalizar(t).split(" ").filter((p) => p.length > 2));
export function parecido(a, b) {
  const pa = palabras(a), pb = palabras(b);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  return comunes / Math.min(pa.size, pb.size);
}

// Busca el evento por su nombre (primero entre lo subido «por confirmar», luego en toda la agenda) y lo quita.
// Si hay dudas entre varios, no quita ninguno y te los enseña.
export async function quitarPorNombre(texto) {
  const [subidos, dias] = await Promise.all([leerSinConfirmar().catch(() => []), eventosProximos(DIAS_AGENDA).catch(() => [])]);
  const candidatos = [...subidos.map((e) => ({ e, subido: true })), ...agendaEntre(dias, hoyEnLeon(), "9999-12-31").map((e) => ({ e, subido: false }))]
    .map((c) => ({ ...c, nota: parecido(texto, c.e.titulo) }))
    .filter((c) => c.nota >= 0.6)
    .sort((a, b) => b.nota - a.nota || b.subido - a.subido);
  const unicos = [];
  for (const c of candidatos) if (!unicos.some((u) => claveEvento(u.e) === claveEvento(c.e))) unicos.push(c);
  if (!unicos.length) return { exito: false, respuesta: `No encuentro ningún evento que se llame así 🤔 Dime el nombre tal como sale en la web.` };
  if (unicos.length > 1 && unicos[1].nota === unicos[0].nota) {
    return { exito: false, respuesta: `Hay varios que se parecen, ¿cuál quito?\n${unicos.slice(0, 4).map((c) => `· ${c.e.titulo} (${diaCorto(c.e.fecha)}${c.e.localidad ? `, ${c.e.localidad}` : ""})`).join("\n")}` };
  }
  const { e, subido } = unicos[0];
  if (subido && e.id) await decidirSinConfirmar(e.id, "quitar");
  else { await quitarDeLaAgenda(e); await tirarParaSiempre([idDudoso(e)]); }
  return { exito: true, respuesta: `🗑 Quitado de la web: «${e.titulo}» (${diaCorto(e.fecha)}). No vuelve a entrar en 30 días.`, evento: e };
}
