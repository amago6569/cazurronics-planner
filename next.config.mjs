// Sitios que usa la web: teselas del mapa (OpenStreetMap), iconos de Leaflet (cdnjs), fotos de Google/Wikimedia/Unsplash,
// Street View (google.com) y el envío de negocios a Google Apps Script.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com https://*.googleusercontent.com https://upload.wikimedia.org https://images.unsplash.com https://maps.googleapis.com https://*.gstatic.com https://*.google.com",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://script.google.com https://script.googleusercontent.com",
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Apagamos el renderizado doble que marea al mapa
  poweredByHeader: false, // No anunciamos con qué está hecha la web

  // Cabeceras de seguridad básicas en todas las páginas. No cambian nada de lo que se ve:
  //  · nosniff: el navegador no "adivina" tipos de archivo (evita ataques con archivos disfrazados)
  //  · SAMEORIGIN: otra web no puede meter Cazurronics dentro de un iframe para engañar a la gente
  //  · Referrer-Policy: a las webs externas (bares, entradas...) solo les llega el dominio, no la URL del plan
  //  · Permissions-Policy: la web no usa cámara, micro ni ubicación del navegador, así que se bloquean
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: el navegador entra siempre por https, aunque alguien escriba http://
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Lista de sitios de los que la web puede cargar cosas. De momento en modo "solo avisar": no bloquea nada,
          // solo apunta en la consola lo que se saldría de la lista. Cuando pase una semana sin avisos, se activa de verdad.
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
