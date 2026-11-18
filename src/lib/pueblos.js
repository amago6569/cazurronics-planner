// ============ EL PUEBLO QUE SE ESCRIBE ============
// Quien escribe «cuevas en Sahelices de Sabero» quiere el plan allí, aunque el mapa siga en León (el punto que sale de serie).
// Si el texto nombra un pueblo de la provincia que queda fuera del radio, el plan se centra en ese pueblo.
// Sin IA ni Google: una lista fija de municipios y parajes. 0 € y sin llamadas.
import { MUNICIPIOS } from "./pueblosDatos";
import { RUTAS, PARAJES } from "./rutas";

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

// «En León» casi siempre quiere decir la provincia: solo cuenta como la capital si se dice claro
const CAPITAL = /\b(?:leon capital|ciudad de leon|centro de leon|capital leonesa)\b/;
// Nombres que también son palabras («pescar truchas»): solo cuentan detrás de «en»
const AMBIGUOS = new Set(["truchas", "matanza", "cuadros", "sobrado", "carrocera", "turcia", "balboa", "sancedo", "vallecillo"]);

// Municipios + pueblos y parajes de las listas de rutas y parajes (Sahelices de Sabero, Valporquero de Torío...)
const LUGARES = (() => {
  const vistos = new Map();
  const poner = (nombre, lat, lon) => {
    const k = normalizar(nombre);
    if (k.length >= 4 && k !== "leon" && !vistos.has(k)) vistos.set(k, { nombre, lat, lon, k });
  };
  for (const [n, la, lo] of MUNICIPIOS) poner(n, la, lo);
  for (const r of [...PARAJES, ...RUTAS]) {
    if (r.zona) poner(r.zona, r.lat, r.lon);
    poner(r.nombre, r.lat, r.lon); // «excursión a Las Médulas», «ir a la Cueva de Valdelajo»
  }
  return [...vistos.values()].sort((a, b) => b.k.length - a.k.length);
})();

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PREP = "(?:en|por|a|hacia|hasta|desde|cerca de|junto a|al lado de|alrededor de|alrededores de|zona de|por la zona de|escapada a|ir a)";

// El pueblo de la provincia que nombra el texto ({ nombre, lat, lon }) o null.
// «en Sahelices de Sabero» encuentra Sahelices de Sabero; «en Cofiñal de Puebla de Lillo», al menos el municipio.
export function puebloEnTexto(texto) {
  const t = ` ${normalizar(texto)} `;
  if (CAPITAL.test(t)) return { nombre: "León", lat: 42.5987, lon: -5.5671 };
  let mejor = null;
  for (const l of LUGARES) {
    const prep = AMBIGUOS.has(l.k) ? "en" : PREP;
    const directo = new RegExp(` ${prep} (?:el |la |los |las )?${esc(l.k)} `);
    // Una pedanía que no está en la lista, pero sí su municipio: «en Sahelices de Sabero» → Sabero
    const pedania = new RegExp(` ${prep} (?:[a-zñ]+ ){1,3}(?:de|del) (?:la |el |los |las )?${esc(l.k)} `);
    const m = t.match(directo) || (AMBIGUOS.has(l.k) ? null : t.match(pedania));
    // El que antes aparece en el texto; a igualdad, el nombre más largo (la lista ya va de largo a corto)
    if (m && (!mejor || m.index < mejor.pos)) mejor = { pos: m.index, l };
  }
  return mejor ? { nombre: mejor.l.nombre, lat: mejor.l.lat, lon: mejor.l.lon } : null;
}

const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111.2, (lo1 - lo2) * 111.2 * Math.cos((la1 * Math.PI) / 180));

// Si el texto nombra un pueblo que queda fuera del radio del mapa, la petición pasa a ese pueblo.
// Devuelve { peticion, pueblo } (pueblo = null si no cambia nada). El radio se queda como estaba (mínimo 10 km).
export function centrarEnPueblo(peticion) {
  const pueblo = puebloEnTexto(peticion?.apetece);
  if (!pueblo) return { peticion, pueblo: null };
  const radio = Number(peticion.radio) || 15;
  if (km(Number(peticion.lat), Number(peticion.lon), pueblo.lat, pueblo.lon) <= radio) return { peticion, pueblo: null };
  return { peticion: { ...peticion, lat: pueblo.lat, lon: pueblo.lon, radio: Math.max(radio, 10) }, pueblo };
}
