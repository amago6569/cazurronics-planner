"use client";
// Lo primero que ves en la oficina:
//  · «Hoy te toca»: lo que espera tu OK, con sus botones (eventos subidos sin fuente segura, locales listos para
//    escribirles y empleados que han fallado, con el porqué en cristiano). Funciona sin el 3D.
//  · La tira del flujo: el trabajo de anoche paso a paso, con números reales. Tocar un paso lleva a su sala.
import { useEffect, useRef, useState } from "react";
import { GLASS, GLASS_SOFT, PRESS } from "../../../lib/estilos";
import { diaCorto, fmt } from "./monigotes";

const MAX_BANDEJA = 3;

function Tarjeta({ icono, titulo, children, tono = "bg-white/80" }) {
  return (
    <li className={`${tono} ring-1 ring-slate-900/5 rounded-2xl p-3.5 flex flex-col gap-2 cz-fade w-[85%] shrink-0 snap-start md:w-auto`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{icono} {titulo}</p>
      {children}
    </li>
  );
}

function Local({ l, clave, alQuitar }) {
  const [texto, setTexto] = useState(l.texto);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [indicacion, setIndicacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const pedir = async (cuerpo) => {
    setOcupado(true); setAviso("");
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ local: l.clave, ...cuerpo }) });
      return await r.json().catch(() => null);
    } catch { return null; } finally { setOcupado(false); }
  };
  // ✅: copia el mensaje, abre Instagram o Gmail (lo envías tú) y lo apunta como enviado
  const enviar = async () => {
    try { await navigator.clipboard?.writeText(texto); } catch {}
    const d = await pedir({ accion: l.recordar ? "recordado" : "enviado" });
    if (d?.exito) alQuitar(`${l.nombre}: apuntado. Mensaje copiado; si no contesta, te lo recuerdo en 7 días.`);
    else setAviso(d?.mensaje || "No se ha podido apuntar.");
  };
  const no = async () => {
    const d = await pedir({ accion: "no" });
    if (d?.exito) alQuitar(`${l.nombre}: no se le escribe.`);
    else setAviso(d?.mensaje || "No se ha podido apuntar.");
  };
  const cambiar = async (ev) => {
    ev.preventDefault();
    if (indicacion.trim().length < 3) return;
    const d = await pedir({ accion: "cambiar", texto: indicacion.trim() });
    if (d?.exito) { setTexto(d.texto); setEditando(false); setIndicacion(""); setAbierto(true); }
    else setAviso(d?.mensaje || "No se ha podido cambiar.");
  };
  return (
    <Tarjeta icono={l.recordar ? "⏰" : "🎯"} titulo={l.recordar ? "Recordatorio (no contestó en 7 días)" : "Local listo para escribirle"}>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 leading-snug">{l.nombre}{l.tipo ? <span className="font-normal text-slate-500"> · {l.tipo}</span> : null}</p>
        <p className="text-xs text-slate-500">Sale {fmt(l.apariciones)} veces en planes · {fmt(l.fichas)} fichas abiertas · {l.via || "⚠️ sin Instagram ni correo"}</p>
      </div>
      <button type="button" onClick={() => setAbierto((x) => !x)} className="text-left rounded-xl bg-slate-50 ring-1 ring-slate-900/5 px-3 py-2 text-[13px] leading-snug text-slate-700 whitespace-pre-line">
        <span className={abierto ? "" : "line-clamp-3"}>{texto}</span>
        <span className="block mt-1 text-[11px] font-semibold text-sky-600">{abierto ? "Ver menos" : "Ver el mensaje entero"}</span>
      </button>
      {editando && (
        <form onSubmit={cambiar} className="flex gap-2">
          <input value={indicacion} onChange={(e) => setIndicacion(e.target.value.slice(0, 300))} autoFocus placeholder="«más corto», «tutéales»…" className="flex-1 min-w-0 h-11 rounded-full bg-white px-4 text-sm outline-none ring-1 ring-slate-900/10 focus:ring-2 focus:ring-rose-300" />
          <button disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-50`}>{ocupado ? "…" : "Cambiar"}</button>
        </form>
      )}
      {aviso && <p className="text-xs text-rose-600">{aviso}</p>}
      <div className="flex gap-2 mt-auto">
        {l.enlace ? (
          <a href={l.enlace} target="_blank" rel="noopener noreferrer" onClick={enviar} className={`${PRESS} flex-1 h-11 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] ${ocupado ? "pointer-events-none opacity-50" : ""}`}>✅ Enviar</a>
        ) : (
          <a href="/panel#captacion" className={`${PRESS} flex-1 h-11 inline-flex items-center justify-center rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold`}>Apuntar contacto</a>
        )}
        <button onClick={() => setEditando((x) => !x)} disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`} aria-label="Cambiar el mensaje">✏️</button>
        <button onClick={no} disabled={ocupado} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`} aria-label="No escribirle">✖</button>
      </div>
      {l.enlace && <p className="text-[11px] text-slate-400">Al pulsar ✅ se copia el mensaje y se abre {l.via?.startsWith("Instagram") ? "Instagram" : "Gmail"}. Lo envías tú.</p>}
    </Tarjeta>
  );
}

async function mandar(clave, cuerpo) {
  try {
    const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    return (await r.json().catch(() => null)) || { exito: false, mensaje: `Error ${r.status}` };
  } catch { return { exito: false, mensaje: "No se pudo conectar" }; }
}

// Un evento que el Verificador subió sin poder confirmarlo: ya está en la web y lo sigue mirando él solo.
// Tocar aquí es opcional: «Vale» le quita la marca, «Quitar» lo saca de la web.
// «Quitar» no se manda al momento: tienes 10 segundos para deshacerlo (lo quitado no vuelve en 30 días)
function SinConfirmar({ e, clave, alQuitar, alQuitarConDeshacer }) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const decidir = async (accion) => {
    if (accion === "quitar") return alQuitarConDeshacer(e);
    setOcupado(true);
    const d = await mandar(clave, { aviso: e.id, accion });
    setOcupado(false);
    if (d.exito || d.mensaje === "Ya no está en la lista") alQuitar(`«${e.titulo}» se queda.`);
    else setAviso(d.mensaje || "No ha podido ser");
  };
  return (
    <Tarjeta icono="⚠️" titulo="Subido sin fuente segura" tono="bg-amber-50/90">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wide">{diaCorto(e.fecha)}{e.hora ? ` · ${e.hora}` : ""}</p>
        <p className="font-semibold text-slate-900 leading-snug">{e.titulo}</p>
        <p className="text-xs text-slate-600">{[e.lugar, e.localidad].filter(Boolean).join(" · ")}</p>
        <p className="text-xs text-slate-600 mt-1">Ya está en la web marcado «por confirmar». El Verificador lo sigue mirando solo: lo confirma o lo quita.</p>
        {e.fuente && <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-700 hover:underline underline-offset-2 break-all line-clamp-1">🔗 Mirar dónde lo vio</a>}
      </div>
      {aviso && <p className="text-xs text-rose-600" role="alert">{aviso}</p>}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => decidir("vale")} disabled={ocupado} className={`${PRESS} flex-1 h-11 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50`}>👍 Vale</button>
        <button onClick={() => decidir("quitar")} disabled={ocupado} className={`${PRESS} flex-1 h-11 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold disabled:opacity-50`}>🗑 Quitar</button>
      </div>
    </Tarjeta>
  );
}

// Lo que aún espera la segunda comprobación (el Verificador pasa a las 8:50, 13:50 y 19:50)
function EnCola({ n, clave, alTerminar, alVerBandeja }) {
  const [estado, setEstado] = useState("");
  const ya = async () => {
    setEstado("trabajando");
    const d = await mandar(clave, { reunion: "verificar:manual", accion: "si", propuesta: { tipo: "guardia", que: "verificador" } });
    setEstado(d.mensaje || (d.exito ? "Hecho" : "No ha podido ser"));
    if (d.exito) alTerminar?.();
  };
  return (
    <Tarjeta icono="🕵️" titulo="Esperan al Verificador">
      <p className="font-semibold text-slate-900 leading-snug">{n} {n === 1 ? "evento sin fuente segura" : "eventos sin fuente segura"}</p>
      <p className="text-xs text-slate-600">Los vuelve a comprobar en su próximo turno y los sube. No tienes que hacer nada.</p>
      <div className="flex gap-2 mt-auto">
        <button onClick={ya} disabled={!!estado} className={`${PRESS} flex-1 h-11 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60`}>{estado === "trabajando" ? "Comprobando… (hasta 1 min)" : estado || "🕵️ Compruébalos ya"}</button>
        <button onClick={alVerBandeja} className={`${PRESS} h-11 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 text-sm font-semibold`}>Ver</button>
      </div>
    </Tarjeta>
  );
}

function Fallo({ e, clave, alTerminar }) {
  const [estado, setEstado] = useState("");
  const repetir = async () => {
    setEstado("trabajando");
    try {
      const r = await fetch("/api/panel/oficina", { method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" }, body: JSON.stringify({ empleado: e.id, accion: "trabajar" }) });
      const d = await r.json().catch(() => null);
      setEstado(d?.exito ? `Hecho: ${d.parte?.nuevos ?? 0} nuevos.` : d?.mensaje || "No se ha podido.");
      if (d?.exito) alTerminar?.();
    } catch { setEstado("No se ha podido conectar."); }
  };
  const p = e.parte || {};
  return (
    <Tarjeta icono="🔥" titulo="Ha fallado" tono="bg-rose-50/90">
      <p className="font-semibold text-slate-900 leading-snug">{e.emoji} {e.nombre}</p>
      <p className="text-xs text-slate-600">{p.busquedas ? `Fallaron ${p.errores} de sus ${p.busquedas} búsquedas.` : "Su último turno no salió bien."}</p>
      <p className="text-xs text-slate-800"><b>Por qué:</b> {p.motivos?.[0]?.texto || p.error || "no lo dejó apuntado"}</p>
      {e.ordenes ? (
        <button onClick={repetir} disabled={!!estado} className={`${PRESS} mt-auto h-11 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60`}>
          {estado === "trabajando" ? "Trabajando… (hasta 1 min)" : estado || "🔁 Repetir su turno ahora"}
        </button>
      ) : <p className="text-[11px] text-slate-500">Lo repite solo en su próximo turno.</p>}
    </Tarjeta>
  );
}

const DESHACER_MS = 10000;

// Quién ha fallado y merece tu atención: solo quien falla dos días seguidos (un fallo suelto lo arregla la Repesca)
export function fallosQueTeTocan(departamentos, fallanSeguido = []) {
  const conError = departamentos.flatMap((d) => d.empleados).filter((e) => e.estado === "error");
  return { fallos: conError.filter((e) => fallanSeguido.includes(e.id)), sueltos: conError.filter((e) => !fallanSeguido.includes(e.id)) };
}

export function HoyTeToca({ bandeja, sinConfirmar = [], captacion = [], departamentos, fallanSeguido = [], flujo, clave, alTerminar, alVerBandeja }) {
  const [quitados, setQuitados] = useState([]);
  const [aviso, setAviso] = useState("");
  const [porQuitar, setPorQuitar] = useState(null); // el evento que se quitará cuando pasen los 10 s
  const espera = useRef(null); // { e, temporizador }
  const locales = captacion.filter((l) => !quitados.includes(l.clave));
  const subidos = sinConfirmar.filter((e) => !quitados.includes(e.id));
  const { fallos, sueltos } = fallosQueTeTocan(departamentos, fallanSeguido);
  const total = locales.length + fallos.length; // ni la bandeja ni lo «por confirmar» te tocan a ti: lo resuelve el Verificador
  const quitar = (id) => (t) => { setQuitados((q) => [...q, id]); setAviso(t); };

  // Manda el «Quitar» que estaba esperando (al pasar los 10 s, al quitar otro o al salir de la página)
  const mandarQuitar = (pendiente) => {
    if (!pendiente) return;
    clearTimeout(pendiente.temporizador);
    if (espera.current === pendiente) { espera.current = null; setPorQuitar(null); }
    mandar(clave, { aviso: pendiente.e.id, accion: "quitar" }).then((d) => {
      if (d.exito || d.mensaje === "Ya no está en la lista") setAviso(`«${pendiente.e.titulo}» quitado de la web.`);
      else { setQuitados((q) => q.filter((x) => x !== pendiente.e.id)); setAviso(`No se ha podido quitar «${pendiente.e.titulo}»: ${d.mensaje || "inténtalo otra vez"}.`); }
    });
  };
  const quitarConDeshacer = (e) => {
    mandarQuitar(espera.current);
    const pendiente = { e };
    pendiente.temporizador = setTimeout(() => mandarQuitar(pendiente), DESHACER_MS);
    espera.current = pendiente;
    setQuitados((q) => [...q, e.id]); setAviso(""); setPorQuitar(e);
  };
  const deshacer = () => {
    const pendiente = espera.current;
    if (!pendiente) return;
    clearTimeout(pendiente.temporizador);
    espera.current = null;
    setQuitados((q) => q.filter((x) => x !== pendiente.e.id)); setPorQuitar(null); setAviso(`«${pendiente.e.titulo}» se queda donde estaba.`);
  };
  // Si cierras la página con un «Quitar» esperando, se manda igual
  useEffect(() => () => {
    const pendiente = espera.current;
    if (!pendiente) return;
    clearTimeout(pendiente.temporizador);
    mandar(clave, { aviso: pendiente.e.id, accion: "quitar" });
  }, [clave]);
  return (
    <section id="hoy" className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up scroll-mt-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-slate-900 text-lg">✋ Hoy te toca {total > 0 && <span className="text-slate-400 font-medium">· {total}</span>}</h2>
        {total > 1 && <span className="md:hidden text-[11px] text-slate-400">Desliza →</span>}
      </div>
      {porQuitar && (
        <div className="mt-2 rounded-xl bg-slate-900 text-white px-3 py-2 flex items-center gap-3" role="status">
          <span className="text-sm flex-1 min-w-0">🗑 «{porQuitar.titulo}» se quita de la web en 10 segundos.</span>
          <button onClick={deshacer} className={`${PRESS} shrink-0 h-11 px-4 rounded-full bg-white text-slate-900 text-sm font-semibold`}>Deshacer</button>
        </div>
      )}
      {aviso && <p className="mt-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">{aviso}</p>}
      {total === 0 && !bandeja.length ? (
        <p className="mt-2 text-[15px] text-slate-700">✅ Nada pendiente. {flujo.entran ? `Anoche entraron ${fmt(flujo.entran)} eventos nuevos` : "Anoche no entró nada nuevo"} y hay {fmt(flujo.agenda)} en la agenda.</p>
      ) : (
        <ul className="mt-3 -mx-4 px-4 flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory md:mx-0 md:px-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible">
          {bandeja.length > 0 && <EnCola n={bandeja.length} clave={clave} alTerminar={alTerminar} alVerBandeja={alVerBandeja} />}
          {locales.map((l) => <Local key={l.clave} l={l} clave={clave} alQuitar={(t) => { setQuitados((q) => [...q, l.clave]); setAviso(t); }} />)}
          {fallos.map((e) => <Fallo key={e.id} e={e} clave={clave} alTerminar={alTerminar} />)}
        </ul>
      )}
      {sueltos.length > 0 && <p className="mt-3 text-sm text-slate-600">🚑 {sueltos.map((e) => e.nombre).join(", ")} {sueltos.length === 1 ? "ha tenido" : "han tenido"} algún fallo suelto. La Repesca lo repite; solo te aviso si se repite mañana.</p>}
      {subidos.length > 0 && (
        <details className="mt-3 group">
          <summary className={`${PRESS} cursor-pointer list-none inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-white/80 ring-1 ring-slate-900/10 text-sm font-semibold text-slate-700`}>
            🕵️ {subidos.length} en la web «por confirmar» · los mira el Verificador <span className="text-slate-400 group-open:rotate-90 transition-transform" aria-hidden>›</span>
          </summary>
          <p className="mt-2 text-xs text-slate-600">No tienes que hacer nada. Si alguno no te cuadra, quítalo aquí o dile al jefe «quita …».</p>
          <ul className="mt-2 -mx-4 px-4 flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory md:mx-0 md:px-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible">
            {subidos.slice(0, MAX_BANDEJA * 2).map((e) => <SinConfirmar key={e.id} e={e} clave={clave} alQuitar={quitar(e.id)} alQuitarConDeshacer={quitarConDeshacer} />)}
          </ul>
          {subidos.length > MAX_BANDEJA * 2 && <p className="mt-2 text-xs text-slate-500">…y {subidos.length - MAX_BANDEJA * 2} más.</p>}
        </details>
      )}
    </section>
  );
}

// El trabajo de anoche, paso a paso. Cada paso lleva a su sala del edificio.
export function Flujo({ flujo, alElegir }) {
  const pasos = [
    { sala: "busqueda", icono: "🔎", titulo: "Buscan", n: flujo.buscan, pie: "búsquedas anoche" },
    { sala: "control", icono: "🧐", titulo: "Comprueban", n: flujo.entran, pie: `nuevos · ${fmt(flujo.sinFuente)} a revisar` },
    { sala: "archivo", icono: "📅", titulo: "Agenda", n: flujo.agenda, pie: "eventos, 3 semanas" },
    { sala: "escaparate", icono: "🗺️", titulo: "Planes", n: flujo.planesAyer, pie: "servidos ayer" },
    { sala: "negocio", icono: "📣", titulo: "Captación", n: flujo.captacion, pie: "locales listos" },
    { sala: "despacho", icono: "✋", titulo: "Tú", n: flujo.pendientes, pie: "esperan tu OK" },
  ];
  return (
    <section className="cz-up">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x">
        {pasos.map((p, i) => (
          <div key={p.sala} className="flex items-center gap-1.5 shrink-0 snap-start">
            <button onClick={() => alElegir(p.sala)} className={`${GLASS_SOFT} ${PRESS} w-[104px] sm:w-[128px] rounded-2xl px-3 py-2.5 text-left hover:-translate-y-0.5`}>
              <p className="text-[11px] font-semibold text-slate-500">{p.icono} {p.titulo}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 leading-tight">{p.n == null ? "—" : fmt(p.n)}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{p.pie}</p>
            </button>
            {i < pasos.length - 1 && <span className="text-slate-400 text-sm">→</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
