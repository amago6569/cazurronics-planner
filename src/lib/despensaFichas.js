// ============ DESPENSA: LO QUE HACE ESPECIAL A CADA TIENDA ============
// Google Maps nos da la tienda, la nota y las reseñas. Lo que no da es lo que sabe un leonés: que la cecina de esa
// carnicería ganó un premio, que ese horno hace pan de centeno de masa madre o que esa confitería borda los nicanores.
// Este barrido lo investiga tienda a tienda con la IA y búsqueda en Google (modelos 2.x: búsquedas gratis), como los planes.
//  · Nunca inventa: cada premio necesita su fuente, y las especialidades, la fuente de la tienda (su web, prensa, guías).
//    La fuente se comprueba igual que en los eventos: la IA la ha consultado o la página existe.
//  · 6 tiendas por consulta, 4 consultas a la vez: 24 tiendas por pasada. Primero las de mejor nota y las de León capital.
//  · Lo investigado vale 90 días; si no se encuentra nada, se vuelve a mirar a los 60.
//
// Coste: 12 consultas por pasada, 3 pasadas cada noche (18:00, 19:00 y 20:00 UTC) = 36 al día de las 1.500 gratis.
// Solo se pagan los tokens del modelo 2.5 flash-lite: ~6.000 de entrada y ~1.500 de salida ≈ 0,0012 $ por consulta,
// unos 0,05 $ al día y ~1,3 $ al mes. Cuando estén todas al día, la mitad.
import { aObjeto, comando, guardarJSON, leerJSON, varios } from "./almacen";
import { llamarGemini, extraerJSON } from "./gemini";
import { comprobarUrl, dominioConsultado } from "./eventos";
import { leerTiendasGoogle, puntuacionGoogle } from "./despensaTiendas";
import { categoriaPorId } from "./despensaProductos";

const CLAVE = "despensa:fichas";
const POR_CONSULTA = 6;
const CONSULTAS_A_LA_VEZ = 4;
const DIAS_VALE = 90;
const DIAS_VALE_VACIA = 60;

const limpiar = (t, max) => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const urlValida = (u) => (typeof u === "string" && /^https?:\/\/[^\s]+$/.test(u) && !/vertexaisearch|grounding-api|google\.[a-z.]+\/(search|maps)/.test(u) ? u : null);

// Lo que devuelve la IA para una tienda, limpio. Sin fuente, no hay especialidades; un premio sin su fuente, fuera.
export function validarFicha(f) {
  if (!f || typeof f !== "object") return null;
  const fuente = urlValida(f.fuente);
  const premios = (Array.isArray(f.premios) ? f.premios : [])
    .map((p) => ({ que: limpiar(p?.que, 120), anio: /^(19|20)\d\d$/.test(String(p?.anio)) ? Number(p.anio) : null, fuente: urlValida(p?.fuente) }))
    .filter((p) => p.que && p.fuente)
    .slice(0, 4);
  const especialidades = fuente ? [...new Set((Array.isArray(f.especialidades) ? f.especialidades : []).map((e) => limpiar(e, 50)).filter((e) => e.length >= 3))].slice(0, 6) : [];
  const destaca = fuente ? limpiar(f.destaca, 180) || null : null;
  return { especialidades, premios, destaca, fuente: especialidades.length || destaca ? fuente : null };
}

export function promptFichas(tiendas) {
  const lista = tiendas.map((t, i) => `${i + 1}. ${t.nombre} | ${t.direccion || t.localidad} | ${(t.cats || []).map((c) => categoriaPorId(c)?.nombre).filter(Boolean).join(", ")}`).join("\n");
  return `
    Eres el documentalista de Cazurronics, una web de planes en León (España). Investiga en Internet estas tiendas de
    alimentación de la provincia de León. Busca cada una por su nombre y su pueblo: su web, sus redes, la prensa
    (Diario de León, Leonoticias, iLeón, La Nueva Crónica, El Bierzo Digital...), guías y reseñas.
    ${lista}

    Para cada tienda quiero:
    - "premios": premios y reconocimientos reales (concursos de cecina, de embutido, de quesos, mejor pan, mejor
      croissant, Alimentos de León, Tierra de Sabor...). Con el año y la página exacta donde se dice.
    - "especialidades": productos concretos por los que se la conoce (ej. "cecina de chivo", "pan de centeno de masa
      madre", "nicanores", "botillo", "queso de oveja curado"). Máximo 6, de 1 a 5 palabras.
    - "destaca": una frase corta con lo que la hace especial (obrador propio, cuarta generación, matanza propia...).
    - "fuente": la página donde lo has leído (su web, un artículo, una guía).
    REGLAS: no inventes nada. Si de una tienda no encuentras nada concreto, pon listas vacías y null. No confundas
    tiendas con el mismo nombre de otros sitios. Las páginas de Google no valen como fuente.
    Devuelve SOLO un array JSON, una entrada por tienda y en el mismo orden:
    [{"n":1,"premios":[{"que":"1.º premio cecina de vacuno, Feria de la Cecina de Vegacervera","anio":2024,"fuente":"https://..."}],
      "especialidades":["cecina de vacuno"],"destaca":"...","fuente":"https://..."}]
  `;
}

// La fuente vale si la IA la ha consultado o si la página existe (como en los eventos)
async function fuenteBuena(url, dominios) {
  if (!url) return false;
  return dominioConsultado(url, dominios) || (await comprobarUrl(url)) === "ok";
}

async function investigar(tiendas) {
  const { texto, dominios } = await llamarGemini(promptFichas(tiendas), { para: "barrido", temperatura: 0.1, msMax: 40000 });
  const lista = extraerJSON(texto, "[") || [];
  const hoy = new Date().toISOString();
  return Promise.all(tiendas.map(async (t, i) => {
    const bruta = lista.find((x) => Number(x?.n) === i + 1) || lista[i];
    const f = validarFicha(bruta) || { especialidades: [], premios: [], destaca: null, fuente: null };
    const [okFuente, okPremios] = await Promise.all([fuenteBuena(f.fuente, dominios), Promise.all(f.premios.map((p) => fuenteBuena(p.fuente, dominios)))]);
    const ficha = {
      especialidades: okFuente ? f.especialidades : [],
      destaca: okFuente ? f.destaca : null,
      fuente: okFuente ? f.fuente : null,
      premios: f.premios.filter((_, k) => okPremios[k]),
      f: hoy,
    };
    ficha.vacia = !ficha.especialidades.length && !ficha.premios.length && !ficha.destaca;
    return [t.placeId, ficha];
  }));
}

// Las que tocan: sin ficha o caducada. Primero León capital y las de mejor nota (las que más se van a recomendar).
export function tiendasQueTocan(tiendas, fichas, ahora = Date.now(), cuantas = POR_CONSULTA * CONSULTAS_A_LA_VEZ) {
  return tiendas
    .filter((t) => {
      const f = fichas[t.placeId];
      if (!f?.f) return true;
      return Date.parse(f.f) < ahora - (f.vacia ? DIAS_VALE_VACIA : DIAS_VALE) * 86400000;
    })
    .map((t) => ({ t, prioridad: puntuacionGoogle(t) + (t.zona === "leon" ? 1.5 : 0) + Math.min(t.resenas || 0, 300) / 300 }))
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, cuantas)
    .map((x) => x.t);
}

export async function leerFichas() {
  const res = await comando(["HGETALL", CLAVE]).catch(() => null);
  const fichas = {};
  for (const [id, v] of Object.entries(aObjeto(res))) { try { fichas[id] = JSON.parse(v); } catch { /* rota: se repite */ } }
  return fichas;
}

// Una pasada: hasta 24 tiendas en 4 consultas a la vez (cabe en el minuto de Vercel)
export async function investigarTiendas() {
  const inicio = new Date().toISOString();
  const [tiendas, fichas] = await Promise.all([leerTiendasGoogle(), leerFichas()]);
  const tocan = tiendasQueTocan(tiendas, fichas);
  if (!tocan.length) {
    const informe = { inicio, fin: new Date().toISOString(), nada: "Todas las tiendas están investigadas" };
    await guardarJSON("despensa:fichas:ultimo", informe);
    return informe;
  }
  const tandas = [];
  for (let i = 0; i < tocan.length; i += POR_CONSULTA) tandas.push(tocan.slice(i, i + POR_CONSULTA));
  const res = await Promise.allSettled(tandas.map(investigar));
  const nuevas = res.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (nuevas.length) await varios([["HSET", CLAVE, ...nuevas.flatMap(([id, f]) => [id, JSON.stringify(f)])]]);
  const errores = res.filter((r) => r.status === "rejected").map((r) => String(r.reason?.message || r.reason).slice(0, 120));
  const informe = {
    inicio, fin: new Date().toISOString(),
    investigadas: nuevas.length,
    conPremio: nuevas.filter(([, f]) => f.premios.length).length,
    conEspecialidad: nuevas.filter(([, f]) => f.especialidades.length).length,
    ...(errores.length ? { error: errores[0], fallidas: errores.length } : {}),
  };
  await guardarJSON("despensa:fichas:ultimo", informe);
  return informe;
}

export async function resumenFichas() {
  const [fichas, ultimo, tiendas] = await Promise.all([leerFichas(), leerJSON("despensa:fichas:ultimo").catch(() => null), leerTiendasGoogle().catch(() => [])]);
  const ids = new Set(tiendas.map((t) => t.placeId));
  const suyas = Object.entries(fichas).filter(([id]) => ids.has(id)).map(([, f]) => f);
  return {
    investigadas: suyas.length,
    tiendas: ids.size,
    conPremio: suyas.filter((f) => f.premios?.length).length,
    conEspecialidad: suyas.filter((f) => f.especialidades?.length).length,
    pendientes: tiendasQueTocan(tiendas, fichas, Date.now(), 1e6).length,
    ultimo,
  };
}
