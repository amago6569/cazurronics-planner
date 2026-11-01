// Plantilla de las páginas legales: misma cabecera que el resto, texto en una tarjeta y fácil de leer
import PaginaContenido from "./PaginaContenido";
import { GLASS } from "../../lib/estilos";
import { ACTUALIZADO } from "../../lib/legal";

export function Apartado({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{titulo}</h2>
      <div className="space-y-2 text-[15px] text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PaginaLegal({ titulo, intro, ctaRef, children }) {
  return (
    <PaginaContenido etiqueta="Información legal" titulo={titulo} intro={intro} ctaRef={ctaRef} sencilla>
      <article className={`${GLASS} rounded-[2.25rem] p-6 sm:p-9 space-y-6`}>
        {children}
        <p className="text-xs text-slate-500">Última actualización: {ACTUALIZADO}.</p>
      </article>
    </PaginaContenido>
  );
}
