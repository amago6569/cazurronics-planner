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
    .filter((t) => { const k = t.placeId || `${t.nombre}|${t.localidad}`; if (vistas.has(k)) return false; vistas.add(k); return true; })
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
