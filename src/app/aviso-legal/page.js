// /aviso-legal — quién está detrás de la web (LSSI art. 10)
import PaginaLegal, { Apartado } from "../components/PaginaLegal";
import { TITULAR } from "../../lib/legal";

export const metadata = {
  title: "Aviso legal · Cazurronics",
  description: "Quién está detrás de Cazurronics y las condiciones de uso de la web.",
  alternates: { canonical: "/aviso-legal" },
  robots: { index: false, follow: true },
};

export default function AvisoLegal() {
  return (
    <PaginaLegal titulo="Aviso legal" intro="Quién está detrás de Cazurronics y las reglas básicas para usar la web." ctaRef="aviso-legal">
      <Apartado titulo="Quién somos">
        <p>Esta web ({TITULAR.web}) es un proyecto personal, sin empresa detrás, de una persona particular:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Titular:</strong> {TITULAR.nombre}</li>
          {TITULAR.nif && <li><strong>NIF:</strong> {TITULAR.nif}</li>}
          <li><strong>Localidad:</strong> {TITULAR.ciudad}</li>
          <li><strong>Contacto:</strong> <a href={`mailto:${TITULAR.email}`} className="text-rose-600 hover:underline">{TITULAR.email}</a></li>
        </ul>
      </Apartado>

      <Apartado titulo="Qué es Cazurronics">
        <p>Cazurronics te ayuda a montar planes de ocio en León y su provincia. Es gratis para quien la usa. Los planes los propone una inteligencia artificial a partir de datos públicos de negocios y eventos, así que pueden tener errores: horarios, precios o eventos pueden cambiar o cancelarse. Confírmalo con el sitio antes de ir.</p>
      </Apartado>

      <Apartado titulo="Uso de la web">
        <p>Puedes usar la web libremente para organizar tus planes. No está permitido usarla de forma automatizada para saturarla, copiar sus contenidos en masa o intentar acceder a zonas privadas.</p>
      </Apartado>

      <Apartado titulo="Enlaces y negocios">
        <p>La web enlaza a negocios, mapas y webs de terceros. No somos responsables de sus contenidos ni de lo que ofrezcan. Las valoraciones y fotos de los sitios pueden venir de servicios externos como Google.</p>
      </Apartado>

      <Apartado titulo="Contenidos">
        <p>El diseño y los textos de la web los ha hecho su titular; si quieres usarlos, pregunta antes. Los nombres, logos y fotos de los negocios pertenecen a sus dueños.</p>
      </Apartado>

      <Apartado titulo="Ley aplicable">
        <p>Esta web se rige por la ley española. Si surge cualquier problema, escríbenos primero a {TITULAR.email} y lo intentamos arreglar.</p>
      </Apartado>
    </PaginaLegal>
  );
}
