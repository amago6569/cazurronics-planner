import { Archivo } from "next/font/google";
import "./panel.css";

// La misma letra que la portada, con su anchura variable para las cifras condensadas
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"] });

export const metadata = {
  title: "Panel | Cazurronics",
  robots: { index: false, follow: false },
};

export default function LayoutPanel({ children }) {
  return <div className={`panel-noche ${archivo.className}`}>{children}</div>;
}
