import { Fredoka } from "next/font/google";
import "./globals.css";

// Cargamos la tipografía Fredoka con distintos grosores
const fredoka = Fredoka({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"] // Desde normal hasta muy gordita
});

export const metadata = {
  title: "Cazurronics Planner 🦁",
  description: "Planificador inteligente de ocio en León",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {/* Aplicamos la fuente "Fredoka" a todo el cuerpo de tu web */}
      <body className={fredoka.className}>
        {children}
      </body>
    </html>
  );
}