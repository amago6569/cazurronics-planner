// Las dos partes de Cazurronics, como pestañas de una app: Planes (portada) y Despensa.
// Solo son enlaces: no toca estados ni llamadas al servidor.
import Link from "next/link";
import { GLASS, PRESS, PEGATINA_PEQ, PULSA } from "../../lib/estilos";

const SECCIONES = [
  { id: "planes", href: "/", emoji: "🦁", texto: "Planes", sub: "Qué hacer" },
  { id: "despensa", href: "/despensa", emoji: "🧺", texto: "Despensa", sub: "Qué comprar" },
];

export default function SelectorSeccion({ actual, className = "", estilo = "vidriera" }) {
  // Variante "pegatina" (portada nueva): pestañas planas con borde negro. La Despensa sigue con la de cristal.
  if (estilo === "pegatina") {
    return (
      <nav aria-label="Secciones de Cazurronics" className={`grid grid-cols-2 gap-2 ${className}`}>
        {SECCIONES.map((s) => {
          const activa = s.id === actual;
          return (
            <Link key={s.id} href={s.href} aria-current={activa ? "page" : undefined}
              className={`${PEGATINA_PEQ} ${PULSA} flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-bold ${activa ? "bg-[#1A1210] text-[#FFF4E6]" : "bg-[#FFF4E6] text-[#1A1210] hover:bg-white"}`}>
              <span aria-hidden>{s.emoji}</span>{s.texto}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Secciones de Cazurronics" className={`${GLASS} grid grid-cols-2 gap-1 p-1.5 rounded-[1.6rem] ${className}`}>
      {SECCIONES.map((s) => {
        const activa = s.id === actual;
        return (
          <Link
            key={s.id} href={s.href} aria-current={activa ? "page" : undefined}
            className={`${PRESS} flex items-center justify-center gap-2.5 h-14 rounded-[1.2rem] ${activa ? "bg-slate-900 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.7)]" : "text-slate-700 hover:bg-white/70 hover:-translate-y-0.5"}`}
          >
            <span className="text-2xl leading-none" aria-hidden>{s.emoji}</span>
            <span className="flex flex-col leading-tight text-left">
              <span className="text-[15px] font-bold">{s.texto}</span>
              <span className={`text-[11px] font-medium ${activa ? "text-white/70" : "text-slate-500"}`}>{s.sub}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
