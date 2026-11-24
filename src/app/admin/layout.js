import { Archivo } from "next/font/google";
import "../panel/panel.css";

// /admin va con la misma clave y el mismo aspecto que el panel. No sale en Google ni en el mapa del sitio.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"] });

export const metadata = {
  title: "Gasto de la IA | Cazurronics",
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }) {
  return <div className={`panel-noche ${archivo.className}`}>{children}</div>;
}
