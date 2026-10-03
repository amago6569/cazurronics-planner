// /finde — "Lo mejor del finde en León": una selección corta (no la lista entera) de lo que de verdad
// merece la pena el viernes, el sábado y el domingo. Está pensada para compartir: botón de WhatsApp,
// imagen bonita al pegar el enlace y la agenda completa un toque más abajo.
import Link from "next/link";
import PaginaContenido from "../components/PaginaContenido";
import TarjetaEvento from "../components/TarjetaEvento";
import { eventosProximos } from "../../lib/eventos";
import { hoyEnLeon } from "../../lib/estadisticas";
import { calcularFinde } from "../../lib/finde";
import { zonaPorId } from "../../lib/zonas";
import { BOTON_CTA, GLASS, PRESS } from "../../lib/estilos";

export const revalidate = 1800;

const TITULO = "Lo mejor del finde en León: planes del viernes, sábado y domingo · Cazurronics";
const DESCRIPCION = "Una selección de lo que merece la pena este fin de semana en León y la provincia: conciertos, teatro, mercados, fiestas y exposiciones, con hora, sitio y fuente.";
export const metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/finde" },
  openGraph: { title: "Lo mejor del finde en León", description: DESCRIPCION, url: "/finde", type: "website", locale: "es_ES", images: [{ url: "/api/finde/imagen?f=og", width: 1200, height: 630, alt: "Lo mejor del finde en León" }] },
  twitter: { card: "summary_large_image", images: ["/api/finde/imagen?f=og"] },
};

const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const diaSemana = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });

export default async function Finde() {
  const p = calcularFinde(await eventosProximos(10), hoyEnLeon());
  const wa = `https://wa.me/?text=${encodeURIComponent(p.whatsapp)}`;
  return (
    <PaginaContenido
      etiqueta={`Selección del ${p.rango}`}
      titulo="Lo mejor del finde"
      destacado="en León"
      intro={p.hayContenido ? `Lo que de verdad merece la pena, elegido entre ${p.total} planes de la agenda: con hora, sitio y su fuente. Mándaselo a tu grupo y decidid en un minuto.` : "Estamos cerrando la agenda de este fin de semana. Vuelve en unas horas o mira todo lo que hay en las próximas dos semanas."}
      ctaRef="finde"
      actual="/finde"
    >
      {p.hayContenido && (
        <div className="flex flex-wrap gap-2 px-1">
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${PRESS} inline-flex items-center gap-2 h-11 px-5 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-[0_10px_24px_-8px_rgba(16,185,129,0.7)] hover:bg-emerald-600`}>💬 Mandar al grupo</a>
          <Link href="/agenda-leon" className={`${PRESS} inline-flex items-center h-11 px-5 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold text-slate-700 hover:bg-white`}>📅 Ver toda la agenda</Link>
        </div>
      )}

      {p.dias.filter((d) => d.leon.length).map((d) => (
        <section key={d.fecha}>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">{mayus(d.nombre)} {d.numero}<span className="font-normal text-slate-400 text-base"> · {d.total} planes en total</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{d.leon.map((e, i) => <TarjetaEvento key={i} e={e} />)}</div>
        </section>
      ))}

      {p.provincia.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">🏔️ Por la provincia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {p.provincia.map((e, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-rose-500 px-1 mb-1">{mayus(diaSemana(e.fecha))} · {zonaPorId(e.zona)?.corto || "León"}</p>
                <TarjetaEvento e={e} />
              </div>
            ))}
          </div>
        </section>
      )}

      {p.enMarcha.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 px-1 mb-3">📌 Todo el finde</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{p.enMarcha.map((e, i) => <TarjetaEvento key={i} e={e} mostrarCuando />)}</div>
        </section>
      )}

      {p.hayContenido && (
        <section className={`${GLASS} rounded-[2rem] p-6 text-center`}>
          <p className="font-bold text-slate-900 text-lg">¿Ninguno te convence?</p>
          <p className="text-slate-600 mt-1 mb-4 text-sm">Dime qué te apetece y tu presupuesto, y te monto el finde a tu medida.</p>
          <Link href="/?ref=finde" className={BOTON_CTA}>✨ Montar mi plan</Link>
        </section>
      )}
    </PaginaContenido>
  );
}
