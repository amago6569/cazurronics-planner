// Plantilla de las páginas de contenido (agenda, qué hacer, dónde comer)
import Link from "next/link";
import Fondo from "./Fondo";
import { GLASS, BOTON_CTA, TITULO_GRADIENTE } from "../../lib/estilos";

export const PAGINAS = [
  ["/agenda-leon", "📅 Agenda de León"],
  ["/que-hacer-en-leon", "✨ Qué hacer en León"],
  ["/donde-comer-en-leon", "🍷 Dónde comer en León"],
];

export default function PaginaContenido({ etiqueta, titulo, destacado, intro, ctaRef, children, actual }) {
  return (
    <main className="min-h-[100dvh] px-4 pt-4 pb-16 sm:px-6 text-slate-800 antialiased">
      <Fondo />
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
        <header className={`${GLASS} sticky top-3 z-50 rounded-full pl-4 pr-2 py-2 flex items-center justify-between gap-2`}>
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900"><span className="text-2xl">🦁</span><span className="hidden sm:inline">Cazurronics</span></Link>
          <Link href={`/?ref=${ctaRef}`} className={`${BOTON_CTA} h-11 px-4 text-sm`}>✨ Créame un plan</Link>
        </header>

        <section className={`${GLASS} rounded-[2.25rem] p-6 sm:p-9 relative overflow-hidden cz-up`}>
          <img src="/roseton.png" alt="" aria-hidden className="pointer-events-none absolute -right-20 -top-20 w-64 h-64 object-cover rounded-full opacity-[0.18]" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">{etiqueta}</p>
          <h1 className="relative text-[2.2rem] leading-[1.05] sm:text-5xl font-bold tracking-[-0.03em] text-slate-900 mt-2">
            {titulo} {destacado && <span className={TITULO_GRADIENTE}>{destacado}</span>}
          </h1>
          <p className="relative mt-4 text-[15px] sm:text-base text-slate-600 leading-relaxed max-w-2xl">{intro}</p>
        </section>

        {children}

        <section className={`${GLASS} rounded-[2.25rem] p-6 sm:p-8 text-center`}>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">¿No sabes por dónde empezar?</p>
          <p className="text-slate-600 mt-2 mb-5">Dime qué te apetece, tu presupuesto y la zona, y te monto la ruta en menos de un minuto. Gratis.</p>
          <Link href={`/?ref=${ctaRef}`} className={BOTON_CTA}>✨ Crear mi plan</Link>
        </section>

        <nav aria-label="Más de León" className="flex flex-wrap justify-center gap-2">
          {PAGINAS.filter(([h]) => h !== actual).map(([href, texto]) => (
            <Link key={href} href={href} className="h-9 px-3.5 inline-flex items-center rounded-full bg-white/50 ring-1 ring-white text-[13px] font-medium text-slate-600 hover:bg-white hover:text-rose-600 transition-colors">{texto}</Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
