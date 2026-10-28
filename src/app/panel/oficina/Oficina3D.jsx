"use client";
// La oficina en 3D isométrico (solo CSS 3D: sin librerías). La planta se ve en diagonal desde arriba,
// con una sala por departamento y el despacho del jefe al fondo. Cada monigote es un "cartel" de pie que
// siempre mira a la cámara, así se lee igual gires como gires. Arrastra para girar; los botones de abajo
// acercan la cámara a cada sala. Tocar un monigote abre su parte.
import { useEffect, useRef, useState } from "react";
import { PRESS } from "../../../lib/estilos";
import { Andarin, CAMISAS, ESTADOS, Monigote, fmt, hace } from "./monigotes";
import Ordenes from "./ordenes";

const ANCHO = 1000, FONDO = 760, INCLINA = 58; // la planta (en unidades de mundo) y cuánto se inclina la cámara

// Salas: posición en la planta, color del suelo y cómo se reparten las mesas
const SALAS = {
  agenda: { x: 30, y: 30, w: 540, h: 440, suelo: "#ffe4e6", cols: 4, nombre: "Agenda por tipo" },
  territorio: { x: 600, y: 30, w: 370, h: 300, suelo: "#e0f2fe", cols: 3, nombre: "Territorio" },
  despensa: { x: 600, y: 360, w: 370, h: 170, suelo: "#fef3c7", cols: 3, nombre: "Despensa" },
  negocio: { x: 30, y: 500, w: 260, h: 230, suelo: "#ede9fe", cols: 2, nombre: "Negocio" },
  cafe: { x: 320, y: 500, w: 250, h: 230, suelo: "#f1f5f9", nombre: "Café" },
  jefe: { x: 600, y: 560, w: 370, h: 170, suelo: "#e2e8f0", nombre: "Despacho del jefe" },
};
const VISTAS = [
  { id: "todo", texto: "Toda", zoom: 1 },
  { id: "agenda", texto: "Agenda", zoom: 1.7 },
  { id: "territorio", texto: "Territorio", zoom: 2 },
  { id: "despensa", texto: "Despensa", zoom: 2.2 },
  { id: "negocio", texto: "Negocio", zoom: 2.2 },
  { id: "jefe", texto: "Jefe", zoom: 2.2 },
];

// Dónde va cada mesa: en filas dentro de su sala
function colocar(departamentos) {
  return departamentos.flatMap((d) => {
    const s = SALAS[d.id];
    if (!s) return [];
    const filas = Math.ceil(d.empleados.length / s.cols);
    const pasoX = s.w / s.cols, pasoY = (s.h - 40) / filas;
    return d.empleados.map((e, i) => ({
      e, i, dep: d.id,
      x: s.x + pasoX * (i % s.cols) + pasoX / 2,
      y: s.y + 40 + pasoY * Math.floor(i / s.cols) + pasoY * 0.78,
    }));
  });
}

// Algo de pie en la planta, en (x, y): se gira al revés que la planta para mirar siempre a la cámara
function DePie({ x, y, giro, ancho, alto, children, onClick, etiqueta, girando }) {
  const Tag = onClick ? "button" : "div";
  return (
    <div className="absolute" style={{ left: x, top: y, transformStyle: "preserve-3d" }}>
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        aria-label={etiqueta}
        className={`absolute block ${onClick ? "cursor-pointer focus-visible:outline-none" : "pointer-events-none"}`}
        style={{
          left: -ancho / 2, top: -alto, width: ancho, height: alto,
          transformOrigin: "50% 100%",
          transform: `rotateZ(${-giro}deg) rotateX(${-INCLINA}deg)`,
          transition: girando ? "none" : "transform .9s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {children}
      </Tag>
    </div>
  );
}

// Pared baja de cristal entre (x1, y1) y (x2, y2); solo líneas rectas horizontales o verticales
function Pared({ x1, y1, x2, y2, alto = 34, tinte = "rgba(255,255,255,0.45)" }) {
  const horizontal = y1 === y2;
  const largo = horizontal ? x2 - x1 : y2 - y1;
  return (
    <div
      className="absolute border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[2px]"
      style={{
        left: x1, top: y1,
        width: horizontal ? largo : alto, height: horizontal ? alto : largo,
        background: `linear-gradient(${horizontal ? "180deg" : "90deg"}, ${tinte}, rgba(255,255,255,0.15))`,
        transformOrigin: horizontal ? "50% 0" : "0 50%",
        transform: horizontal ? "rotateX(90deg)" : "rotateY(-90deg)",
      }}
    />
  );
}

function Sala({ s, cristal }) {
  const alto = cristal ? 70 : 30;
  const tinte = cristal ? "rgba(186,230,253,0.55)" : "rgba(255,255,255,0.5)";
  return (
    <>
      <div className="absolute rounded-[18px] ring-1 ring-slate-900/5" style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 40px), ${s.suelo}` }} />
      <p className="absolute text-[22px] font-black uppercase tracking-[0.18em] text-slate-900/25 select-none" style={{ left: s.x + 18, top: s.y + 10 }}>{s.nombre}</p>
      <Pared x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y} alto={alto} tinte={tinte} />
      <Pared x1={s.x} y1={s.y} x2={s.x} y2={s.y + s.h} alto={alto} tinte={tinte} />
      {cristal && <Pared x1={s.x + s.w} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} alto={alto} tinte={tinte} />}
    </>
  );
}

export default function Oficina3D({ departamentos, jefe, alElegir }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(360);
  const [giro, setGiro] = useState(-40);
  const [vista, setVista] = useState("todo");
  const arrastre = useRef(null);
  const [girando, setGirando] = useState(false); // mientras arrastras, la planta sigue al dedo sin transición

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mesas = colocar(departamentos);
  const v = VISTAS.find((x) => x.id === vista) || VISTAS[0];
  const sala = SALAS[vista];
  const foco = sala ? [sala.x + sala.w / 2 - ANCHO / 2, sala.y + sala.h / 2 - FONDO / 2] : [0, 0];
  const escala = Math.min(0.9, ancho / (ancho > 700 ? 1350 : 1150)) * v.zoom;
  const alto = Math.max(380, Math.min(640, ancho * 0.78));

  const empezar = (ev) => { arrastre.current = { x: ev.clientX, giro, movido: false }; };
  const mover = (ev) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = ev.clientX - a.x;
    if (!a.movido && Math.abs(dx) > 4) { a.movido = true; setGirando(true); }
    if (a.movido) setGiro(a.giro + dx * 0.35);
  };
  const soltar = () => { setGirando(false); setTimeout(() => { arrastre.current = null; }, 0); };
  const tocar = (e) => () => { if (!arrastre.current?.movido) alElegir(e); };

  return (
    <div className="space-y-3">
      <div
        ref={caja}
        onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}
        className="relative overflow-hidden rounded-[2rem] ring-1 ring-white/70 bg-gradient-to-b from-sky-100/70 via-white/40 to-rose-100/60 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] select-none cursor-grab active:cursor-grabbing touch-pan-y"
        style={{ height: alto, perspective: 2400 }}
      >
        <div
          className="absolute"
          style={{
            left: "50%", top: "50%", width: ANCHO, height: FONDO, marginLeft: -ANCHO / 2, marginTop: -FONDO / 2,
            transformStyle: "preserve-3d",
            transform: `scale(${escala}) rotateX(${INCLINA}deg) rotateZ(${giro}deg) translate(${-foco[0]}px, ${-foco[1]}px)`,
            transition: girando ? "none" : "transform .9s cubic-bezier(.2,.8,.2,1)",
          }}
        >
          {/* el edificio: suelo con sombra */}
          <div className="absolute -inset-4 rounded-[28px] bg-[#f8f1e7] shadow-[0_60px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5" />
          {Object.entries(SALAS).map(([id, s]) => <Sala key={id} s={s} cristal={id === "jefe"} />)}

          {/* el rincón del café */}
          <DePie x={400} y={600} giro={giro} girando={girando} ancho={70} alto={90}><div className="text-[64px] leading-none text-center">☕</div></DePie>
          <DePie x={510} y={690} giro={giro} girando={girando} ancho={70} alto={90}><div className="text-[64px] leading-none text-center">🪴</div></DePie>
          <DePie x={940} y={300} giro={giro} girando={girando} ancho={50} alto={70}><div className="text-[48px] leading-none text-center">🪴</div></DePie>

          {/* las mesas */}
          {mesas.map(({ e, i, dep, x, y }) => {
            const colores = CAMISAS[dep] || CAMISAS.agenda;
            const nuevos = e.parte?.eventos;
            return (
              <DePie key={e.id} x={x} y={y} giro={giro} girando={girando} ancho={128} alto={128} onClick={tocar(e)} etiqueta={`${e.nombre}: ${ESTADOS[e.estado]?.texto}`}>
                {e.estado === "ok" && nuevos > 0 && (
                  <span className="cz-flota absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-emerald-500 text-white text-[15px] font-bold px-2.5 py-0.5 shadow-lg tabular-nums">+{fmt(nuevos)}</span>
                )}
                <Monigote estado={e.estado} semilla={i + dep.length} camisa={colores[i % colores.length]} emoji={e.emoji} className="absolute bottom-0 inset-x-0 w-full h-auto drop-shadow-[0_6px_6px_rgba(15,23,42,0.18)] transition-transform duration-300 hover:scale-110" />
              </DePie>
            );
          })}

          {/* el jefe en su despacho */}
          <DePie x={785} y={712} giro={giro} girando={girando} ancho={160} alto={150} onClick={() => alElegir({ jefe: true })} etiqueta="El jefe">
            <span className="cz-flota absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 text-white text-[14px] font-bold px-3 py-1 shadow-lg">👔 {jefe.cifras.alDia}/{jefe.cifras.equipo}</span>
            <Monigote estado="ok" semilla={2} camisa="#0f172a" emoji="👔" jefe className="absolute bottom-0 inset-x-0 w-full h-auto drop-shadow-[0_8px_8px_rgba(15,23,42,0.2)]" />
          </DePie>

          {/* los que van y vienen: uno le lleva papeles al jefe, otra va a por café */}
          <div className="absolute left-0 top-0 cz-ruta-papel" style={{ transformStyle: "preserve-3d" }}>
            <DePie x={0} y={0} giro={giro} girando={girando} ancho={44} alto={92}><Andarin semilla={5} camisa="#0284c7" lleva="📄" className="w-full h-full" /></DePie>
          </div>
          <div className="absolute left-0 top-0 cz-ruta-cafe" style={{ transformStyle: "preserve-3d" }}>
            <DePie x={0} y={0} giro={giro} girando={girando} ancho={44} alto={92}><Andarin semilla={1} camisa="#e11d48" lleva="☕" className="w-full h-full" /></DePie>
          </div>
        </div>

        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <button onClick={() => setGiro((g) => g - 45)} aria-label="Girar a la izquierda" className={`${PRESS} w-10 h-10 rounded-full bg-white/80 ring-1 ring-slate-900/10 shadow-sm text-lg`}>⟲</button>
          <button onClick={() => setGiro((g) => g + 45)} aria-label="Girar a la derecha" className={`${PRESS} w-10 h-10 rounded-full bg-white/80 ring-1 ring-slate-900/10 shadow-sm text-lg`}>⟳</button>
        </div>
        <p className="absolute bottom-3 left-4 z-10 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-500 pointer-events-none">Arrastra para girar · toca un monigote</p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {VISTAS.map((x) => (
          <button key={x.id} onClick={() => setVista(x.id)} className={`${PRESS} shrink-0 h-10 px-4 rounded-full text-sm font-semibold ${vista === x.id ? "bg-slate-900 text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)]" : "bg-white/75 ring-1 ring-slate-900/10 text-slate-700"}`}>{x.texto}</button>
        ))}
      </div>
    </div>
  );
}

// La ficha que sale al tocar un monigote
export function FichaEmpleado({ e, jefe, alCerrar, clave, alTerminar }) {
  if (!e) return null;
  const est = ESTADOS[e.estado] || ESTADOS.ok;
  const p = e.parte;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={alCerrar}>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] cz-fade" />
      <div onClick={(ev) => ev.stopPropagation()} className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[2rem] bg-white/90 backdrop-blur-2xl ring-1 ring-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] cz-sheet">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" />
        {e.jefe ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">👔 El jefe</p>
            <ul className="mt-2 space-y-1.5 text-[15px] leading-snug text-slate-700">{jefe.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="text-4xl leading-none">{e.emoji}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">{e.nombre}</h3>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${est.pill}`}><i className={`w-1.5 h-1.5 rounded-full ${est.punto}`} />{est.texto}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-3">{e.puesto}</p>
            {p?.busquedas != null ? (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[["Encontrados", p.eventos], ["Sin fuente", p.descartados], ["Búsquedas", p.busquedas]].map(([t, n]) => (
                  <div key={t} className="rounded-2xl bg-slate-50 ring-1 ring-slate-900/5 p-3 text-center"><p className="text-xl font-bold tabular-nums text-slate-900">{fmt(n)}</p><p className="text-[11px] text-slate-500">{t}</p></div>
                ))}
              </div>
            ) : p?.texto && <p className="mt-3 text-sm font-semibold text-slate-800">{p.texto}</p>}
            {p?.error && <p className="mt-3 text-xs text-rose-600">{p.error}</p>}
            <p className="text-xs text-slate-400 mt-4">🕒 {e.horario} · último turno {hace(p?.fin)}</p>
            {e.ordenes && <Ordenes key={e.id} e={e} clave={clave} alTerminar={alTerminar} />}
          </>
        )}
        <button onClick={alCerrar} className={`${PRESS} mt-5 w-full h-12 rounded-full bg-slate-900 text-white font-semibold`}>Cerrar</button>
      </div>
    </div>
  );
}
