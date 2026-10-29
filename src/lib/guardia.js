// ============ LA GUARDIA DE LA OFICINA: VERIFICADOR Y REPESCA ============
// Dos empleados que arreglan lo que el barrido deja a medias. Usan los mismos modelos 2.x que el barrido
// (búsquedas dentro de las 1.500 gratis al día de Google) y paran si el día va cerca del tope: 0 €.
//
// 🕵️ Verificador (3 veces al día, después de cada barrido): los eventos cuya fuente no se pudo comprobar
//   1. vuelve a abrir el enlace con más calma (8 s, la página entera);
//   2. si sigue sin saberse, pregunta a Google por ellos, de 8 en 8 (como mucho 2 preguntas por turno);
//   3. confirmado → a la web normal · desmentido (cancelado, otra fecha, la página no existe) → fuera ·
//      sin confirmar → a la web igual, marcado «por confirmar». Lo sigue mirando él solo en los turnos siguientes (con las
//      preguntas a Google que le sobren) y lo confirma o lo quita; tú no tienes que decidir nada evento a evento.
//   Lo que no le da tiempo a mirar se queda para su siguiente turno; a la segunda vuelta se sube «por confirmar».
// 🚑 Repesca (2 veces al día): repite las búsquedas que fallaron (Google lento o saturado), 6 por turno.
//   Cada una lleva su motivo en cristiano. Tras 3 intentos se deja: su próximo turno normal la hace igual.
import { comando, guardarJSON, sinRomper } from "./almacen";
import { hoyEnLeon } from "./estadisticas";
import { extraerJSON, llamarGemini, motivoClaro } from "./gemini";
import { apuntarCharla, JEFE, TU } from "./charla";
import { esOficial, esSocial, leerPagina, paginaLoNombra, websDistintas } from "./fiables";
import {
  DIAS_AGENDA, apuntarRepaso, apuntarSinConfirmar, comprobarUrl, decidirSinConfirmar, dominioConsultado, leerBandeja, leerRepesca,
  leerSinConfirmar, marcarRevisados, sacarDeBandeja, sumarALaAgenda, tirarParaSiempre, trabajarEn,
} from "./eventos";

const CUPO_SEGURO = 1300; // de las 1.500 peticiones gratis al día, dejamos margen para los planes y el barrido
export const POR_PREGUNTA = 8, PREGUNTAS_POR_TURNO = 2, REPESCA_POR_TURNO = 6, VUELTAS_ANTES_DE_SUBIR = 2;
const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const trozos = (l, n) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
const titulos = (l, max = 2) => l.slice(0, max).map((e) => `«${String(e.titulo).slice(0, 45)}»`).join(", ") + (l.length > max ? ` y ${l.length - max} más` : "");

export async function quedaCupo() {
  const n = Number(await comando(["GET", `ia:gratis:${hoyEnLeon()}`]).catch(() => 0)) || 0;
  return n < CUPO_SEGURO;
}

// ---------- Verificador ----------
export function promptVerificar(grupo) {
  const lineas = grupo.map((e, i) => `${i + 1}. ${e.titulo} · ${e.fecha}${e.hora ? ` ${e.hora}` : ""} · ${[e.lugar, e.localidad].filter(Boolean).join(", ")}${e.fuente ? ` · visto en ${e.fuente}` : ""}`);
  return `Eres el verificador de Cazurronics Planner (agenda de ocio de León, España). Comprueba en Internet si cada evento
existe de verdad con esa fecha y ese sitio. Busca en la web del organizador, del ayuntamiento, prensa local o venta de entradas.
Para cada uno: "si" si lo ves confirmado en una web (pon la URL exacta donde lo has visto), "no" si encuentras que está
cancelado, que es otra fecha o que no existe, y "nose" si no encuentras nada claro. No inventes URLs.
Devuelve SOLO un array JSON: [{"n":1,"veredicto":"si|no|nose","fuente":"https://...","nota":"máximo 10 palabras"}]
${lineas.join("\n")}`;
}

// Lee la respuesta de Google y decide cada evento. "si" solo vale si la URL la ha consultado Google de verdad (o existe)
export async function leerVeredictos(texto, dominios, grupo, comprobar = (u) => comprobarUrl(u, 6000, { sinRango: true })) {
  const lista = extraerJSON(texto, "[") || [];
  return Promise.all(grupo.map(async (e, i) => {
    const v = lista.find((x) => Number(x?.n) === i + 1) || lista[i] || {};
    const veredicto = String(v.veredicto || "nose").toLowerCase();
    if (veredicto === "si" && /^https?:\/\//.test(v.fuente || "")) {
      if (dominioConsultado(v.fuente, dominios) || (await comprobar(v.fuente)) === "ok") return { decision: "confirmado", fuente: v.fuente };
      return { decision: "porConfirmar" };
    }
    if (veredicto === "no") return { decision: "falso", nota: String(v.nota || "").slice(0, 80) };
    return { decision: "porConfirmar" };
  }));
}

// leer: cómo se descarga cada página (las pruebas lo cambian)
export async function segundaComprobacion({ inicio = Date.now(), leer = (url) => leerPagina(url, 8000) } = {}) {
  const limite = inicio + 50000;
  const [bandeja, subidos, cupo] = await Promise.all([leerBandeja(), leerSinConfirmar().catch(() => []), quedaCupo()]);
  const confirmados = [], porConfirmar = [], falsos = [], quedan = [];
  let preguntas = 0, fallo = null;
  // Si sobran preguntas a Google este turno, se usan para volver a mirar lo subido «por confirmar» (como mucho una
  // vez al día cada uno): confirmado → se le quita la marca · desmentido → fuera de la web · nada claro → sigue igual.
  // Así no tienes que decidir tú evento a evento.
  const aPreguntar = [], repaso = [];
  const libres = Math.max(0, PREGUNTAS_POR_TURNO - Math.ceil(Math.min(bandeja.length, 40) / POR_PREGUNTA));
  const aRepasar = cupo && libres ? trozos(subidos.filter((e) => !e.repaso || Date.now() - Date.parse(e.repaso) > 20 * 3600000)
    .sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, libres * POR_PREGUNTA), POR_PREGUNTA) : [];
  if (bandeja.length) {
    // 1. Sin Google (0 €): dos webs distintas con el mismo evento, o el enlace otra vez, con calma, leyendo la página.
    //    Confirma si es una web oficial o si la página dice la fecha, el pueblo y el año. Si la página carga pero no
    //    nombra el evento, no se tira: pasa a Google. Facebook o Instagram piden sesión: esos van directos a Google.
    const lote = bandeja.slice(0, 40);
    const paginas = await Promise.all(lote.map((e) => (websDistintas(e) >= 2 || !e.fuente || esSocial(e.fuente) ? { estado: "duda", texto: "" } : leer(e.fuente))));
    const dudan = [];
    lote.forEach((e, i) => {
      const p = paginas[i];
      if (websDistintas(e) >= 2) confirmados.push({ ...e, porque: "dos webs" });
      else if (p.estado === "mal") falsos.push({ ...e, nota: "la página ya no existe" });
      else if (esOficial(e.fuente) || (p.estado === "ok" && paginaLoNombra(p.texto, e))) confirmados.push({ ...e, porque: esOficial(e.fuente) ? "web oficial" : "la página lo dice" });
      else dudan.push(e);
    });
    quedan.push(...bandeja.slice(40));

    // 2. Google, de 8 en 8
    const grupos = trozos(dudan, POR_PREGUNTA);
    aPreguntar.push(...(cupo ? grupos.slice(0, PREGUNTAS_POR_TURNO) : []));
    const sinPreguntar = grupos.slice(aPreguntar.length).flat();
    const res = await Promise.allSettled([...aPreguntar, ...aRepasar].map(async (g) => {
      const { texto, dominios } = await llamarGemini(promptVerificar(g), { para: "barrido", tarea: "verificador", temperatura: 0, msMax: Math.max(5000, Math.min(38000, limite - Date.now() - 6000)), msPorModelo: 24000, maxSalida: 2048 });
      return leerVeredictos(texto, dominios, g);
    }));
    repaso.push(...res.slice(aPreguntar.length));
    res.slice(0, aPreguntar.length).forEach((r, gi) => {
      const g = aPreguntar[gi];
      if (r.status !== "fulfilled") { fallo = motivoClaro(r.reason); sinPreguntar.push(...g); return; }
      preguntas++;
      g.forEach((e, i) => {
        const v = r.value[i];
        if (v.decision === "confirmado") confirmados.push({ ...e, fuente: v.fuente });
        else if (v.decision === "falso") falsos.push({ ...e, nota: v.nota || "Google dice que no es así" });
        else porConfirmar.push(e);
      });
    });
    // Lo que no ha podido mirar: a la segunda vuelta se sube «por confirmar» igual (así nada se queda colgado)
    for (const e of sinPreguntar) ((e.vueltas || 0) + 1 >= VUELTAS_ANTES_DE_SUBIR ? porConfirmar : quedan).push(e);
  }

  // Lo subido «por confirmar» que se ha vuelto a mirar
  if (!bandeja.length && aRepasar.length) {
    const res = await Promise.allSettled(aRepasar.map(async (g) => {
      const { texto, dominios } = await llamarGemini(promptVerificar(g), { para: "barrido", tarea: "verificador", temperatura: 0, msMax: Math.max(5000, Math.min(38000, limite - Date.now() - 6000)), msPorModelo: 24000, maxSalida: 2048 });
      return leerVeredictos(texto, dominios, g);
    }));
    repaso.push(...res);
  }
  const repasados = { confirmados: 0, quitados: 0 };
  const sinCambio = [];
  for (const [gi, r] of repaso.entries()) {
    if (r.status !== "fulfilled") continue;
    preguntas++;
    for (const [i, e] of aRepasar[gi].entries()) {
      const v = r.value[i];
      if (v.decision === "confirmado" && (await decidirSinConfirmar(e.id, "vale")).exito) repasados.confirmados++;
      else if (v.decision === "falso" && (await decidirSinConfirmar(e.id, "quitar")).exito) repasados.quitados++;
      else sinCambio.push(e);
    }
  }
  await sinRomper(apuntarRepaso(sinCambio), "repaso");

  const limpio = ({ id: _, encontrado: __, revisadoEn: ___, vueltas: ____, nota: _____, porque: ______, fuentesVistas: _______, ...e }) => e;
  const desde = hoyEnLeon(), hasta = sumarDias(desde, DIAS_AGENDA - 1);
  const subir = [...confirmados.map((e) => ({ ...limpio(e), verificado: true, segundaComprobacion: true })), ...porConfirmar.map((e) => ({ ...limpio(e), verificado: true, porConfirmar: true }))];
  if (subir.length) await sumarALaAgenda(subir, desde, hasta, (e) => e.empleado || "verificador");
  if (porConfirmar.length) await apuntarSinConfirmar(porConfirmar.map(limpio));
  await sacarDeBandeja([...confirmados, ...porConfirmar, ...falsos].map((e) => e.id));
  await tirarParaSiempre(falsos.map((e) => e.id));
  await marcarRevisados(quedan.filter((e) => bandeja.slice(0, 40).includes(e)).map((e) => ({ ...e, vueltas: (e.vueltas || 0) + 1 })));

  const revisados = confirmados.length + porConfirmar.length + falsos.length;
  const parte = {
    fin: new Date().toISOString(), revisados, confirmados: confirmados.length, porConfirmar: porConfirmar.length, falsos: falsos.length,
    pendientes: quedan.length, preguntas, sinGoogle: confirmados.filter((e) => e.porque).length, error: fallo && !revisados ? fallo.texto : null,
    texto: !bandeja.length ? "Bandeja vacía: nada que revisar" : `${revisados} revisados: ${confirmados.length} confirmados, ${porConfirmar.length} subidos por confirmar, ${falsos.length} falsos`,
    descartes: falsos.slice(0, 5).map((e) => ({ titulo: e.titulo, nota: e.nota })),
    repasados,
  };
  if (repasados.confirmados || repasados.quitados) parte.texto += ` · de lo subido «por confirmar»: ${repasados.confirmados} confirmados y ${repasados.quitados} quitados`;
  await guardarJSON("oficina:turno:verificador", parte, 14 * 24 * 3600);
  const charla = [];
  if (revisados) charla.push({ de: "verificador", a: JEFE, tipo: "nuevos", texto: `He repasado ${revisados} dudosos: ${confirmados.length} confirmados, ${porConfirmar.length} sin confirmar y ${falsos.length} falsos.` });
  if (porConfirmar.length) charla.push({ de: JEFE, a: TU, tipo: "aviso", texto: `He subido ${porConfirmar.length} «por confirmar»: ${titulos(porConfirmar)}. Los sigo mirando yo; si alguno no te cuadra, dime «quita …».` });
  if (repasados.confirmados || repasados.quitados) charla.push({ de: "verificador", a: JEFE, tipo: "nuevos", texto: `He vuelto a mirar lo subido «por confirmar»: ${repasados.confirmados} confirmados y ${repasados.quitados} quitados por falsos.` });
  if (falsos.length) charla.push({ de: "verificador", a: JEFE, tipo: "fallo", texto: `Fuera ${titulos(falsos, 1)}: ${falsos[0].nota}.` });
  if (fallo && !revisados) charla.push({ de: "verificador", a: JEFE, tipo: "fallo", texto: `No he podido preguntar a Google: ${fallo.texto}` });
  await sinRomper(apuntarCharla(charla), "charla");
  return parte;
}

// ---------- Repesca ----------
// Primero lo que cubre este fin de semana (es lo que más se busca en los planes); dentro de eso, como venía (menos intentos antes)
export function ordenarRepesca(cola, hoy = hoyEnLeon()) {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 domingo … 6 sábado
  const domingo = sumarDias(hoy, dia === 0 ? 0 : 7 - dia);
  const cubreFinde = (r) => !r.b?.desde || r.b.desde <= domingo;
  return [...cola.filter(cubreFinde), ...cola.filter((r) => !cubreFinde(r))];
}

export async function turnoDeRepesca({ inicio = Date.now(), max = REPESCA_POR_TURNO } = {}) {
  const cola = await leerRepesca();
  const guardar = async (p) => { await guardarJSON("oficina:turno:repesca", p, 14 * 24 * 3600); return p; };
  if (!cola.length) return guardar({ fin: new Date().toISOString(), busquedas: 0, nuevos: 0, errores: 0, quedan: 0, texto: "Nada que repetir: no falló ninguna búsqueda" });
  if (!(await quedaCupo())) return guardar({ fin: new Date().toISOString(), busquedas: 0, nuevos: 0, errores: 0, quedan: cola.length, texto: `Hoy ya va cerca del tope gratis de Google: ${cola.length} en cola para mañana` });
  const desde = hoyEnLeon(), hasta = sumarDias(desde, DIAS_AGENDA - 1);
  // Las fechas de la búsqueda guardada se ajustan a hoy si ya han pasado
  const busquedas = ordenarRepesca(cola, desde).slice(0, max).map(({ b }) => ({ ...b, desde: b.desde < desde ? desde : b.desde, hasta: b.hasta < desde ? hasta : b.hasta }));
  const r = await trabajarEn({ busquedas }, { desde, hasta, inicio, firma: "repesca" });
  const quedan = (await leerRepesca().catch(() => [])).length;
  const motivo = Object.values(r.fuentes || {}).find((f) => !f.ok)?.error;
  const parte = {
    fin: new Date().toISOString(), busquedas: r.busquedas, nuevos: r.nuevos, encontrados: r.encontrados, errores: r.errores, dudosos: r.dudosos || 0, quedan,
    error: r.busquedas && r.errores >= r.busquedas ? motivo || "Siguen fallando" : null,
    texto: `${r.busquedas - r.errores} de ${r.busquedas} repetidas bien · ${r.nuevos} eventos nuevos${quedan ? ` · ${quedan} en cola` : ""}`,
  };
  await sinRomper(apuntarCharla([{ de: "repesca", a: JEFE, tipo: r.errores ? "fallo" : "nuevos", texto: `He repetido ${r.busquedas} búsquedas que fallaron: ${r.busquedas - r.errores} bien y ${r.nuevos} eventos nuevos.${r.errores ? ` ${r.errores} siguen fallando (${motivo || "Google"}).` : ""}` }]), "charla");
  return guardar(parte);
}
