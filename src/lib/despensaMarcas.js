// ============ DESPENSA: PRODUCTORES DE LEÓN Y DÓNDE SE VENDE LO SUYO ============
// Hay productores muy buenos que Google Maps no enseña bien: una fábrica en un pueblo no sale como tienda, y en las
// tiendas que venden su producto nadie lo dice en las reseñas. Aquí se apuntan a mano: el productor (con su venta en
// fábrica) y las tiendas de la provincia que tienen lo suyo. Así, quien pide "una buena morcilla" cerca de una de esas
// tiendas, se entera de que allí hay morcilla de Morvega.
//  · Si alguien pide lo que hace el productor (morcilla) y uno de sus sitios está en su radio, ese sitio sale el
//    primero (decisión de Alejandro, 2026-10-24). Si no hay ninguno en el radio, sale otra buena como siempre.
//  · Solo comercio de León: las cadenas de supermercados no se apuntan (tampoco salen en el resto de la Despensa).
//  · Cada sitio se ubica una vez en Google Maps (1 búsqueda sin nota, de las 5.000 gratis al mes) y se renueva a los
//    30 días. Se comprueba que el nombre que devuelve Google es el que buscamos. Hoy: 6 sitios = 6 búsquedas al mes, 0 €.
import { aObjeto, comando, varios } from "./almacen";
import { ubicarEnMaps } from "./despensaTiendas";

const CLAVE = "despensa:marcas";
const DIAS_VALE = 30;
const DIAS_REINTENTO = 7; // si Google no lo encontró, se vuelve a probar a la semana

// clave: lo que tiene que salir en el nombre que da Google (si no, la búsqueda ha dado con otro sitio)
export const MARCAS = [
  {
    id: "morvega",
    nombre: "Morcillas Morvega",
    pueblo: "Sahelices de Sabero",
    web: "https://www.morcillasmorvega.com",
    productos: ["morcilla", "embutidos", "cecina"],
    especialidades: ["morcilla de León", "morcilla en tarro con cecina, Cabrales o Valdeón", "chorizo", "cecina"],
    fabrica: { busca: "Morcillas Morvega, Sahelices de Sabero", clave: "morvega", localidad: "Sahelices de Sabero" },
    tiendas: [
      { nombre: "Patatas Marcos", busca: "Patatas Marcos, León", clave: "patatas marcos" },
      { nombre: "Rúa Selecta", busca: "Rúa Selecta tienda gourmet, León", clave: "selecta" },
      { nombre: "Serranillo", busca: "Serranillo, León", clave: "serranillo" },
      { nombre: "La Casa del Embutido", busca: "La Casa del Embutido, León", clave: "casa del embutido" },
      { nombre: "El Contenedor de Quesos", busca: "Contenedor de quesos, León", clave: "contenedor" },
    ],
  },
];

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const sitiosDe = (m) => [{ ...m.fabrica, nombre: m.nombre, fabrica: true }, ...m.tiendas];

// ¿El sitio que ha dado Google es el que buscábamos?
export const esElSitio = (sitio, encontrado) => Boolean(encontrado?.placeId) && normalizar(encontrado.nombre).includes(normalizar(sitio.clave));

// Ubica en Google Maps los sitios que faltan o tienen más de 30 días. Lo llama la pasada de fichas (lib/despensaFichas.js).
export async function ubicarMarcas(ahora = Date.now()) {
  const guardados = await leerSitiosMarcas();
  const tocan = MARCAS.flatMap(sitiosDe).filter((s) => {
    const g = guardados[s.busca];
    return !g || Date.parse(g.f) < ahora - (g.placeId ? DIAS_VALE : DIAS_REINTENTO) * 86400000;
  });
  if (!tocan.length) return { ubicados: 0, fallidos: 0 };
  const hoy = new Date(ahora).toISOString();
  const res = await Promise.allSettled(tocan.map((s) => ubicarEnMaps(s.busca)));
  const nuevos = [];
  res.forEach((r, i) => {
    const s = tocan[i];
    // Si Google da otro sitio (o ninguno), se apunta vacío para no repetir la búsqueda cada noche
    const bueno = r.status === "fulfilled" && esElSitio(s, r.value) ? r.value : null;
    nuevos.push([s.busca, JSON.stringify(bueno ? { placeId: bueno.placeId, lat: bueno.lat, lon: bueno.lon, localidad: bueno.localidad || "", f: hoy } : { f: hoy })]);
  });
  await varios([["HSET", CLAVE, ...nuevos.flat()]]);
  const fuera = tocan.filter((s, i) => !nuevos[i][1].includes("placeId")).map((s) => s.nombre);
  return { ubicados: nuevos.length - fuera.length, fallidos: fuera.length, ...(fuera.length ? { sinEncontrar: fuera } : {}) };
}

// Para el panel: cuántos sitios de cada productor están ubicados y cuáles no encuentra Google
export function estadoMarcas(sitios, marcas = MARCAS) {
  return marcas.map((m) => {
    const todos = sitiosDe(m);
    return { nombre: m.nombre, ubicados: todos.filter((s) => sitios?.[s.busca]?.placeId).length, total: todos.length, sinEncontrar: todos.filter((s) => sitios?.[s.busca] && !sitios[s.busca].placeId).map((s) => s.nombre) };
  });
}

export async function leerSitiosMarcas() {
  const res = await comando(["HGETALL", CLAVE]).catch(() => null);
  const sitios = {};
  for (const [k, v] of Object.entries(aObjeto(res))) { try { sitios[k] = JSON.parse(v); } catch { /* rota: se repite */ } }
  return sitios;
}

// Lo que sabe la Despensa gracias a los productores:
//  · fichas: a las tiendas que ya conoce (de Google Maps) se les añade "morcilla Morvega" a lo que son conocidas
//  · extra: las que no conoce (y la fábrica, si no la conoce), como tiendas nuevas
//  · primero: placeId → { producto que, si se pide, pone ese sitio el primero; marca; texto para el motivo }
export function aplicarMarcas(deGoogle, fichas, sitios, marcas = MARCAS) {
  const conocidas = new Set((deGoogle || []).map((t) => t.placeId));
  const nuevasFichas = { ...fichas };
  const extra = [];
  const primero = new Map();
  for (const m of marcas) {
    const lo = `${m.productos[0]} ${m.nombre.replace(/^Morcillas /, "")} (de ${m.pueblo})`;
    for (const s of sitiosDe(m)) {
      const u = sitios?.[s.busca];
      if (!u?.placeId) continue;
      const especialidades = s.fabrica ? m.especialidades : [lo];
      const porque = s.fabrica ? `Fábrica con venta directa de ${m.nombre} en ${m.pueblo}` : `Aquí venden ${m.nombre}, de ${m.pueblo}`;
      primero.set(u.placeId, { producto: m.productos[0], marca: m.nombre, texto: porque });
      if (conocidas.has(u.placeId)) {
        const f = fichas?.[u.placeId] || {};
        nuevasFichas[u.placeId] = { ...f, especialidades: [...new Set([...especialidades, ...(f.especialidades || [])])].slice(0, 6), destaca: f.destaca || porque, premios: f.premios || [] };
        continue;
      }
      extra.push({
        nombre: s.nombre, localidad: u.localidad || s.localidad || "León", lat: u.lat, lon: u.lon, placeId: u.placeId, nota: null, resenas: 0,
        producto: m.productos[0], productoNombre: s.fabrica ? "Productor" : "Tienda", productos: m.productos,
        especialidad: especialidades.join(", "), porque, premios: [], precio: null,
        puntuacion: s.fabrica ? 7.5 : 7, fuente: m.web,
      });
    }
  }
  return { fichas: nuevasFichas, extra, primero };
}
