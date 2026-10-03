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

const FORM_VACIO = { nombreLocal: "", email: "", telefono: "", mensaje: "", web: "" };

// Lo que gana un local por estar en Cazurronics Choices (sin precios ni plazos: eso se habla en persona)
const VENTAJAS = [
  { icono: "⭐", color: "from-amber-300 to-orange-400", titulo: "En la portada", texto: "Tu local con foto en Cazurronics Choices" },
  { icono: "📱", color: "from-fuchsia-400 to-rose-500", titulo: "Tu destacada en Instagram", texto: "Historias y posts en @cazurronics" },
  { icono: "🏷️", color: "from-rose-300 to-rose-500", titulo: "Sello Choice", texto: "Para tu puerta y tus redes" },
  { icono: "📊", color: "from-sky-300 to-indigo-500", titulo: "Tus estadísticas", texto: "Planes, fichas, llamadas y valoraciones" },
];

// Manda la solicitud a tu Google Apps Script. Devuelve true si el script confirma que la ha guardado.
async function enviarAlSheet(form) {
  if (!GAS_URL) {
    console.error("Falta configurar NEXT_PUBLIC_GAS_BUSINESS_URL en .env.local / Vercel");
    return false;
  }
  try {
    const respuesta = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      // Mismos campos de siempre; el teléfono va dentro del mensaje para que llegue a la hoja tal cual
      body: JSON.stringify({
        nombreLocal: form.nombreLocal,
        email: form.email,
        mensaje: [form.telefono && `Teléfono: ${form.telefono}`, form.mensaje].filter(Boolean).join("\n"),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const texto = await respuesta.text();
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      throw new Error("Error leyendo JSON");
    }
    if (!datos.exito) throw new Error(datos.mensaje);
    return true;
  } catch (error) {
    console.error("[negocios] Apps Script:", error?.message || error);
    return false;
  }
}

// Copia de seguridad en nuestro servidor: aparece en /panel aunque el Apps Script falle
async function guardarCopia(form, enviadoAlSheet) {
  try {
    const r = await fetch("/api/negocios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, enviadoAlSheet }),
    });
    const d = await r.json().catch(() => ({}));
    return Boolean(d.exito);
  } catch {
    return false;
  }
}

export default function BusinessModal() {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState(ESTADO.IDLE);
  const [form, setForm] = useState(FORM_VACIO);
  const [aviso, setAviso] = useState("");

  const cerrar = () => {
    setAbierto(false);
    setTimeout(() => {
      setEstado(ESTADO.IDLE);
      setForm(FORM_VACIO);
      setAviso("");
    }, 200);
  };

  const manejarCambio = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (aviso) setAviso("");
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const telefono = form.telefono.trim();
    const enfocar = (id) => document.getElementById(id)?.focus();
    if (!form.nombreLocal.trim()) { enfocar("bm-nombre"); return setAviso("Dinos cómo se llama tu local."); }
    if (!email && telefono.replace(/\D/g, "").length < 9) { enfocar(email ? "bm-telefono" : "bm-email"); return setAviso("Déjanos un email o un teléfono para poder contestarte."); }

    setEstado(ESTADO.ENVIANDO);
    const datos = { ...form, nombreLocal: form.nombreLocal.trim(), email, telefono };
    const enSheet = await enviarAlSheet(datos);
    const enCopia = await guardarCopia(datos, enSheet);
    setEstado(enSheet || enCopia ? ESTADO.ENVIADO : ESTADO.ERROR);
  };

  // Se puede abrir desde cualquier sitio de la web (p. ej. las vidrieras libres de Cazurronics Choices)
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("cz-abrir-negocios", abrir);
    return () => window.removeEventListener("cz-abrir-negocios", abrir);
  }, []);

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
            <div className="relative flex justify-between items-start gap-3 mb-2">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-100 to-orange-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                  🦁 Para negocios de León
                </span>
                <h2 id="bm-titulo" className="text-2xl sm:text-[1.7rem] font-bold tracking-tight text-slate-900 leading-tight">
                  Que León te vea{" "}
                  <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">primero</span>
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
            <p className="relative text-sm text-slate-600 leading-relaxed mb-3">
              Cazurronics es gratis para la gente. Los locales que quieren destacar entran en <b className="text-slate-900">Cazurronics Choices</b>:
            </p>

            {/* VENTAJAS (compactas: el formulario tiene que verse sin bajar mucho) */}
            <ul className="relative grid grid-cols-2 gap-2 mb-3">
              {VENTAJAS.map((v) => (
                <li key={v.titulo} className="flex items-start gap-2.5 bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-2.5">
                  <span className={`w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br ${v.color} flex items-center justify-center text-[15px] shadow-sm`}>{v.icono}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 leading-tight">{v.titulo}</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{v.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="relative flex gap-2 text-[11px] text-slate-500 leading-snug px-1 mb-5">
              <span aria-hidden>🤝</span>
              <span>Las rutas de la IA no se compran: salen de lo que pide cada persona y de lo que valora la gente.</span>
            </p>

            {/* FORMULARIO */}
            {estado === ESTADO.ENVIADO ? (
              <div className="relative text-center rounded-[1.5rem] p-6 bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100">
                <div className="bm-pop mx-auto mb-3 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(16,185,129,0.7)]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path className="bm-trazo" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </div>
                <p className="text-lg font-bold text-slate-900">¡Recibido!</p>
                <p className="text-sm text-slate-600 mt-1">Te escribimos en breve para contártelo todo y resolver tus dudas.</p>
              </div>
            ) : (
              <form id="bm-form" onSubmit={enviarSolicitud} noValidate className="relative space-y-2.5">
                <div className="mb-1">
                  <p className="text-[15px] font-bold text-slate-900">Escríbenos y te lo contamos</p>
                  <p className="text-xs text-slate-500">Sin compromiso. Te explicamos cómo funciona y lo que encaja con tu local.</p>
                </div>
                <input id="bm-nombre" type="text" name="nombreLocal" value={form.nombreLocal} onChange={manejarCambio} placeholder="Nombre del local" autoComplete="organization" required disabled={enviando} className={CAMPO} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input id="bm-email" type="email" name="email" value={form.email} onChange={manejarCambio} placeholder="Email" autoComplete="email" disabled={enviando} className={CAMPO} />
                  <input id="bm-telefono" type="tel" name="telefono" value={form.telefono} onChange={manejarCambio} placeholder="Teléfono o WhatsApp" autoComplete="tel" inputMode="tel" disabled={enviando} className={CAMPO} />
                </div>
                <textarea name="mensaje" value={form.mensaje} onChange={manejarCambio} placeholder="¿Algo que quieras contarnos? (opcional)" rows="2" disabled={enviando} className={`${CAMPO} resize-none leading-relaxed`} />
                {/* Campo trampa para bots: invisible para personas */}
                <input type="text" name="web" value={form.web} onChange={manejarCambio} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] w-px h-px opacity-0" />

                {(aviso || estado === ESTADO.ERROR) && (
                  <p className="flex items-center gap-2 text-sm font-medium text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-2xl px-3.5 py-2.5">
                    <span>⚠️</span> {aviso || "No se ha podido enviar. Escríbenos por Instagram, aquí abajo."}
                  </p>
                )}

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
              Escríbenos por DM a @cazurronics
            </a>

            {/* Botón para preguntar SIEMPRE visible abajo (como en una app), sin tener que bajar */}
            {estado !== ESTADO.ENVIADO && (
              <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 -mb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-mb-7 mt-5 px-5 sm:px-7 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 bg-gradient-to-t from-white via-white/95 to-white/0">
              <button
                type="submit"
                form="bm-form"
                disabled={enviando}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-semibold shadow-[0_12px_28px_-10px_rgba(244,63,94,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_16px_34px_-10px_rgba(244,63,94,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] active:scale-[0.97] disabled:opacity-60 disabled:hover:translate-y-0 transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] flex items-center justify-center gap-2"
              >
                {enviando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                {enviando ? "Enviando..." : "Quiero información"}
              </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
