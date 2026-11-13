// /privacidad — qué datos se guardan, para qué y cómo pedir que se borren (RGPD art. 13)
import PaginaLegal, { Apartado } from "../components/PaginaLegal";
import { TITULAR } from "../../lib/legal";

export const metadata = {
  title: "Privacidad · Cazurronics",
  description: "Qué datos guarda Cazurronics, para qué y cómo pedir que se borren.",
  alternates: { canonical: "/privacidad" },
  robots: { index: false, follow: true },
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Privacidad" intro="Para usar Cazurronics no hace falta registrarse ni dar tu nombre. Aquí te contamos, sin letra pequeña, lo poco que guardamos." ctaRef="privacidad">
      <Apartado titulo="Responsable">
        <p>{TITULAR.nombre}{TITULAR.nif && ` (NIF ${TITULAR.nif})`}, {TITULAR.ciudad}. Contacto: <a href={`mailto:${TITULAR.email}`} className="text-rose-600 hover:underline">{TITULAR.email}</a>.</p>
      </Apartado>

      <Apartado titulo="Qué datos usamos y para qué">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Lo que escribes para tu plan</strong> (qué te apetece, fecha, presupuesto y la zona del mapa). Lo usamos solo para montar el plan. Si lo compartes, el plan se guarda con un enlace durante unos 4 meses para que tu grupo pueda verlo y votar.</li>
          <li><strong>Si eres un negocio y nos escribes</strong> (nombre del local, email o teléfono y mensaje). Lo usamos solo para contestarte y hablar de aparecer en Cazurronics. Lo guardamos mientras estemos en contacto, y como mucho las últimas 300 solicitudes.</li>
          <li><strong>Tu dirección IP</strong>, durante como mucho día y medio, solo para frenar abusos (por ejemplo, que alguien pida miles de planes con un programa).</li>
          <li><strong>Si juegas en la Liga Cazurra</strong> (es opcional): tu correo, el apodo que elijas, tus partidas y sus puntos, y si quieres recibir novedades. El correo sirve para entrar (te mandamos un código) y para avisarte si ganas; nunca se publica. En el ranking solo sale tu apodo. Puedes borrar tu cuenta y todas tus partidas desde la propia liga, en el menú con tu apodo.</li>
          <li><strong>Estadísticas</strong>: contamos cuántas visitas y planes hay al día, sin cookies y sin saber quién eres.</li>
        </ul>
        <p>Base legal: tu consentimiento al usar la web o escribirnos, y nuestro interés legítimo en que la web no se sature. No vendemos datos ni hacemos publicidad con ellos.</p>
      </Apartado>

      <Apartado titulo="Quién más los trata">
        <p>Para que la web funcione usamos estos servicios, que tratan los datos solo por encargo nuestro:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Vercel</strong>: alojamiento de la web.</li>
          <li><strong>Upstash</strong>: base de datos donde se guardan los planes compartidos y las solicitudes.</li>
          <li><strong>Google</strong> (Gemini, Maps y Hojas de cálculo): crear el plan con IA, fotos y datos de los sitios, y guardar las solicitudes de negocios.</li>
          <li><strong>OpenStreetMap</strong>: el mapa donde eliges la zona.</li>
          <li><strong>Supabase</strong> (servidores en Fráncfort, Alemania): cuentas y partidas de la Liga Cazurra.</li>
          <li><strong>Strato</strong> (Alemania): el correo de Cazurronics, desde el que salen los códigos para entrar en la Liga y los avisos a los ganadores.</li>
        </ul>
        <p>Algunos de estos servicios pueden tratar datos fuera de la Unión Europea, siempre con las garantías que exige el RGPD (cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.).</p>
      </Apartado>

      <Apartado titulo="Tus derechos">
        <p>Puedes pedir ver, corregir o borrar tus datos, oponerte a que los usemos o pedir una copia, escribiendo a {TITULAR.email}. Si crees que no lo hemos hecho bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </Apartado>

      <Apartado titulo="Menores">
        <p>La web no está pensada para menores de 14 años y no les pedimos datos.</p>
      </Apartado>
    </PaginaLegal>
  );
}
