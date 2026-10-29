// ============ DESPENSA: BARRIDO GORDO DE TIENDAS (Google Maps) ============
// La IA de la Despensa (lib/despensa.js) encuentra las tiendas con historia: premios, prensa, obradores de pueblo.
// Pero solo saca 5 por producto y comarca. Para que "un buen pan cerca de casa" funcione en cualquier sitio,
// este barrido recorre TODA la provincia en el buscador de Google Maps, cuadrícula a cuadrícula y tipo a tipo de tienda
// (carnicerías, panaderías, queserías, fruterías, mercados de abastos...), con la nota y las reseñas de cada una.
//
// Cómo:
//  · La provincia se parte en cuadrículas de ~15 km. León capital y Ponferrada, en cuadrículas pequeñas (hay más tiendas).
//  · Cada cuadrícula se prueba primero con "tienda de alimentación": si no sale nada de la provincia (código postal 24...),
//    queda fuera 180 días (Asturias, Zamora, Palencia o monte sin tiendas) y no se gasta más ahí.
//  · Cada cuadrícula × tipo de tienda = 1 búsqueda de 20 resultados (hasta 3 páginas si está llena).
//  · Se descartan cadenas y supermercados, lo cerrado, lo que no es de León y lo que tiene mala nota.
//  · Las normas de Google no dejan guardar sus datos más de 30 días: cada tienda se renueva cada 30 días y lo que
//    no se ha renovado en 45 deja de salir.
//
// Coste (Text Search de la API nueva de Places, tarifa de octubre de 2026). Cada tarifa tiene su cupo gratis al mes:
//  · Text Search Enterprise (trae la nota y las reseñas): 1.000 gratis, luego 35 $/1.000. Tope DESPENSA_TOPE_TS_NOTA = 900.
//    Se gastan primero en León capital, el alfoz y las ciudades.
//  · Text Search Pro (lo mismo sin la nota): 5.000 gratis, luego 32 $/1.000. Tope DESPENSA_TOPE_TS = 2.000.
// Una vuelta completa son ~1.500 búsquedas: cabe en los cupos gratis cada mes. Lo normal: 0 €.
// Peor caso si Google no regalase nada: 900 × 0,035 + 2.000 × 0,032 ≈ 95 $ al mes.
import { aObjeto, comando, guardarJSON, leerJSON, varios } from "./almacen";
import { apuntarNovedades } from "./novedades";
import { apuntarCharla } from "./charla";
import { CATEGORIAS, categoriaPorId, notaAjustada } from "./despensaProductos";
import { hoyEnLeon } from "./estadisticas";
import { ZONAS, zonaDe, zonaMasCercana } from "./zonas";

export const TOPE_TS_NOTA_MES = Math.max(0, Number(process.env.DESPENSA_TOPE_TS_NOTA) || 900);
export const TOPE_TS_MES = Math.max(0, Number(process.env.DESPENSA_TOPE_TS) || 2000);
const PRECIO_TS_NOTA = 0.035, PRECIO_TS = 0.032;
const DIAS_RENUEVA = 30; // las normas de Google: sus datos, como mucho 30 días
const DIAS_CADUCA = 45; // lo que no se ha renovado en 45 días deja de salir
const DIAS_FUERA = 180; // una cuadrícula sin tiendas de la provincia no se vuelve a mirar en 6 meses
const POR_PASADA = 120; // búsquedas por pasada (caben de sobra en el minuto de Vercel, 8 a la vez)
const A_LA_VEZ = 8;
const PAGINAS_MAX = 3;
const SONDA = { id: "sonda", busca: "tienda de alimentación" };

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
const redondea = (n, d = 5) => Math.round(n * 10 ** d) / 10 ** d;

function km(a1, o1, a2, o2) {
  const r = Math.PI / 180;
  const x = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

// ---------- 1. Las cuadrículas ----------
const PROVINCIA = { sur: 41.8, norte: 43.45, oeste: -7.35, este: -4.45 };
const CIUDADES = [
  // León capital: 3 × 3 de ~2,6 × 2,7 km. Ponferrada: 2 × 2.
  { id: "leon", sur: 42.565, norte: 42.635, oeste: -5.62, este: -5.52, filas: 3, columnas: 3 },
  { id: "ponf", sur: 42.52, norte: 42.58, oeste: -6.63, este: -6.56, filas: 2, columnas: 2 },
];
// Lo primero que se barre: lo que está cerca de donde vive más gente
const NUCLEOS = [[42.5987, -5.5671], [42.546, -6.596], [42.457, -6.055], [42.299, -5.9], [42.293, -5.517], [42.371, -5.03], [42.94, -6.32], [42.86, -5.13], [42.62, -6.42]];

function trocear({ id, sur, norte, oeste, este, filas, columnas }, prioridadBase) {
  const dLat = (norte - sur) / filas, dLon = (este - oeste) / columnas;
  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const s = sur + f * dLat, o = oeste + c * dLon;
      const centro = [s + dLat / 2, o + dLon / 2];
      const cerca = Math.min(...NUCLEOS.map(([la, lo]) => km(centro[0], centro[1], la, lo)));
      celdas.push({ id: `${id}-${f}-${c}`, sur: redondea(s, 4), norte: redondea(s + dLat, 4), oeste: redondea(o, 4), este: redondea(o + dLon, 4), ciudad: id !== "prov", prioridad: prioridadBase + cerca });
    }
  }
  return celdas;
}

export const CELDAS = [
  ...CIUDADES.flatMap((c) => trocear(c, 0)),
  // Provincia: celdas de 0,135° × 0,18° (~15 × 15 km)
  ...trocear({ id: "prov", ...PROVINCIA, filas: Math.ceil((PROVINCIA.norte - PROVINCIA.sur) / 0.135), columnas: Math.ceil((PROVINCIA.este - PROVINCIA.oeste) / 0.18) }, 1000),
].sort((a, b) => a.prioridad - b.prioridad);

// Lo que toca hacer: primero sondear las cuadrículas de provincia que no se han mirado, luego cada cuadrícula × tipo
// que no se ha hecho en 30 días, de lo más cercano a la gente a lo más lejano.
// hechas: { "celda|categoria": fechaISO } · fuera: { celda: fechaISO }
export function tareasPendientes(hechas = {}, fuera = {}, ahora = Date.now(), cuantas = POR_PASADA) {
  const viejo = (f, dias) => !f || Date.parse(f) < ahora - dias * 86400000;
  const tareas = [];
  for (const c of CELDAS) {
    if (!c.ciudad && !viejo(fuera[c.id], DIAS_FUERA)) continue;
    // Una celda de provincia sin sondear (o con la sonda caducada) solo puede sondearse
    if (!c.ciudad && viejo(hechas[`${c.id}|sonda`], DIAS_FUERA)) { tareas.push({ celda: c, cat: SONDA }); continue; }
    for (const cat of CATEGORIAS) if (viejo(hechas[`${c.id}|${cat.id}`], DIAS_RENUEVA)) tareas.push({ celda: c, cat });
  }
  return tareas.slice(0, cuantas);
}

// ---------- 2. ¿Vale esta ficha de Google? ----------
// Cadenas y súper: no son lo que busca la Despensa
const CADENAS = /\b(mercadona|carrefour|lidl|aldi|dia|eroski|alimerka|gadis|froiz|consum|el arbol|ahorramas|alcampo|hipercor|el corte ingles|spar|coviran|supersol|masymas|bm supermercados|simply|vegalsa|cash fresh|supeco|lupa|hipermercado|supermercado|autoservicio|telepizza|mcdonald|burger king|granier|panaria|rodilla|100 montaditos|primaprix|tiger|amazon|correos|farmacia|gasolinera|repsol|cepsa|galp|bp)\b/;
// Lo que nunca es una tienda de producto aunque salga en la búsqueda
const NO_TIENDA = new Set(["supermarket", "hypermarket", "convenience_store", "gas_station", "department_store", "shopping_mall", "restaurant", "bar", "pub", "hotel", "lodging", "pharmacy", "drugstore", "fast_food_restaurant", "pizza_restaurant", "hamburger_restaurant", "night_club", "warehouse_store", "discount_store"]);

const codigoPostal = (p) => (p?.addressComponents || []).find((c) => (c.types || []).includes("postal_code"))?.longText || "";
const localidadDe = (p) => {
  const comp = p?.addressComponents || [];
  const de = (tipo) => comp.find((c) => (c.types || []).includes(tipo))?.longText;
  return de("locality") || de("postal_town") || de("administrative_area_level_3") || de("administrative_area_level_2") || "";
};
// Nota con la que se ordena una tienda de Google Maps (1 a 10): su nota ajustada por reseñas; sin nota, un 6
export const puntuacionGoogle = (t) => (Number.isFinite(t.nota) && t.resenas >= 5 ? Math.round(notaAjustada(t.nota, t.resenas) * 20) / 10 : 6);

// ¿Es de la provincia de León? Código postal 24xxx (o, sin código, que la dirección diga León y esté dentro del mapa)
export function esDeLeon(p) {
  const lat = Number(p?.location?.latitude), lon = Number(p?.location?.longitude);
  const cp = codigoPostal(p);
  if (cp) return cp.startsWith("24");
  return / leon\b/.test(` ${normalizar(p?.formattedAddress)}`) && lat > PROVINCIA.sur && lat < PROVINCIA.norte && lon > PROVINCIA.oeste && lon < PROVINCIA.este;
}

// Devuelve la tienda lista para guardar, o null si no vale. cat: una de CATEGORIAS.
export function tiendaDeGoogle(p, cat, hoy = new Date().toISOString()) {
  const nombre = String(p?.displayName?.text || "").trim();
  const lat = Number(p?.location?.latitude), lon = Number(p?.location?.longitude);
  if (!p?.id || !nombre || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return null;
  if (!esDeLeon(p)) return null;
  const n = normalizar(nombre);
  if (CADENAS.test(n)) return null;
  const tipos = Array.isArray(p.types) ? p.types : [];
  if (NO_TIENDA.has(p.primaryType)) return null;
  // Que sea de verdad de ese tipo: lo dice el nombre o lo dice Google
  if (!cat.nombres.some((t) => ` ${n} `.includes(normalizar(t)) || n.includes(normalizar(t))) && !cat.tipos.some((t) => tipos.includes(t))) return null;
  const nota = Number(p.rating), resenas = Number(p.userRatingCount) || 0;
  const conNota = Number.isFinite(nota) && nota > 0;
  if (conNota && resenas >= 5 && notaAjustada(nota, resenas) < 3.6) return null;
  const localidad = localidadDe(p);
  return {
    placeId: p.id,
    nombre: nombre.slice(0, 80),
    localidad: localidad.slice(0, 60),
    direccion: String(p.formattedAddress || "").replace(/, España$/, "").slice(0, 120),
    lat: redondea(lat), lon: redondea(lon),
    nota: conNota ? nota : null, resenas: conNota ? resenas : 0,
    cats: [cat.id],
    zona: zonaDeTienda(lat, lon, localidad),
    f: hoy,
    ...(conNota ? { fn: hoy } : {}),
  };
}

function zonaDeTienda(lat, lon, localidad) {
  const z = zonaDe({ lat, lon, localidad });
  return ZONAS.some((x) => x.id === z) ? z : zonaMasCercana(lat, lon);
}

// Junta lo que ya había con lo nuevo: suma los tipos de tienda y conserva la nota si aún es válida (menos de 30 días)
export function unirFicha(vieja, nueva, ahora = Date.now()) {
  if (!vieja) return nueva;
  const cats = [...new Set([...(vieja.cats || []), ...(nueva.cats || [])])];
  const notaVieja = vieja.fn && Date.parse(vieja.fn) > ahora - DIAS_RENUEVA * 86400000;
  if (nueva.nota == null && notaVieja) return { ...nueva, cats, nota: vieja.nota, resenas: vieja.resenas, fn: vieja.fn };
  return { ...nueva, cats };
}

// ---------- 3. Las búsquedas en Google ----------
const claveMaps = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY || "";
const mesActual = () => hoyEnLeon().slice(0, 7);
const claveGastoNota = () => `despensa:tsNota:${mesActual()}`;
const claveGasto = () => `despensa:ts:${mesActual()}`;
const claveHechas = "despensa:g:hechas";
const claveFuera = "despensa:g:fuera";
const claveZona = (zona) => `despensa:g:${zona}`;
const CAMPOS = "places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents,places.businessStatus,places.primaryType,places.types,nextPageToken";
const CAMPOS_NOTA = `${CAMPOS},places.rating,places.userRatingCount`;

// Gasta una búsqueda del tope del mes de una tarifa. true si cabía.
async function gastar(clave, tope) {
  const usadas = Number(await comando(["INCRBY", clave, 1]));
  if (usadas === 1) await comando(["EXPIRE", clave, 40 * 86400]);
  return usadas <= tope;
}
const CON_NOTA = { campos: CAMPOS_NOTA, clave: claveGastoNota, tope: () => TOPE_TS_NOTA_MES };
const SIN_NOTA = { campos: CAMPOS, clave: claveGasto, tope: () => TOPE_TS_MES };

// La tarifa de una tarea: con nota mientras quede cupo (la sonda nunca: solo cuenta tiendas); si no, sin nota; si no, null
async function elegirTarifa(quiereNota) {
  if (quiereNota && await gastar(CON_NOTA.clave(), CON_NOTA.tope())) return CON_NOTA;
  if (await gastar(SIN_NOTA.clave(), SIN_NOTA.tope())) return SIN_NOTA;
  return null;
}

async function buscarEnMaps(celda, cat, campos, pageToken) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": claveMaps(), "X-Goog-FieldMask": campos },
    body: JSON.stringify({
      textQuery: cat.busca,
      languageCode: "es", regionCode: "es", pageSize: 20,
      locationRestriction: { rectangle: { low: { latitude: celda.sur, longitude: celda.oeste }, high: { latitude: celda.norte, longitude: celda.este } } },
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places ${res.status} ${String(datos?.error?.message || "").slice(0, 120)}`);
  return datos;
}

// Una cuadrícula × tipo de tienda: hasta 3 páginas. Devuelve { tiendas, llamadas, brutos, enProvincia, sinCupo }
// La sonda no guarda nada: solo cuenta si hay negocios de la provincia en esa cuadrícula.
async function hacerTarea({ celda, cat }) {
  const hoy = new Date().toISOString();
  const sonda = cat.id === "sonda";
  const tiendas = [];
  let pageToken = null, llamadas = 0, brutos = 0, enProvincia = 0;
  const tarifa = await elegirTarifa(!sonda);
  if (!tarifa) return { tiendas, llamadas, brutos, enProvincia, sinCupo: true };
  for (let pagina = 0; pagina < (sonda ? 1 : PAGINAS_MAX); pagina++) {
    // Las páginas siguientes piden los mismos campos y gastan de la misma tarifa; si se acaba, se para ahí
    if (pagina > 0 && !(await gastar(tarifa.clave(), tarifa.tope()))) break;
    const d = await buscarEnMaps(celda, cat, tarifa.campos, pageToken);
    llamadas++;
    for (const p of d.places || []) {
      brutos++;
      if (esDeLeon(p)) enProvincia++;
      const t = sonda ? null : tiendaDeGoogle(p, cat, hoy);
      if (t) tiendas.push(t);
    }
    pageToken = d.nextPageToken;
    if (!pageToken || (d.places || []).length < 20) break;
  }
  return { tiendas, llamadas, brutos, enProvincia };
}

// Dónde está un sitio ("Plaza Mayor, Boñar"): 1 búsqueda sin nota (la usan los mercadillos). null si no hay cupo o no es de León.
export async function ubicarEnMaps(texto) {
  if (!claveMaps() || !(await gastar(SIN_NOTA.clave(), SIN_NOTA.tope()))) return null;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": claveMaps(), "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents" },
    body: JSON.stringify({ textQuery: `${texto}, León, España`, languageCode: "es", regionCode: "es", pageSize: 1, locationRestriction: { rectangle: { low: { latitude: PROVINCIA.sur, longitude: PROVINCIA.oeste }, high: { latitude: PROVINCIA.norte, longitude: PROVINCIA.este } } } }),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places ${res.status} ${String(datos?.error?.message || "").slice(0, 120)}`);
  const p = datos.places?.[0];
  if (!p || !esDeLeon(p)) return null;
  return { placeId: p.id, lat: redondea(Number(p.location.latitude)), lon: redondea(Number(p.location.longitude)), nombre: String(p.displayName?.text || ""), localidad: localidadDe(p) };
}

// ---------- 4. La pasada ----------
export async function barrerTiendas({ cuantas = POR_PASADA } = {}) {
  const inicio = Date.now();
  if (!claveMaps()) return { saltado: "Falta GOOGLE_MAPS_API_KEY" };
  const [hechas, fuera] = await Promise.all([comando(["HGETALL", claveHechas]).then(aObjeto), comando(["HGETALL", claveFuera]).then(aObjeto)]);
  const toca = tareasPendientes(hechas, fuera, inicio, cuantas);
  if (!toca.length) return { fin: new Date().toISOString(), segundos: 0, tareas: 0, nada: "Todo al día: se renueva cada 30 días" };

  const resultados = [];
  let siguiente = 0, sinCupo = false, error = null;
  const trabajador = async () => {
    // No se empieza una tarea nueva pasados 28 s: una tarea son hasta 3 páginas de 8 s como mucho, y hay que guardar antes del minuto
    while (siguiente < toca.length && !sinCupo && Date.now() - inicio < 28000) {
      const t = toca[siguiente++];
      try {
        const r = await hacerTarea(t);
        if (r.sinCupo) sinCupo = true;
        resultados.push({ ...t, ...r });
      } catch (e) {
        error = String(e.message).slice(0, 160);
        // Si Google bloquea la clave, no tiene sentido seguir
        if (/Places 40[03]/.test(error)) sinCupo = true;
      }
    }
  };
  await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador));

  // Guardar: por zona, uniendo con lo que ya había
  const nuevas = resultados.flatMap((r) => r.tiendas);
  const porZona = {};
  for (const t of nuevas) (porZona[t.zona] ||= new Map()).set(t.placeId, unirFicha(porZona[t.zona].get(t.placeId), t));
  const zonas = Object.keys(porZona);
  const viejas = zonas.length ? await varios(zonas.map((z) => ["HGETALL", claveZona(z)])) : [];
  const escribir = [], estrenos = [];
  zonas.forEach((z, i) => {
    const antes = aObjeto(viejas[i]);
    const campos = [];
    for (const [id, t] of porZona[z]) {
      if (!antes[id]) estrenos.push({ tipo: "tienda", titulo: t.nombre, localidad: t.localidad, quien: "despensa-tiendas" });
      let vieja = null;
      try { vieja = antes[id] ? JSON.parse(antes[id]) : null; } catch { /* rota */ }
      campos.push(id, JSON.stringify(unirFicha(vieja, t)));
    }
    if (campos.length) escribir.push(["HSET", claveZona(z), ...campos]);
  });
  // Marcar lo hecho (solo lo que terminó entero) y las cuadrículas que caen fuera de la provincia
  const hoy = new Date().toISOString();
  const marcas = [], fueras = [];
  for (const r of resultados) {
    if (r.sinCupo) continue;
    marcas.push(`${r.celda.id}|${r.cat.id}`, hoy);
    if (r.cat.id === "sonda" && !r.enProvincia) fueras.push(r.celda.id, hoy);
  }
  if (marcas.length) escribir.push(["HSET", claveHechas, ...marcas]);
  if (fueras.length) escribir.push(["HSET", claveFuera, ...fueras]);
  if (escribir.length) await varios(escribir);
  if (estrenos.length) {
    await apuntarNovedades(estrenos).catch(() => null);
    await apuntarCharla([{ de: "despensa-tiendas", a: "jefe", tipo: "nuevos", texto: `He dado de alta ${estrenos.length === 1 ? "una tienda nueva" : `${estrenos.length} tiendas nuevas`} de Google Maps: ${estrenos.slice(0, 2).map((t) => t.titulo).join(" y ")}.` }]).catch(() => null);
  }

  const informe = {
    fin: hoy,
    segundos: Math.round((Date.now() - inicio) / 1000),
    tareas: resultados.length,
    llamadas: resultados.reduce((s, r) => s + r.llamadas, 0),
    tiendas: new Set(nuevas.map((t) => t.placeId)).size,
    fuera: fueras.length / 2,
    ...(sinCupo ? { sinCupo: true } : {}),
    ...(error ? { error } : {}),
    muestra: resultados.filter((r) => r.cat.id !== "sonda").slice(0, 12).map((r) => ({ celda: r.celda.id, cat: r.cat.id, encontradas: r.brutos, guardadas: r.tiendas.length })),
  };
  await guardarJSON("despensa:g:ultimo", informe);
  return informe;
}

// ---------- 5. Leer ----------
// Las tiendas de Google de unas zonas (todas si no se dice), sin las caducadas
export async function leerTiendasGoogle(zonas = ZONAS.map((z) => z.id)) {
  const res = await varios(zonas.map((z) => ["HGETALL", claveZona(z)])).catch(() => []);
  const limite = Date.now() - DIAS_CADUCA * 86400000;
  const tiendas = [];
  for (const lista of res || []) {
    for (const v of Object.values(aObjeto(lista))) {
      let t = null;
      try { t = JSON.parse(v); } catch { continue; }
      if (!t?.f || Date.parse(t.f) < limite) continue;
      // La nota de Google, solo si tiene menos de 30 días
      if (t.fn && Date.parse(t.fn) < Date.now() - DIAS_RENUEVA * 86400000) { t.nota = null; t.resenas = 0; }
      tiendas.push(t);
    }
  }
  return tiendas;
}

// Las zonas que pueden tener tiendas a menos de `radio` km de un punto
export function zonasCerca(lat, lon, radio) {
  if (radio >= 100) return ZONAS.map((z) => z.id);
  const ids = ZONAS.filter((z) => {
    const [la, lo] = z.centroReal || [z.lat, z.lon];
    return km(lat, lon, la, lo) <= radio + (z.id === "leon" ? 10 : 45);
  }).map((z) => z.id);
  const propia = zonaMasCercana(lat, lon);
  return ids.includes(propia) ? ids : [...ids, propia];
}

export async function resumenTiendas() {
  const [hechas, fuera, gastos, ultimo, porZona] = await Promise.all([
    comando(["HGETALL", claveHechas]).then(aObjeto).catch(() => ({})),
    comando(["HGETALL", claveFuera]).then(aObjeto).catch(() => ({})),
    Promise.all([comando(["GET", claveGastoNota()]), comando(["GET", claveGasto()])]).catch(() => [0, 0]),
    leerJSON("despensa:g:ultimo").catch(() => null),
    leerTiendasGoogle().catch(() => []),
  ]);
  const ahora = Date.now();
  const total = tareasPendientes({}, {}, ahora, 1e6).length; // sin saber qué cae fuera: el máximo posible
  const pendientes = tareasPendientes(hechas, fuera, ahora, 1e6).length;
  const conNota = Math.min(Number(gastos[0]) || 0, TOPE_TS_NOTA_MES), sinNota = Number(gastos[1]) || 0;
  const porCat = {};
  for (const t of porZona) for (const c of t.cats || []) porCat[c] = (porCat[c] || 0) + 1;
  return {
    tiendas: porZona.length,
    conNota: porZona.filter((t) => t.nota != null).length,
    porCategoria: CATEGORIAS.map((c) => ({ id: c.id, nombre: categoriaPorId(c.id).nombre, n: porCat[c.id] || 0 })),
    pendientes, total, celdasFuera: Object.keys(fuera).length,
    google: { mes: mesActual(), conNota, topeNota: TOPE_TS_NOTA_MES, sinNota, tope: TOPE_TS_MES, peorCasoDolares: Math.round((conNota * PRECIO_TS_NOTA + sinNota * PRECIO_TS) * 100) / 100 },
    ultimo,
  };
}
