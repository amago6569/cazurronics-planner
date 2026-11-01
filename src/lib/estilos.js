// Clases compartidas del sistema visual "Vidriera" (las mismas que usa la portada)
export const GLASS = "bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]";
export const GLASS_SOFT = "bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]";
export const PRESS = "transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/70";
export const BOTON_OSCURO = `${PRESS} inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:-translate-y-0.5`;
export const BOTON_CTA = `${PRESS} inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-bold shadow-[0_14px_36px_-10px_rgba(244,63,94,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105`;
export const TITULO_GRADIENTE = "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent";

// Sistema visual "Pegatina" (portada y plan desde nov. 2026): granate, bordes negros gruesos
// y sombra dura, como pegatinas. Letra grande estrecha (Anton) solo para titulares.
export const TINTA = "#1A1210";
export const PEGATINA = "border-[2.5px] border-[#1A1210] shadow-[4px_4px_0_0_#1A1210]";
export const PEGATINA_PEQ = "border-2 border-[#1A1210] shadow-[2px_2px_0_0_#1A1210]";
export const PULSA = "transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#1A1210] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F2B33D]";
export const BOTON_GRANATE = `${PEGATINA} ${PULSA} inline-flex items-center justify-center gap-2 h-14 px-6 rounded-2xl bg-[#7A1F2B] text-white text-lg font-extrabold hover:bg-[#8E2433]`;
export const BOTON_CREMA = `${PEGATINA_PEQ} ${PULSA} inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#FFF4E6] text-[#1A1210] text-sm font-bold hover:bg-white`;
export const DISPLAY = "font-[family-name:var(--font-anton)] font-normal uppercase leading-[0.86] tracking-[-0.005em]";
