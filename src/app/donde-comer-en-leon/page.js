// /donde-comer-en-leon — ranking propio de bares y restaurantes (idea 8)
import PaginaContenido from "../components/PaginaContenido";
import TarjetaLugar from "../components/TarjetaLugar";
import { topLugares } from "../../lib/lugares";
import { GLASS } from "../../lib/estilos";

export const revalidate = 3600;
export const metadata = {
  title: "Dónde comer en León: bares de tapas y restaurantes recomendados · Cazurronics",
  description: "Los bares y restaurantes de León que más recomienda Cazurronics y que mejor valora la gente que ha ido. Más qué pedir: cecina, morcilla, cocido maragato y botillo.",
  alternates: { canonical: "/donde-comer-en-leon" },
};

const QUE_PEDIR = [
  ["🥩", "Cecina de León", "Ternera curada, en lonchas finas con un chorrito de aceite."],
  ["🌶️", "Morcilla de León", "De cebolla, frita o en tapa, a veces con su punto picante."],
  ["🍲", "Cocido maragato", "En Astorga y la Maragatería se come al revés: primero la carne."],
  ["🐖", "Botillo del Bierzo", "El plato más contundente de la provincia, para ir con hambre."],
  ["🍻", "La tapa", "En los bares de León, con cada consumición te ponen una tapa."],
];

export default async function DondeComer() {
  const lugares = await topLugares("ranking:comer", 12);
  return (
    <PaginaContenido
      etiqueta="Comer y tapear"
      titulo="Dónde comer en León"
      destacado="sin caer en trampas"
      intro="Este ranking no se compra: sale de las veces que nuestra IA recomienda cada sitio y de lo que valora la gente que ha ido de verdad."
      ctaRef="donde-comer"
      actual="/donde-comer-en-leon"
    >
      {lugares.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Los que más recomendamos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{lugares.map((l, i) => <TarjetaLugar key={l.clave} l={l} posicion={i + 1} />)}</div>
        </section>
      )}
      <section>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Qué pedir en León</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUE_PEDIR.map(([icono, nombre, texto]) => (
            <div key={nombre} className={`${GLASS} rounded-[1.5rem] p-4`}>
              <p className="text-2xl">{icono}</p>
              <h3 className="font-semibold text-slate-900 mt-2">{nombre}</h3>
              <p className="text-sm text-slate-600 mt-0.5">{texto}</p>
            </div>
          ))}
        </div>
      </section>
    </PaginaContenido>
  );
}
