"use client";
// Buscador de la Despensa de León. Dos formas de buscar:
//  · Escribes lo que quieres y la IA elige entre las tiendas comprobadas (/api/despensa/buscar, ~0,0007 $ por búsqueda).
//    Si pides algo que no tenemos, se apunta y se busca esa noche.
//  · Eliges productos con los botones: se filtra en el navegador con el catálogo que ya trae la página (0 €).
import { useEffect, useMemo, useRef, useState } from "react";
import { GLASS, PRESS, BOTON_CTA } from "../../lib/estilos";
import { PRODUCTOS, enlaceMaps, productoPorId, topTiendas } from "../../lib/despensaProductos";
import { ZONAS, zonaPorId } from "../../lib/zonas";

const RADIOS = [5, 15, 30, 60];
const PRESUPUESTOS = [
  { id: "ajustado", texto: "Ajustado", emoji: "💸" },
  { id: "igual", texto: "Me da igual", emoji: "👌" },
  { id: "capricho", texto: "Capricho", emoji: "✨" },
];
const MAX_PRODUCTOS = 4;
const MEDALLAS = ["🥇", "🥈", "🥉"];
const EJEMPLOS = [
  { emoji: "🎁", texto: "Cecina buena para regalar" },
  { emoji: "🧀", texto: "Queso curado de oveja" },
  { emoji: "🧁", texto: "Mantecadas para llevar a Madrid" },
  { emoji: "🍷", texto: "Un Prieto Picudo para una cena" },
  { emoji: "🥖", texto: "Pan de horno de leña" },
];
const INPUT = "w-full bg-white/75 border border-white text-slate-800 placeholder:text-slate-400 text-[15px] font-medium rounded-2xl px-4 py-3.5 outline-none ring-1 ring-slate-900/5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:ring-2 focus:ring-rose-300/70 focus:shadow-[0_0_0_6px_rgba(251,113,133,0.12)]";

const centroDe = (id) => { const z = zonaPorId(id); const [lat, lon] = z.centroReal || [z.lat, z.lon]; return { lat, lon, nombre: z.id === "leon" ? "León" : z.corto }; };
const chip = (activo) => `${PRESS} shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-sm font-semibold ring-1 ${activo ? "bg-slate-900 text-white ring-slate-900 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)]" : "bg-white/60 text-slate-700 ring-slate-900/5 hover:bg-white hover:-translate-y-0.5"}`;

function Paso({ n, titulo, extra, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2.5 px-1">
        <p className="text-[15px] font-bold text-slate-900"><span className="text-rose-500 tabular-nums mr-1.5">{n}</span>{titulo}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Tienda({ t, i }) {
  return (
    <li className="bg-white/70 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4 transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.35)]">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-label={`Puesto ${i + 1}`}>{MEDALLAS[i]}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 leading-snug">{t.nombre}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {[t.localidad, t.km != null && `a ${String(t.km).replace(".", ",")} km`].filter(Boolean).join(" · ")}
            <span className={`ml-2 inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold ${t.precio === "capricho" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{t.precio === "capricho" ? "✨ Capricho" : "💸 Calidad-precio"}</span>
          </p>
          {t.motivo && <p className="text-sm font-semibold text-rose-700 mt-2 leading-relaxed">✨ {t.motivo}</p>}
          {t.especialidad && <p className={`text-sm font-semibold text-slate-800 ${t.motivo ? "mt-1.5" : "mt-2"}`}>{t.especialidad}</p>}
          {t.porque && <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{t.porque}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <a href={enlaceMaps(t)} target="_blank" rel="noopener noreferrer" className={`${PRESS} inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)] hover:bg-slate-800 hover:-translate-y-0.5`}>📍 Cómo llegar</a>
            <a href={t.fuente} target="_blank" rel="noopener noreferrer nofollow" className={`${PRESS} inline-flex items-center h-10 px-3 rounded-full text-sm font-semibold text-slate-500 hover:text-rose-600`}>Fuente ↗</a>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function BuscadorDespensa({ tiendas, productoInicial = "cecina" }) {
  const [elegidos, setElegidos] = useState([productoInicial]);
  const [zona, setZona] = useState("leon");
  const [centro, setCentro] = useState(() => centroDe("leon"));
  const [radio, setRadio] = useState(15);
  const [presupuesto, setPresupuesto] = useState("igual");
  const [aviso, setAviso] = useState("");
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [ia, setIa] = useState(null); // lo que ha elegido la IA para lo que has escrito
  const resultadosRef = useRef(null);
  const [resultadosALaVista, setResultadosALaVista] = useState(false);

  // El botón flotante del móvil se esconde cuando ya estás viendo los resultados
  useEffect(() => {
    const el = resultadosRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setResultadosALaVista(e.isIntersecting), { rootMargin: "0px 0px -35% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const conTiendas = useMemo(() => new Set(tiendas.map((t) => t.producto)), [tiendas]);
  const resultados = useMemo(
    () => elegidos.map((id) => ({ producto: productoPorId(id), top: topTiendas(tiendas, { producto: id, lat: centro.lat, lon: centro.lon, radio, presupuesto }) })),
    [elegidos, tiendas, centro, radio, presupuesto],
  );

  const alternar = (id) => {
    setIa(null);
    if (elegidos.includes(id)) { setAviso(""); setElegidos(elegidos.filter((x) => x !== id)); return; }
    if (elegidos.length >= MAX_PRODUCTOS) { setAviso(`Como mucho ${MAX_PRODUCTOS} productos a la vez`); return; }
    setAviso("");
    setElegidos([...elegidos, id]);
  };
  const elegirZona = (id) => { setZona(id); setCentro(centroDe(id)); if (id !== "leon" && radio < 30) setRadio(30); };
  const cercaDeMi = () => {
    if (!navigator.geolocation) { setAviso("Tu navegador no deja usar la ubicación"); return; }
    setAviso("Buscando dónde estás…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setZona("yo"); setCentro({ lat: p.coords.latitude, lon: p.coords.longitude, nombre: "ti" }); setAviso(""); },
      () => setAviso("No hemos podido saber dónde estás. Elige una zona."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const verResultados = () => resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const buscar = async () => {
    if (buscando) return;
    if (texto.trim().length < 3) { setAviso("Escribe qué quieres comprar"); return; }
    setBuscando(true); setAviso("");
    setTimeout(verResultados, 50);
    try {
      const r = await fetch("/api/despensa/buscar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, lat: centro.lat, lon: centro.lon, radio, presupuesto }),
      });
      const d = await r.json().catch(() => null);
      if (!d?.exito) { setAviso(d?.mensaje || "No hemos podido buscar. Prueba otra vez."); setIa(null); return; }
      setIa({ ...d, pregunta: texto.trim() });
    } catch {
      setAviso("Sin conexión. Prueba otra vez en un momento.");
    } finally {
      setBuscando(false);
    }
  };

  // Lo que ha elegido la IA, agrupado por lo que compras en cada sitio (máximo 3 por grupo)
  const gruposIA = useMemo(() => {
    const grupos = [];
    for (const t of ia?.tiendas || []) {
      const clave = (t.para || "").toLowerCase();
      let g = grupos.find((x) => x.clave === clave);
      if (!g) { g = { clave, titulo: t.para, tiendas: [] }; grupos.push(g); }
      if (g.tiendas.length < 3) g.tiendas.push(t);
    }
    return grupos;
  }, [ia]);

  const total = resultados.reduce((n, r) => n + r.top.length, 0);
  const conTexto = texto.trim().length >= 3;

  return (
    <>
      <section className={`${GLASS} rounded-[2.25rem] p-5 sm:p-7 space-y-6 cz-up`}>
        <Paso n="1" titulo="¿Qué quieres comprar?">
          <textarea
            rows="2" value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); buscar(); } }}
            className={`${INPUT} resize-none leading-relaxed`} aria-label="Qué quieres comprar"
            placeholder="Ej: cecina buena para regalar y un queso curado"
          />
          <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap">
            {EJEMPLOS.map((s) => (
              <button key={s.texto} type="button" onClick={() => setTexto(s.texto)} className={`${PRESS} shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/60 ring-1 ring-slate-900/5 text-[13px] font-medium text-slate-700 hover:bg-white hover:ring-rose-200 hover:text-rose-600 hover:-translate-y-0.5`}>
                <span>{s.emoji}</span>{s.texto}
              </button>
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-4 mb-2.5 px-1">
            <p className="text-[13px] font-semibold text-slate-500">O elige productos</p>
            <span className="text-xs text-slate-500 tabular-nums">{elegidos.length}/{MAX_PRODUCTOS}</span>
          </div>
          <div className="grid grid-flow-col grid-rows-3 auto-cols-max justify-items-start gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 sm:mx-0 sm:px-0 sm:flex sm:flex-wrap">
            {PRODUCTOS.map((p) => (
              <button key={p.id} type="button" aria-pressed={elegidos.includes(p.id)} onClick={() => alternar(p.id)} className={`${chip(elegidos.includes(p.id))} ${conTiendas.has(p.id) ? "" : "opacity-70"}`}>
                <span className="text-base">{p.emoji}</span>{p.nombre}
              </button>
            ))}
          </div>
        </Paso>

        <Paso n="2" titulo="¿Por dónde?">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap pb-1">
            <button type="button" aria-pressed={zona === "yo"} onClick={cercaDeMi} className={chip(zona === "yo")}>📍 Cerca de mí</button>
            {ZONAS.map((z) => (
              <button key={z.id} type="button" aria-pressed={zona === z.id} onClick={() => elegirZona(z.id)} className={chip(zona === z.id)}>
                <span>{z.emoji}</span>{z.corto}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5 p-1.5 bg-white/45 rounded-2xl ring-1 ring-slate-900/5" role="radiogroup" aria-label="Radio">
            {RADIOS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={radio === r} onClick={() => setRadio(r)} className={`${PRESS} h-10 rounded-xl text-sm font-semibold tabular-nums ${radio === r ? "bg-white text-slate-900 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)]" : "text-slate-500 hover:text-slate-800"}`}>{r} km</button>
            ))}
          </div>
        </Paso>

        <Paso n="3" titulo="Presupuesto">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Presupuesto">
            {PRESUPUESTOS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={presupuesto === p.id} onClick={() => setPresupuesto(p.id)} className={`${PRESS} h-14 rounded-2xl text-sm font-semibold ring-1 flex flex-col items-center justify-center leading-tight ${presupuesto === p.id ? "bg-slate-900 text-white ring-slate-900 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)]" : "bg-white/60 text-slate-700 ring-slate-900/5 hover:bg-white"}`}>
                <span className="text-lg">{p.emoji}</span>{p.texto}
              </button>
            ))}
          </div>
        </Paso>

        {aviso && <p className="text-sm font-semibold text-rose-600 px-1 cz-fade" role="status">{aviso}</p>}

        {/* En el móvil este botón va abajo, al alcance del pulgar */}
        <div className="hidden sm:block">
          <button type="button" onClick={buscar} disabled={buscando || !conTexto} className={`${BOTON_CTA} w-full disabled:opacity-50 disabled:hover:translate-y-0`}>
            {buscando ? "Buscando en la despensa…" : conTexto ? "✨ Buscar lo que he escrito" : "✨ Escribe arriba qué buscas"}
          </button>
        </div>
      </section>

      <div ref={resultadosRef} className="scroll-mt-24 space-y-4 sm:space-y-5">
        {buscando && (
          <section className={`${GLASS} rounded-[2rem] p-6 text-center cz-fade`} aria-live="polite">
            <p className="text-3xl animate-bounce">🧺</p>
            <p className="font-bold text-slate-900 mt-2">Buscando en la despensa…</p>
            <p className="text-sm text-slate-500 mt-1">Repasamos las tiendas comprobadas de la zona</p>
          </section>
        )}
        {!buscando && ia && (
          <>
            <section className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up`}>
              <div className="px-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-rose-600">✨ Para «{ia.pregunta}»</p>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">Tu top a {ia.radio} km de {ia.sitio || centro.nombre}</h2>
                  {ia.frase && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ia.frase}</p>}
                </div>
                <button type="button" onClick={() => setIa(null)} className={`${PRESS} shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold text-slate-500 bg-white/60 ring-1 ring-slate-900/5 hover:text-rose-600`}>Cerrar</button>
              </div>
              {gruposIA.map((g) => (
                <div key={g.clave} className="mt-4">
                  {gruposIA.length > 1 && <h3 className="px-1 mb-2 text-[15px] font-bold text-slate-900 first-letter:uppercase">{g.titulo}</h3>}
                  <ol className="grid gap-2.5 lg:grid-cols-3">{g.tiendas.map((t, i) => <Tienda key={t.placeId || t.nombre} t={t} i={i} />)}</ol>
                </div>
              ))}
              {!gruposIA.length && !ia.buscamos && (
                <div className="bg-white/55 rounded-[1.4rem] p-5 text-center mt-4">
                  <p className="font-semibold text-slate-800">No hemos encontrado nada que encaje a {ia.radio} km.</p>
                  <p className="text-sm text-slate-500 mt-1">Prueba con otras palabras o con más kilómetros.</p>
                </div>
              )}
            </section>
            {ia.buscamos && (
              <section className={`${GLASS} rounded-[2rem] p-5 sm:p-6 cz-up`}>
                <p className="text-2xl">🔎</p>
                <p className="font-bold text-slate-900 mt-1">Aún no tenemos «{ia.buscamos}» comprobado por aquí</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">Esta noche nuestra IA lo busca en prensa, guías y reseñas, y solo publica las tiendas que existen de verdad. Vuelve mañana y repite la búsqueda.</p>
              </section>
            )}
          </>
        )}
        {!buscando && !ia && resultados.length === 0 && (
          <section className={`${GLASS} rounded-[2rem] p-6 text-center`}>
            <p className="text-3xl">🧺</p>
            <p className="font-bold text-slate-900 mt-2">Elige al menos un producto</p>
          </section>
        )}
        {!buscando && !ia && resultados.map(({ producto, top }) => (
          <section key={producto.id} className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up`}>
            <div className="px-1 mb-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{producto.emoji} {producto.nombre}</h2>
              <p className="text-sm text-slate-500">Top 3 a {radio} km de {centro.nombre}</p>
            </div>
            {top.length ? (
              <ol className="grid gap-2.5 lg:grid-cols-3">{top.map((t, i) => <Tienda key={t.placeId || t.nombre} t={t} i={i} />)}</ol>
            ) : (
              <div className="bg-white/55 rounded-[1.4rem] p-5 text-center">
                <p className="font-semibold text-slate-800">Todavía no tenemos {producto.nombre.toLowerCase()} a {radio} km de {centro.nombre}.</p>
                <p className="text-sm text-slate-500 mt-1">{conTiendas.has(producto.id) ? "Prueba con más kilómetros u otra zona." : "Cada noche nuestra IA revisa tiendas nuevas de la provincia. Vuelve en unos días."}</p>
                {radio < 60 && <button type="button" onClick={() => setRadio(RADIOS.find((r) => r > radio))} className={`${PRESS} mt-3 h-10 px-4 rounded-full bg-white ring-1 ring-slate-900/10 text-sm font-semibold text-slate-700 hover:text-rose-600`}>Ampliar a {RADIOS.find((r) => r > radio)} km</button>}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Móvil: el botón al alcance del pulgar para saltar a los resultados */}
      {/* Con texto escrito: buscar con la IA. Sin texto: saltar a los resultados de los productos elegidos */}
      {((conTexto && !buscando && ia?.pregunta !== texto.trim()) || (!conTexto && elegidos.length > 0 && !ia && !resultadosALaVista)) && (
        <div className="sm:hidden cz-fade fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-white/80 via-white/50 to-transparent pointer-events-none">
          {conTexto
            ? <button type="button" onClick={buscar} className={`${BOTON_CTA} w-full pointer-events-auto`}>✨ Buscar lo que he escrito</button>
            : <button type="button" onClick={verResultados} className={`${BOTON_CTA} w-full pointer-events-auto`}>🧺 Ver mi top {total ? `(${total} ${total === 1 ? "tienda" : "tiendas"})` : "3"}</button>}
        </div>
      )}
    </>
  );
}
