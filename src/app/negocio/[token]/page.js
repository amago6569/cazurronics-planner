// /negocio/TOKEN — panel privado de un local (idea 6).
// El enlace lo genera el equipo desde /panel; va firmado, así que nadie puede ver los datos de otro local.
import { notFound } from "next/navigation";
import Link from "next/link";
import Fondo from "../../components/Fondo";
import { claveDesdeToken, leerLugar } from "../../../lib/lugares";
import { GLASS, BOTON_CTA, TITULO_GRADIENTE } from "../../../lib/estilos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu local en Cazurronics", robots: { index: false, follow: false } };

const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);

export default async function PanelNegocio({ params }) {
  const { token } = await params;
  const clave = claveDesdeToken(token);
  const lugar = clave ? await leerLugar(clave) : null;
  if (!lugar) notFound();

  const s = lugar.stats;
  const valoradas = s.bien + s.mal;
  const recomendacion = valoradas ? Math.round((s.bien / valoradas) * 100) : null;
  const tarjetas = [
    { icono: "🗺️", valor: s.apariciones, texto: "veces has salido en un plan" },
    { icono: "👀", valor: s.detalle, texto: "personas abrieron tu ficha" },
    { icono: "📞", valor: s.llamar, texto: "pulsaron “Llamar”" },
    { icono: "🌐", valor: s.web, texto: "visitaron tu web desde aquí" },
  ];

  return (
    <main className="min-h-[100dvh] px-4 py-8 sm:py-12 text-slate-800">
      <Fondo />
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
        <section className={`${GLASS} rounded-[2.25rem] p-6 sm:p-8 relative overflow-hidden cz-up`}>
          <img src="/roseton.png" alt="" aria-hidden className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 object-cover rounded-full opacity-20" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Tu local en Cazurronics</p>
          <h1 className="relative text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">{lugar.nombre}</h1>
          <p className="relative text-slate-600 mt-2 max-w-lg">Estas cifras son reales: cuentan cada vez que nuestra IA te ha recomendado y lo que hizo la gente después.</p>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {tarjetas.map((t, i) => (
            <div key={t.texto} className={`${GLASS} rounded-[1.75rem] p-5 cz-up`} style={{ animationDelay: `${80 + i * 60}ms` }}>
              <p className="text-2xl">{t.icono}</p>
              <p className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums mt-2">{fmt(t.valor)}</p>
              <p className="text-sm text-slate-500 leading-snug">{t.texto}</p>
            </div>
          ))}
        </div>

        <section className={`${GLASS} rounded-[2rem] p-6 cz-up`} style={{ animationDelay: "320ms" }}>
          <h2 className="font-bold text-slate-900 mb-1">Qué dice la gente que fue</h2>
          {recomendacion === null ? (
            <p className="text-sm text-slate-500">Todavía nadie ha valorado su visita. Cuando lo hagan, lo verás aquí.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">{valoradas} {valoradas === 1 ? "valoración" : "valoraciones"} de personas que fueron con un plan de Cazurronics</p>
              <div className="flex items-center gap-4">
                <p className={`text-5xl font-bold tracking-tight tabular-nums ${TITULO_GRADIENTE}`}>{recomendacion} %</p>
                <p className="text-sm text-slate-600">lo recomiendan<br /><span className="text-slate-400">😍 {s.bien} · 😕 {s.mal}</span></p>
              </div>
            </>
          )}
        </section>

        <section className={`${GLASS} rounded-[2rem] p-6 text-center cz-up`} style={{ animationDelay: "380ms" }}>
          <p className="text-lg font-bold text-slate-900">¿Quieres salir en más planes?</p>
          <p className="text-sm text-slate-600 mt-1 mb-4">Con el sello Cazurronics Choice te destacamos en la web y en nuestro Instagram.</p>
          <a href="https://www.instagram.com/cazurronics" target="_blank" rel="noopener noreferrer" className={BOTON_CTA}>Hablar con el equipo</a>
          <p className="mt-4 text-xs text-slate-400"><Link href="/" className="hover:text-rose-500">cazurronics · No pienses. Cazurrea.</Link></p>
        </section>
      </div>
    </main>
  );
}
