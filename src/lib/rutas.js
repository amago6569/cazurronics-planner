// ============ RUTAS PARA IR CUALQUIER DÍA ============
// Rutas y parajes conocidos de la provincia, para que quien pide caminar no acabe en una carrera o en un sitio inventado.
// Solo se añaden a la petición cuando se pide algo así: sin llamadas nuevas a la IA ni a Google. Después, como todas las
// paradas, se comprueban en Google (enriquecerParada): si Google no conoce una, no sale. Coordenadas aproximadas.
import { haversineKm } from "./planUtils";

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

const quitarTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PIDE_RUTA = /\b(?:caminar|caminata|andar|senderismo|sendero|senda|ruta|rutas|excursion|naturaleza|montana|bici|mtb|btt|mountain)/;

// Las más cercanas al punto elegido, solo si se pide salir a caminar o en bici
export function rutasParaPrompt(apetece, lat, lon, radio, cuantas = 6) {
  if (!PIDE_RUTA.test(` ${quitarTildes(apetece)} `)) return "";
  const cerca = RUTAS.map((r) => ({ ...r, km: haversineKm(lat, lon, r.lat, r.lon) }))
    .filter((r) => r.km <= Number(radio) * 1.1)
    .sort((a, b) => a.km - b.km)
    .slice(0, cuantas);
  if (!cerca.length) return "";
  return `RUTAS REALES QUE SE PUEDEN HACER CUALQUIER DÍA (tipo "ruta"; usa este nombre tal cual en el título): ${cerca.map((r) => `${r.nombre} (${r.zona})`).join(", ")}. Si pide caminar, una ruta o naturaleza, elige de aquí salvo que la agenda tenga una ruta guiada que encaje. Una marcha o una carrera de la agenda solo si la pide.`;
}
