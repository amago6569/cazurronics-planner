// /agenda-leon — la agenda de los próximos 14 días, sacada del barrido diario (ideas 3 y 8).
// Lleva datos estructurados de "Event" para que Google pueda mostrar los eventos en sus resultados.
import PaginaContenido from "../components/PaginaContenido";
import TarjetaEvento, { fechaLarga } from "../components/TarjetaEvento";
import { eventosProximos } from "../../lib/eventos";

export const revalidate = 3600;
export const metadata = {
  title: "Agenda de León: conciertos, exposiciones y planes de los próximos días · Cazurronics",
  description: "Qué hacer en León esta semana: conciertos, teatro, exposiciones, mercados y fiestas en la capital y la provincia, actualizado cada día.",
  alternates: { canonical: "/agenda-leon" },
};

function datosEstructurados(dias) {
  const eventos = dias.flatMap((d) => d.eventos.map((e) => ({ ...e, dia: d.fecha }))).slice(0, 60);
  return eventos.map((e) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titulo,
    startDate: /^\d{1,2}:\d{2}/.test(e.hora || "") ? `${e.dia}T${e.hora.slice(0, 5).padStart(5, "0")}` : e.dia,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.lugar || e.localidad || "León", address: { "@type": "PostalAddress", addressLocality: e.localidad || "León", addressRegion: "León", addressCountry: "ES" } },
    ...(e.descripcion ? { description: e.descripcion } : {}),
    ...(e.fuente ? { url: e.fuente } : {}),
    ...(/grat/i.test(e.precio || "") ? { isAccessibleForFree: true } : {}),
  }));
}

export default async function Agenda() {
  const dias = (await eventosProximos(14)).filter((d) => d.eventos.length);
  const total = dias.reduce((s, d) => s + d.eventos.length, 0);
  return (
    <PaginaContenido
      etiqueta="Actualizada cada mañana"
      titulo="Agenda de León:"
      destacado="qué hay estos días"
      intro={total ? `${total} planes con fecha en León capital y la provincia durante las próximas dos semanas: conciertos, teatro, exposiciones, mercados y fiestas de los pueblos. Cada uno con su fuente.` : "Cada mañana revisamos las agendas del Ayuntamiento, la Diputación, la Junta, la prensa local, auditorios y museos para traerte todo lo que pasa en León."}
      ctaRef="agenda"
      actual="/agenda-leon"
    >
      {total > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados(dias)).replace(/</g, "\\u003c") }} />}
      {dias.length ? dias.map((d) => (
        <section key={d.fecha} aria-labelledby={`dia-${d.fecha}`}>
          <h2 id={`dia-${d.fecha}`} className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3 first-letter:uppercase">{fechaLarga(d.fecha)}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {d.eventos.map((e, i) => <TarjetaEvento key={`${d.fecha}-${i}`} e={e} />)}
          </div>
        </section>
      )) : (
        <p className="text-center text-slate-500 py-6">Estamos actualizando la agenda. Vuelve en un rato o pide tu plan: también buscamos eventos en directo.</p>
      )}
    </PaginaContenido>
  );
}
