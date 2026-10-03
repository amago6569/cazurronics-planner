// /que-hacer-en-leon — planes de este fin de semana + favoritos de la comunidad + clásicos (idea 8)
import PaginaContenido from "../components/PaginaContenido";
import TarjetaEvento, { fechaLarga } from "../components/TarjetaEvento";
import AgendaFranjas from "../components/AgendaFranjas";
import { organizarAgenda } from "../../lib/agenda";
import TarjetaLugar from "../components/TarjetaLugar";
import { eventosProximos } from "../../lib/eventos";
import { topLugares } from "../../lib/lugares";
import { GLASS } from "../../lib/estilos";

export const revalidate = 3600;
export const metadata = {
  title: "Qué hacer en León este fin de semana · Cazurronics",
  description: "Planes para este fin de semana en León: eventos con fecha, los sitios favoritos de la gente que ya ha ido y los clásicos que nunca fallan.",
  alternates: { canonical: "/que-hacer-en-leon" },
};

const CLASICOS = [
  ["⛪", "Catedral de León", "Entra a media tarde, cuando el sol atraviesa las vidrieras."],
  ["👑", "Real Colegiata de San Isidoro", "El Panteón de los Reyes, con sus pinturas románicas."],
  ["🍷", "Barrio Húmedo y Barrio Romántico", "Ronda de bares: en León, con cada consumición va una tapa."],
  ["🏰", "Casa Botines", "El edificio de Gaudí en pleno centro, con museo dentro."],
  ["🖼️", "MUSAC", "Arte contemporáneo tras la fachada de cristales de colores."],
  ["🌳", "Paseo del Bernesga", "Para bajar la comida andando junto al río."],
];

export default async function QueHacer() {
  const proximos = await eventosProximos(14);
  // Próximo fin de semana: viernes, sábado y domingo
  // Próximo fin de semana, sin repetidos: lo que dura varios días va aparte y cada día solo lo suyo
  const finde = organizarAgenda(proximos.filter((d) => [5, 6, 0].includes(new Date(`${d.fecha}T12:00:00`).getDay())).slice(0, 3));
  let favoritos = await topLugares("ranking:gusta", 6);
  if (favoritos.length < 3) favoritos = await topLugares("ranking:apariciones", 6);

  return (
    <PaginaContenido
      etiqueta="Planes en León"
      titulo="Qué hacer en León"
      destacado="este fin de semana"
      intro="Lo que pasa estos días con fecha y hora, los sitios que más gustan a quienes ya han ido con Cazurronics y los imprescindibles de siempre."
      ctaRef="que-hacer"
      actual="/que-hacer-en-leon"
    >
      {(finde.enMarcha.length > 0 || finde.porDia.length > 0) && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Este fin de semana</h2>
          <div className="space-y-5">
            {finde.enMarcha.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-rose-500 px-1 mb-2">Todo el fin de semana</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{finde.enMarcha.slice(0, 6).map((e, i) => <TarjetaEvento key={i} e={e} mostrarCuando />)}</div>
              </div>
            )}
            {finde.porDia.map((d) => (
              <div key={d.fecha}>
                <p className="text-sm font-semibold text-rose-500 px-1 mb-2 first-letter:uppercase">{fechaLarga(d.fecha)}</p>
                <AgendaFranjas eventos={d.grupos.flatMap((g) => g.eventos)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {favoritos.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Los favoritos de la comunidad</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{favoritos.map((l, i) => <TarjetaLugar key={l.clave} l={l} posicion={i + 1} />)}</div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">Clásicos que nunca fallan</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CLASICOS.map(([icono, nombre, texto]) => (
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
