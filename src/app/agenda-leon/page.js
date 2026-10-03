// /agenda-leon — la agenda de los próximos 14 días, sacada del barrido diario por zonas (ideas 3 y 8).
// Con mapa: se elige zona (empieza en León capital) y día. Sin repeticiones: lo que dura varios días
// (exposiciones, mercados semanales, ferias) sale UNA vez, y cada día muestra solo lo suyo, ordenado por horas.
// Lleva datos estructurados "Event" para Google.
import Link from "next/link";
import PaginaContenido from "../components/PaginaContenido";
import AgendaZonas from "../components/AgendaZonas";
import { eventosProximos } from "../../lib/eventos";
import { deduplicar, esDeVariosDias, organizarAgenda } from "../../lib/agenda";
import { ZONAS } from "../../lib/zonas";
import { rutaZona } from "../../lib/zonasSeo";
import { datosEstructurados } from "../../lib/jsonld";

export const revalidate = 3600;
export const metadata = {
  title: "Agenda de León: conciertos, exposiciones y planes de los próximos días · Cazurronics",
  description: "Qué hacer en León esta semana: conciertos, teatro, exposiciones, mercados y fiestas en la capital y la provincia, actualizado cada día.",
  alternates: { canonical: "/agenda-leon" },
};

// Solo lo que necesita la página (la descripción recortada) para que pese poco
const ligero = ({ titulo, fecha, fechaFin, hora, lugar, localidad, precio, categoria, descripcion, fuente, lat, lon, diasSemana, permanente, zonaBusqueda }) =>
  ({ titulo, fecha, fechaFin, hora, lugar, localidad, precio, categoria, descripcion: descripcion ? descripcion.slice(0, 160) : null, fuente, lat, lon, diasSemana, permanente, zonaBusqueda });

export default async function Agenda() {
  const dias = await eventosProximos(14);
  const agenda = organizarAgenda(dias);
  const total = agenda.enMarcha.length + agenda.porDia.reduce((s, d) => s + d.total, 0);
  const enMarcha = agenda.enMarcha.map(ligero);
  const porDia = dias.map((d) => ({ fecha: d.fecha, eventos: deduplicar(d.eventos.filter((e) => !esDeVariosDias(e))).map(ligero) }));
  return (
    <PaginaContenido
      etiqueta="Actualizada cada mañana"
      titulo="Agenda de León:"
      destacado="qué hay estos días"
      intro={total ? `${total} planes distintos en León capital y en toda la provincia durante las próximas dos semanas, sin repetidos y ordenados por horas. Elige zona en el mapa y mira qué hay.` : "Cada mañana rastreamos las agendas del Ayuntamiento, la Diputación, la Junta, la prensa local y las comarcas para traerte todo lo que pasa en León."}
      ctaRef="agenda"
      actual="/agenda-leon"
    >
      {total > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados(agenda)).replace(/</g, "\\u003c") }} />}
      <AgendaZonas enMarcha={enMarcha} dias={porDia} />
      <nav aria-label="Agenda por zonas" className="px-1">
        <p className="text-sm font-semibold text-slate-700 mb-2">Agenda de cada zona</p>
        <div className="flex flex-wrap gap-2">
          {ZONAS.map((z) => (
            <Link key={z.id} href={rutaZona(z.id)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/60 ring-1 ring-white text-[13px] font-medium text-slate-700 hover:bg-white hover:text-rose-600 transition-colors">
              <span aria-hidden>{z.emoji}</span>{z.corto}
            </Link>
          ))}
        </div>
      </nav>
    </PaginaContenido>
  );
}
