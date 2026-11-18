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
// Cuevas, cascadas, miradores, lagos y visitas de los pueblos que la IA casi no conoce (Alejandro, 18-11-2026: «que no le
// estamos dando visibilidad bien a los pueblos»). Van al plan como tipo "parque". Coordenadas aproximadas: Google Places
// pone las de verdad; si Google no lo tiene, se usan estas. Para añadir uno, una línea aquí.
export const PARAJES = [
  { nombre: "Cueva de Valdelajo", zona: "Sahelices de Sabero", lat: 42.818, lon: -5.165, que: "cueva con visita guiada, con reserva por teléfono" },
  { nombre: "Cueva de Valporquero", zona: "Valporquero de Torío", lat: 42.904, lon: -5.553, que: "cueva con visita guiada" },
  { nombre: "Cueva de Llamazares", zona: "Llamazares", lat: 42.968, lon: -5.37, que: "cueva con visita guiada, con reserva" },
  { nombre: "Museo de la Siderurgia y la Minería de Castilla y León", zona: "Sabero", lat: 42.836, lon: -5.149, que: "museo minero" },
  { nombre: "Museo de la Fauna Salvaje", zona: "Valdehuesa", lat: 42.85, lon: -5.27, que: "museo de naturaleza" },
  { nombre: "Chorco de los Lobos", zona: "Cofiñal", lat: 43.06, lon: -5.33, que: "trampa de lobos antigua en el monte" },
  { nombre: "Embalse de Riaño", zona: "Riaño", lat: 42.975, lon: -5.0, que: "embalse entre montañas, miradores" },
  { nombre: "Mirador de Orellán", zona: "Orellán", lat: 42.468, lon: -6.775, que: "mirador sobre Las Médulas" },
  { nombre: "Lago de Carucedo", zona: "Carucedo", lat: 42.49, lon: -6.76, que: "lago" },
  { nombre: "Castro de Chano", zona: "Chano", lat: 42.86, lon: -6.66, que: "castro prerromano visitable" },
  { nombre: "Monasterio de San Miguel de Escalada", zona: "San Miguel de Escalada", lat: 42.572, lon: -5.3, que: "monasterio mozárabe" },
  { nombre: "Monasterio de Santa María de Carracedo", zona: "Carracedo del Monasterio", lat: 42.557, lon: -6.731, que: "monasterio" },
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

// Quien pide salir a caminar o en bici quiere una ruta, no apuntarse a una prueba: esas no se le ofrecen a la IA,
// salvo que las pida. Sin esto, la regla de la agenda ("si encaja, DEBE incluirlo") ganaba a la lista de rutas.
const PIDE_PRUEBA = /\b(?:marcha|carrera|cross|trail|maraton|duatlon|triatlon|torneo|competicion|prueba|evento|guiada|guiadas)/;
const ES_PRUEBA = /\b(?:marcha|carrera|cross|trail|maraton|media maraton|duatlon|triatlon|\d+ ?k)\b/;
export function agendaParaRutas(agenda, apetece) {
  const pide = ` ${quitarTildes(apetece).replace(RUTA_DE_COMER, " ")} `;
  if (!PIDE_RUTA.test(pide) || PIDE_PRUEBA.test(pide)) return agenda;
  return agenda.filter((e) => !ES_PRUEBA.test(quitarTildes(e?.titulo)));
}

// Distancia sencilla en km (aquí no hace falta más precisión, y así este archivo no depende de planUtils)
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111.2, (lo1 - lo2) * 111.2 * Math.cos((la1 * Math.PI) / 180));

// ¿La parada es una ruta o un paraje de la lista? Así uno real que Google no tiene como sitio no se descarta
export function rutaConocida(titulo) {
  const t = slug(titulo);
  if (!t) return null;
  return [...PARAJES, ...TODAS_LAS_RUTAS].find((r) => { const n = slug(r.nombre); return n.length >= 8 && t.includes(n); }) || null;
}

// Los parajes cercanos al punto del plan (sin pedir nada concreto: cualquier plan que no sea solo comer o beber).
// Unos 20 tokens por paraje y solo los del radio: el coste de la IA casi no cambia.
export function parajesParaPrompt(lat, lon, radio, cuantos = 6) {
  const cerca = PARAJES.map((p) => ({ ...p, km: km(lat, lon, p.lat, p.lon) }))
    .filter((p) => p.km <= Number(radio) * 1.1)
    .sort((a, b) => a.km - b.km)
    .slice(0, cuantos);
  if (!cerca.length) return "";
  return `SITIOS NATURALES Y VISITAS DE LOS PUEBLOS DE LA ZONA (reales; tipo "parque", o "museo" si es un museo; usa este nombre tal cual en el título): ${cerca.map((p) => `${p.nombre} (${p.zona}; ${p.que})`).join(", ")}. Si pide una cueva, naturaleza, algo que ver o un plan por esa zona, propón el que encaje.`;
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
  return `RUTAS REALES QUE SE PUEDEN HACER CUALQUIER DÍA (tipo "ruta"; usa este nombre tal cual en el título): ${lista.map((r) => (r.zona ? `${r.nombre} (${r.zona})` : r.nombre)).join(", ")}. Si pide caminar, una ruta o naturaleza en general, elige de aquí salvo que la agenda tenga una ruta guiada que encaje. Si pide algo concreto (una cueva, una cascada, un mirador, un lago, un museo), dale eso y no una ruta. Una marcha o una carrera de la agenda solo si la pide.`;
}
