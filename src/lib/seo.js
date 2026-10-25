// Piezas para Google y para las IAs que contestan preguntas ("¿dónde compro la mejor morcilla de León?").
// Funciones puras: no llaman a ninguna API ni al almacén. Solo dan forma a datos que ya tenemos.
import { enlaceMaps } from "./despensaProductos";

const coma = (n) => String(n).replace(".", ",");

// Una frase con la respuesta, arriba del todo. Es lo que suelen copiar Google y las IAs.
// Va en el mismo orden que la lista de la página; la nota de Google solo se cita con al menos 5 reseñas.
export function fraseRespuesta(nombreProducto, tiendas, donde = "en León") {
  if (!tiendas?.length) return null;
  const que = nombreProducto.toLowerCase();
  const nota = (t) => (t.nota && t.resenas >= 5 ? t : null);
  const [a, ...resto] = tiendas;
  const primera = `${a.nombre}, en ${a.localidad}${nota(a) ? `, con ${coma(a.nota)} ★ en Google Maps y ${a.resenas} reseñas` : ""}`;
  const otras = resto.slice(0, 2).map((t) => `${t.nombre} (${nota(t) ? `${coma(t.nota)} ★` : t.localidad})`);
  return `Para comprar ${que} ${donde}, nuestra primera recomendación es ${primera}.${otras.length ? ` Le ${otras.length > 1 ? "siguen" : "sigue"} ${unir(otras)}.` : ""}`;
}

function unir(lista) {
  if (lista.length <= 1) return lista[0] || "";
  return `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
}

// Lista de tiendas en formato schema.org (ItemList de Store). Google lo usa para entender la página.
export function listaTiendasJsonLd({ nombre, url, tiendas }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    url,
    numberOfItems: tiendas.length,
    itemListElement: tiendas.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Store",
        name: t.nombre,
        address: { "@type": "PostalAddress", addressLocality: t.localidad, addressRegion: "León", addressCountry: "ES" },
        ...(Number.isFinite(t.lat) && Number.isFinite(t.lon) ? { geo: { "@type": "GeoCoordinates", latitude: t.lat, longitude: t.lon } } : {}),
        hasMap: enlaceMaps(t),
        ...(t.nota && t.resenas >= 5 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: t.nota, reviewCount: t.resenas, bestRating: 5 } } : {}),
      },
    })),
  };
}

// Lista de bares y restaurantes (para /donde-comer-en-leon)
export function listaRestaurantesJsonLd({ nombre, url, lugares }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    url,
    numberOfItems: lugares.length,
    itemListElement: lugares.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": String(l.tipo || "").startsWith("bar") || l.tipo === "taberna" ? "BarOrPub" : "Restaurant",
        name: l.nombre,
        address: { "@type": "PostalAddress", addressRegion: "León", addressCountry: "ES" },
        ...(Number.isFinite(l.lat) && Number.isFinite(l.lon) ? { geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lon } } : {}),
      },
    })),
  };
}

// Quién está detrás de la web (va en todas las páginas)
export function sitioJsonLd(url) {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Cazurronics Planner", alternateName: "Cazurronics", url, inLanguage: "es-ES" },
    { "@context": "https://schema.org", "@type": "Organization", name: "Cazurronics", url, logo: `${url}/roseton.png`, sameAs: ["https://www.instagram.com/cazurronics"], areaServed: { "@type": "AdministrativeArea", name: "Provincia de León" } },
  ];
}

// Para meter un objeto en <script type="application/ld+json"> sin que un "<" rompa la página
export const jsonLdSeguro = (datos) => JSON.stringify(datos).replace(/</g, "\\u003c");
