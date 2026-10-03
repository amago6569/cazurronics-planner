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
        ],
      },
    ];
  },
};

export default nextConfig;
