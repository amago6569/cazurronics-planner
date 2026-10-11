// /despensa — Despensa de León: las mejores tiendas de producto (cecina, quesos, pan, vino...) por zona y radio
import Link from "next/link";
import PaginaContenido from "../components/PaginaContenido";
import BuscadorDespensa from "../components/BuscadorDespensa";
import { catalogoParaWeb } from "../../lib/despensa";
import { PRODUCTOS } from "../../lib/despensaProductos";
import { GLASS } from "../../lib/estilos";

export const revalidate = 3600;
export const metadata = {
  title: "Despensa de León: dónde comprar cecina, quesos, pan y vino de León · Cazurronics",
  description: "Elige qué quieres comprar, la zona y tu presupuesto y te damos las 3 mejores tiendas de la provincia de León. Cecina, embutido, quesos, mantecadas, vino y más.",
  alternates: { canonical: "/despensa" },
};

export default async function Despensa() {
  const tiendas = await catalogoParaWeb();
  return (
    <PaginaContenido
      etiqueta="Despensa de León"
      titulo="Lo mejor de León,"
      destacado="para llevar a casa"
      intro="Elige qué quieres comprar, por dónde te mueves y cuánto quieres gastar. Te damos las 3 mejores tiendas de cada cosa. Las busca nuestra IA en prensa, guías y reseñas, y solo salen las que existen de verdad."
      ctaRef="despensa"
      actual="/despensa"
    >
      <BuscadorDespensa tiendas={tiendas} />
      <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6`}>
        <h2 className="text-lg font-bold tracking-tight text-slate-900 px-1 mb-3">Dónde comprar en León</h2>
        <div className="flex flex-wrap gap-2">
          {PRODUCTOS.map((p) => (
            <Link key={p.id} href={`/despensa/${p.id}`} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/60 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600 transition-colors">{p.emoji} {p.nombre}</Link>
          ))}
        </div>
      </section>
    </PaginaContenido>
  );
}
