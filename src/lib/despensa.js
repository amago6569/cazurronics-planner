// ============ DESPENSA DE LEÓN ============
// Las mejores tiendas de producto de León (cecina, quesos, pan, empanadas, vino...) por producto y comarca.
//
// Cómo se llena (de noche, con /api/despensa/barrido):
//  1. Gemini con Google Search (solo modelos 2.x: búsquedas gratis) busca en webs, prensa, foros y reseñas
//     los mejores sitios de UN producto en UNA comarca.
//  2. Cada tienda necesita una fuente real (la misma comprobación que los eventos)...
//  3. ...y una ficha real en Google Places. Igual que con los bares: sin ficha, fuera.
//  4. Se guarda y no se vuelve a buscar en 90 días.
//
// Lo que paga cada consulta de la gente: NADA si elige productos (la página filtra este catálogo).
// Si escribe lo que busca, una IA barata elige entre estas tiendas (lib/despensaBuscar.js). Si pide algo que no
// tenemos, queda apuntado y se busca en la siguiente pasada nocturna (igual que el resto: gratis).
//
// Coste de la comprobación en Google Places (API nueva, tarifa de octubre de 2026):
//  · Text Search "solo ID" (places.id): GRATIS sin límite. Nos dice qué ficha es.
//  · Place Details Essentials (ubicación, dirección, tipos): 10.000 gratis al mes, luego 5 $ cada 1.000.
// TOPE_PLACES_MES corta las comprobaciones de pago al mes: aunque no quedase nada gratis,
// el peor caso es 900 × 5 $ / 1.000 = 4,5 $ al mes. Lo pendiente se retoma el mes siguiente.
import { aObjeto, comando, leerJSON, guardarJSON, varios } from "./almacen";
import { PRODUCTOS } from "./despensaProductos";
import { hoyEnLeon } from "./estadisticas";
import { ZONAS, zonaDe } from "./zonas";
import { llamarGemini, extraerJSON } from "./gemini";
import { comprobarUrl, dominioConsultado } from "./eventos";

const PRODUCTO = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]));

// Una búsqueda por producto y comarca: 17 × 9 = 153. Primero la capital entera, luego el alfoz, etc.
export const COMBINACIONES = ZONAS.flatMap((z) => PRODUCTOS.map((p) => ({ producto: p.id, zona: z.id })));
const claveCombo = (producto, zona) => `despensa:${producto}:${zona}`;

const DIAS_REFRESCO = 90;
const POR_PASADA = 6; // cada pasada cabe en el minuto que da Vercel (las 6 búsquedas van a la vez)
export const TOPE_PLACES_MES = Math.max(0, Number(process.env.DESPENSA_TOPE_PLACES) || 900);
const PRECIO_DETALLE_DOLARES = 0.005;
const LIMITES = { latMin: 41.8, latMax: 43.45, lonMin: -7.35, lonMax: -4.45 };

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
const limpiar = (t, max) => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const centroZona = (z) => z.centroReal || [z.lat, z.lon];

// ---------- 1. Lo que devuelve la IA ----------
export function validarTiendaIA(t) {
  if (!t || typeof t !== "object") return null;
  const nombre = limpiar(t.nombre, 80);
  const localidad = limpiar(t.localidad, 60);
  const fuente = typeof t.fuente === "string" && /^https?:\/\//.test(t.fuente) && !/vertexaisearch|grounding-api/.test(t.fuente) ? t.fuente : null;
  if (!nombre || !localidad || !fuente) return null; // sin fuente verificable no se publica
  const puntuacion = Math.min(10, Math.max(1, Math.round(Number(t.puntuacion) || 6)));
  return {
    nombre, localidad,
    direccion: limpiar(t.direccion, 120) || null,
    especialidad: limpiar(t.especialidad, 90) || null,
    porque: limpiar(t.porque, 220) || null,
    precio: t.precio === "capricho" ? "capricho" : "calidad-precio",
    puntuacion,
    fuente,
  };
}

async function buscarConIA(busca, zona) {
  const z = ZONAS.find((x) => x.id === zona);
  const prompt = `
    Eres el documentalista de Cazurronics, una web de planes en León (España). Busca en Internet dónde comprar
    ${busca} en ${z.nombre} (provincia de León). Pueblos de la zona: ${z.pueblos.slice(0, 25).join(", ")}.
    Mira prensa local (Diario de León, Leonoticias, iLeón, El Bierzo Digital...), guías gastronómicas, foros,
    reseñas, premios y webs de los propios negocios. Haz varias búsquedas distintas.
    Queremos los MEJORES o los más especiales, no un listado: máximo 5.
    REGLAS: solo negocios que existen y venden al público en esa zona, con local físico; nada de supermercados
    ni grandes cadenas; no inventes nada; "fuente" es la página exacta donde lo has leído (no la web de Google).
    Si no encuentras ninguno bueno, devuelve [].
    Devuelve SOLO un array JSON con este formato:
    [{"nombre":"nombre del negocio","localidad":"municipio exacto","direccion":"calle y número o null",
      "especialidad":"lo que hay que comprar ahí, corto","porque":"una frase con el motivo (premio, años, lo que dice la gente)",
      "precio":"calidad-precio o capricho","puntuacion":"1 a 10 según lo bien que hablan de él","fuente":"https://..."}]
  `;
  const { texto, dominios } = await llamarGemini(prompt, { para: "barrido", temperatura: 0.1, msMax: 38000 });
  const tiendas = (extraerJSON(texto, "[") || []).map(validarTiendaIA).filter(Boolean).slice(0, 6);
  return { tiendas, dominios };
}

// ---------- 2. ¿Existe en Google Places? ----------
const claveMaps = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY || "";
const mesActual = () => hoyEnLeon().slice(0, 7);
const claveGasto = () => `despensa:places:${mesActual()}`;

// Tipos que dicen que Google no ha encontrado el negocio, solo el pueblo o la calle
const NO_ES_NEGOCIO = ["locality", "political", "route", "street_address", "postal_code", "country", "sublocality", "neighborhood", "geocode"];

// La ficha vale si es un negocio (no un pueblo), está en la provincia y en la zona buscada (o en su pueblo)
export function fichaValida(ficha, tienda, zona) {
  const lat = Number(ficha?.location?.latitude), lon = Number(ficha?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < LIMITES.latMin || lat > LIMITES.latMax || lon < LIMITES.lonMin || lon > LIMITES.lonMax) return false;
  const tipos = Array.isArray(ficha.types) ? ficha.types : [];
  if (!tipos.includes("establishment") && !tipos.includes("point_of_interest")) return false;
  if (tipos.some((t) => NO_ES_NEGOCIO.includes(t))) return false;
  const enDireccion = normalizar(ficha.formattedAddress).includes(normalizar(tienda.localidad));
  const zonaFicha = zonaDe({ lat, lon });
  const cerca = zonaFicha === zona || ((zona === "leon" || zona === "alfoz") && (zonaFicha === "leon" || zonaFicha === "alfoz"));
  return enDireccion || cerca;
}

async function pedirPlaces(url, opciones) {
  const res = await fetch(url, { ...opciones, cache: "no-store", signal: AbortSignal.timeout(6000) });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places ${res.status} ${String(datos?.error?.message || "").slice(0, 120)}`);
  return datos;
}

// Devuelve { placeId, lat, lon, direccion } o null. "sinCupo" si este mes ya no quedan comprobaciones.
async function comprobarEnPlaces(tienda, zona) {
  const key = claveMaps();
  if (!key) return null;
  const cache = `despensa:ficha:${normalizar(`${tienda.nombre} ${tienda.localidad}`).replace(/ /g, "-").slice(0, 90)}`;
  const guardada = await leerJSON(cache).catch(() => null);
  if (guardada) return guardada.placeId ? guardada : null;

  const z = ZONAS.find((x) => x.id === zona);
  const [lat, lon] = centroZona(z);
  // Paso gratis: qué ficha es (solo el id)
  const busqueda = await pedirPlaces("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({
      textQuery: `${tienda.nombre}, ${tienda.direccion ? `${tienda.direccion}, ` : ""}${tienda.localidad}, León, España`,
      languageCode: "es", regionCode: "es", pageSize: 1,
      locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: zona === "leon" ? 15000 : 50000 } },
    }),
  });
  const id = busqueda?.places?.[0]?.id;
  if (!id) { await guardarJSON(cache, { placeId: null }, DIAS_REFRESCO * 86400); return null; }

  // Paso de pago (10.000 gratis al mes): dónde está y qué es. Con tope mensual.
  const usadas = Number(await comando(["INCRBY", claveGasto(), 1]));
  if (usadas === 1) await comando(["EXPIRE", claveGasto(), 40 * 86400]);
  if (usadas > TOPE_PLACES_MES) return "sinCupo";
  const ficha = await pedirPlaces(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=es`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,location,formattedAddress,types" },
  });
  const ok = fichaValida(ficha, tienda, zona);
  const r = ok ? { placeId: id, lat: ficha.location.latitude, lon: ficha.location.longitude, direccion: limpiar(ficha.formattedAddress, 140) } : { placeId: null };
  await guardarJSON(cache, r, DIAS_REFRESCO * 86400);
  return ok ? r : null;
}

// ---------- 3. Una combinación (producto + zona) ----------
async function fuenteValida(tienda, dominios) {
  if (dominioConsultado(tienda.fuente, dominios)) return true;
  return (await comprobarUrl(tienda.fuente)) === "ok";
}

// Busca con IA y comprueba cada tienda. Devuelve { encontradas, buenas } o { sinCupo }. Si Places falla, lanza error.
async function buscarYComprobar(busca, zona) {
  const { tiendas, dominios } = await buscarConIA(busca, zona);
  // Cada tienda se comprueba a la vez (fuente + Places) para caber en el minuto de Vercel
  const fichas = await Promise.all(tiendas.map(async (t) => {
    if (!(await fuenteValida(t, dominios))) return null;
    return comprobarEnPlaces(t, zona).catch((e) => { console.warn("[despensa] places:", e.message); return { error: e.message }; });
  }));
  // Si Google Places falla (clave sin la API nueva activada, caída...), no se guarda nada: se repite en otra pasada
  const fallo = fichas.find((f) => f?.error);
  if (fallo) throw new Error(`Google Places: ${fallo.error}`);
  // Sin cupo de Places este mes: no se guarda, se repite el mes que viene
  if (fichas.includes("sinCupo")) return { sinCupo: true, encontradas: tiendas.length };
  const buenas = [];
  tiendas.forEach((t, i) => {
    const f = fichas[i];
    if (f && !buenas.some((b) => b.placeId === f.placeId)) buenas.push({ ...t, ...f });
  });
  buenas.sort((a, b) => b.puntuacion - a.puntuacion);
  return { encontradas: tiendas.length, buenas: buenas.slice(0, 5) };
}

export async function barrerCombinacion(producto, zona) {
  const r = await buscarYComprobar(PRODUCTO[producto].busca, zona);
  if (r.sinCupo) return { producto, zona, sinCupo: true, encontradas: r.encontradas, guardadas: 0 };
  await guardarJSON(claveCombo(producto, zona), { fecha: new Date().toISOString(), tiendas: r.buenas });
  return { producto, zona, encontradas: r.encontradas, guardadas: r.buenas.length };
}

// ---------- 3b. Lo que pide la gente y no tenemos ----------
// El buscador apunta aquí lo que falta ("aceite de oliva" en Astorga). La pasada nocturna lo busca igual que
// una combinación normal y lo guarda aparte; desde ese momento la IA del buscador ya puede recomendarlo.
const PETICIONES = "despensa:peticiones"; // campo = clave de la petición · valor = { texto, zona, fecha }
const LIBRES = "despensa:libres"; // campo = clave de la petición · valor = fecha en que se buscó
const claveLibre = (id) => `despensa:libre:${id}`;
const POR_PASADA_PETICIONES = 2;
export const idPeticion = (texto, zona) => `${normalizar(texto).replace(/ /g, "-").slice(0, 60)}--${zona}`;

export function limpiarPeticion(texto) {
  const t = limpiar(texto, 60).replace(/[^\p{L}\p{N} ,.'-]/gu, "").trim();
  return t.length >= 3 ? t : null;
}

export async function pedirBusqueda(texto, zona) {
  const limpio = limpiarPeticion(texto);
  if (!limpio || !ZONAS.some((z) => z.id === zona)) return false;
  await comando(["HSETNX", PETICIONES, idPeticion(limpio, zona), JSON.stringify({ texto: limpio, zona, fecha: new Date().toISOString() })]);
  return true;
}

async function leerPeticiones() {
  const [pedidas, hechas] = await Promise.all([comando(["HGETALL", PETICIONES]), comando(["HGETALL", LIBRES])]);
  const yaHechas = aObjeto(hechas);
  const todas = Object.entries(aObjeto(pedidas)).map(([id, v]) => { try { return { id, ...JSON.parse(v), hecha: Boolean(yaHechas[id]) }; } catch { return null; } }).filter(Boolean);
  todas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { todas, hechas: yaHechas };
}

// Las que faltan, de la más antigua a la más nueva (solo las 30 últimas: si alguien llenase la lista, no atasca nada)
export function peticionesPendientes(todas, cuantas = POR_PASADA_PETICIONES) {
  return todas.filter((p) => !p.hecha).slice(0, 30).reverse().slice(0, cuantas);
}

async function barrerPeticion(p) {
  const r = await buscarYComprobar(p.texto, p.zona);
  if (r.sinCupo) return { peticion: p.texto, zona: p.zona, sinCupo: true, encontradas: r.encontradas, guardadas: 0 };
  const fecha = new Date().toISOString();
  await guardarJSON(claveLibre(p.id), { texto: p.texto, zona: p.zona, fecha, tiendas: r.buenas }, 180 * 86400);
  await comando(["HSET", LIBRES, p.id, fecha]);
  return { peticion: p.texto, zona: p.zona, encontradas: r.encontradas, guardadas: r.buenas.length };
}

// ---------- 4. La pasada nocturna ----------
// Elige las combinaciones que faltan (o las que tienen más de 90 días) y las busca a la vez.
export function pendientes(fechas, ahora = Date.now(), cuantas = POR_PASADA) {
  const vieja = ahora - DIAS_REFRESCO * 86400000;
  return COMBINACIONES
    .map((c, i) => ({ ...c, fecha: fechas[i] ? Date.parse(fechas[i]) : 0 }))
    .filter((c) => c.fecha < vieja)
    .sort((a, b) => a.fecha - b.fecha) // primero las que nunca se han hecho (en el orden de COMBINACIONES)
    .slice(0, cuantas);
}

async function fechasGuardadas() {
  const res = await varios(COMBINACIONES.map((c) => ["GET", claveCombo(c.producto, c.zona)]));
  return res.map((v) => { try { return JSON.parse(v)?.fecha || null; } catch { return null; } });
}

export async function barrerDespensa({ cuantas = POR_PASADA } = {}) {
  const inicio = Date.now();
  if (!claveMaps()) return { saltado: "Falta GOOGLE_MAPS_API_KEY: sin comprobar en Places no se publica ninguna tienda" };
  const gastadas = Number(await comando(["GET", claveGasto()])) || 0;
  if (gastadas >= TOPE_PLACES_MES) return { saltado: `Tope de comprobaciones de Google del mes alcanzado (${TOPE_PLACES_MES})` };
  // Primero lo que ha pedido la gente; el resto de huecos, para el catálogo normal
  const pedidas = peticionesPendientes((await leerPeticiones().catch(() => ({ todas: [] }))).todas, Math.min(POR_PASADA_PETICIONES, cuantas));
  const toca = [
    ...pedidas.map((p) => ({ peticion: p.texto, zona: p.zona, hacer: () => barrerPeticion(p) })),
    ...pendientes(await fechasGuardadas(), inicio, cuantas - pedidas.length).map((c) => ({ ...c, hacer: () => barrerCombinacion(c.producto, c.zona) })),
  ];
  const resultados = await Promise.allSettled(toca.map((c) => c.hacer()));
  const informe = {
    fin: new Date().toISOString(),
    segundos: Math.round((Date.now() - inicio) / 1000),
    combinaciones: resultados.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      const { hacer: _, ...c } = toca[i];
      return { ...c, error: String(r.reason?.message || r.reason).slice(0, 160) };
    }),
  };
  await guardarJSON("despensa:ultimoBarrido", informe);
  return informe;
}

// ---------- 5. Leer el catálogo (la web y el panel) ----------
// conPedidas: también las tiendas de lo que pidió la gente (las usa la IA del buscador; la página no las necesita)
export async function leerDespensa({ conPedidas = false } = {}) {
  const res = await varios(COMBINACIONES.map((c) => ["GET", claveCombo(c.producto, c.zona)])).catch(() => []);
  const tiendas = [];
  let hechas = 0;
  (res || []).forEach((v, i) => {
    let d = null;
    try { d = JSON.parse(v); } catch { /* sin datos */ }
    if (!d) return;
    hechas++;
    for (const t of d.tiendas || []) tiendas.push({ ...t, producto: COMBINACIONES[i].producto, zona: COMBINACIONES[i].zona });
  });
  if (conPedidas) {
    const ids = Object.keys(aObjeto(await comando(["HGETALL", LIBRES]).catch(() => [])));
    const libres = ids.length ? await varios(ids.map((id) => ["GET", claveLibre(id)])).catch(() => []) : [];
    (libres || []).forEach((v, i) => {
      let d = null;
      try { d = JSON.parse(v); } catch { /* caducada */ }
      for (const t of d?.tiendas || []) tiendas.push({ ...t, producto: `libre:${ids[i]}`, productoNombre: d.texto, zona: d.zona });
    });
  }
  return { tiendas, hechas, total: COMBINACIONES.length };
}

export async function resumenDespensa() {
  const [{ tiendas, hechas, total }, ultimo, gastadas, peticiones, busquedas] = await Promise.all([
    leerDespensa({ conPedidas: true }),
    leerJSON("despensa:ultimoBarrido").catch(() => null),
    comando(["GET", claveGasto()]).catch(() => 0),
    leerPeticiones().catch(() => ({ todas: [] })),
    comando(["HGET", "stats:total", "despensa"]).catch(() => 0),
  ]);
  const usadas = Number(gastadas) || 0;
  return {
    hechas, total, tiendas: tiendas.length,
    // Lo que escribe la gente y no teníamos: pista de qué tiendas interesan
    peticiones: {
      busquedas: Number(busquedas) || 0, // búsquedas escritas desde siempre
      pendientes: peticiones.todas.filter((p) => !p.hecha).length,
      ultimas: peticiones.todas.slice(0, 8).map(({ texto, zona, hecha }) => ({ texto, zona, hecha })),
    },
    places: { mes: mesActual(), usadas, tope: TOPE_PLACES_MES, peorCasoDolares: Math.round(usadas * PRECIO_DETALLE_DOLARES * 100) / 100 },
    ultimo,
  };
}

// Lo que necesita la página pública (sin campos internos), ya listo para pasarlo al navegador
export async function catalogoParaWeb() {
  const { tiendas } = await leerDespensa().catch(() => ({ tiendas: [] }));
  return tiendas.map(({ nombre, localidad, especialidad, porque, precio, puntuacion, fuente, placeId, lat, lon, producto, zona }) =>
    ({ nombre, localidad, especialidad, porque, precio, puntuacion, fuente, placeId, lat, lon, producto, zona }));
}
