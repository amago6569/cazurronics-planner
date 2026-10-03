// /agenda-leon — la agenda de los próximos 14 días, sacada del barrido diario por zonas (ideas 3 y 8).
// Con mapa: se elige zona (empieza en León capital) y día. Sin repeticiones: lo que dura varios días
// (exposiciones, mercados semanales, ferias) sale UNA vez, y cada día muestra solo lo suyo, ordenado por horas.
// Lleva datos estructurados "Event" para Google.
import PaginaContenido from "../components/PaginaContenido";
import AgendaZonas from "../components/AgendaZonas";
import { eventosProximos } from "../../lib/eventos";
import { deduplicar, esDeVariosDias, leerHora, organizarAgenda } from "../../lib/agenda";

export const revalidate = 3600;
export const metadata = {
  title: "Agenda de León: conciertos, exposiciones y planes de los próximos días · Cazurronics",
  description: "Qué hacer en León esta semana: conciertos, teatro, exposiciones, mercados y fiestas en la capital y la provincia, actualizado cada día.",
  alternates: { canonical: "/agenda-leon" },
};

function datosEstructurados({ enMarcha, porDia }) {
  const unicos = [
    ...enMarcha.map((e) => ({ ...e, dia: e.fecha, diaFin: e.fechaFin })),
    ...porDia.flatMap((d) => d.grupos.flatMap((g) => g.eventos.map((e) => ({ ...e, dia: d.fecha })))),
  ].slice(0, 60);
  return unicos.map((e) => {
    const h = leerHora(e.hora);
    const hora = h.min != null ? `T${String(Math.floor(h.min / 60)).padStart(2, "0")}:${String(h.min % 60).padStart(2, "0")}` : "";
    return {
      "@context": "https://schema.org",
      "@type": "Event",
      name: e.titulo,
      startDate: `${e.dia}${hora}`,
      ...(e.diaFin ? { endDate: e.diaFin } : {}),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: e.lugar || e.localidad || "León", address: { "@type": "PostalAddress", addressLocality: e.localidad || "León", addressRegion: "León", addressCountry: "ES" } },
      ...(e.descripcion ? { description: e.descripcion } : {}),
      ...(e.fuente ? { url: e.fuente } : {}),
      ...(/grat/i.test(e.precio || "") ? { isAccessibleForFree: true } : {}),
    };
  });
}

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
    </PaginaContenido>
  );
}
