// Pie de página discreto con los enlaces legales. Va en el layout, así sale en todas las páginas.
// En móvil deja hueco abajo para que no lo tape el botón flotante de "crear plan" de la portada.
import Link from "next/link";
import { ENLACES_LEGALES } from "../../lib/legal";

export default function PieLegal() {
  return (
    <footer className="relative z-10 px-4 pt-2 pb-32 sm:pb-8 text-center text-[12px] text-slate-500">
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-1">
        <span>Cazurronics {new Date().getFullYear()}</span>
        {ENLACES_LEGALES.map(([href, texto]) => (
          <span key={href} className="inline-flex items-center gap-x-1">
            <span aria-hidden>·</span>
            <Link href={href} className="px-1 py-2 hover:text-slate-800 hover:underline underline-offset-2">{texto}</Link>
          </span>
        ))}
      </nav>
    </footer>
  );
}
