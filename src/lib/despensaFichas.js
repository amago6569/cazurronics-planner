// ============ DESPENSA: LO QUE HACE ESPECIAL A CADA TIENDA (sus reseñas de Google) ============
// Google Maps nos da la tienda y la nota. Lo que no da a simple vista es lo que sabe un leonés: que la cecina de esa
// carnicería ganó un premio, que ese horno hace pan de centeno de masa madre o que esa confitería borda los nicanores.
// Buscarlo en Internet tienda a tienda no dio resultado (casi ninguna tienda pequeña sale en prensa). Quien sí lo cuenta
// es la gente en sus reseñas: "la mejor cecina de León", "el pan de escanda está buenísimo", "premio a la mejor morcilla".
//  · Se leen las 5 reseñas más útiles de cada tienda y el resumen de Google (Place Details, en español).
//  · La IA, sin búsqueda, saca de ahí especialidades y premios. 6 tiendas por consulta.
//  · Nunca inventa: cada especialidad tiene que salir en las reseñas, y un premio solo vale si las reseñas hablan
//    de premio, concurso o medalla.
//  · Google no deja guardar sus datos más de 30 días: la ficha caduca a los 30 y se vuelve a leer.
//  · 30 tiendas por pasada, 3 pasadas cada noche: 90 al día. Las ~790 tiendas se cubren en unos 9 días.
//
// Coste. Reseñas: tarifa "Place Details Enterprise + Atmosphere", 1.000 gratis al mes y luego 25 $ cada 1.000. Es una
// tarifa aparte: no gasta las búsquedas con nota del barrido de tiendas. Con 790 tiendas cada 30 días son ~790 al mes:
// 0 €. Tope de seguridad: DESPENSA_TOPE_RESENAS (900 al mes). Si Google dejase de regalarlas, como mucho 22,5 $ al mes.
// IA: 5 consultas por pasada, 15 al día, sin búsqueda; ~4.000 tokens de entrada por consulta ≈ 0,0005 $: ~0,25 $ al mes.
import { aObjeto, comando, guardarJSON, leerJSON, varios } from "./almacen";
import { llamarGemini, extraerJSON } from "./gemini";
import { leerTiendasGoogle, puntuacionGoogle } from "./despensaTiendas";
import { categoriaPorId } from "./despensaProductos";
import { hoyEnLeon } from "./estadisticas";
import { estadoMarcas, leerSitiosMarcas, ubicarMarcas } from "./despensaMarcas";

const CLAVE = "despensa:fichas";
export const TOPE_RESENAS_MES = Math.max(0, Number(process.env.DESPENSA_TOPE_RESENAS ?? 900));
const PRECIO_RESENAS = 0.025; // $ por lectura si no quedasen gratis
const POR_PASADA = 30;
const POR_CONSULTA = 6;
const A_LA_VEZ = 10; // lecturas de reseñas en paralelo
const DIAS_VALE = 30;
// Sube al cambiar cómo se investiga: las fichas de una versión anterior se vuelven a investigar
const VERSION = 4;

const claveMaps = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY || "";
const claveGasto = () => `despensa:resenas:${hoyEnLeon().slice(0, 7)}`;
const limpiar = (t, max) => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PREMIO = /premi|galard|concurso|medalla|campeon|ganador|reconocimiento/;

// Las palabras con chicha de un texto, recortadas a 6 letras para que "cecinas" y "cecina" o "hojaldre" y "hojaldres"
// casen. Las genéricas no cuentan: "buen trato" no es una especialidad aunque alguien diga "buen precio".
const GENERICAS = new Set(["buen", "buena", "bueno", "buenos", "buenas", "mejor", "mejore", "calida", "precio", "precios", "trato", "atenci", "amable", "fresco", "fresca", "frescos", "frescas", "produc", "tienda", "siempr", "varied", "servic", "person", "local", "sitio", "lugar", "recomi", "excele", "genial"]);
const raices = (t) => normalizar(t).split(/[^a-zñ]+/).filter((p) => p.length >= 4).map((p) => p.slice(0, 6)).filter((r) => !GENERICAS.has(r));

// Gasta una lectura del tope del mes. true si cabía.
async function gastar() {
  const clave = claveGasto();
  const usadas = Number(await comando(["INCRBY", clave, 1]));
  if (usadas === 1) await comando(["EXPIRE", clave, 40 * 86400]);
  return usadas <= TOPE_RESENAS_MES;
}

// Reseñas y resumen de una tienda. null si no queda cupo; "" si Google no da nada.
async function leerResenas(placeId) {
  if (!(await gastar())) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "X-Goog-Api-Key": claveMaps(), "X-Goog-FieldMask": "reviews,editorialSummary" },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error?.message || `Places ${res.status}`);
  const resumen = limpiar(d.editorialSummary?.text, 300);
  const resenas = (d.reviews || []).map((r) => limpiar(r.text?.text || r.originalText?.text, 600)).filter(Boolean);
  return [resumen && `Resumen de Google: ${resumen}`, ...resenas.map((r) => `- "${r}"`)].filter(Boolean).join("\n");
}

export function promptFichas(tiendas) {
  const bloques = tiendas.map((t, i) => `TIENDA ${i + 1}: ${t.nombre} (${t.localidad || ""}) · ${(t.cats || []).map((c) => categoriaPorId(c)?.nombre).filter(Boolean).join(", ")}\n${t.texto}`).join("\n\n");
  return `
    Eres el documentalista de Cazurronics, una web de planes en León (España). Estas son tiendas de alimentación de la
    provincia de León con las reseñas que les ha dejado la gente en Google Maps.

    ${bloques}

    Para cada tienda saca SOLO lo que digan las reseñas:
    - "especialidades": productos concretos que la gente alaba o por los que va (ej. "cecina de chivo", "pan de centeno",
      "nicanores", "botillo", "queso de oveja curado"). Máximo 6, de 1 a 5 palabras, con las palabras de las reseñas.
      Nada genérico ("buen trato", "calidad", "producto fresco" no son especialidades).
    - "premios": premios, concursos o medallas que mencionen las reseñas, con el año si lo dicen.
    - "destaca": una frase corta con lo que la hace especial según la gente (obrador propio, matanza casera...), o null.
    REGLAS: no inventes. Si las reseñas no nombran productos concretos, listas vacías y null.
    Devuelve SOLO un array JSON, una entrada por tienda y en el mismo orden:
    [{"n":1,"especialidades":["cecina de chivo"],"premios":[{"que":"Premio a la mejor cecina","anio":2024}],"destaca":"..."}]
  `;
}

// Lo que devuelve la IA para una tienda, comprobado contra sus reseñas: cada especialidad tiene que salir en ellas, y
// un premio solo vale si las reseñas hablan de premios y comparten alguna palabra con él.
export function validarFicha(f, texto) {
  if (!f || typeof f !== "object") return null;
  const enResenas = new Set(raices(texto));
  const sale = (t) => raices(t).some((r) => enResenas.has(r));
  const especialidades = [...new Set((Array.isArray(f.especialidades) ? f.especialidades : []).map((e) => limpiar(e, 50)).filter((e) => e.length >= 3 && sale(e)))].slice(0, 6);
  const hayPremio = PREMIO.test(normalizar(texto));
  const premios = (hayPremio && Array.isArray(f.premios) ? f.premios : [])
    .map((p) => ({ que: limpiar(p?.que, 120), anio: /^(19|20)\d\d$/.test(String(p?.anio)) ? Number(p.anio) : null }))
    .filter((p) => p.que && sale(p.que))
    .slice(0, 3);
  const destaca = especialidades.length || premios.length ? limpiar(f.destaca, 180) || null : null;
  return { especialidades, premios, destaca };
}

async function leerLote(lote) {
  const { texto } = await llamarGemini(promptFichas(lote), { para: "despensa", google: false, json: true, temperatura: 0.1, msMax: 30000 });
  const lista = extraerJSON(texto, "[") || [];
  return lote.map((t, i) => [t, validarFicha(lista.find((x) => Number(x?.n) === i + 1) || lista[i], t.texto)]);
}

// Las que tocan: sin ficha, de una versión anterior o de hace más de 30 días. Primero León capital y las de mejor
// nota (las que más se van a recomendar).
export function tiendasQueTocan(tiendas, fichas, ahora = Date.now(), cuantas = POR_PASADA) {
  return tiendas
    .filter((t) => {
      const f = fichas[t.placeId];
      return !f?.f || (f.v || 1) < VERSION || Date.parse(f.f) < ahora - DIAS_VALE * 86400000;
    })
    .map((t) => ({ t, prioridad: puntuacionGoogle(t) + (t.zona === "leon" ? 1.5 : 0) + Math.min(t.resenas || 0, 300) / 300 }))
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, cuantas)
    .map((x) => x.t);
}

// Las fichas vigentes. Las de más de 30 días no se usan (Google no deja guardar sus datos más tiempo).
export async function leerFichas(ahora = Date.now()) {
  const res = await comando(["HGETALL", CLAVE]).catch(() => null);
  const fichas = {};
  for (const [id, v] of Object.entries(aObjeto(res))) {
    try {
      const f = JSON.parse(v);
      if (f?.f && Date.parse(f.f) >= ahora - DIAS_VALE * 86400000) fichas[id] = f;
    } catch { /* rota: se repite */ }
  }
  return fichas;
}

// Una pasada: lee las reseñas de 30 tiendas (10 a la vez) y se las pasa a la IA de 6 en 6 (cabe en el minuto de Vercel)
export async function investigarTiendas() {
  const inicio = new Date().toISOString();
  const fin = async (datos) => { const informe = { inicio, fin: new Date().toISOString(), ...datos }; await guardarJSON("despensa:fichas:ultimo", informe); return informe; };
  if (!claveMaps()) return fin({ nada: "Falta GOOGLE_MAPS_API_KEY" });
  // De paso, se ubican los productores y sus tiendas que falten (unas pocas búsquedas al mes)
  const marcas = await ubicarMarcas().catch((e) => ({ error: String(e?.message || e).slice(0, 120) }));
  const [tiendas, fichas] = await Promise.all([leerTiendasGoogle(), leerFichas()]);
  const tocan = tiendasQueTocan(tiendas, fichas);
  if (!tocan.length) return fin({ nada: "Todas las tiendas están al día", marcas });

  const leidas = [];
  const errores = [];
  let sinCupo = false;
  for (let i = 0; i < tocan.length && !sinCupo; i += A_LA_VEZ) {
    const res = await Promise.allSettled(tocan.slice(i, i + A_LA_VEZ).map((t) => leerResenas(t.placeId)));
    res.forEach((r, k) => {
      const t = tocan[i + k];
      if (r.status === "rejected") errores.push(String(r.reason?.message || r.reason).slice(0, 120));
      else if (r.value === null) sinCupo = true;
      else leidas.push({ ...t, texto: r.value });
    });
  }

  // Sin reseñas no hay nada que leer: ficha vacía directamente, sin gastar IA
  const hoy = new Date().toISOString();
  const vacia = { especialidades: [], premios: [], destaca: null };
  const conTexto = leidas.filter((t) => t.texto);
  const lotes = [];
  for (let i = 0; i < conTexto.length; i += POR_CONSULTA) lotes.push(conTexto.slice(i, i + POR_CONSULTA));
  const res = await Promise.allSettled(lotes.map(leerLote));
  res.filter((r) => r.status === "rejected").forEach((r) => errores.push(String(r.reason?.message || r.reason).slice(0, 120)));
  const nuevas = [
    ...leidas.filter((t) => !t.texto).map((t) => [t, vacia]),
    ...res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  ].map(([t, f]) => {
    const ficha = { ...(f || vacia), origen: "resenas", f: hoy, v: VERSION };
    ficha.vacia = !ficha.especialidades.length && !ficha.premios.length;
    return [t.placeId, ficha];
  });
  if (nuevas.length) await varios([["HSET", CLAVE, ...nuevas.flatMap(([id, f]) => [id, JSON.stringify(f)])]]);
  return fin({
    investigadas: nuevas.length,
    conPremio: nuevas.filter(([, f]) => f.premios.length).length,
    conEspecialidad: nuevas.filter(([, f]) => f.especialidades.length).length,
    marcas,
    ...(sinCupo ? { sinCupo: true } : {}),
    ...(errores.length ? { error: errores[0], fallidas: errores.length } : {}),
  });
}

export async function resumenFichas() {
  const [fichas, ultimo, tiendas, usadas, sitiosMarcas] = await Promise.all([
    leerFichas(),
    leerJSON("despensa:fichas:ultimo").catch(() => null),
    leerTiendasGoogle().catch(() => []),
    comando(["GET", claveGasto()]).catch(() => 0),
    leerSitiosMarcas().catch(() => ({})),
  ]);
  const ids = new Set(tiendas.map((t) => t.placeId));
  const suyas = Object.entries(fichas).filter(([id]) => ids.has(id)).map(([, f]) => f);
  const n = Number(usadas) || 0;
  return {
    investigadas: suyas.length,
    tiendas: ids.size,
    conPremio: suyas.filter((f) => f.premios?.length).length,
    conEspecialidad: suyas.filter((f) => f.especialidades?.length).length,
    pendientes: tiendasQueTocan(tiendas, fichas, Date.now(), 1e6).length,
    marcas: estadoMarcas(sitiosMarcas),
    google: { usadas: n, tope: TOPE_RESENAS_MES, peorCasoDolares: Math.round(Math.min(n, TOPE_RESENAS_MES) * PRECIO_RESENAS * 100) / 100 },
    ultimo,
  };
}
