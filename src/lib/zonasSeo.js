// Textos y direcciones de las páginas por zona (/agenda-leon/bierzo, /agenda-leon/astorga...).
// Las busca la gente en Google ("qué hacer en el Bierzo este finde"), así que cada una lleva su agenda
// de los próximos días y un párrafo propio. Solo se afirma lo que es de sobra conocido de cada comarca.
import { ZONAS } from "./zonas";

export const SEO_ZONAS = {
  leon: {
    slug: "leon-capital", en: "León capital",
    intro: "La capital concentra casi toda la agenda: conciertos y teatro en el Auditorio y el Albéitar, exposiciones en el MUSAC y los museos, mercados y, cada noche, la ronda de tapas del Barrio Húmedo, donde con cada consumición va una tapa.",
    imprescindibles: [["⛪", "Catedral de León", "Sus vidrieras, mejor a media tarde."], ["👑", "San Isidoro", "El Panteón de los Reyes, con pinturas románicas."], ["🍷", "Barrio Húmedo", "La ronda de tapas de siempre."], ["🏰", "Casa Botines", "El edificio de Gaudí en el centro."]],
  },
  alfoz: {
    slug: "alfoz-de-leon", en: "los alrededores de León",
    intro: "Los municipios que rodean la capital, como San Andrés del Rabanedo, Villaquilambre, Valverde de la Virgen o Sariegos, tienen su propia agenda de fiestas, mercadillos y actividades a un paso de la ciudad.",
    imprescindibles: [],
  },
  bierzo: {
    slug: "bierzo", en: "el Bierzo",
    intro: "Ponferrada, Villafranca, Bembibre o Cacabelos: el Bierzo tiene agenda propia durante todo el año, con teatro, ferias, fiestas y su gastronomía y sus vinos.",
    imprescindibles: [["🏰", "Castillo de los Templarios", "El gran monumento de Ponferrada."], ["⛏️", "Las Médulas", "Patrimonio Mundial, en Carucedo."], ["🥾", "Villafranca del Bierzo", "Villa del Camino de Santiago."], ["🍷", "Vinos del Bierzo", "Con la uva mencía como protagonista."]],
  },
  astorga: {
    slug: "astorga", en: "Astorga y la Maragatería",
    intro: "Astorga y su entorno, la Maragatería y la ribera del Órbigo reúnen ferias, fiestas, música y mucha historia, con el Camino de Santiago cruzando la comarca.",
    imprescindibles: [["🏛️", "Palacio Episcopal de Gaudí", "En el centro de Astorga."], ["⛪", "Catedral de Astorga", "Con su museo y sus torres."], ["🍫", "Museo del Chocolate", "Astorga y el chocolate, una vieja historia."], ["🍲", "Cocido maragato", "Se come al revés: primero la carne."]],
  },
  baneza: {
    slug: "la-baneza", en: "La Bañeza, el Páramo y la Cabrera",
    intro: "La Bañeza y las tierras del Páramo y la Cabrera tienen una agenda muy de pueblo: fiestas, mercados, deporte y cultura, con un Carnaval muy animado.",
    imprescindibles: [],
  },
  esla: {
    slug: "valencia-de-don-juan", en: "Valencia de Don Juan y el Esla",
    intro: "La ribera del Esla, de Valencia de Don Juan a Mansilla de las Mulas y Valderas, mezcla castillos, Camino de Santiago, fiestas y bodegas de la zona de Los Oteros.",
    imprescindibles: [["🏰", "Castillo de Valencia de Don Juan", "Una fortaleza sobre el Esla."], ["🧱", "Mansilla de las Mulas", "Sus murallas, en pleno Camino de Santiago."], ["🍷", "Bodegas de Los Oteros", "Vinos de la zona de León."]],
  },
  sahagun: {
    slug: "sahagun", en: "Sahagún y Tierra de Campos",
    intro: "Sahagún y Tierra de Campos tienen fiestas, mercados y actividades todo el año, en pleno Camino de Santiago y con un patrimonio mudéjar único en la provincia.",
    imprescindibles: [["🥾", "Camino de Santiago", "El Camino Francés pasa por Sahagún."], ["🧱", "Arte mudéjar", "Iglesias de ladrillo como San Tirso y San Lorenzo."], ["⛪", "Santuario de la Peregrina", "En la misma villa."]],
  },
  oriental: {
    slug: "montana-de-riano", en: "la Montaña de Riaño y los Picos de Europa",
    intro: "Riaño, Cistierna, Boñar y los valles de los Picos de Europa: fiestas de montaña, ferias y mucha naturaleza para los fines de semana.",
    imprescindibles: [["🏔️", "Picos de Europa", "Valdeón y Sajambre, en el lado leonés."], ["🥾", "Ruta del Cares", "Empieza en Caín, en Posada de Valdeón."], ["💧", "Embalse de Riaño", "Un paisaje de montaña con agua."]],
  },
  occidental: {
    slug: "babia-y-laciana", en: "Babia, Laciana, Luna y Gordón",
    intro: "Babia, Laciana, Luna y Gordón son la montaña del noroeste de León: reservas de la biosfera, fiestas de pueblo y planes al aire libre.",
    imprescindibles: [["🌲", "Reservas de la biosfera", "Babia, Laciana, Omaña y más."], ["🕳️", "Cuevas de Valporquero", "En Vegacervera."], ["🥾", "Rutas de montaña", "Para andar todo el año."]],
  },
};

export const zonaPorSlug = (slug) => ZONAS.find((z) => SEO_ZONAS[z.id]?.slug === slug) || null;
export const rutaZona = (id) => `/agenda-leon/${SEO_ZONAS[id].slug}`;
