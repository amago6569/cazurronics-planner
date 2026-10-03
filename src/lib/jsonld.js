// Datos estructurados "Event" para que Google enseñe los planes en sus resultados.
// Recibe lo que devuelve organizarAgenda(): { enMarcha, porDia: [{ fecha, grupos: [{ eventos }] }] }
import { leerHora } from "./agenda";

export function datosEstructurados({ enMarcha, porDia }) {
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
