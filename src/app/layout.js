import { Fredoka } from "next/font/google";
import "./globals.css";
import { URL_SITIO } from "../lib/sitio";
import { jsonLdSeguro, sitioJsonLd } from "../lib/seo";

// Cargamos la tipografía Fredoka con distintos grosores
const fredoka = Fredoka({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"] // Desde normal hasta muy gordita
});

export const metadata = {
  metadataBase: new URL(URL_SITIO),
  title: 'Cazurronics Planner | Tu planazo en León',
  description: 'Organiza tu escapada perfecta por la provincia de León. Descubre rincones ocultos sin pensar y sin estrés.',
  openGraph: { siteName: 'Cazurronics Planner', locale: 'es_ES', type: 'website' },
  verification: { google: '95sdW_hUNT20HILlfi8C5gDdRjUkOPfVnULlE8AYuAI' },
}

//Pruebas para vercel
export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* Aplicamos la fuente "Fredoka" a todo el cuerpo de tu web */}
      <body className={fredoka.className}>
        {/* Quién está detrás de la web, para Google (no se ve) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(sitioJsonLd(URL_SITIO)) }} />
        {children}
      </body>
    </html>
  );
}