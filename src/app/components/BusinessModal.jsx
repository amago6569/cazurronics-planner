"use client";

import { useState } from "react";

// URL de tu Google Apps Script desplegado como Web App (termina en /exec).
// Guárdala en .env.local como: NEXT_PUBLIC_GAS_BUSINESS_URL=https://script.google.com/macros/s/TU_ID/exec
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
    // Pequeño margen para que no se vea el formulario "resetearse" mientras el modal aún se cierra
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
      // OJO: Content-Type "text/plain" (no "application/json") a propósito.
      // Así el navegador no lanza una petición OPTIONS de preflight antes del POST,
      // que es justo lo que hace fallar por CORS a los Web Apps de Google Apps Script.
      // Apps Script igualmente puede leer el contenido como JSON sin problema (ver Código.gs).
      const respuesta = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(form),
      });

      const texto = await respuesta.text();
      console.log("[BusinessModal] Respuesta cruda de Apps Script:", texto);

      let datos;
      try {
        datos = JSON.parse(texto);
      } catch {
        throw new Error("Apps Script no devolvió JSON válido (mira la consola para ver la respuesta cruda)");
      }

      if (!datos.exito) {
        throw new Error(datos.mensaje || "Apps Script devolvió exito:false sin más detalle");
      }

      setEstado(ESTADO.ENVIADO);
    } catch (error) {
      console.error("[BusinessModal] Error enviando el formulario:", error.message);
      setEstado(ESTADO.ERROR);
    }
  };

  return (
    <>
      {/* Botón de apertura, sutil, para colocar debajo del botón principal de rutas */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mx-auto mt-3 block text-xs sm:text-sm font-bold text-slate-700 bg-white/70 hover:bg-white border-2 border-slate-800 rounded-full px-4 py-2 shadow-[2px_2px_0px_rgba(30,41,59,1)] hover:-translate-y-0.5 transition-all"
      >
        ¿Tienes un local en León? 🚀 Destaca tu negocio aquí
      </button>

      {abierto && (
        <div
          className="fixed inset-0 bg-slate-900/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={cerrar}
        >
          <div
            className="bg-white p-6 rounded-[2rem] border-4 border-slate-800 shadow-[8px_8px_0px_rgba(30,41,59,1)] w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black text-slate-900 leading-tight pr-2">
                Impulsa tu negocio con Cazurronics 🦁
              </h2>
              <button
                onClick={cerrar}
                className="text-slate-900 font-black text-xl bg-slate-300 rounded-full min-w-[32px] h-8 flex items-center justify-center border-2 border-slate-800 hover:bg-slate-400 shrink-0"
              >
                ✕
              </button>
            </div>

            {/* PITCH DE VENTA */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 bg-amber-50 border-2 border-slate-800 rounded-xl px-3 py-2">
                <span className="text-lg">⭐</span>
                <p className="text-sm font-bold text-slate-800">
                  Sello <span className="font-black">"Cazurronics Choice"</span> destacando tu local en las rutas
                </p>
              </div>
              <div className="flex items-center gap-2 bg-sky-50 border-2 border-slate-800 rounded-xl px-3 py-2">
                <span className="text-lg">📱</span>
                <p className="text-sm font-bold text-slate-800">Ruido y promoción activa en nuestro Instagram</p>
              </div>
              <div className="flex items-center gap-2 bg-pink-50 border-2 border-slate-800 rounded-xl px-3 py-2">
                <span className="text-lg">📍</span>
                <p className="text-sm font-bold text-slate-800">
                  Ficha VIP Permanente en la pestaña de Locales Colaboradores
                </p>
              </div>
            </div>

            {/* FORMULARIO O MENSAJE DE ÉXITO */}
            {estado === ESTADO.ENVIADO ? (
              <div className="bg-green-100 border-4 border-slate-800 rounded-2xl p-4 text-center">
                <p className="font-black text-slate-900 mb-1">✅ ¡Solicitud enviada!</p>
                <p className="text-sm font-bold text-slate-700">
                  Te hemos mandado un email de confirmación. En breve nos ponemos en contacto contigo.
                </p>
              </div>
            ) : (
              <form onSubmit={enviarSolicitud} className="space-y-3">
                <input
                  type="text"
                  name="nombreLocal"
                  value={form.nombreLocal}
                  onChange={manejarCambio}
                  placeholder="Nombre del local"
                  required
                  disabled={estado === ESTADO.ENVIANDO}
                  className="w-full bg-white border-4 border-slate-800 text-slate-900 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:border-[#ff6b6b] disabled:opacity-50"
                />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={manejarCambio}
                  placeholder="Email de contacto"
                  required
                  disabled={estado === ESTADO.ENVIANDO}
                  className="w-full bg-white border-4 border-slate-800 text-slate-900 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:border-[#ff6b6b] disabled:opacity-50"
                />
                <textarea
                  name="mensaje"
                  value={form.mensaje}
                  onChange={manejarCambio}
                  placeholder="Cuéntanos sobre tu local (opcional)"
                  rows="3"
                  disabled={estado === ESTADO.ENVIANDO}
                  className="w-full bg-white border-4 border-slate-800 text-slate-900 text-sm font-bold rounded-xl px-3 py-2 outline-none resize-none focus:border-[#ff6b6b] disabled:opacity-50"
                />

                {estado === ESTADO.ERROR && (
                  <p className="text-sm font-bold text-red-600 bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2">
                    ⚠️ No se pudo enviar. Prueba otra vez o escríbenos directamente por Instagram.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={estado === ESTADO.ENVIANDO}
                  className="w-full bg-[#ff6b6b] text-white font-black text-base py-3 rounded-2xl border-4 border-slate-800 shadow-[4px_4px_0px_rgba(30,41,59,1)] active:translate-y-1 active:shadow-none hover:bg-[#ff5252] transition-all disabled:opacity-60 disabled:active:translate-y-0 disabled:active:shadow-[4px_4px_0px_rgba(30,41,59,1)]"
                >
                  {estado === ESTADO.ENVIANDO ? "Enviando..." : "Enviar solicitud"}
                </button>
              </form>
            )}

            {/* ALTERNATIVA INSTAGRAM */}
            <hr className="border-slate-800 border-t-2 my-5" />
            <p className="text-center text-sm font-bold text-slate-700 mb-2">
              ¿Prefieres un trato más directo? Háblanos por Instagram 👇
            </p>
            <a
              href="https://www.instagram.com/cazurronics"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-amber-300 text-slate-900 font-black px-4 py-2 rounded-xl border-4 border-slate-800 shadow-[2px_2px_0px_rgba(30,41,59,1)] hover:bg-amber-400 active:translate-y-1 active:shadow-none transition-all"
            >
              📸 @cazurronics
            </a>
          </div>
        </div>
      )}
    </>
  );
}