// ============ RUTAS PARA IR CUALQUIER DÍA ============
// Parajes conocidos de la provincia más las rutas señalizadas de OpenStreetMap (rutasDatos.js), para que quien pide caminar
// no acabe en una carrera o en un sitio inventado. Solo se añaden a la petición cuando se pide algo así y solo las más
// cercanas: sin llamadas nuevas a la IA ni a Google. Coordenadas aproximadas.
import { RUTAS_OSM } from "./rutasDatos";
import { slug } from "./nombres";

export const RUTAS = [
  { nombre: "Monte San Isidro", zona: "León", lat: 42.633, lon: -5.598 },
  { nombre: "Parque de La Candamia", zona: "León", lat: 42.596, lon: -5.549 },
  { nombre: "Faedo de Ciñera", zona: "Ciñera de Gordón", lat: 42.884, lon: -5.634 },
  { nombre: "Hoces de Vegacervera", zona: "Vegacervera", lat: 42.904, lon: -5.539 },
  { nombre: "Hoces de Valdeteja", zona: "Valdeteja", lat: 42.93, lon: -5.4 },
  { nombre: "Cascada de Nocedo", zona: "Nocedo de Curueño", lat: 42.888, lon: -5.402 },
  { nombre: "Lago de Isoba", zona: "Puebla de Lillo", lat: 43.04, lon: -5.31 },
  { nombre: "Ruta del Cares", zona: "Caín de Valdeón", lat: 43.214, lon: -4.905 },
  { nombre: "Senda del Arcediano", zona: "Oseja de Sajambre", lat: 43.14, lon: -5.03 },
  { nombre: "Las Médulas", zona: "Carucedo", lat: 42.46, lon: -6.77 },
  { nombre: "Valle del Silencio", zona: "Peñalba de Santiago", lat: 42.428, lon: -6.548 },
  { nombre: "Lago de Truchillas", zona: "Truchillas", lat: 42.27, lon: -6.44 },
];
export const TODAS_LAS_RUTAS = [
  ...RUTAS.map((r) => ({ ...r, destacada: true, tipo: "a" })),
  ...RUTAS_OSM.map(([nombre, lat, lon, tipo]) => ({ nombre, lat, lon, tipo })),
];

const quitarTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PIDE_RUTA = /\b(?:caminar|caminata|andar|senderismo|sendero|senda|ruta|rutas|excursion|naturaleza|montana|bici|mtb|btt|mountain)/;
const PIDE_BICI = /\b(?:bici|mtb|btt|mountain|ciclis)/;
// "Ruta de tapas" no es salir a caminar; "ruta por la montaña y comer tapas" sí, por eso solo se quita esa expresión
const RUTA_DE_COMER = /\brutas? (?:(?:de|del|por)(?: los| las| la| el)? )?(?:tapas?|tapeo|pinchos?|vinos?|bar|bares|cervezas?|copas?|bodegas?|gastronomicas?)\b/g;

// Distancia sencilla en km (aquí no hace falta más precisión, y así este archivo no depende de planUtils)
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111.2, (lo1 - lo2) * 111.2 * Math.cos((la1 * Math.PI) / 180));

// ¿La parada es una ruta de la lista? Así una ruta real que Google no tiene como sitio no se descarta
export function rutaConocida(titulo) {
  const t = slug(titulo);
  if (!t) return null;
  return TODAS_LAS_RUTAS.find((r) => { const n = slug(r.nombre); return n.length >= 8 && t.includes(n); }) || null;
}

// Las más cercanas al punto elegido, solo si se pide salir a caminar o en bici. Primero un par de las conocidas.
export function rutasParaPrompt(apetece, lat, lon, radio, cuantas = 8) {
  const pide = ` ${quitarTildes(apetece).replace(RUTA_DE_COMER, " ")} `;
  if (!PIDE_RUTA.test(pide)) return "";
  const tipo = PIDE_BICI.test(pide) ? "b" : "a";
  const cerca = TODAS_LAS_RUTAS.filter((r) => r.tipo === tipo || (tipo === "b" && r.destacada))
    .map((r) => ({ ...r, km: km(lat, lon, r.lat, r.lon) }))
    .filter((r) => r.km <= Number(radio) * 1.1)
    .sort((a, b) => a.km - b.km);
  const conocidas = cerca.filter((r) => r.destacada).slice(0, 3);
  const lista = [...conocidas, ...cerca.filter((r) => !r.destacada)].slice(0, cuantas);
  if (!lista.length) return "";
  return `RUTAS REALES QUE SE PUEDEN HACER CUALQUIER DÍA (tipo "ruta"; usa este nombre tal cual en el título): ${lista.map((r) => (r.zona ? `${r.nombre} (${r.zona})` : r.nombre)).join(", ")}. Si pide caminar, una ruta o naturaleza, elige de aquí salvo que la agenda tenga una ruta guiada que encaje. Una marcha o una carrera de la agenda solo si la pide.`;
}
