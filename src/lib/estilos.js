// Clases compartidas del sistema visual "Vidriera" (las mismas que usa la portada)
export const GLASS = "bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]";
export const GLASS_SOFT = "bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]";
export const PRESS = "transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.97]";
export const BOTON_OSCURO = `${PRESS} inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:-translate-y-0.5`;
export const BOTON_CTA = `${PRESS} inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-bold shadow-[0_14px_36px_-10px_rgba(244,63,94,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105`;
export const TITULO_GRADIENTE = "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent";
