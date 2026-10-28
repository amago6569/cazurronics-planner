// ============ SOLO LA PROVINCIA DE LEÓN ============
// Cazurronics solo hace planes en León capital y provincia. Lo de fuera (Zamora, Asturias, Palencia...)
// se para ANTES de llamar a la IA o a Google: así no se gasta ni un céntimo en planes que no tocan.
// Funciones puras: valen en el servidor y en el navegador.

// Frontera de la provincia simplificada (153 puntos, [lat, lon]). Fuente: límites provinciales de
// click_that_hood (Code for Germany), a partir de datos del IGN. Error de 1-2 km en el borde: por eso el margen.
const FRONTERA = [[43.238,-4.894],[43.19,-4.839],[43.173,-4.852],[43.157,-4.835],[43.126,-4.851],[43.103,-4.833],[43.047,-4.734],[43.019,-4.738],[42.987,-4.795],[42.93,-4.809],[42.892,-4.856],[42.861,-4.866],[42.863,-4.898],[42.785,-4.896],[42.756,-4.936],[42.721,-4.916],[42.708,-4.872],[42.67,-4.9],[42.624,-4.895],[42.555,-4.916],[42.537,-4.888],[42.451,-4.9],[42.436,-4.924],[42.425,-4.905],[42.401,-4.914],[42.386,-4.903],[42.374,-4.973],[42.338,-4.984],[42.342,-4.941],[42.297,-4.953],[42.297,-5.038],[42.258,-5.053],[42.309,-5.094],[42.312,-5.112],[42.264,-5.183],[42.273,-5.236],[42.24,-5.254],[42.227,-5.226],[42.215,-5.241],[42.211,-5.266],[42.23,-5.287],[42.199,-5.307],[42.225,-5.361],[42.221,-5.388],[42.13,-5.372],[42.09,-5.39],[42.041,-5.376],[42.032,-5.439],[42.052,-5.481],[42.104,-5.527],[42.099,-5.543],[42.056,-5.561],[42.065,-5.578],[42.051,-5.587],[42.077,-5.589],[42.082,-5.635],[42.107,-5.62],[42.142,-5.668],[42.138,-5.687],[42.12,-5.677],[42.113,-5.743],[42.137,-5.755],[42.136,-5.777],[42.111,-5.845],[42.156,-5.897],[42.141,-5.912],[42.142,-5.948],[42.124,-5.953],[42.16,-6.049],[42.166,-6.16],[42.148,-6.212],[42.178,-6.294],[42.207,-6.313],[42.202,-6.428],[42.182,-6.498],[42.203,-6.526],[42.213,-6.72],[42.236,-6.735],[42.254,-6.784],[42.299,-6.741],[42.359,-6.734],[42.406,-6.844],[42.427,-6.814],[42.453,-6.823],[42.469,-6.808],[42.491,-6.823],[42.489,-6.86],[42.521,-6.932],[42.518,-6.96],[42.493,-6.979],[42.508,-7.077],[42.529,-7.06],[42.554,-7.07],[42.584,-7.034],[42.597,-7.05],[42.633,-7.047],[42.643,-7.004],[42.695,-7.045],[42.724,-7.011],[42.725,-6.973],[42.755,-6.959],[42.741,-6.936],[42.787,-6.867],[42.823,-6.84],[42.874,-6.871],[42.882,-6.834],[42.874,-6.835],[42.871,-6.815],[42.914,-6.848],[42.901,-6.777],[42.883,-6.772],[42.917,-6.723],[42.922,-6.69],[42.92,-6.49],[42.94,-6.433],[42.964,-6.434],[42.968,-6.473],[42.991,-6.478],[42.988,-6.424],[42.999,-6.408],[43.017,-6.411],[43.017,-6.394],[43.038,-6.397],[43.06,-6.359],[43.031,-6.326],[43.036,-6.285],[43.009,-6.227],[43.047,-6.216],[43.048,-6.178],[43.021,-6.137],[43.031,-6.097],[43.076,-6.082],[43.055,-6.02],[43.065,-5.975],[43.019,-5.957],[42.993,-5.915],[42.963,-5.804],[42.97,-5.764],[43.043,-5.728],[43.056,-5.693],[43.023,-5.57],[43.021,-5.494],[43.055,-5.479],[43.049,-5.39],[43.095,-5.369],[43.077,-5.282],[43.084,-5.217],[43.115,-5.148],[43.102,-5.102],[43.182,-5.076],[43.173,-4.997],[43.212,-4.964],[43.238,-4.894]];

// Lo que está a menos de esto del borde cuenta como dentro (la frontera es aproximada)
const MARGEN_KM = 2;

const KM_GRADO = 111.32;
const COS_LAT = Math.cos(42.6 * Math.PI / 180);

// Punto en polígono (rayo hacia el este)
function dentroDelPoligono(lat, lon) {
  let dentro = false;
  for (let i = 0, j = FRONTERA.length - 1; i < FRONTERA.length; j = i++) {
    const [la1, lo1] = FRONTERA[i], [la2, lo2] = FRONTERA[j];
    if ((la1 > lat) !== (la2 > lat) && lon < ((lo2 - lo1) * (lat - la1)) / (la2 - la1) + lo1) dentro = !dentro;
  }
  return dentro;
}

// Distancia en km del punto al borde (plano local: a esta escala sobra)
function kmAlBorde(lat, lon) {
  let min = Infinity;
  const x = lon * COS_LAT * KM_GRADO, y = lat * KM_GRADO;
  for (let i = 0, j = FRONTERA.length - 1; i < FRONTERA.length; j = i++) {
    const x1 = FRONTERA[j][1] * COS_LAT * KM_GRADO, y1 = FRONTERA[j][0] * KM_GRADO;
    const x2 = FRONTERA[i][1] * COS_LAT * KM_GRADO, y2 = FRONTERA[i][0] * KM_GRADO;
    const dx = x2 - x1, dy = y2 - y1;
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return min;
}

// ¿Está este punto en la provincia de León? (con el margen del borde)
export function enProvinciaLeon(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < 41.9 || la > 43.35 || lo < -7.2 || lo > -4.6) return false; // fuera de la caja: ni se mira
  return dentroDelPoligono(la, lo) || kmAlBorde(la, lo) <= MARGEN_KM;
}

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

// Sitios de fuera que la gente puede pedir. Solo cuentan si van detrás de "en", "a", "por", "cerca de"...
// ("un plan en Zamora" sí; "ver al Real Madrid" o "sidra como en Asturias" no).
// Ojo con los que chocan con León: "Valencia" (de Don Juan), "Santiago" (Millas, el Camino), "Toro", "Cuenca" (minera).
const FUERA = [
  // Vecinas y sus pueblos más pedidos
  "zamora", "benavente", "sanabria", "puebla de sanabria", "lago de sanabria",
  "palencia", "guardo", "aguilar de campoo", "cervera de pisuerga", "velilla del rio carrion",
  "asturias", "oviedo", "gijon", "aviles", "mieres", "pola de lena", "cangas de onis", "covadonga", "lagos de covadonga", "llanes", "ribadesella",
  "cantabria", "santander", "potes",
  "galicia", "lugo", "ourense", "orense", "a coruna", "la coruna", "coruna", "santiago de compostela", "vigo", "pontevedra", "o barco", "o barco de valdeorras", "valdeorras",
  "valladolid", "medina de rioseco", "burgos", "salamanca", "segovia", "avila", "soria",
  // Resto de España
  "madrid", "barcelona", "bilbao", "vitoria", "san sebastian", "donostia", "pamplona", "navarra", "logrono", "la rioja",
  "zaragoza", "huesca", "teruel", "sevilla", "cordoba", "malaga", "granada", "cadiz", "huelva", "jaen", "almeria",
  "murcia", "alicante", "castellon", "toledo", "albacete", "guadalajara", "badajoz", "caceres", "extremadura", "andalucia",
  "cataluna", "girona", "tarragona", "lleida", "mallorca", "ibiza", "menorca", "tenerife", "canarias", "las palmas",
  // Fuera de España
  "portugal", "braganza", "braganca", "oporto", "porto", "lisboa", "francia", "paris", "londres", "roma", "andorra",
];
const ANTES = "(?:en|a|por|hacia|hasta|para ir a|cerca de|junto a|al lado de|alrededor de|alrededores de|zona de|provincia de|ciudad de|viaje a|escapada a)";
const PATRON_FUERA = new RegExp(` ${ANTES} (?:el |la |los |las )?(${[...FUERA].sort((a, b) => b.length - a.length).join("|")}) `);
// "Valencia" sola es la de fuera; "Valencia de Don Juan" es de León
const PATRON_VALENCIA = new RegExp(` ${ANTES} valencia (?!de don juan)`);

// Si el texto pide un plan en un sitio de fuera de León, devuelve su nombre (bonito); si no, null
export function sitioFueraEnTexto(texto) {
  // "como en Asturias" habla de cómo es, no de dónde: eso no cuenta
  const t = ` ${normalizar(texto)} `.replace(/ como (?:en|a|por) /g, " como ");
  const m = t.match(PATRON_FUERA);
  if (m) return m[1].replace(/\b\w/g, (c) => c.toUpperCase());
  if (PATRON_VALENCIA.test(t)) return "Valencia";
  return null;
}

// ¿Este nombre de localidad es de fuera? ("Benavente" sí; "Valencia de Don Juan" o "Astorga" no)
const SET_FUERA = new Set([...FUERA, "valencia"]);
export const esSitioDeFuera = (nombre) => SET_FUERA.has(normalizar(nombre));

// Mensajes para la persona (los mismos en planes, retoques y Despensa)
export const AVISO_MAPA = "Cazurronics solo hace planes en León capital y provincia 🦁 Mueve el punto del mapa dentro de la provincia y te montamos el planazo.";
export const avisoSitio = (sitio) => `Lo nuestro es León 🦁 Solo hacemos planes en León capital y provincia, así que ${sitio} se nos escapa. Prueba con un sitio de la provincia.`;
