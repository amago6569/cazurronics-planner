// /cookies — solo hay almacenamiento técnico, por eso no hace falta banner de consentimiento (LSSI art. 22.2)
import PaginaLegal, { Apartado } from "../components/PaginaLegal";
import { TITULAR } from "../../lib/legal";

export const metadata = {
  title: "Cookies · Cazurronics",
  description: "Cazurronics no usa cookies de publicidad ni de seguimiento.",
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: true },
};

export default function Cookies() {
  return (
    <PaginaLegal titulo="Cookies" intro="Corto y claro: no usamos cookies de publicidad ni de seguimiento. Por eso no te sale ningún aviso pidiéndote permiso." ctaRef="cookies">
      <Apartado titulo="Qué guardamos en tu navegador">
        <p>Solo lo imprescindible para que la web funcione, y se queda en tu dispositivo:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Tus planes recientes y tus votos</strong>, para que no se pierdan si recargas la página y no votes dos veces lo mismo.</li>
          <li><strong>Un identificador anónimo</strong> (un código al azar, sin tu nombre ni nada tuyo) para contar tus votos y valoraciones una sola vez.</li>
          <li><strong>La fecha de tu última visita</strong>, solo para contar cuánta gente vuelve. Nunca sale de tu navegador con tu nombre ni se cruza con otras webs.</li>
        </ul>
        <p>Son datos técnicos y de medición propia, sin terceros, que la ley permite usar sin pedir permiso.</p>
      </Apartado>

      <Apartado titulo="Lo que no hacemos">
        <p>No usamos Google Analytics, ni píxeles de redes sociales, ni nada que te siga por otras webs. Las estadísticas de visitas las contamos en nuestro servidor, sin cookies.</p>
      </Apartado>

      <Apartado titulo="Servicios externos">
        <p>Al ver el mapa o las fotos de los sitios, tu navegador se conecta a OpenStreetMap y Google para descargarlas. Esos servicios pueden recibir tu IP, como pasa con cualquier imagen de internet.</p>
      </Apartado>

      <Apartado titulo="Cómo borrarlo">
        <p>Puedes borrar todo desde los ajustes de tu navegador (datos de sitios o historial). Para cualquier duda: {TITULAR.email}.</p>
      </Apartado>
    </PaginaLegal>
  );
}
