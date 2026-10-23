// /despensa — Despensa de León: las mejores tiendas de producto (cecina, quesos, pan, vino...) por zona y radio
import PaginaContenido from "../components/PaginaContenido";
import BuscadorDespensa from "../components/BuscadorDespensa";
import SelectorSeccion from "../components/SelectorSeccion";

export const metadata = {
  title: "Despensa de León: dónde comprar cecina, quesos, pan y vino de León · Cazurronics",
  description: "Escribe qué quieres comprar y hasta dónde te mueves, y te damos las mejores tiendas de la provincia de León. Morcilla, cecina, pan, quesos, mantecadas, vino y más.",
  alternates: { canonical: "/despensa" },
};

export default function Despensa() {
  return (
    <PaginaContenido
      etiqueta="Despensa de León"
      titulo="Lo mejor de León,"
      destacado="para llevar a casa"
      intro="Escribe qué quieres comprar y hasta dónde te mueves. Te marcamos en el mapa las mejores tiendas."
      ctaRef="despensa"
      actual="/despensa"
      sencilla
      arriba={<SelectorSeccion actual="despensa" className="cz-up" />}
    >
      <BuscadorDespensa />
    </PaginaContenido>
  );
}
