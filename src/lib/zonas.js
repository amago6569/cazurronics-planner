// ============ ZONAS DE LA PROVINCIA ============
// La agenda se ordena por zonas para no mezclar lo de Ponferrada con lo de la Plaza Mayor.
// Funciones puras: valen en el servidor (barrido) y en el navegador (mapa de la agenda).
//  · ZONAS: León capital + 8 comarcas, con su punto en el mapa y sus pueblos.
//  · zonaDe(evento): a qué zona pertenece un evento (por municipio, por sitio o por coordenadas).

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

// lat/lon = dónde va la burbuja en el mapa (separadas para que no se pisen); centroReal = centro de verdad de la comarca
export const ZONAS = [
  {
    id: "leon", nombre: "León capital", corto: "León", emoji: "🦁", lat: 42.5987, lon: -5.5671,
    pueblos: ["leon", "leon capital", "leon ciudad", "ciudad de leon"],
    pistas: "aytoleon.es, leon.es (Turismo), Auditorio Ciudad de León, Teatro El Albéitar, Espacio Vías, MUSAC, Museo de León, Palacio del Conde Luna, Catedral, San Isidoro, Casa Botines, Barrio Húmedo y Barrio Romántico, Diario de León, Leonoticias, iLeón",
  },
  {
    id: "alfoz", nombre: "Alrededores de León", corto: "Alfoz", emoji: "🏘️", lat: 42.74, lon: -5.8, centroReal: [42.61, -5.6],
    pueblos: ["san andres del rabanedo", "trobajo del camino", "trobajo del cerecedo", "villaquilambre", "navatejera", "villaobispo de las regueras", "villaobispo", "valverde de la virgen", "la virgen del camino", "virgen del camino", "sariegos", "carbajal de la legua", "azadinos", "santovenia de la valdoncina", "villaturiel", "onzonilla", "vilecha", "chozas de abajo", "garrafe de torio", "vegas del condado", "puente castro", "armunia", "oteruelo"],
    pistas: "ayuntamientos de San Andrés del Rabanedo, Villaquilambre, Valverde de la Virgen, Sariegos, Santovenia de la Valdoncina y Villaturiel; Diario de León (alfoz)",
  },
  {
    id: "bierzo", nombre: "El Bierzo", corto: "Bierzo", emoji: "🍒", lat: 42.62, lon: -6.65, centroReal: [42.58, -6.6],
    pueblos: ["el bierzo", "bierzo", "ponferrada", "villafranca del bierzo", "bembibre", "cacabelos", "camponaraya", "toreno", "fabero", "carucedo", "las medulas", "molinaseca", "priaranza del bierzo", "carracedelo", "arganza", "cubillos del sil", "columbrianos", "congosto", "folgoso de la ribera", "iguena", "noceda del bierzo", "paramo del sil", "puente de domingo florez", "sobrado", "trabadelo", "vega de valcarce", "villadecanes", "toral de los vados", "balboa", "borrenes", "corullon", "san roman de bembibre", "fuentes nuevas"],
    pistas: "Ayuntamiento de Ponferrada, Teatro Bergidum, Castillo de los Templarios, Consejo Comarcal del Bierzo, Diario de León (Bierzo), InfoBierzo, El Bierzo Digital, Bierzo Noticias",
  },
  {
    id: "astorga", nombre: "Astorga, Maragatería y Órbigo", corto: "Astorga", emoji: "🍫", lat: 42.48, lon: -6.12, centroReal: [42.46, -6.0],
    pueblos: ["astorga", "maragateria", "castrillo de los polvazares", "santa colomba de somoza", "rabanal del camino", "val de san lorenzo", "lucillo", "luyego", "hospital de orbigo", "villares de orbigo", "veguellina de orbigo", "benavides", "benavides de orbigo", "turcia", "carrizo", "carrizo de la ribera", "villarejo de orbigo", "santa marina del rey", "san justo de la vega", "brazuelo", "santiago millas", "villagaton", "quintana del castillo", "magaz de cepeda", "villamejil", "el ganso", "foncebadon", "murias de rechivaldo", "llamas de la ribera", "cimanes del tejar", "valderrey"],
    pistas: "Ayuntamiento de Astorga, Teatro Gullón, Palacio de Gaudí, Museo del Chocolate, ayuntamientos del Órbigo (Hospital de Órbigo, Carrizo), Astorga Redacción, El Faro Astorgano",
  },
  {
    id: "baneza", nombre: "La Bañeza, Páramo y Cabrera", corto: "La Bañeza", emoji: "🏍️", lat: 42.22, lon: -5.85, centroReal: [42.28, -5.92],
    pueblos: ["la baneza", "baneza", "la bañeza", "bañeza", "santa maria del paramo", "laguna de negrillos", "soto de la vega", "santa elena de jamuz", "jimenez de jamuz", "alija del infantado", "villazala", "riego de la vega", "destriana", "castrocontrigo", "truchas", "encinedo", "la cabrera", "cabrera", "palacios de la valduerna", "roperuelos del paramo", "bustillo del paramo", "urdiales del paramo", "valdefuentes del paramo", "zotes del paramo", "pobladura de pelayo garcia", "regueras de arriba", "quintana del marco", "cebrones del rio", "san adrian del valle", "santa maria de la isla", "villamontan de la valduerna", "laguna dalga"],
    pistas: "Ayuntamiento de La Bañeza, Teatro Municipal de La Bañeza, Santa María del Páramo, La Cabrera, La Bañeza Hoy, Diario de León",
  },
  {
    id: "esla", nombre: "Valencia de Don Juan y el Esla", corto: "Esla", emoji: "🏰", lat: 42.25, lon: -5.4, centroReal: [42.32, -5.45],
    pueblos: ["valencia de don juan", "coyanza", "mansilla de las mulas", "valderas", "villamanan", "villamañan", "gordoncillo", "ardon", "cabreros del rio", "fresno de la vega", "toral de los guzmanes", "cimanes de la vega", "campazas", "castrofuerte", "villaquejida", "algadefe", "villabraz", "fuentes de carbajal", "villademor de la vega", "santas martas", "mansilla mayor", "villasabariego", "corbillos de los oteros", "valdevimbre", "pajares de los oteros", "gusendos de los oteros", "izagre", "san millan de los caballeros", "villanueva de las manzanas", "los oteros"],
    pistas: "Ayuntamiento de Valencia de Don Juan, Castillo de Coyanza, Mansilla de las Mulas, Museo Etnográfico Provincial, Valderas, bodegas DO León (Valdevimbre, Gordoncillo)",
  },
  {
    id: "sahagun", nombre: "Sahagún y Tierra de Campos", corto: "Sahagún", emoji: "🌾", lat: 42.4, lon: -5.02, centroReal: [42.38, -5.05],
    pueblos: ["sahagun", "grajal de campos", "cea", "almanza", "el burgo ranero", "gordaliza del pino", "joarilla de las matas", "villamol", "calzada del coto", "bercianos del real camino", "escobar de campos", "saelices del rio", "vallecillo", "villazanzo de valderaduey", "canalejas", "cebanico", "la vega de almanza", "valdepolo", "santa cristina de valmadrigal", "villamartin de don sancho", "castrotierra de valmadrigal", "villamoratiel de las matas", "galleguillos de campos", "el burgo", "tierra de campos"],
    pistas: "Ayuntamiento de Sahagún, Grajal de Campos, Camino de Santiago, Diario de León (Sahagún y Tierra de Campos)",
  },
  {
    id: "oriental", nombre: "Montaña de Riaño, Picos y Cistierna", corto: "Riaño", emoji: "🏔️", lat: 42.92, lon: -5.1, centroReal: [42.88, -5.15],
    pueblos: ["riano", "riaño", "cistierna", "bonar", "boñar", "posada de valdeon", "valdeon", "sabero", "puebla de lillo", "buron", "cremenes", "oseja de sajambre", "sajambre", "vegaquemada", "prioro", "valderrueda", "acebedo", "marana", "maraña", "picos de europa", "la vecilla", "valdepielago", "cubillas de rueda", "gradefes", "boca de huergano", "reyero", "valdelugueros", "santa colomba de curueno", "la ercina"],
    pistas: "Riaño, Cistierna, Boñar, Valdeón (Picos de Europa), Sabero (Museo de la Siderurgia), Puebla de Lillo, estación de San Isidro, Diario de León (Montaña)",
  },
  {
    id: "occidental", nombre: "Laciana, Babia, Luna y Gordón", corto: "Babia", emoji: "🌲", lat: 42.93, lon: -6.05, centroReal: [42.88, -5.95],
    pueblos: ["villablino", "laciana", "babia", "san emiliano", "cabrillanes", "los barrios de luna", "barrios de luna", "la pola de gordon", "pola de gordon", "la robla", "villamanin", "murias de paredes", "riello", "omana", "omaña", "soto y amio", "carrocera", "palacios del sil", "rioscuro", "caboalles", "caboalles de abajo", "matallana de torio", "vegacervera", "carmenes", "la magdalena", "ciñera", "cinera", "busdongo", "vegarienza", "sena de luna", "villasecino", "valle de laciana", "ancares", "candin", "vega de espinareda", "peranzanes"],
    pistas: "Ayuntamiento de Villablino, Babia, Luna, La Pola de Gordón, La Robla, Cuevas de Valporquero (Vegacervera), Laciana 7 días, Diario de León (Montaña)",
  },
];


// Los ayuntamientos (municipios) de la provincia, por zona. Los usa el barrido gordo,
// que va municipio a municipio, y ayudan a saber de qué zona es cada evento.
export const MUNICIPIOS = {
  alfoz: ["San Andrés del Rabanedo", "Villaquilambre", "Valverde de la Virgen", "Sariegos", "Santovenia de la Valdoncina", "Onzonilla", "Villaturiel", "Chozas de Abajo", "Cuadros", "Garrafe de Torío", "Valdefresno", "Vegas del Condado", "Villasabariego", "Mansilla Mayor", "Ardón", "Vega de Infanzones", "Villadangos del Páramo"],
  bierzo: ["Ponferrada", "Bembibre", "Villafranca del Bierzo", "Cacabelos", "Camponaraya", "Carracedelo", "Cubillos del Sil", "Toreno", "Fabero", "Molinaseca", "Arganza", "Balboa", "Barjas", "Benuza", "Berlanga del Bierzo", "Borrenes", "Cabañas Raras", "Candín", "Carucedo", "Castropodame", "Congosto", "Corullón", "Folgoso de la Ribera", "Igüeña", "Noceda del Bierzo", "Oencia", "Páramo del Sil", "Palacios del Sil", "Peranzanes", "Priaranza del Bierzo", "Puente de Domingo Flórez", "Sancedo", "Sobrado", "Toral de los Vados", "Torre del Bierzo", "Trabadelo", "Vega de Espinareda", "Vega de Valcarce", "Villadecanes"],
  occidental: ["Villablino", "Cabrillanes", "San Emiliano", "Sena de Luna", "Los Barrios de Luna", "Riello", "Murias de Paredes", "Valdesamario", "Las Omañas", "Soto y Amío", "Carrocera", "Santa María de Ordás", "La Pola de Gordón", "Villamanín", "La Robla", "Cármenes", "Vegacervera", "Matallana de Torío", "Rioseco de Tapia"],
  oriental: ["Riaño", "Boca de Huérgano", "Burón", "Crémenes", "Cistierna", "Boñar", "La Ercina", "Valdepiélago", "Valdelugueros", "La Vecilla", "Puebla de Lillo", "Posada de Valdeón", "Oseja de Sajambre", "Acebedo", "Maraña", "Prioro", "Valderrueda", "Sabero", "Prado de la Guzpeña", "Gradefes", "Cubillas de Rueda", "Santa Colomba de Curueño", "Reyero", "Vegaquemada"],
  sahagun: ["Sahagún", "Grajal de Campos", "Joarilla de las Matas", "Gordaliza del Pino", "Escobar de Campos", "Galleguillos de Campos", "Villamol", "Calzada del Coto", "Bercianos del Real Camino", "El Burgo Ranero", "Villamartín de Don Sancho", "Castrotierra de Valmadrigal", "Santa Cristina de Valmadrigal", "Villamoratiel de las Matas", "Villazanzo de Valderaduey", "Vallecillo", "Valdepolo", "Cebanico", "Almanza", "Cea", "Canalejas", "Saelices del Río", "Villaselán", "La Vega de Almanza", "Santa María del Monte de Cea"],
  esla: ["Valencia de Don Juan", "Mansilla de las Mulas", "Valderas", "Villamañán", "Gordoncillo", "Cabreros del Río", "Fresno de la Vega", "Toral de los Guzmanes", "Matanza", "Cimanes de la Vega", "Campazas", "Castrofuerte", "Villaquejida", "Algadefe", "Villabraz", "Fuentes de Carbajal", "Villademor de la Vega", "Santas Martas", "Corbillos de los Oteros", "Valdevimbre", "Pajares de los Oteros", "Gusendos de los Oteros", "Izagre", "San Millán de los Caballeros", "Villanueva de las Manzanas", "Matadeón de los Oteros", "Villaornate y Castro", "Valverde-Enrique", "Castilfalé", "Cubillas de los Oteros", "Campo de Villavidel", "Villacé", "Valdemora"],
  baneza: ["La Bañeza", "Santa María del Páramo", "Laguna de Negrillos", "Soto de la Vega", "Santa Elena de Jamuz", "Quintana y Congosto", "Jiménez de Jamuz", "Alija del Infantado", "Villazala", "Riego de la Vega", "Destriana", "Castrocontrigo", "Truchas", "Encinedo", "Castrillo de Cabrera", "Palacios de la Valduerna", "Roperuelos del Páramo", "Bustillo del Páramo", "Urdiales del Páramo", "Valdefuentes del Páramo", "Zotes del Páramo", "Pobladura de Pelayo García", "Regueras de Arriba", "Quintana del Marco", "Cebrones del Río", "San Adrián del Valle", "Santa María de la Isla", "Villamontán de la Valduerna", "La Antigua", "Laguna Dalga", "Bercianos del Páramo", "San Pedro Bercianos", "Castrocalbón", "San Esteban de Nogales", "Pozuelo del Páramo", "San Cristóbal de la Polantera"],
  astorga: ["Astorga", "Santa Colomba de Somoza", "Santiago Millas", "Val de San Lorenzo", "Lucillo", "Luyego", "Brazuelo", "Villagatón", "Quintana del Castillo", "Magaz de Cepeda", "Villamejil", "Villaobispo de Otero", "San Justo de la Vega", "Valderrey", "Villares de Órbigo", "Hospital de Órbigo", "Villarejo de Órbigo", "Benavides", "Turcia", "Carrizo", "Llamas de la Ribera", "Cimanes del Tejar", "Santa Marina del Rey"],
};
for (const z of ZONAS) if (MUNICIPIOS[z.id]) z.pueblos = [...new Set([...z.pueblos, ...MUNICIPIOS[z.id].map((m) => m.toLowerCase())])];

// Nombres de pueblo que también son palabras corrientes: en el TÍTULO de un evento no cuentan ("Matanza tradicional")
const PALABRAS_CORRIENTES = new Set(["matanza", "cuadros", "la antigua", "cea", "sobrado", "turcia", "carrizo", "balboa", "la robla", "reyero", "prioro", "candin", "cabrera", "la cabrera"]);

export const ZONA_INICIAL = "leon";
export const TODAS = "todas";
const POR_ID = Object.fromEntries(ZONAS.map((z) => [z.id, z]));
export const zonaPorId = (id) => POR_ID[id] || null;

function km(a1, o1, a2, o2) {
  const r = Math.PI / 180;
  const x = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

// Busca un pueblo de alguna zona dentro de un texto (palabras completas). La capital no cuenta aquí:
// "León" aparece en casi todo ("provincia de León") y no dice nada.
const TABLA = ZONAS.filter((z) => z.id !== "leon")
  .flatMap((z) => z.pueblos.map((p) => [normalizar(p), z.id]))
  .sort((a, b) => b[0].length - a[0].length); // primero los nombres largos ("villafranca del bierzo" antes que "bierzo")
// Nombres de comarca: valen en el municipio o el sitio, pero no en el título ("Cata de vinos del Bierzo" puede ser en la capital)
const COMARCAS = new Set(["bierzo", "el bierzo", "maragateria", "laciana", "valle de laciana", "babia", "omana", "omaña", "ancares", "tierra de campos", "picos de europa", "la cabrera", "cabrera", "los oteros"].map(normalizar));
function pueblaEn(texto, { sinComarcas = false } = {}) {
  const t = ` ${normalizar(texto)} `;
  if (t.trim() === "") return null;
  for (const [p, id] of TABLA) if (!(sinComarcas && (COMARCAS.has(p) || PALABRAS_CORRIENTES.has(p))) && t.includes(` ${p} `)) return id;
  return null;
}

function porCoordenadas(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const capital = km(lat, lon, POR_ID.leon.lat, POR_ID.leon.lon);
  if (capital <= 4.5) return "leon";
  if (capital <= 15) return "alfoz";
  let mejor = null, dist = Infinity;
  for (const z of ZONAS) {
    if (z.id === "leon" || z.id === "alfoz") continue;
    const [la, lo] = z.centroReal || [z.lat, z.lon];
    const d = km(lat, lon, la, lo);
    if (d < dist) { dist = d; mejor = z.id; }
  }
  return dist <= 70 ? mejor : null;
}

// ¿De qué zona es este evento? Devuelve un id de ZONAS o "otros" si no hay manera de saberlo
export function zonaDe(e) {
  if (!e) return "otros";
  const loc = normalizar(e.localidad);
  const enLocalidad = pueblaEn(e.localidad);
  if (enLocalidad) return enLocalidad;
  // El título solo cuenta si el municipio no dice "León" ("Fiestas de Villablino")
  const enLugar = pueblaEn(e.lugar) || (POR_ID.leon.pueblos.includes(loc) ? null : pueblaEn(e.titulo, { sinComarcas: true }));
  if (enLugar) return enLugar;
  const lat = e.lat == null ? NaN : Number(e.lat), lon = e.lon == null ? NaN : Number(e.lon);
  const coords = porCoordenadas(lat, lon);
  if (coords) return coords;
  if (POR_ID.leon.pueblos.includes(loc)) return "leon";
  if (e.zonaBusqueda && POR_ID[e.zonaBusqueda]) return e.zonaBusqueda;
  if (!loc) return "leon"; // sin municipio: casi siempre es la capital (agendas del Ayuntamiento y la prensa)
  return "otros";
}

// Cuenta eventos únicos por zona: { leon: 12, bierzo: 4, ... }
export function contarPorZona(eventos) {
  const cuenta = {};
  for (const e of eventos || []) { const z = zonaDe(e); cuenta[z] = (cuenta[z] || 0) + 1; }
  return cuenta;
}

// La zona más cercana a un punto del mapa (cuando la gente pincha en cualquier sitio)
export function zonaMasCercana(lat, lon) {
  const capital = km(lat, lon, POR_ID.leon.lat, POR_ID.leon.lon);
  if (capital <= 6) return "leon";
  let mejor = "leon", dist = Infinity;
  for (const z of ZONAS) {
    const [la, lo] = z.centroReal || [z.lat, z.lon];
    const d = km(lat, lon, la, lo);
    if (d < dist) { dist = d; mejor = z.id; }
  }
  return mejor;
}
