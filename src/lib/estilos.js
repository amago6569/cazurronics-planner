// Clases compartidas del sistema visual "Vidriera" (las mismas que usa la portada)
export const GLASS = "bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]";
export const GLASS_SOFT = "bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]";
export const PRESS = "transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/70";
export const BOTON_OSCURO = `${PRESS} inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:-translate-y-0.5`;
export const BOTON_CTA = `${PRESS} inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-bold shadow-[0_14px_36px_-10px_rgba(244,63,94,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105`;
export const TITULO_GRADIENTE = "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent";

// Sistema visual "Desierto" (portada y plan desde nov. 2026): calco de la web de White Desert.
// Blanco, azul marino, rayas finas de 1 px, esquinas rectas y un solo acento naranja.
// Oswald estrecha para la palabra gigante, Cormorant para titulares y Inter Tight para el texto.
export const MARINO = "#1B2541";
export const ACENTO = "#E2572B";
export const GIGANTE = "font-[family-name:var(--font-oswald)] font-normal uppercase leading-[0.8] tracking-[-0.01em]";
export const SERIFA = "font-[family-name:var(--font-cormorant)] font-normal";
export const TEXTO = "font-[family-name:var(--font-inter-tight)]";
export const ETIQUETA = "font-[family-name:var(--font-inter-tight)] text-[11px] font-medium uppercase tracking-[0.18em]";
export const TOQUE = "transition-[background-color,color,border-color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#E2572B]";
export const BOTON_RAYA = `${TOQUE} inline-flex items-center justify-center gap-2 h-10 px-4 border text-[11px] font-medium uppercase tracking-[0.18em] font-[family-name:var(--font-inter-tight)]`;
export const BOTON_ACENTO = `${TOQUE} inline-flex items-center justify-center gap-3 h-14 px-6 bg-[#E2572B] text-white text-[12px] font-medium uppercase tracking-[0.2em] font-[family-name:var(--font-inter-tight)] hover:bg-[#C9471F] active:bg-[#B53F1B]`;
