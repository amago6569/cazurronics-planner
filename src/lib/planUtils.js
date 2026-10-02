// ============ UTILIDADES COMPARTIDAS ============
// Usado por app/api/plan/route.js (generar plan) y app/api/retocar/route.js (cambiar una parada).
// Si tu proyecto no usa la carpeta "app" en la raíz (por ejemplo, usas "src/app"), ajusta las rutas
// de import en los dos route.js para que apunten aquí correctamente.

// Distancia en km entre dos puntos (fórmula de Haversine)
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convierte el rango de presupuesto del usuario (€) a la escala price_level de Google (0-4)
export function presupuestoAPriceLevel(presupuestoMin, presupuestoMax) {
  const medio = (Number(presupuestoMin) + Number(presupuestoMax)) / 2;
  if (medio <= 10) return 0;
  if (medio <= 25) return 1;
  if (medio <= 50) return 2;
  if (medio <= 100) return 3;
  return 4;
}

// Extrae un número (€) de textos como "6€", "10-15€" o "Gratis"
export function parsePrecio(precioStr) {
  if (!precioStr) return 0;
  const texto = precioStr.toString().toLowerCase();
  if (texto.includes('grat') || texto.includes('free')) return 0;
  const numeros = texto.match(/\d+([.,]\d+)?/g);
  if (!numeros || numeros.length === 0) return 0;
  const valores = numeros.map(n => parseFloat(n.replace(',', '.')));
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

// Puntúa un candidato de Google Places según valoración, popularidad, encaje de presupuesto y distancia real
export function puntuarCandidato(candidato, tipo, lat, lon, priceLevelObjetivo, radio) {
  if (!candidato || !candidato.geometry) return -Infinity;

  const rating = candidato.rating || 0;
  const numResenas = candidato.user_ratings_total || 0;
  const popularidad = Math.min(Math.log10(numResenas + 1) / 3, 1);

  const distanciaKm = haversineKm(lat, lon, candidato.geometry.location.lat, candidato.geometry.location.lng);
  const distanciaNormalizada = Math.max(0, 1 - distanciaKm / Math.max(Number(radio), 1));

  let encajePresupuesto = 0.5;
  if (typeof candidato.price_level === 'number') {
    const diferencia = Math.abs(candidato.price_level - priceLevelObjetivo);
    encajePresupuesto = Math.max(0, 1 - diferencia / 4);
  }

  const esSitioFijo = tipo === 'monumento' || tipo === 'parque';

  if (esSitioFijo) {
    return (rating / 5) * 0.55 + popularidad * 0.15 + distanciaNormalizada * 0.25 + encajePresupuesto * 0.05;
  }

  return (rating / 5) * 0.4 + popularidad * 0.15 + encajePresupuesto * 0.25 + distanciaNormalizada * 0.2;
}

// Recorta el itinerario quitando las paradas más caras hasta caber en el presupuesto TOTAL
export function ajustarAlPresupuesto(paradas, presupuestoMax) {
  let lista = [...paradas];
  let total = lista.reduce((suma, p) => suma + parsePrecio(p.precio), 0);

  while (total > Number(presupuestoMax) && lista.length > 1) {
    let indiceMasCaro = 0;
    let precioMasCaro = -1;
    lista.forEach((p, i) => {
      const precio = parsePrecio(p.precio);
      if (precio > precioMasCaro) {
        precioMasCaro = precio;
        indiceMasCaro = i;
      }
    });
    total -= precioMasCaro;
    lista.splice(indiceMasCaro, 1);
  }

  if (total > Number(presupuestoMax)) return [];
  return lista;
}

// Averigua el nombre real de la localidad (pueblo/ciudad) donde está el punto elegido en el mapa
export async function obtenerLocalidad(lat, lon, mapsKey) {
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${mapsKey}&language=es`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (data.status && data.status !== 'OK') {
      console.error(`[Geocoding] status="${data.status}": ${data.error_message || ''}`);
      return null;
    }

    if (data.results && data.results.length > 0) {
      const componentes = data.results[0].address_components;
      const candidato =
        componentes.find(c => c.types.includes('locality')) ||
        componentes.find(c => c.types.includes('administrative_area_level_3')) ||
        componentes.find(c => c.types.includes('administrative_area_level_2'));
      if (candidato) return candidato.long_name;
    }
  } catch (e) {
    console.error("Error en geocodificación inversa:", e);
  }
  return null;
}

// Traduce los códigos meteorológicos oficiales (WMO) que da Open-Meteo a texto en español
export const WMO_A_TEXTO = {
  0: 'Cielo despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
  56: 'Llovizna helada', 57: 'Llovizna helada intensa',
  61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
  66: 'Lluvia helada', 67: 'Lluvia helada intensa',
  71: 'Nevada ligera', 73: 'Nevada moderada', 75: 'Nevada intensa', 77: 'Granos de nieve',
  80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
  85: 'Chubascos de nieve ligeros', 86: 'Chubascos de nieve intensos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo intenso',
};

// Consulta la previsión real del tiempo (Open-Meteo, gratis, sin API key) para el punto y fecha del plan.
export async function obtenerPrevisionTiempo(lat, lon, fecha) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FMadrid&start_date=${fecha}&end_date=${fecha}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error(`[Open-Meteo] error: ${data.reason || JSON.stringify(data)}`);
      return null;
    }

    if (data.daily && data.daily.weather_code && data.daily.weather_code.length > 0) {
      const codigo = data.daily.weather_code[0];
      const tMax = Math.round(data.daily.temperature_2m_max[0]);
      const tMin = Math.round(data.daily.temperature_2m_min[0]);
      const descripcion = WMO_A_TEXTO[codigo] || 'Previsión no disponible';
      return `${descripcion}, entre ${tMin}°C y ${tMax}°C`;
    }
  } catch (e) {
    console.error("Error obteniendo la previsión del tiempo (Open-Meteo):", e);
  }
  return null;
}

// Búsqueda de una foto real en Wikimedia Commons para un término de búsqueda dado
export async function buscarFotoCommons(query) {
  try {
    const commonsRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json`, {
      headers: { 'User-Agent': 'CazurronicsPlanner/10.0' }
    });
    const commonsData = await commonsRes.json();

    if (commonsData.query?.search && commonsData.query.search.length > 0) {
      const fileTitle = commonsData.query.search[0].title;
      const fileInfoRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`);
      const fileInfoData = await fileInfoRes.json();
      const filePages = fileInfoData.query?.pages;
      const filePageId = Object.keys(filePages || {})[0];

      if (filePages?.[filePageId]?.imageinfo?.[0]?.url) {
        return filePages[filePageId].imageinfo[0].url;
      }
    }
  } catch (e) {
    console.error("Error buscando foto en Wikimedia Commons:", e);
  }
  return null;
}

// NUEVO: comprueba si Google tiene cobertura de Street View en ese punto (la consulta a "metadata" es
// gratuita, no gasta cuota) y, si la hay, devuelve la URL de la imagen real de esa calle.
export async function obtenerStreetView(lat, lon, mapsKey) {
  try {
    const svKey = process.env.STREET_VIEW_API_KEY || mapsKey;
    // AQUÍ ESTABA EL FALLO: Usaba ${mapsKey} en vez de${svKey}
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lon}&key=${svKey}`;
    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();

    if (metaData.status === 'OK') {
      return `https://www.google.com/maps/embed/v1/streetview?key=${svKey}&location=${lat},${lon}`;
    }
  } catch (e) {
    console.error("Error consultando Street View:", e);
  }
  return null;
}

export const BUSQUEDA_GENERICA_POR_TIPO = {
  bar: 'tapas bar Spain',
  restaurante: 'restaurant table food Spain',
  discoteca: 'nightclub party lights',
  monumento: 'historic monument building Spain',
  parque: 'city park green space',
  concierto: 'live music concert crowd',
  mercadillo: 'street market stalls Spain',
  fiesta: 'traditional Spanish village festival fireworks',
  feria: 'Spanish fair stalls crafts',
  festival: 'music festival stage Spain',
  exposicion: 'art exhibition gallery',
  museo: 'museum interior Spain',
  teatro: 'theatre stage performance',
  evento: 'León Spain event plaza',
  ruta: 'hiking trail mountains León Spain',
  deporte: 'sports stadium Spain',
};

// Tipos para los que aceptamos una ubicación aproximada (la del centro elegido, o la que estime la IA)
// cuando Google Places no tiene una ficha de negocio exacta. No aplica a bar/restaurante/discoteca.
export const TIPOS_UBICACION_FLEXIBLE = ['concierto', 'mercadillo', 'fiesta', 'evento', 'monumento', 'parque'];

// NUEVO: solo los negocios de hostelería EXIGEN ficha real en Google Places. Antes, una exposición,
// una feria, un teatro o una ruta sin ficha se descartaban y el plan se quedaba en bares y restaurantes.
export const TIPOS_CON_FICHA_OBLIGATORIA = ['bar', 'restaurante', 'discoteca', 'cafeteria', 'cafetería', 'pub', 'taberna', 'sidreria', 'sidrería'];
const necesitaFicha = (tipo) => TIPOS_CON_FICHA_OBLIGATORIA.includes(String(tipo || '').toLowerCase());

// Dado UNA parada (tal cual la devuelve Gemini) y el contexto de la búsqueda, la enriquece con datos
// reales: coordenadas verificadas, teléfono, web, horario, reseñas, foto real y Street View.
// Devuelve la parada enriquecida, o null si debe descartarse (bar/restaurante/discoteca sin ficha real).
export async function enriquecerParada(paradaOriginal, contexto) {
  const { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey } = contexto;
  let parada = { ...paradaOriginal };

  parada.titulo = parada.titulo.replace(/,?\s*León,?\s*España/gi, '').trim();
  const queryBusquedaReal = `${parada.titulo}, ${nombreZona}, provincia de León, España`;

  let objetivo = null;
  let fotoRealEncontrada = null;
  let ubicacionResuelta = false;
  let problemaConfigPlaces = null;

  try {
    const radioMetros = Number(radio) * 1000;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryBusquedaReal)}&location=${lat},${lon}&radius=${radioMetros}&language=es&region=es&key=${mapsKey}`;
    const resSearch = await fetch(searchUrl);
    const dataSearch = await resSearch.json();

    if (dataSearch.status && dataSearch.status !== 'OK' && dataSearch.status !== 'ZERO_RESULTS') {
      console.error(`[Google Places] status="${dataSearch.status}" para "${queryBusquedaReal}": ${dataSearch.error_message || '(sin mensaje adicional)'}`);
      problemaConfigPlaces = `${dataSearch.status}: ${dataSearch.error_message || 'revisa que la Places API esté activada y la clave sea correcta'}`;
    }

    if (dataSearch.results && dataSearch.results.length > 0) {
      const candidatosEnZona = dataSearch.results.filter(r => {
        if (!r.geometry || r.business_status === 'CLOSED_PERMANENTLY') return false;
        const distanciaKm = haversineKm(lat, lon, r.geometry.location.lat, r.geometry.location.lng);
        return distanciaKm <= Number(radio) * 1.1;
      });

      if (candidatosEnZona.length > 0) {
        if (parada.tipo === 'concierto' || parada.tipo === 'fiesta' || parada.tipo === 'mercadillo') {
          objetivo = candidatosEnZona[0];
        } else {
          const listaCandidatos = candidatosEnZona.slice(0, 5);
          objetivo = listaCandidatos.reduce((mejor, actual) => {
            const puntuacionActual = puntuarCandidato(actual, parada.tipo, lat, lon, priceLevelObjetivo, radio);
            const puntuacionMejor = mejor ? puntuarCandidato(mejor, parada.tipo, lat, lon, priceLevelObjetivo, radio) : -Infinity;
            return puntuacionActual > puntuacionMejor ? actual : mejor;
          }, null);
        }
      }
    }

    if (objetivo) {
      parada.lat = objetivo.geometry.location.lat;
      parada.lon = objetivo.geometry.location.lng;
      ubicacionResuelta = true;
      if (objetivo.place_id) parada.placeId = objetivo.place_id;

      if (typeof objetivo.rating === 'number') {
        parada.resenas = `${objetivo.rating}/5 (${objetivo.user_ratings_total || 0} reseñas)`;
      }

      if (objetivo.place_id) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${objetivo.place_id}&fields=photos,formatted_phone_number,website,opening_hours&language=es&key=${mapsKey}`;
          const resDetails = await fetch(detailsUrl);
          const dataDetails = await resDetails.json();
          const detalle = dataDetails.result;

          if (detalle) {
            if (detalle.formatted_phone_number) parada.telefono = detalle.formatted_phone_number;
            if (detalle.website) parada.web = detalle.website;
            if (detalle.opening_hours?.weekday_text?.length) {
              parada.horario = detalle.opening_hours.weekday_text.join(' | ');
            }
            if (detalle.photos && detalle.photos.length > 0) {
              const photoRef = detalle.photos[0].photo_reference;
              // La clave NO viaja al navegador: la foto se pide a nuestra ruta /api/foto, que añade la clave en el servidor
              fotoRealEncontrada = `/api/foto?ref=${encodeURIComponent(photoRef)}`;
            }
          }
        } catch (eDetalle) {
          console.error("Error obteniendo detalles del lugar:", eDetalle);
        }
      }

      if (!fotoRealEncontrada && objetivo.photos && objetivo.photos.length > 0) {
        const photoRef = objetivo.photos[0].photo_reference;
        fotoRealEncontrada = `/api/foto?ref=${encodeURIComponent(photoRef)}`;
      }
    }
  } catch (e) {
    console.error("Error buscando lugar real en Google Places:", e);
  }

  if (!ubicacionResuelta && (TIPOS_UBICACION_FLEXIBLE.includes(parada.tipo) || !necesitaFicha(parada.tipo))) {
    const latIA = Number(parada.lat);
    const lonIA = Number(parada.lon);
    const coordenadaValidaIA = !isNaN(latIA) && !isNaN(lonIA) && haversineKm(lat, lon, latIA, lonIA) <= Number(radio) * 1.1;
    parada.lat = coordenadaValidaIA ? latIA : lat;
    parada.lon = coordenadaValidaIA ? lonIA : lon;
    ubicacionResuelta = true;
  }

  if (!ubicacionResuelta) {
    return { parada: null, problemaConfigPlaces };
  }

  if (!fotoRealEncontrada) {
    fotoRealEncontrada = await buscarFotoCommons(queryBusquedaReal);
  }
  if (!fotoRealEncontrada) {
    const terminoGenerico = BUSQUEDA_GENERICA_POR_TIPO[parada.tipo] || 'Castilla y León turismo';
    fotoRealEncontrada = await buscarFotoCommons(terminoGenerico);
  }

  parada.fotoOficial = fotoRealEncontrada || "https://images.unsplash.com/photo-1543785734-4b6e564642f8?auto=format&fit=crop&w=800&q=80";

  // Street View: funciona igual para negocios verificados que para fiestas/monumentos con ubicación aproximada,
  // porque depende solo de las coordenadas, no de tener ficha de negocio en Places.
  parada.streetView = await obtenerStreetView(parada.lat, parada.lon, mapsKey);

  return { parada, problemaConfigPlaces };
}