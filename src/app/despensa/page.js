// /despensa — Despensa de León: las mejores tiendas de producto (cecina, quesos, pan, vino...) por zona y radio
import Link from "next/link";
import PaginaContenido from "../components/PaginaContenido";
import BuscadorDespensa from "../components/BuscadorDespensa";
import SelectorSeccion from "../components/SelectorSeccion";
import { catalogoParaWeb } from "../../lib/despensa";
import { leerMercadillos, textoDias } from "../../lib/despensaMercados";
import { ZONAS } from "../../lib/zonas";
import { enlaceMaps } from "../../lib/despensaProductos";
import { PRODUCTOS } from "../../lib/despensaProductos";
import { GLASS } from "../../lib/estilos";

export const revalidate = 3600;
export const metadata = {
  title: "Despensa de León: dónde comprar cecina, quesos, pan y vino de León · Cazurronics",
  description: "Escribe qué quieres comprar y hasta dónde te mueves, y te damos las mejores tiendas de la provincia de León. Morcilla, cecina, pan, quesos, mantecadas, vino y más.",
  alternates: { canonical: "/despensa" },
};

export default async function Despensa() {
  const [tiendas, mercadillos] = await Promise.all([catalogoParaWeb(), leerMercadillos().catch(() => [])]);
  const mercadilloPorZona = ZONAS.map((z) => ({ z, lista: mercadillos.filter((m) => m.zona === z.id) })).filter((x) => x.lista.length);
  return (
    <PaginaContenido
      etiqueta="Despensa de León"
      titulo="Lo mejor de León,"
      destacado="para llevar a casa"
      intro="Escribe qué quieres comprar y hasta dónde te mueves. Te damos las mejores tiendas de cada cosa en toda la provincia, y la ruta para pasar por todas. Salen de Google Maps con su valoración y de lo que cuentan la prensa y las guías, y también los mercadillos de los pueblos."
      ctaRef="despensa"
      actual="/despensa"
      arriba={<SelectorSeccion actual="despensa" className="cz-up" />}
    >
      <BuscadorDespensa tiendas={tiendas} />
      {mercadilloPorZona.length > 0 && (
        <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 px-1">🧺 Mercadillos de la provincia</h2>
          <p className="text-sm text-slate-500 px-1 mb-3">Fruta, verdura, embutido y queso de la zona, el día de mercado de cada pueblo.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mercadilloPorZona.map(({ z, lista }) => (
              <div key={z.id} className="bg-white/60 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4">
                <h3 className="font-semibold text-slate-900">{z.emoji} {z.nombre}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {lista.map((m) => (
                    <li key={`${m.pueblo}-${m.dias.join()}`}>
                      <a href={enlaceMaps({ nombre: m.lugar || m.pueblo, localidad: m.pueblo, placeId: m.placeId })} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-rose-600">{m.pueblo}</a>
                      <span className="text-slate-500"> · {textoDias(m.dias)}{m.horario ? `, ${m.horario}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
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
