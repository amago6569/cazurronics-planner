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
  ["charlas y cultura", /\b(?:charla|conferencia|coloquio|ponencia|presentacion|libro|lectura|mesa redonda|debate|seminario|jornada|cine ?forum|club de lectura|literari|literatura|poesia|poeta|escritor|novela|relatos|tertulia|recital poetico)/,
    "Universidad de León y su agenda cultural, bibliotecas municipales y públicas, Instituto Leonés de Cultura, centros cívicos, casas de cultura de los pueblos, librerías, fundaciones, colegios profesionales y asociaciones culturales"],
  ["deporte", /\b(?:deporte|partido|futbol|baloncesto|balonmano|carrera|maraton|trail|senderismo|ruta|bici|ciclismo|caminar|caminata|andar|excursion|montana|marcha|cross|mtb|btt|mountain|duatlon|triatlon|correr|running|escalada|padel|tenis|esqui|natacion|yoga|gimnasio|cultural leonesa|ademar)/,
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

// ¿Un evento de la agenda va de lo que pide? Mismo tema («charla literaria» → presentaciones de libros, conferencias) o una
// palabra suya en el título. 25-11-2026: «algo de charla literaria y comer» sacó solo la comida, con 3 presentaciones de
// libros esa tarde en la agenda: con 100+ eventos, las de las 19:00 no llegaban a los 30 que ve la IA.
export function encajaConLoPedido(e, apetece) {
  const t = ` ${quitarTildes(apetece)} `;
  const texto = ` ${quitarTildes(`${e?.titulo || ""} ${e?.categoria || ""}`)} `;
  if (TEMAS.some(([, re]) => re.test(t) && re.test(texto))) return true;
  return palabrasClave(apetece).some((p) => new RegExp(`\\b${p.length >= 7 ? p.slice(0, -2) : p}`).test(texto));
}

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

// La IA a veces cuela un mercado o una feria porque están en la agenda ("tapeo y cenar" con el mercado a las 09:00).
// Se quitan solo cuando el error es seguro: hay un tema pedido, no es un plan abierto, no se habla de mercados ni de
// compras y la parada no comparte palabras con lo pedido. Nunca se quita más de la mitad. Sin IA: 0 € y sin llamadas.
const PIDE_MERCADO = /\b(?:mercad|mercadill|rastr|ferias?\b|compra|comprar|tipic|producto|artesan)/;
const PLAN_ABIERTO = /\b(?:sorprend|que hacer|pasar el dia|lo que sea|cualquier cosa)/;
const ES_MERCADO = /\b(?:mercados?|mercadillos?|rastros?|rastrillos?|ferias?)\b/;
const TIPOS_SIN_CONCRETAR = new Set(["", "evento", "fiesta", "festival", "otro", "visita"]);
export function quitarNoPedidas(paradas, apetece) {
  if (!Array.isArray(paradas)) return [];
  const t = ` ${quitarTildes(apetece)} `;
  const conTema = TEMAS.some(([, re]) => re.test(t));
  if (!conTema || PLAN_ABIERTO.test(t) || PIDE_MERCADO.test(t)) return paradas;
  // Sin la s final: "tapas" también vale para "Feria de la Tapa". Se mira solo el título: la descripción nombra barrios y alternativas
  const palabras = palabrasClave(apetece).map((p) => new RegExp(`\\b${p.replace(/s$/, "")}`));
  const ajena = (p) => {
    const titulo = quitarTildes(p?.titulo), tipo = quitarTildes(p?.tipo);
    // Por el título, solo si el tipo no dice otra cosa: la Iglesia del Mercado es un monumento
    const esMercado = /^(?:mercadillo|mercado|feria)$/.test(tipo) || (TIPOS_SIN_CONCRETAR.has(tipo) && ES_MERCADO.test(titulo));
    return esMercado && !palabras.some((re) => re.test(titulo));
  };
  let puedenIrse = Math.floor(paradas.length / 2);
  return paradas.filter((p) => !(ajena(p) && puedenIrse-- > 0));
}

// ============ CUÁNTOS SITIOS PIDE ============
// «4 bares para salir a tomar algo» son 4 bares, no 1. La IA tendía a quedarse corta (el prompt decía "normalmente
// 1 parada" para lo concreto) y, si nombraba dos bares que Google no conoce, los dos acababan en el mismo local y se
// fusionaban. Aquí se lee el número y el tipo sin IA (0 €) para pedirlo claro y completar el plan si llega corto.
const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
export const MAX_PARADAS_PEDIDAS = 8;
// [tipo de parada, cómo se dice en plural, regex del sustantivo]
const CONTABLES = [
  ["bar", "bares", /(?:bar(?:es)?|pubs?|tabernas?|garitos?|chigres?|sidrerias?|vinotecas?|cervecerias?|sitios? (?:para|de|donde) (?:tomar|beber|tapear|tapas|vinos?|canas?|copas?|cervezas?|picar)|sitios? de (?:tapas|vinos|canas|copas|tapeo))/],
  ["restaurante", "restaurantes", /(?:restaurantes?|mesones?|asadores?|sitios? (?:para|de|donde) (?:comer|cenar))/],
  ["cafeteria", "cafeterías", /(?:cafeterias?|sitios? (?:para|de) (?:tomar (?:un )?cafe|merendar|desayunar))/],
  ["discoteca", "discotecas", /(?:discotecas?|sitios? (?:para|de) (?:bailar|fiesta))/],
  ["museo", "museos", /museos?/],
  ["monumento", "monumentos", /(?:monumentos?|iglesias?)/],
];
const CUANTOS = `(\\d{1,2}|un par de|par de|${Object.keys(NUMEROS).join("|")}|unos|unas|varios|varias|algunos|algunas)`;
// Entre el número y el sitio solo caben adjetivos: «4 buenos bares» sí, «4 personas un bar» no
const ADJETIVOS = "(?:(?:buen[oa]s|mejores|bonit[oa]s|barat[oa]s|tipic[oa]s|autentic[oa]s|chul[oa]s|guays?|distint[oa]s|diferentes|otr[oa]s|tranquil[oa]s|animad[oa]s)\\s+){0,2}";
// Sin número pero en plural de ruta: «ruta de bares», «ir de tapas», «salir de vinos» = unos 3
// y «salir a tomar algo» / «salir de cañas», que en León es ir de bar en bar
const DE_RUTA = /\b(?:(?:ruta|ir|salir|irnos|vamos|noche|tarde) de (?:bares|tapas|vinos|canas|pinchos|tapeo|copas|potes)|(?:salir|irnos|ir) a (?:tomar algo|tomar unas? \w+|tapear|potear|picar algo))\b/;

// { n, tipo, plural } o null si no pide un número de sitios del mismo tipo
export function paradasPedidas(apetece) {
  const t = ` ${quitarTildes(apetece).replace(/\s+/g, " ")} `;
  for (const [tipo, plural, sustantivo] of CONTABLES) {
    const m = t.match(new RegExp(`\\b${CUANTOS}\\s+${ADJETIVOS}${sustantivo.source}`));
    if (!m) continue;
    const palabra = m[1];
    let n = /^\d+$/.test(palabra) ? Number(palabra) : /par de/.test(palabra) ? 2 : NUMEROS[palabra] ?? 3;
    // «un bar» o «una cafetería» es lo de siempre: una parada; no hace falta forzar nada
    if (n < 2) continue;
    n = Math.min(MAX_PARADAS_PEDIDAS, n);
    return { n, tipo, plural };
  }
  if (DE_RUTA.test(t)) return { n: 3, tipo: "bar", plural: "bares" };
  return null;
}

// Tipos que cuentan como «bar» al contar las paradas (la IA a veces pone pub o taberna)
const IGUALES = { bar: ["bar", "pub", "taberna", "sidreria", "sidrería"], cafeteria: ["cafeteria", "cafetería"] };
export const tiposIguales = (tipo) => IGUALES[tipo] || [tipo];
export const esDelTipo = (parada, tipo) => tiposIguales(tipo).map(quitarTildes).includes(quitarTildes(parada?.tipo));

// «Qué hay hoy en León», «qué se hace este sábado», «eventos para hoy»: quiere la agenda del día, no un bar
const PIDE_AGENDA = /\b(?:que hay|que se hace|que se cuece|que pasa|que hacer|que puedo hacer|que podemos hacer|que se celebra|eventos?|agenda|actividades|que planes)\b/;
export function pideAgenda(apetece) {
  const t = ` ${quitarTildes(apetece)} `;
  if (!PIDE_AGENDA.test(t) || paradasPedidas(apetece)) return false;
  // «qué conciertos hay» o «qué hay para comer» ya tienen tema: se tratan como siempre
  return !TEMAS.some(([, re]) => re.test(t));
}
