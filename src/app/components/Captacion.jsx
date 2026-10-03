"use client";
// Sección «Captación» del panel: los locales que ya rinden en la web, listos para escribirles.
// El panel solo PREPARA el correo o el mensaje de Instagram; lo mandas tú con un botón.
import { useCallback, useEffect, useState } from "react";
import { GLASS, PRESS } from "../../lib/estilos";

const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);
const DIA = 24 * 3600 * 1000;
const DIAS_RECORDATORIO = 7;
const fecha = (ms) => new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const ESTADOS = [["nuevo", "Sin contactar"], ["contactado", "Contactado"], ["respondio", "Ha respondido"], ["cliente", "Cliente 🎉"], ["no", "No interesado"]];
const COLOR_ESTADO = { nuevo: "bg-slate-100 text-slate-600", contactado: "bg-sky-100 text-sky-700", respondio: "bg-amber-100 text-amber-800", cliente: "bg-emerald-100 text-emerald-700", no: "bg-rose-100 text-rose-700" };
const VISTAS = [["listos", "🎯 Listos"], ["seguimiento", "💬 En seguimiento"], ["casi", "👀 Casi listos"], ["cerrados", "📁 Cerrados"]];
const VACIO = {
  listos: "Todavía ningún local supera el umbral. Cuando alguno lo haga aparecerá aquí y te llegará un aviso al correo (si has activado los avisos). Mientras tanto, mira «Casi listos».",
  seguimiento: "Aquí verás a los locales a los que ya has escrito y cuándo toca el recordatorio.",
  casi: "Ningún local se acerca todavía al umbral.",
  cerrados: "Aquí quedan los que han dicho que sí o que no.",
};

const BOTON = `${PRESS} inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold`;
const B_OSCURO = `${BOTON} bg-slate-900 text-white hover:bg-slate-800 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.5)]`;
const B_CLARO = `${BOTON} bg-white/80 ring-1 ring-slate-900/10 text-slate-700 hover:bg-white`;
const B_VERDE = `${BOTON} bg-emerald-500 text-white hover:bg-emerald-600`;
const INPUT = "w-full bg-white/80 border border-white rounded-xl px-3 h-9 text-[13px] outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300";

const enc = encodeURIComponent;
const urlGmail = (para, asunto, cuerpo) => `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(para)}&su=${enc(asunto)}&body=${enc(cuerpo)}`;
const urlMailto = (para, asunto, cuerpo) => `mailto:${para}?subject=${enc(asunto)}&body=${enc(cuerpo)}`;
const urlBuscar = (nombre) => `https://www.google.com/search?q=${enc(`${nombre} León Instagram`)}`;

function Tarjeta({ l, vista, onGuardar, onCopiar }) {
  const [edit, setEdit] = useState({ email: null, ig: null }); // null = sin tocar (se muestra lo guardado)
  const [corto, setCorto] = useState(false);
  const [abierto, setAbierto] = useState(null); // canal que acabas de abrir: "correo" | "instagram"
  const [ocupado, setOcupado] = useState(false);

  const email = edit.email ?? l.email;
  const ig = edit.ig ?? l.instagram;
  const sucio = (edit.email !== null && edit.email.trim() !== l.email) || (edit.ig !== null && edit.ig.trim() !== l.instagram);
  const m = l.mensajes;
  const s = l.stats;
  const puedeEscribir = !!m && (vista === "listos" || l.toca);
  // Por correo si hay correo; si no, por Instagram. En un recordatorio, por el mismo canal del primer mensaje.
  const canal = l.toca && l.via === "instagram" && l.instagram ? "instagram"
    : l.toca && l.via === "correo" && l.email ? "correo"
    : l.email ? "correo" : l.instagram ? "instagram" : null;
  const asunto = l.toca ? m?.asuntoRecordatorio : corto ? m?.asuntoCorto : m?.asunto;
  const cuerpo = l.toca ? m?.recordatorioCorreo : corto ? m?.correoCorto : m?.correo;
  const chat = l.toca ? m?.recordatorioChat : m?.chat;

  const guardarContacto = async () => {
    setOcupado(true);
    const ok = await onGuardar(l.clave, { email: email.trim(), instagram: ig.trim() });
    setOcupado(false);
    if (ok) setEdit({ email: null, ig: null });
  };
  const confirmar = async () => {
    setOcupado(true);
    await onGuardar(l.clave, l.toca ? { recordado: true } : { estado: "contactado", via: abierto });
    setOcupado(false);
    setAbierto(null);
  };
  const abrirInstagram = () => { onCopiar(chat, "Mensaje copiado: pégalo en el chat de Instagram"); setAbierto("instagram"); };

  return (
    <li className="bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 leading-snug">{l.nombre}</p>
          {l.tipo && <p className="text-xs text-slate-400">{l.tipo}</p>}
        </div>
        <select
          value={l.estado}
          onChange={(e) => onGuardar(l.clave, { estado: e.target.value, via: canal === "instagram" ? "instagram" : "correo" })}
          aria-label={`Estado de ${l.nombre}`}
          className={`shrink-0 text-xs font-semibold rounded-full px-2.5 h-7 outline-none cursor-pointer ${COLOR_ESTADO[l.estado]}`}
        >
          {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>

      <p className="text-[13px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
        <span title="Veces que ha salido en un plan">🗺️ {fmt(s.apariciones)} planes</span>
        <span title="Personas que han abierto su ficha">👀 {fmt(s.detalle)} fichas</span>
        {s.llamar > 0 && <span title="Han pulsado Llamar">📞 {fmt(s.llamar)}</span>}
        {s.web > 0 && <span title="Han entrado en su web">🌐 {fmt(s.web)}</span>}
        {l.aprobacion !== null && <span title="Valoraciones positivas de quienes fueron">😍 {Math.round(l.aprobacion * 100)} %</span>}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="email" value={email} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} placeholder="Correo del local" aria-label={`Correo de ${l.nombre}`} className={INPUT} />
        <input type="text" value={ig} onChange={(e) => setEdit((x) => ({ ...x, ig: e.target.value }))} placeholder="Instagram (@usuario)" aria-label={`Instagram de ${l.nombre}`} className={INPUT} />
      </div>
      {sucio && <button onClick={guardarContacto} disabled={ocupado} className={`${B_OSCURO} self-start disabled:opacity-60`}>Guardar contacto</button>}

      {puedeEscribir && !sucio && (
        <div className="space-y-2">
          {l.toca && <p className="text-xs font-semibold text-amber-700">⏰ Toca recordatorio: hace más de {DIAS_RECORDATORIO} días que le escribiste y no ha respondido.</p>}

          {canal === "correo" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <a href={urlGmail(l.email, asunto, cuerpo)} target="_blank" rel="noopener noreferrer" onClick={() => setAbierto("correo")} className={B_OSCURO}>✉️ Abrir en Gmail</a>
                <button onClick={() => onCopiar(`Asunto: ${asunto}\n\n${cuerpo}`, "Correo copiado")} className={B_CLARO}>📋 Copiar</button>
                {l.instagram && <a href={`https://ig.me/m/${l.instagram}`} target="_blank" rel="noopener noreferrer" onClick={abrirInstagram} className={B_CLARO}>📸 O por Instagram</a>}
                <a href={urlMailto(l.email, asunto, cuerpo)} onClick={() => setAbierto("correo")} className="text-xs text-slate-500 hover:text-rose-600 underline underline-offset-2">otro programa de correo</a>
              </div>
              {!l.toca && (
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={corto} onChange={(e) => setCorto(e.target.checked)} className="accent-rose-500" /> Versión corta del correo
                </label>
              )}
            </>
          )}

          {canal === "instagram" && (
            <div className="flex flex-wrap items-center gap-2">
              <a href={`https://ig.me/m/${l.instagram}`} target="_blank" rel="noopener noreferrer" onClick={abrirInstagram} className={B_OSCURO}>📸 Copiar mensaje y abrir Instagram</a>
              <a href={`https://www.instagram.com/${l.instagram}/`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-rose-600 underline underline-offset-2">ver su perfil</a>
            </div>
          )}

          {canal === null && (
            <div className="flex flex-wrap items-center gap-2">
              <a href={urlBuscar(l.nombre)} target="_blank" rel="noopener noreferrer" className={B_CLARO}>🔎 Buscar su contacto</a>
              <span className="text-xs text-slate-500">Apunta arriba su correo o su Instagram y saldrán los botones para escribirle.</span>
            </div>
          )}

          {canal && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Ver el mensaje</summary>
              <textarea readOnly value={canal === "correo" ? `Asunto: ${asunto}\n\n${cuerpo}` : chat} rows={10} aria-label={`Mensaje para ${l.nombre}`} className="mt-2 w-full bg-white/70 rounded-xl ring-1 ring-slate-900/5 p-2.5 text-[12px] leading-relaxed text-slate-700 outline-none resize-y" />
            </details>
          )}

          {m?.enlace && <a href={m.enlace} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-rose-600 hover:underline underline-offset-2">Ver lo que verá el local ↗</a>}

          {abierto && (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2 text-[13px]">
              <span className="text-amber-900">¿Lo has enviado?</span>
              <button onClick={confirmar} disabled={ocupado} className={`${B_VERDE} h-8 disabled:opacity-60`}>{l.toca ? "Sí, recordatorio enviado" : "Sí, marcar como contactado"}</button>
              <button onClick={() => setAbierto(null)} className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2">Todavía no</button>
            </div>
          )}
        </div>
      )}

      {l.estado === "contactado" && l.contactadoEn && (
        <p className="text-xs text-slate-500">
          Contactado el {fecha(l.contactadoEn)}{l.via ? ` por ${l.via}` : ""}
          {l.recordadoEn ? ` · recordatorio enviado el ${fecha(l.recordadoEn)}` : l.toca ? "" : ` · recordatorio a partir del ${fecha(l.contactadoEn + DIAS_RECORDATORIO * DIA)}`}
        </p>
      )}
      {l.estado === "respondio" && <p className="text-xs text-slate-500">Ha respondido: cuéntale cómo funciona y, cuando se decida, cámbialo a «Cliente» (o a «No interesado»).</p>}
    </li>
  );
}

export default function Captacion({ clave }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("listos");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState(null); // ajustes en edición (null = cerrados)
  const [prueba, setPrueba] = useState(false);

  const avisar = (texto) => { setAviso(texto); setTimeout(() => setAviso(""), 3500); };
  const leerCookie = () => setPrueba(/(?:^|;\s*)cz_prueba=1/.test(document.cookie));

  const llamar = useCallback(async (metodo, cuerpo) => {
    const r = await fetch("/api/captacion", {
      method: metodo,
      headers: { "x-clave": clave, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    });
    return r.json().catch(() => ({ exito: false, mensaje: `Error ${r.status}` }));
  }, [clave]);

  const cargar = useCallback(async () => {
    try {
      const d = await llamar("GET");
      if (!d.exito) { setError(d.mensaje || "No se pudo cargar la captación"); return; }
      setError("");
      setDatos(d);
      leerCookie();
    } catch { setError("No se pudo conectar"); }
  }, [llamar]);

  // setTimeout (y no requestAnimationFrame) para que también cargue con la pestaña en segundo plano
  useEffect(() => {
    const t = setTimeout(cargar, 0);
    return () => clearTimeout(t);
  }, [cargar]);

  const copiar = async (texto, mensaje = "Copiado") => {
    try { await navigator.clipboard.writeText(texto); avisar(mensaje); } catch { avisar("No se pudo copiar: selecciona el texto a mano"); }
  };
  const guardarLocal = async (claveLocal, cambios) => {
    const d = await llamar("POST", { accion: "local", clave: claveLocal, cambios });
    if (!d.exito) { avisar(d.mensaje || "No se pudo guardar"); return false; }
    await cargar();
    return true;
  };
  const guardarAjustes = async () => {
    const d = await llamar("POST", { accion: "ajustes", ...form });
    if (!d.exito) { avisar(d.mensaje || "No se pudieron guardar los ajustes"); return; }
    setForm(null);
    avisar("Ajustes guardados");
    await cargar();
  };
  const alternarPrueba = async () => { await llamar("POST", { accion: "prueba", activar: !prueba }); leerCookie(); };

  const caja = `${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up scroll-mt-4`;
  if (!datos) {
    return (
      <section id="captacion" className={caja}>
        <h2 className="font-bold text-slate-900">🎯 Captación</h2>
        <p className={`text-sm mt-1 ${error ? "text-rose-600" : "text-slate-500"}`}>{error || "Cargando…"}</p>
      </section>
    );
  }

  const { ajustes } = datos;
  const aTocar = datos.seguimiento.filter((l) => l.toca).length;
  const lista = datos[vista];

  return (
    <section id="captacion" className={caja}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">
            🎯 Captación <span className="text-slate-400 font-medium">· {datos.listos.length} {datos.listos.length === 1 ? "local listo" : "locales listos"} para escribir{aTocar ? ` · ${aTocar} ${aTocar === 1 ? "recordatorio" : "recordatorios"}` : ""}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Locales que han salido {ajustes.apariciones}+ veces en planes y suman {ajustes.interacciones}+ gestos de interés (ficha abierta, llamada o web). Aquí no se envía nada solo: el botón deja el mensaje preparado y lo mandas tú.
          </p>
        </div>
        <button onClick={() => setForm(form ? null : { apariciones: String(ajustes.apariciones), interacciones: String(ajustes.interacciones), remitente: ajustes.remitente })} className={B_CLARO}>⚙️ Ajustes</button>
      </div>

      {!ajustes.remitente && !form && (
        <p className="text-xs font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2 mb-3">
          Pon tu nombre en ⚙️ Ajustes para que los mensajes lleven tu firma. Mientras tanto firman como «El equipo de Cazurronics».
        </p>
      )}

      {form && (
        <div className="bg-white/70 ring-1 ring-slate-900/5 rounded-2xl p-4 mb-4 grid sm:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-slate-600">Tu nombre (para firmar)
            <input value={form.remitente} maxLength={60} onChange={(e) => setForm({ ...form, remitente: e.target.value })} placeholder="Ej.: Alejandro" className={`${INPUT} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Mínimo de veces en planes
            <input type="number" min="1" value={form.apariciones} onChange={(e) => setForm({ ...form, apariciones: e.target.value })} className={`${INPUT} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-slate-600">Mínimo de interacciones
            <input type="number" min="0" value={form.interacciones} onChange={(e) => setForm({ ...form, interacciones: e.target.value })} className={`${INPUT} mt-1`} />
          </label>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
            <button onClick={guardarAjustes} className={B_OSCURO}>Guardar ajustes</button>
            <button onClick={() => setForm(null)} className={B_CLARO}>Cancelar</button>
            <span className="text-xs text-slate-500">Interacciones = fichas abiertas + llamadas + visitas a su web. Las cifras son acumuladas desde que arrancó la web.</span>
          </div>
          <div className="sm:col-span-3 border-t border-slate-900/5 pt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600 max-w-xl">🧪 <b>Modo prueba en este navegador:</b> {prueba ? "activado. Lo que pruebes aquí (planes, fichas, llamadas, valoraciones) no suma a las cifras de ningún local." : "desactivado. Lo que hagas aquí sí cuenta en las cifras de los locales."}</p>
            <button onClick={alternarPrueba} className={B_CLARO}>{prueba ? "Desactivar" : "Activar"}</button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
        {VISTAS.map(([id, texto]) => (
          <button key={id} onClick={() => setVista(id)} className={`${PRESS} shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ${vista === id ? "bg-slate-900 text-white" : "bg-white/70 ring-1 ring-slate-900/10 text-slate-600"}`}>
            {texto} <span className="opacity-60 tabular-nums">{datos[id].length}</span>
          </button>
        ))}
      </div>

      {lista.length ? (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {lista.map((l) => <Tarjeta key={l.clave} l={l} vista={vista} onGuardar={guardarLocal} onCopiar={copiar} />)}
        </ul>
      ) : <p className="text-sm text-slate-500">{VACIO[vista]}</p>}

      <p className="text-[11px] text-slate-400 mt-4">No se proponen locales que la gente valora mal (3 o más valoraciones y menos del 60 % positivas) ni monumentos, parques o eventos sueltos.</p>

      {aviso && (
        <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 max-w-[90vw] rounded-full bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.6)]">{aviso}</div>
      )}
    </section>
  );
}
