// ============ DESPENSA DE LEÓN: la parte que también usa el navegador ============
// Productos, el top 3 y el enlace a Google Maps. Sin almacén ni IA: funciones puras.

export const PRODUCTOS = [
  { id: "cecina", nombre: "Cecina", emoji: "🥩", busca: "cecina de vacuno: cecineros, charcuterías y tiendas de producto leonés que la venden" },
  { id: "embutidos", nombre: "Chorizo y embutido", emoji: "🌭", busca: "chorizo, salchichón, lomo y embutido artesano: fábricas con tienda, charcuterías y carnicerías que lo elaboran" },
  { id: "morcilla", nombre: "Morcilla", emoji: "🥘", busca: "morcilla de León (de arroz y cebolla, ahumada): carnicerías, charcuterías y fábricas con tienda que la elaboran" },
  { id: "botillo", nombre: "Botillo", emoji: "🐖", busca: "botillo del Bierzo y botillo artesano: quién lo elabora y lo vende" },
  { id: "quesos", nombre: "Quesos", emoji: "🧀", busca: "quesos artesanos: queserías con venta directa y tiendas especializadas en queso" },
  { id: "pan", nombre: "Pan artesano", emoji: "🥖", busca: "pan artesano, de masa madre o de horno de leña: panaderías y hornos" },
  { id: "empanadas", nombre: "Empanadas", emoji: "🥟", busca: "empanadas caseras: hornos, panaderías y confiterías famosas por sus empanadas" },
  { id: "dulces", nombre: "Mantecadas y dulces", emoji: "🧁", busca: "mantecadas, hojaldres, nicanores, imperiales, merles y dulces típicos leoneses: obradores y confiterías tradicionales" },
  { id: "pasteles", nombre: "Pastelerías", emoji: "🍰", busca: "pastelerías y confiterías artesanas: tartas, pasteles y bollería" },
  { id: "chocolate", nombre: "Chocolate", emoji: "🍫", busca: "chocolate artesano: chocolateros y obradores con tienda" },
  { id: "vino", nombre: "Vino", emoji: "🍷", busca: "vino de León (DO León, DO Bierzo, Prieto Picudo, Mencía, Albarín): bodegas con venta directa y vinotecas" },
  { id: "cerveza", nombre: "Cerveza artesana", emoji: "🍺", busca: "cerveza artesana leonesa: cerveceras con venta directa y tiendas de cerveza" },
  { id: "miel", nombre: "Miel", emoji: "🍯", busca: "miel y productos de la colmena de apicultores locales con venta directa o tiendas que la venden" },
  { id: "legumbres", nombre: "Legumbres", emoji: "🫘", busca: "legumbres de León (alubia de La Bañeza-León, lenteja pardina, garbanzo): productores, ultramarinos y tiendas a granel" },
  { id: "pimientos", nombre: "Pimientos y conservas", emoji: "🫑", busca: "pimiento asado del Bierzo y conservas artesanas: productores y tiendas" },
  { id: "carne", nombre: "Carnicerías", emoji: "🍖", busca: "carnicerías con carne de calidad (ternera, lechazo, cordero, cabrito)" },
  { id: "pescado", nombre: "Pescaderías", emoji: "🐟", busca: "pescaderías con buen pescado y marisco fresco" },
  { id: "fruta", nombre: "Fruta y verdura", emoji: "🍎", busca: "fruterías y fruta local (manzana reineta y pera conferencia del Bierzo, cerezas, tomate de Mansilla): fruterías y productores" },
];
const POR_ID = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]));

// Tipos de tienda que se barren en Google Maps (lib/despensaTiendas.js), con los productos que se compran en cada una.
//  · busca: lo que se escribe en el buscador de Google Maps.
//  · nombres: trozos del nombre que confirman el tipo (normalizados, sin tildes). tipos: tipos de Google que también valen.
export const CATEGORIAS = [
  { id: "carniceria", nombre: "Carnicería", busca: "carnicería", nombres: ["carnic", "carnes", "embutid", "chacin", "cecin"], tipos: ["butcher_shop"], productos: ["carne", "morcilla", "embutidos", "cecina", "botillo"] },
  { id: "charcuteria", nombre: "Charcutería", busca: "charcutería embutidos cecina", nombres: ["charcut", "embutid", "chacin", "cecin", "jamon", "iberic", "matanza"], tipos: ["deli", "butcher_shop"], productos: ["embutidos", "cecina", "morcilla", "botillo", "quesos"] },
  { id: "panaderia", nombre: "Panadería", busca: "panadería horno de pan", nombres: ["panad", "horno", "pan ", "masa madre", "obrador", "tahona"], tipos: ["bakery"], productos: ["pan", "empanadas"] },
  { id: "pasteleria", nombre: "Pastelería", busca: "pastelería confitería", nombres: ["pastel", "confit", "dulce", "obrador", "reposter", "mantecad", "hojaldr"], tipos: ["bakery", "confectionery", "pastry_shop", "dessert_shop"], productos: ["pasteles", "dulces", "empanadas", "chocolate"] },
  { id: "queseria", nombre: "Quesería", busca: "quesería tienda de quesos", nombres: ["queso", "queser", "lacteo"], tipos: ["cheese_shop"], productos: ["quesos"] },
  { id: "fruteria", nombre: "Frutería", busca: "frutería verdulería", nombres: ["frut", "verdur", "hortal", "huerta"], tipos: [], productos: ["fruta", "pimientos"] },
  { id: "pescaderia", nombre: "Pescadería", busca: "pescadería", nombres: ["pescad", "marisc", "pescado"], tipos: [], productos: ["pescado"] },
  { id: "vinos", nombre: "Vinos y bodegas", busca: "vinoteca tienda de vinos bodega", nombres: ["vino", "vinot", "bodeg", "enotec", "licor", "cervec", "cerveza"], tipos: ["liquor_store", "winery"], productos: ["vino", "cerveza"] },
  { id: "tipicos", nombre: "Productos de León", busca: "tienda de productos típicos leoneses ultramarinos delicatessen", nombres: ["tipic", "ultramar", "delicat", "gourmet", "despensa", "colmado", "producto", "leones", "tierra", "granel", "miel", "legumbr"], tipos: ["deli", "food_store", "grocery_store"], productos: ["cecina", "embutidos", "quesos", "legumbres", "pimientos", "miel", "dulces", "vino"] },
  { id: "mercado", nombre: "Mercado", busca: "mercado de abastos", nombres: ["mercado", "abastos", "plaza de abastos"], tipos: ["market", "farmers_market"], productos: ["fruta", "pescado", "carne", "quesos", "pan", "embutidos"] },
];
// Nota de Google ajustada por el número de reseñas (bayesiana): un 5,0 con 3 reseñas no gana a un 4,7 con 300
export const notaAjustada = (nota, resenas) => (resenas * nota + 30 * 4.4) / (resenas + 30);
const CAT_POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
export const categoriaPorId = (id) => CAT_POR_ID[id] || null;
// Las categorías donde se compra un producto ("morcilla" → carnicería, charcutería, mercado)
export const categoriasDeProducto = (producto) => CATEGORIAS.filter((c) => c.productos.includes(producto)).map((c) => c.id);
export const productoPorId = (id) => POR_ID[id] || null;

function km(a1, o1, a2, o2) {
  const r = Math.PI / 180;
  const x = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

// El top de un producto. presupuesto: "ajustado" (fuera los caprichos) · "capricho" (primero los caprichos) · otra cosa = da igual
export function topTiendas(tiendas, { producto, lat, lon, radio, presupuesto, cuantas = 3 } = {}) {
  const conCentro = Number.isFinite(lat) && Number.isFinite(lon);
  const vistas = new Set();
  return (tiendas || [])
    .filter((t) => t.producto === producto)
    .filter((t) => presupuesto !== "ajustado" || t.precio !== "capricho")
    .map((t) => ({ ...t, km: conCentro && Number.isFinite(t.lat) ? Math.round(km(lat, lon, t.lat, t.lon) * 10) / 10 : null }))
    .filter((t) => !conCentro || !(radio > 0) || (t.km != null && t.km <= radio))
    .sort((a, b) => {
      if (presupuesto === "capricho" && a.precio !== b.precio) return a.precio === "capricho" ? -1 : 1;
      // A igual nota, primero calidad-precio (salvo que pida capricho)
      return b.puntuacion - a.puntuacion || Number(a.precio === "capricho") - Number(b.precio === "capricho") || (a.km ?? 0) - (b.km ?? 0);
    })
    // Sin repetir: ni la misma ficha ni dos locales con el mismo nombre en el mismo pueblo (sucursales)
    .filter((t) => {
      const ks = [t.placeId, `${t.nombre}|${t.localidad}`.toLowerCase()].filter(Boolean);
      if (ks.some((k) => vistas.has(k))) return false;
      ks.forEach((k) => vistas.add(k));
      return true;
    })
    .slice(0, cuantas);
}

// Enlace a la ficha de Google Maps (gratis: no llama a ninguna API)
export function enlaceMaps(t) {
  const q = encodeURIComponent(`${t.nombre}, ${t.localidad}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}${t.placeId ? `&query_place_id=${encodeURIComponent(t.placeId)}` : ""}`;
}

// Ruta en Google Maps por varias tiendas (gratis: es un enlace, no llama a ninguna API).
// Ordena las paradas yendo siempre a la más cercana desde donde estás. Máximo 4 paradas:
// en el móvil Google Maps solo admite 3 intermedias más el destino.
export const MAX_PARADAS = 4;
export function rutaMaps(tiendas, origen) {
  let quedan = (tiendas || []).filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)).slice(0, MAX_PARADAS);
  if (quedan.length < 2) return null;
  const orden = [];
  let aqui = origen && Number.isFinite(origen.lat) ? origen : quedan[0];
  while (quedan.length) {
    const sig = quedan.reduce((a, b) => (km(aqui.lat, aqui.lon, b.lat, b.lon) < km(aqui.lat, aqui.lon, a.lat, a.lon) ? b : a));
    orden.push(sig);
    quedan = quedan.filter((t) => t !== sig);
    aqui = sig;
  }
  const sitio = (t) => `${t.nombre}, ${t.localidad}`;
  const destino = orden[orden.length - 1];
  const intermedias = orden.slice(0, -1);
  const p = new URLSearchParams({ api: "1", travelmode: "driving", destination: sitio(destino) });
  if (origen && Number.isFinite(origen.lat)) p.set("origin", `${origen.lat},${origen.lon}`);
  if (destino.placeId) p.set("destination_place_id", destino.placeId);
  p.set("waypoints", intermedias.map(sitio).join("|"));
  if (intermedias.every((t) => t.placeId)) p.set("waypoint_place_ids", intermedias.map((t) => t.placeId).join("|"));
  return { url: `https://www.google.com/maps/dir/?${p}`, paradas: orden };
}
