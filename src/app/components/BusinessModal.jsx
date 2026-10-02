"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// URL de tu Google Apps Script
const GAS_URL = process.env.NEXT_PUBLIC_GAS_BUSINESS_URL;

const ESTADO = {
  IDLE: "idle",
  ENVIANDO: "enviando",
  ENVIADO: "enviado",
  ERROR: "error",
};

export default function BusinessModal() {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState(ESTADO.IDLE);
  const [form, setForm] = useState({ nombreLocal: "", email: "", mensaje: "" });

  const cerrar = () => {
    setAbierto(false);
    setTimeout(() => {
      setEstado(ESTADO.IDLE);
      setForm({ nombreLocal: "", email: "", mensaje: "" });
    }, 200);
  };

  const manejarCambio = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    if (!form.nombreLocal.trim() || !form.email.trim()) return;

    if (!GAS_URL) {
      console.error("Falta configurar NEXT_PUBLIC_GAS_BUSINESS_URL en .env.local");
      setEstado(ESTADO.ERROR);
      return;
    }

    setEstado(ESTADO.ENVIANDO);

    try {
      const respuesta = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(form),
      });

      const texto = await respuesta.text();
      let datos;
      try {
        datos = JSON.parse(texto);
      } catch {
        throw new Error("Error leyendo JSON");
      }

      if (!datos.exito) {
        throw new Error(datos.mensaje);
      }

      setEstado(ESTADO.ENVIADO);
    } catch (error) {
      setEstado(ESTADO.ERROR);
    }
  };

  // Solo visual: cerrar con Escape mientras el modal está abierto
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const enviando = estado === ESTADO.ENVIANDO;
  const CAMPO = "w-full bg-white/80 border border-white text-slate-800 placeholder:text-slate-400 text-[15px] font-medium rounded-2xl px-4 py-3 outline-none ring-1 ring-slate-900/5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-300/70 focus:shadow-[0_0_0_6px_rgba(251,113,133,0.12)] disabled:opacity-50";

  const VENTAJAS = [
    { icono: "⭐", color: "from-amber-300 to-orange-400", titulo: "Sello Cazurronics Choice", texto: "Tu local destacado en la web y en los planes" },
    { icono: "📱", color: "from-fuchsia-400 to-rose-500", titulo: "Promoción en Instagram", texto: "Ruido de verdad en @cazurronics" },
    { icono: "📍", color: "from-sky-300 to-indigo-500", titulo: "Ficha VIP permanente", texto: "En nuestra sección de locales colaboradores" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bm-sube { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        @keyframes bm-pop { 0% { opacity: 0; transform: scale(.5); } 60% { opacity: 1; transform: scale(1.12); } 100% { transform: none; } }
        @keyframes bm-trazo { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
        .bm-fade { animation: bm-fade .3s ease both; }
        .bm-sube { animation: bm-sube .5s cubic-bezier(.2,.8,.2,1) both; }
        .bm-pop { animation: bm-pop .6s cubic-bezier(.3,1.4,.5,1) both; }
        .bm-trazo { stroke-dasharray: 30; animation: bm-trazo .5s ease .35s both; }
        @media (prefers-reduced-motion: reduce) { .bm-sube, .bm-pop { animation: bm-fade .3s ease both !important; } .bm-trazo { animation: none; stroke-dasharray: none; } }
      `}} />

      {/* Botón de apertura */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="group relative shrink-0 inline-flex items-center gap-1.5 h-11 pl-4 pr-3.5 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-6px_rgba(15,23,42,0.55)] active:scale-[0.97] transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
      >
        <span className="transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-12">🚀</span>
        Destácalo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
      </button>

      {/* Portal a <body>: si no, el cristal (backdrop-filter) de la tarjeta que contiene
          el botón "atrapa" al modal y no ocupa la pantalla entera */}
      {abierto && typeof document !== "undefined" && createPortal(
        <div
          className="bm-fade fixed inset-0 bg-slate-900/35 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center sm:p-4"
          onClick={cerrar}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bm-titulo"
            className="bm-sube relative w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar bg-white/90 backdrop-blur-2xl backdrop-saturate-150 border border-white/80 rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_-10px_60px_-10px_rgba(15,23,42,0.35)] sm:shadow-[0_40px_80px_-20px_rgba(15,23,42,0.45)] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="sm:hidden mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-rose-200/70 via-amber-200/50 to-transparent blur-3xl" />

            {/* CABECERA */}
            <div className="relative flex justify-between items-start gap-3 mb-5">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-100 to-orange-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                  🦁 Para negocios de León
                </span>
                <h2 id="bm-titulo" className="text-2xl sm:text-[1.7rem] font-bold tracking-tight text-slate-900 leading-tight">
                  Impulsa tu negocio con{" "}
                  <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">Cazurronics</span>
                </h2>
              </div>
              <button
                onClick={cerrar}
                aria-label="Cerrar"
                className="shrink-0 w-11 h-11 rounded-full bg-slate-900/5 text-slate-500 flex items-center justify-center hover:bg-slate-900/10 hover:text-slate-900 hover:rotate-90 active:scale-[0.97] transition-all duration-300"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* VENTAJAS */}
            <ul className="relative grid gap-2 mb-5">
              {VENTAJAS.map((v) => (
                <li key={v.titulo} className="flex items-center gap-3 bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-3">
                  <span className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${v.color} flex items-center justify-center text-lg shadow-sm`}>{v.icono}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 leading-snug">{v.titulo}</p>
                    <p className="text-xs text-slate-500 leading-snug">{v.texto}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* FORMULARIO */}
            {estado === ESTADO.ENVIADO ? (
              <div className="relative text-center rounded-[1.5rem] p-6 bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100">
                <div className="bm-pop mx-auto mb-3 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(16,185,129,0.7)]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path className="bm-trazo" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </div>
                <p className="text-lg font-bold text-slate-900">¡Solicitud enviada!</p>
                <p className="text-sm text-slate-600 mt-1">Te hemos mandado un email. En breve nos ponemos en contacto.</p>
              </div>
            ) : (
              <form onSubmit={enviarSolicitud} className="relative space-y-2.5">
                <input
                  type="text"
                  name="nombreLocal"
                  value={form.nombreLocal}
                  onChange={manejarCambio}
                  placeholder="Nombre del local"
                  required
                  disabled={enviando}
                  className={CAMPO}
                />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={manejarCambio}
                  placeholder="Email de contacto"
                  required
                  disabled={enviando}
                  className={CAMPO}
                />
                <textarea
                  name="mensaje"
                  value={form.mensaje}
                  onChange={manejarCambio}
                  placeholder="Cuéntanos sobre tu local (opcional)"
                  rows="2"
                  disabled={enviando}
                  className={`${CAMPO} resize-none leading-relaxed`}
                />

                {estado === ESTADO.ERROR && (
                  <p className="flex items-center gap-2 text-sm font-medium text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-2xl px-3.5 py-2.5">
                    <span>⚠️</span> Error al enviar. Escríbenos por Instagram.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-semibold shadow-[0_12px_28px_-10px_rgba(244,63,94,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_16px_34px_-10px_rgba(244,63,94,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] active:scale-[0.97] disabled:opacity-60 disabled:hover:translate-y-0 transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] flex items-center justify-center gap-2"
                >
                  {enviando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                  {enviando ? "Enviando..." : "Enviar solicitud"}
                </button>
              </form>
            )}

            {/* ALTERNATIVA INSTAGRAM */}
            <div className="relative flex items-center gap-3 my-5" aria-hidden>
              <span className="h-px flex-1 bg-slate-900/10" />
              <span className="text-xs font-medium text-slate-400">o, más directo</span>
              <span className="h-px flex-1 bg-slate-900/10" />
            </div>
            <a
              href="https://www.instagram.com/cazurronics"
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex items-center justify-center gap-2 h-12 rounded-2xl bg-white text-slate-900 font-semibold ring-1 ring-slate-900/10 hover:ring-rose-200 hover:bg-gradient-to-r hover:from-fuchsia-50 hover:via-rose-50 hover:to-amber-50 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-300"
            >
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" /></svg>
              </span>
              Háblanos en @cazurronics
            </a>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
