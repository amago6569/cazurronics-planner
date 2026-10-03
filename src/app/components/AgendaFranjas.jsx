// Lista de eventos sin repetir, ordenada por hora y agrupada: Todo el día · Mañana · Tarde · Noche
import TarjetaEvento from "./TarjetaEvento";
import { agruparPorFranja } from "../../lib/agenda";

export default function AgendaFranjas({ eventos, mostrarCuando = false, columnas = "md:grid-cols-2" }) {
  const grupos = agruparPorFranja(eventos);
  if (!grupos.length) return null;
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.id}>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 px-1 mb-2">
            <span aria-hidden>{g.emoji}</span>{g.titulo}
            <span className="font-normal text-slate-400">· {g.eventos.length}</span>
          </p>
          <div className={`grid grid-cols-1 ${columnas} gap-2.5`}>
            {g.eventos.map((e, i) => <TarjetaEvento key={`${g.id}-${i}-${e.titulo}`} e={e} mostrarCuando={mostrarCuando} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
