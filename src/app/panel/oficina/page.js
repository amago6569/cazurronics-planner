"use client";
// /panel/oficina — solo para el equipo (clave = PANEL_CLAVE, la misma que /panel).
// Lo primero que ves es el edificio en 3D con los monigotes. Si no hay nadie en turno al abrirla, se repite sola la
// actividad de las últimas 24 h con sus cifras reales y la cámara sigue a quien trabaja.
//  · Debajo, la cadena de trabajo: buscan → comprueban → agenda → planes → captación → tú.
//  · Lo que necesita tu OK (fallos que se repiten, eventos por confirmar). A los locales se les escribe desde Negocios.
//  · Plegados: el parte del jefe, la reunión, las novedades y la bandeja.
//  · Chat con el jefe o cualquier empleado, y la lista de mesas para móviles flojos.
// Se actualiza sola cada minuto mientras la tienes abierta (solo lee Redis). Ver la oficina no gasta IA.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { dondeEsta } from "../../../lib/turnos";
import { LIMITE_DIA_EUROS, euros } from "../../../lib/euros";
import { Entrada, Marco, pedir, useClave } from "../comun";
import { CAMISAS, ESTADOS, Monigote, diaCorto, fmt, hace } from "./monigotes";
import { FichaEmpleado } from "./ficha";
import Novedades from "./novedades";
import Chat from "./chat";
import { Flujo, HoyTeToca, fallosQueTeTocan } from "./hoy";
import Reunion from "./reunion";

// three.js solo se descarga al abrir la oficina (y nunca en el servidor)
const Oficina3D = dynamic(() => import("./Oficina3D"), {
  ssr: false,
  loading: () => <div className="pn-escena h-[min(66dvh,128vw)] min-h-[420px] sm:h-[680px] grid place-items-center pn-apunte">Encendiendo las luces de la oficina…</div>,
});

function Mesa({ e, i, departamento, alElegir }) {
  const est = ESTADOS[e.estado] || ESTADOS.nuevo;
  const p = e.parte;
  const colores = CAMISAS[departamento] || CAMISAS.agenda;
  const cifras = p && (p.busquedas != null
    ? [`${fmt(p.eventos)} encontrados`, p.descartados ? `${fmt(p.descartados)} a revisar` : null, p.errores ? `${p.errores} fallos` : null].filter(Boolean).join(" · ")
    : p.texto);
  return (
    <button type="button" onClick={() => alElegir(e)} className="pn-bloque text-left group flex flex-col" style={{ padding: 12 }}>
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--panel)" }}>
        <span className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${est.pill}`}>
          <i className={`w-1.5 h-1.5 rounded-full ${est.punto}`} />{est.texto}
        </span>
        <Monigote estado={e.estado} semilla={i + departamento.length} camisa={colores[i % colores.length]} emoji={e.emoji} className="w-full h-auto pt-4" />
      </div>
      <div className="mt-3 min-w-0 flex-1 flex flex-col">
        <h3 className="font-bold leading-tight text-[15px]">{e.nombre}</h3>
        <p className="pn-apunte leading-snug mt-0.5 line-clamp-2" style={{ fontSize: 12 }}>{e.puesto}</p>
        <div className="mt-auto pt-2.5 space-y-1">
          {cifras && <p className="text-xs font-semibold tabular-nums">{cifras}</p>}
          {p?.error && <p className="text-[11px] line-clamp-2" style={{ color: "var(--mal)" }}>{p.error}</p>}
          <p className="pn-apunte" style={{ fontSize: 11 }}>{e.horario} · último turno {hace(p?.fin)}</p>
        </div>
        {e.encargos?.length > 0 && <p className="text-[11px] font-semibold" style={{ color: "var(--oro)" }}>{e.encargos.length} {e.encargos.length === 1 ? "encargo pendiente" : "encargos pendientes"}</p>}
      </div>
    </button>
  );
}

function ParteJefe({ jefe }) {
  const g = jefe.cifras.gasto;
  const pasado = g && g.hoy > LIMITE_DIA_EUROS;
  return (
    <div className="space-y-3 px-2 pb-2">
      <ul className="space-y-1.5 text-[15px] leading-snug">{jefe.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
      {jefe.ronda && <p className="pn-apunte" style={{ fontSize: 12 }}>Última ronda del jefe {hace(jefe.ronda)}</p>}
      {g && (
        <div className="grid grid-cols-3 gap-2" aria-label="Gasto de la IA">
          {[["hoy", g.hoy], ["este mes", g.mes], ["previsión mes", g.prevision]].map(([texto, valor]) => (
            <div key={texto}><p className="pn-grande" style={{ fontSize: 26, color: pasado && texto === "hoy" ? "var(--mal)" : undefined }}>{euros(valor)}</p><p className="pn-apunte" style={{ fontSize: 12 }}>{texto}</p></div>
          ))}
        </div>
      )}
      {g && <p className="pn-apunte" style={{ fontSize: 12, color: pasado ? "var(--mal)" : undefined }}>{pasado ? `Hoy ya pasa de ${euros(LIMITE_DIA_EUROS)}: te he avisado por Telegram.` : `Si un día pasa de ${euros(LIMITE_DIA_EUROS)}, te aviso por Telegram. Cambio aproximado de dólares a euros.`}</p>}
    </div>
  );
}

function Bandeja({ lista, decidir, enCurso }) {
  return (
    <div className="px-2 pb-2">
      <p className="pn-apunte mb-3">Eventos cuya fuente no se pudo comprobar a la primera. El Verificador los vuelve a mirar en su próximo turno y los sube solo; si quieres adelantarte, decide tú.</p>
      {lista.length ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {lista.map((e) => (
            <li key={e.id} className="pn-bloque flex flex-col gap-2" style={{ padding: 14 }}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--oro)" }}>{diaCorto(e.fecha)}{e.hora ? ` · ${e.hora}` : ""}</p>
                <p className="font-semibold leading-snug">{e.titulo}</p>
                <p className="pn-apunte" style={{ fontSize: 12 }}>{[e.lugar, e.localidad, e.precio].filter(Boolean).join(" · ")}</p>
                <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold hover:underline underline-offset-2 break-all line-clamp-1" style={{ color: "var(--azul)" }}>{e.fuente}</a>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decidir(e.id, "subir")} disabled={!!enCurso} className="pn-boton flex-1">{enCurso === e.id ? "…" : "Subir"}</button>
                <button onClick={() => decidir(e.id, "tirar")} disabled={!!enCurso} className="pn-boton flojo flex-1">Tirar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="pn-apunte">Nada pendiente. El Verificador ya lo ha repasado todo.</p>}
    </div>
  );
}

const AYUDA = [
  ["Los monigotes", "Cada empleado es una tarea automática de la web. En su mesa con la pantalla encendida: trabajando (🔴 si es justo ahora). En la cafetería: ya ha hecho su turno. Dormido en el sofá: se saltó el turno. 📝: ha fallado y lo repasa en su próximo turno. 🏖️: de descanso."],
  ["Lo que ves al abrir", "Si nadie está en turno, se repiten solas las últimas 24 h con sus cifras reales. El equipo trabaja casi siempre de noche. Toca ✕ para ver la oficina tal como está ahora."],
  ["Paseos", "Entre turnos se levantan a hablar de lo que se dijeron de verdad. Los paseos a por café son solo ambiente: no significan trabajo."],
  ["Verificador", "Vuelve a comprobar lo que no tenía fuente segura. Lo bueno lo sube; lo falso lo tira; lo dudoso lo sube «por confirmar» y lo sigue mirando él solo."],
  ["Repesca", "Repite las búsquedas que fallaron porque Google iba lento o saturado. Gratis, dentro del cupo diario."],
  ["El chat", "Al jefe le puedes preguntar lo que sea («¿qué hay esta semana en Boñar?»): contesta con los datos del equipo y, si no hay nada, lo busca. A cada empleado le puedes preguntar «¿cómo vas?» o decirle «busca …»."],
];
function Ayuda({ abierta, alCerrar }) {
  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={alCerrar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cz-fade" />
      <div role="dialog" aria-modal="true" aria-label="Qué estoy viendo" onClick={(ev) => ev.stopPropagation()} className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto overscroll-contain rounded-[1.75rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] cz-sheet" style={{ background: "#17151c", border: "1px solid var(--borde)" }}>
        <h2 className="text-xl font-bold">¿Qué estoy viendo?</h2>
        <ul className="mt-3 space-y-3">{AYUDA.map(([titulo, texto]) => <li key={titulo}><b className="block">{titulo}</b><span className="text-[15px] leading-snug" style={{ color: "var(--gris)" }}>{texto}</span></li>)}</ul>
        <button onClick={alCerrar} className="pn-boton mt-5 w-full" style={{ minHeight: 48 }}>Entendido</button>
      </div>
    </div>
  );
}

export default function Oficina() {
  const [datos, setDatos] = useState(null);
  const [enCurso, setEnCurso] = useState(null);
  const [modo, setModoActual] = useState("3d"); // "3d" (la planta), "chat" (lo que se dicen) o "lista" (las mesas, sin 3D: va más ligera)
  // La vista que eliges se recuerda para la próxima vez
  const setModo = (m) => { setModoActual(m); try { localStorage.setItem("cz-modo", m); } catch {} };
  const [elegido, setElegido] = useState(null);
  const [vista, setVista] = useState("todo"); // la sala que enfoca el 3D
  const [repeticion, setRepeticion] = useState(0); // > 0: la repetición en marcha
  const [con, setCon] = useState("todos"); // la conversación abierta en el chat
  const [escena, setEscena] = useState(null); // la reunión en el 3D: { n, participantes }
  const [movimiento, setMovimiento] = useState(true); // que paseen y hablen (se apaga si el móvil pide menos movimiento)
  const [ayuda, setAyuda] = useState(false);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const planta = useRef(null);
  const autoHecha = useRef(false);

  const cargar = useCallback(async (c) => {
    const d = await pedir("/api/panel/oficina", c);
    if (d.exito) setDatos(d);
    return d;
  }, []);
  const acceso = useClave(cargar);
  const { clave } = acceso;

  const verPlanta = () => planta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const irASala = (sala) => { setModo("3d"); setVista((v) => (v === sala ? `${sala} ` : sala)); verPlanta(); };
  const repetirAnoche = () => { setModo("3d"); setVista("todo"); setRepeticion((n) => Math.abs(n) + 1); verPlanta(); };
  const ir = (id) => { setAbiertos((a) => new Set(a).add(id)); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  const hablarCon = (id) => { setElegido(null); setCon(id); setModo("chat"); verPlanta(); };
  const verReunion = () => {
    const r = datos?.reunion;
    if (!r?.propuestas?.length) return;
    setRepeticion((n) => -Math.abs(n));
    setModo("3d"); setVista("escaparate");
    setEscena((x) => ({ n: (x?.n || 0) + 1, participantes: [{ id: "jefe", texto: r.abre }, ...r.propuestas.map((p) => ({ id: p.quien, texto: `${p.texto} ${p.propuesta}` }))] }));
    verPlanta();
  };
  const fichaDe = (id) => setElegido(datos?.departamentos.flatMap((d) => d.empleados).find((e) => e.id === id) || null);

  useEffect(() => {
    let modoGuardado = "";
    try { modoGuardado = localStorage.getItem("cz-modo") || ""; } catch {}
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = requestAnimationFrame(() => {
      if (["3d", "chat", "lista"].includes(modoGuardado)) setModoActual(modoGuardado);
      if (quieto) setMovimiento(false);
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Al abrir, si nadie está en su turno, se repite solo lo de las últimas 24 h: así siempre les ves trabajar.
  const hayDatos = !!datos;
  useEffect(() => {
    if (!hayDatos || autoHecha.current || modo !== "3d" || !movimiento) return;
    autoHecha.current = true;
    const ahora = Date.now();
    const alguien = datos.departamentos.some((d) => d.empleados.some((e) => dondeEsta(e, ahora) === "mesa"));
    const hayQueVer = datos.golpes?.length > 0 || datos.departamentos.some((d) => d.empleados.some((e) => e.parte?.fin && ahora - Date.parse(e.parte.fin) < 864e5));
    if (alguien || !hayQueVer) return;
    const t = requestAnimationFrame(() => setRepeticion((n) => (n > 0 ? n : Math.abs(n) + 1)));
    return () => cancelAnimationFrame(t);
    // Se mira una sola vez, con los primeros datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayDatos, modo, movimiento]);

  // En directo: cada minuto mientras alguien trabaja, si la pestaña está a la vista, vuelve a leer la oficina (solo Redis, 0 €).
  // Si nadie está trabajando, cada 3 minutos basta
  const ocupados = datos?.enCurso?.length || 0;
  useEffect(() => {
    if (!hayDatos || !clave) return;
    const i = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const d = await pedir("/api/panel/oficina", clave);
      if (d?.exito) setDatos(d);
    }, ocupados ? 60000 : 180000);
    return () => clearInterval(i);
  }, [hayDatos, clave, ocupados]);

  const decidir = async (id, decision) => {
    setEnCurso(id);
    try {
      const d = await pedir("/api/panel/oficina", clave, { id, decision });
      if (d?.exito || d?.mensaje === "Ya no está en la bandeja") setDatos((x) => ({ ...x, bandeja: x.bandeja.filter((e) => e.id !== id) }));
    } finally { setEnCurso(null); }
  };

  const cerrarFicha = () => setElegido(null);
  if (!acceso.lista || !datos) return <Entrada acceso={acceso} />;

  const fallos = fallosQueTeTocan(datos.departamentos, datos.fallanSeguido).fallos.length;
  const plegable = (id, titulo, contenido) => (
    <details id={id} className="pn-plegable scroll-mt-4" open={abiertos.has(id)} onToggle={(e) => { const a = e.currentTarget.open; setAbiertos((s) => { if (s.has(id) === a) return s; const n = new Set(s); if (a) n.add(id); else n.delete(id); return n; }); }}>
      <summary>{titulo}</summary>
      {abiertos.has(id) && <div>{contenido}</div>}
    </details>
  );

  return (
    <Marco derecha={<button onClick={() => setAyuda(true)} className="pn-boton flojo" style={{ minHeight: 40, padding: "0 14px", fontSize: 13 }}>¿Qué estoy viendo?</button>}>
      <div className="space-y-3">
        <section ref={planta} className="space-y-2.5 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="pn-segmento" role="group" aria-label="Cómo ver la oficina">
              {[["3d", "Oficina"], ["chat", "Chat"], ["lista", "Mesas"]].map(([id, texto]) => <button key={id} aria-pressed={modo === id} onClick={() => setModo(id)}>{texto}</button>)}
            </div>
            {modo === "3d" && <button onClick={repetirAnoche} className="pn-boton flojo" style={{ minHeight: 40, fontSize: 13 }}>▶ Ver las últimas 24 h</button>}
          </div>
          {modo === "3d" && (
            <Oficina3D departamentos={datos.departamentos} charla={datos.charla || []} golpes={datos.golpes || []} bandeja={datos.bandeja} flujo={datos.flujo || {}}
              alElegir={setElegido} vista={vista} setVista={setVista} repeticion={repeticion > 0 ? repeticion : 0} alAcabarRepeticion={() => { setRepeticion((n) => -Math.abs(n)); setVista("todo"); }}
              movimiento={movimiento} reunion={escena} alAcabarReunion={() => { setVista("todo"); setEscena(null); }} />
          )}
          {modo === "lista" && datos.departamentos.map((d) => (
            <section key={d.id} className="space-y-3" aria-label={d.nombre}>
              <div className="px-1 flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-bold text-base">{d.nombre}</h3>
                <p className="pn-apunte" style={{ fontSize: 12 }}>{d.nota}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {d.empleados.map((e, i) => <Mesa key={e.id} e={e} i={i} departamento={d.id} alElegir={setElegido} />)}
              </div>
            </section>
          ))}
          {modo === "chat" && <Chat charla={datos.charla || []} departamentos={datos.departamentos} clave={clave} alTerminar={() => cargar(clave)} con={con} setCon={setCon} />}
        </section>

        <Flujo flujo={datos.flujo || {}} alElegir={irASala} />

        {(fallos > 0 || datos.bandeja.length > 0 || (datos.sinConfirmar || []).length > 0) && (
          <HoyTeToca bandeja={datos.bandeja} sinConfirmar={datos.sinConfirmar || []} captacion={[]} departamentos={datos.departamentos} fallanSeguido={datos.fallanSeguido || []} flujo={datos.flujo || {}}
            clave={clave} alTerminar={() => cargar(clave)} alVerBandeja={() => ir("bandeja")} />
        )}

        {plegable("parte", "Parte del jefe", <ParteJefe jefe={datos.jefe} />)}
        {plegable("reunion", `Reunión del equipo${datos.reunion?.propuestas?.length ? ` · ${datos.reunion.propuestas.length}` : ""}`, (
          <Reunion reunion={datos.reunion} porId={Object.fromEntries(datos.departamentos.flatMap((d) => d.empleados).map((e) => [e.id, e]))} clave={clave}
            alVer={verReunion} alFicha={fichaDe} alIr={(destino) => ir(destino)} alTerminar={() => cargar(clave)} />
        ))}
        {plegable("novedades", "Novedades de la semana", <Novedades lista={datos.novedades || []} departamentos={datos.departamentos} />)}
        {plegable("bandeja", `Bandeja del Verificador · ${datos.bandeja.length}`, <Bandeja lista={datos.bandeja} decidir={decidir} enCurso={enCurso} />)}
      </div>

      <FichaEmpleado e={elegido} jefe={datos.jefe} alCerrar={cerrarFicha} clave={clave} alTerminar={() => cargar(clave)} alHablar={hablarCon} />
      <Ayuda abierta={ayuda} alCerrar={() => setAyuda(false)} />
    </Marco>
  );
}
