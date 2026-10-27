// ============ LO QUE PIDE DE VERDAD LA PERSONA ============
// Dos ayudas para que el plan se ciña a lo pedido:
//  · fuentesPara(): a qué webs mirar según el tema (charlas, deporte, comida, música...). Va dentro de la MISMA
//    búsqueda a medida de cada plan: no añade búsquedas ni gasto.
//  · filtrarMasEseDia(): si el plan es algo concreto (1-2 paradas), "Más cosas ese día" solo enseña cosas parecidas.

const quitarTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palabras que no dicen nada del tema ("quiero algo para hacer cerca...")
const VACIAS = new Set(("algo alguna alguno algun algunas algunos hay haya quiero queria querria busco buscando " +
  "para por con sin que donde cerca hacer plan planes sitio sitios lugar cosa cosas luego despues antes " +
  "tarde noche manana hoy finde semana este esta estos estas esos esas como mucho poco bueno buena buenos " +
  "buenas mejor tambien pero porque cual cuales leon zona barato barata gratis lunes martes miercoles jueves " +
  "viernes sabado domingo tranquilo tranquila romantico romantica especial bonito bonita guay chulo chula " +
  "pasear pasar dar vuelta rato gente amigos pareja").split(" "));

export function palabrasClave(apetece) {
  return [...new Set(quitarTildes(apetece).split(/[^a-zñ0-9]+/).filter((p) => p.length >= 4 && !VACIAS.has(p)))];
}

// [tema, regex sobre lo que pide, fuentes donde suele estar publicado]
const TEMAS = [
  ["charlas y cultura", /\b(?:charla|conferencia|coloquio|ponencia|presentacion|libro|lectura|mesa redonda|debate|seminario|jornada|cine ?forum|club de lectura)/,
    "Universidad de León y su agenda cultural, bibliotecas municipales y públicas, Instituto Leonés de Cultura, centros cívicos, casas de cultura de los pueblos, librerías, fundaciones, colegios profesionales y asociaciones culturales"],
  ["deporte", /\b(?:deporte|partido|futbol|baloncesto|balonmano|carrera|maraton|trail|senderismo|ruta|bici|ciclismo|escalada|padel|tenis|esqui|natacion|yoga|gimnasio|cultural leonesa|ademar)/,
    "webs y redes de los clubes (Cultural Leonesa, Ademar León, clubes de baloncesto y de montaña), federaciones de Castilla y León, calendarios de carreras populares y trails, la concejalía de deportes y la Diputación, estaciones de esquí de la provincia"],
  ["comida y bebida", /\b(?:comer|comida|cena\b|cenar|almuerzo|desayun|tapa|tapeo|vinos?\b|vermu|cerveza|cocido|cecina|botillo|gastro|restaurante|bar\b|bares|cata\b|catas\b|menu\b|brunch|vegano|vegetariano)/,
    "jornadas gastronómicas, consejos reguladores (D.O. León, Cecina de León, Botillo del Bierzo), webs y redes de los restaurantes, guías y reseñas (Guía Repsol, TripAdvisor, Google), foros y blogs gastronómicos locales"],
  ["música y noche", /\b(?:concierto|musica|fiesta|discoteca|copas|bailar|baile|dj\b|jazz|rock\b|flamenco|orquesta|verbena)/,
    "salas de conciertos y bares con música en directo, Auditorio Ciudad de León, venta de entradas (Eventbrite, Entradas.com, Ticketmaster y las webs de las salas), redes de los grupos y promotores, programas de fiestas de los ayuntamientos"],
  ["niños y familia", /\b(?:nino|nina|ninos|crio|crios|familia|infantil|peques|chavales)/,
    "agendas infantiles municipales, bibliotecas (cuentacuentos), museos con talleres, ludotecas y centros cívicos"],
  ["museos y visitas", /\b(?:museo|exposicion|visita|guiada|monumento|catedral|arte\b|historia|patrimonio)/,
    "museos (MUSAC, Museo de León, Catedral), oficinas de turismo, Junta de Castilla y León, visitas guiadas y salas de exposiciones"],
];

// Fuentes extra para la búsqueda a medida: solo las de los temas que salen en lo que pide la persona
export function fuentesPara(apetece) {
  const t = ` ${quitarTildes(apetece)} `;
  const elegidos = TEMAS.filter(([, re]) => re.test(t));
  if (!elegidos.length) return "";
  return elegidos.map(([tema, , fuentes]) => `para ${tema}: ${fuentes}`).join("; ");
}

// Plan concreto (1-2 paradas): en "Más cosas ese día" solo lo del mismo tipo o que comparte palabras con lo pedido.
// Plan completo (3 o más): se enseña todo, como siempre.
export function filtrarMasEseDia(agenda, plan, apetece) {
  if (!Array.isArray(agenda) || !Array.isArray(plan) || plan.length > 2) return agenda || [];
  const GENERICOS = new Set(["evento", "fiesta", "otro"]);
  const tipos = new Set(plan.map((p) => quitarTildes(p?.tipo)).filter((t) => t && !GENERICOS.has(t)));
  const palabras = palabrasClave(apetece).map((p) => new RegExp(`\\b${p}`));
  return agenda.filter((e) => {
    if (e?.categoria && tipos.has(quitarTildes(e.categoria))) return true;
    const texto = quitarTildes(`${e?.titulo || ""} ${e?.descripcion || ""} ${e?.categoria || ""}`);
    return palabras.some((re) => re.test(texto));
  });
}
