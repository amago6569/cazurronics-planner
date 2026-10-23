"use client";
// Buscador de la Despensa de León. Tres cosas y nada más: lo que quieres, hasta dónde te mueves y tus tiendas en el mapa.
//  · Escribes lo que quieres y la IA elige entre las tiendas comprobadas (/api/despensa/buscar, ~0,0007 $ por búsqueda).
//    Si pides algo que no tenemos, se apunta y se busca esa noche.
//  · En /despensa/<producto> ya sale el top de ese producto, filtrado en el navegador con el catálogo de la página (0 €).
import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { GLASS, PRESS, BOTON_CTA } from "../../lib/estilos";
import { enlaceMaps, productoPorId, rutaMaps, topTiendas } from "../../lib/despensaProductos";
import { zonaDe, zonaPorId } from "../../lib/zonas";

// El mismo mapa que los planes: buscas un pueblo o tocas el mapa y mueves el rosetón para la distancia
const Mapa = dynamic(() => import("./MapSelector"), { ssr: false, loading: () => <div className="h-[250px] rounded-[2rem] bg-white/50 animate-pulse" /> });

const PRESUPUESTO = "igual"; // sin presupuesto: la IA lo deduce de lo que escribes
const distancia = (r) => (r < 1 ? `${Math.round(r * 1000)} m` : `${String(r).replace(".", ",")} km`);
const dondeRadio = (r, sitio) => (r >= 150 ? "en toda la provincia" : `a ${distancia(r)} de ${sitio}`);
const LABEL = "flex items-center gap-2 text-[13px] font-semibold text-slate-700 mb-2 px-1";
const INPUT = "w-full bg-white/75 border border-white text-slate-800 placeholder:text-slate-400 font-medium rounded-2xl px-4 py-3.5 outline-none ring-1 ring-slate-900/5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:ring-2 focus:ring-rose-300/70 focus:shadow-[0_0_0_6px_rgba(251,113,133,0.12)]";
const LEON = { lat: 42.5987, lon: -5.5671, nombre: "León" };

// Cada tienda lleva el mismo número que su chincheta en el mapa (como las paradas de los planes)
function Tienda({ t }) {
  return (
    <li className="bg-white/70 ring-1 ring-slate-900/5 rounded-[1.4rem] p-4 transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.35)]">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 text-white font-bold text-sm flex items-center justify-center shadow-[0_5px_12px_-4px_rgba(244,63,94,0.6)] tabular-nums" aria-label={`Número ${t.n} en el mapa`}>{t.n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 leading-snug">{t.nombre}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {[t.localidad, t.km != null && `a ${String(t.km).replace(".", ",")} km`].filter(Boolean).join(" · ")}
            {t.nota && t.resenas >= 5 && <span className="ml-2 font-semibold text-slate-700" aria-label={`${t.nota} estrellas en Google Maps, ${t.resenas} reseñas`}>★ {String(t.nota).replace(".", ",")} <span className="font-normal text-slate-500">({t.resenas})</span></span>}
          </p>
          {t.premios?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {t.premios.slice(0, 2).map((p) => <li key={p} className="text-[13px] font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200/70 rounded-xl px-2.5 py-1.5 leading-snug">🏆 {p}</li>)}
            </ul>
          )}
          {t.motivo && <p className="text-sm text-slate-700 mt-2 leading-relaxed">{t.motivo}</p>}
          {t.especialidad && <p className="text-xs text-slate-500 mt-1.5"><span className="font-semibold text-slate-700">Conocida por:</span> {t.especialidad}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
          <a href={enlaceMaps(t)} target="_blank" rel="noopener noreferrer" className={`${PRESS} inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)] hover:bg-slate-800 hover:-translate-y-0.5`}>📍 Cómo llegar</a>
            {t.fuente && <a href={t.fuente} target="_blank" rel="noopener noreferrer nofollow" className={`${PRESS} inline-flex items-center h-10 px-3 rounded-full text-sm font-semibold text-slate-500 hover:text-rose-600`}>Fuente ↗</a>}
          </div>
        </div>
      </div>
    </li>
  );
}

// productoInicial: en /despensa/cecina ya salen las de cecina sin escribir nada. En /despensa se empieza escribiendo.
export default function BuscadorDespensa({ tiendas = [], productoInicial = null }) {
  const [centro, setCentro] = useState(LEON);
  const [radio, setRadio] = useState(15);
  const radioSeguro = radio === "" || radio < 0.2 ? 0.2 : radio; // la caja del mapa se puede vaciar mientras escribes
  const [aviso, setAviso] = useState("");
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [ia, setIa] = useState(null); // lo que ha elegido la IA para lo que has escrito
  const resultadosRef = useRef(null);

  // Tocar el mapa o buscar un pueblo en él
  const ponerCentro = ([lat, lon]) => {
    const z = zonaPorId(zonaDe({ lat, lon }));
    setCentro({ lat, lon, nombre: z ? (z.id === "leon" ? "León" : z.corto) : "tu punto" });
  };
  const centroMapa = useMemo(() => [centro.lat, centro.lon], [centro]);

  const buscar = async () => {
    if (buscando) return;
    if (texto.trim().length < 3) { setAviso("Escribe qué quieres comprar"); return; }
    setBuscando(true); setAviso("");
    setTimeout(() => resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const r = await fetch("/api/despensa/buscar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, lat: centro.lat, lon: centro.lon, radio: radioSeguro >= 150 ? 200 : radioSeguro, presupuesto: PRESUPUESTO }),
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

  // Los resultados, venga de la IA o del producto de la página: grupos por lo que compras, numerados seguidos
  const grupos = useMemo(() => {
    const lista = [];
    if (ia) {
      for (const t of ia.tiendas || []) {
        const clave = (t.para || "").toLowerCase();
        let g = lista.find((x) => x.clave === clave);
        if (!g) { g = { clave, titulo: t.para, tiendas: [] }; lista.push(g); }
        if (g.tiendas.length < 3) g.tiendas.push(t);
      }
    } else if (productoInicial) {
      const p = productoPorId(productoInicial);
      lista.push({ clave: p.id, titulo: `${p.emoji} ${p.nombre}`, tiendas: topTiendas(tiendas, { producto: p.id, lat: centro.lat, lon: centro.lon, radio: radioSeguro >= 150 ? 0 : radioSeguro, presupuesto: PRESUPUESTO }) });
    }
    let n = 0;
    return lista.map((g) => ({ ...g, tiendas: g.tiendas.map((t) => ({ ...t, n: ++n })) }));
  }, [ia, productoInicial, tiendas, centro, radioSeguro]);
  const todas = useMemo(() => grupos.flatMap((g) => g.tiendas), [grupos]);
  const pines = useMemo(() => todas.filter((t) => Number.isFinite(t.lat)).map((t) => ({ lat: t.lat, lon: t.lon, nombre: t.nombre, localidad: t.localidad, enlace: enlaceMaps(t), emoji: String(t.n), destacada: true })), [todas]);
  // Ruta con la mejor tienda de cada cosa (solo si buscas 2 o más cosas)
  const ruta = useMemo(() => (grupos.length > 1 ? rutaMaps(grupos.map((g) => g.tiendas[0]).filter(Boolean)) : null), [grupos]);
  const conTexto = texto.trim().length >= 3;
  const radioMostrado = ia ? (ia.radio >= 200 ? 150 : ia.radio) : radioSeguro;
  // Si la búsqueda se fue a otro sitio ("en Astorga"), el mapa de resultados se centra en sus tiendas
  const centroResultados = useMemo(() => (ia?.sitio && pines[0] ? [pines[0].lat, pines[0].lon] : centroMapa), [ia, pines, centroMapa]);

  return (
    <>
      <section className={`${GLASS} rounded-[2.25rem] p-5 sm:p-7 space-y-6 cz-up`}>
        <div>
          <label htmlFor="despensa-texto" className={LABEL}><span>🧺</span> ¿Qué quieres comprar?</label>
          <textarea
            id="despensa-texto" rows="3" value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); buscar(); } }}
            className={`${INPUT} resize-none leading-relaxed text-base`}
            placeholder="Una cosa o tu lista: morcilla, pan de leña, nicanores…"
          />
        </div>

        <div className="rounded-[1.75rem] p-2.5 sm:p-4 [&_input[type=text]]:min-w-0 [&_button]:whitespace-nowrap [&_button]:shrink-0 bg-gradient-to-br from-white/60 to-sky-50/50 ring-1 ring-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <label className={`${LABEL} mt-1 mb-3`}><span>📍</span> Hasta dónde te mueves <span className="font-normal text-slate-400">· toca el mapa</span></label>
          <Mapa fino radiusKm={radio} setRadiusKm={setRadio} center={centroMapa} setCenter={ponerCentro} tiendas={[]} />
        </div>

        {aviso && <p className="text-sm font-semibold text-rose-600 px-1 cz-fade" role="status">{aviso}</p>}

        {/* En el móvil este botón va abajo, al alcance del pulgar */}
        <div className="hidden sm:block">
          <button type="button" onClick={buscar} disabled={buscando || !conTexto} className={`${BOTON_CTA} w-full h-14 text-lg disabled:opacity-50 disabled:hover:translate-y-0`}>
            {buscando ? "Buscando…" : "✨ Buscar tiendas"}
          </button>
        </div>
      </section>

      <div ref={resultadosRef} className="scroll-mt-24">
        {buscando && (
          <section className={`${GLASS} rounded-[2rem] p-6 text-center cz-fade`} aria-live="polite">
            <p className="text-3xl animate-bounce">🧺</p>
            <p className="font-bold text-slate-900 mt-2">Buscando en las tiendas de la zona…</p>
          </section>
        )}
        {!buscando && (ia || productoInicial) && (
          <section className={`${GLASS} rounded-[2rem] p-4 sm:p-6 cz-up`} aria-live="polite">
            <div className="px-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {ia && <p className="text-xs font-semibold text-rose-600 truncate">Para «{ia.pregunta}»</p>}
                <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">Tus tiendas {dondeRadio(radioMostrado, ia?.sitio || centro.nombre)}</h2>
                {ia?.frase && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ia.frase}</p>}
              </div>
              {ia && <button type="button" onClick={() => setIa(null)} className={`${PRESS} shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold text-slate-500 bg-white/60 ring-1 ring-slate-900/5 hover:text-rose-600`}>Cerrar</button>}
            </div>

            {pines.length > 0 && (
              <div className="mt-4">
                <Mapa soloVer radiusKm={1} setRadiusKm={() => {}} center={centroResultados} setCenter={() => {}} tiendas={pines} />
              </div>
            )}

            {ruta && (
              <a href={ruta.url} target="_blank" rel="noopener noreferrer" className={`${PRESS} mt-4 group/ruta flex items-center gap-3 rounded-[1.4rem] bg-slate-900 text-white p-3.5 pr-4 shadow-[0_14px_30px_-14px_rgba(15,23,42,0.7)] hover:-translate-y-0.5 hover:bg-slate-800`}>
                <span className="shrink-0 w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl" aria-hidden>🗺️</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">Ruta por la mejor de cada cosa</span>
                  <span className="block text-xs text-white/70 truncate">{ruta.paradas.map((t) => t.nombre).join(" → ")}</span>
                </span>
                <span className="shrink-0 text-lg transition-transform duration-300 group-hover/ruta:translate-x-1" aria-hidden>→</span>
              </a>
            )}

            {grupos.filter((g) => g.tiendas.length).map((g) => (
              <div key={g.clave} className="mt-4">
                {grupos.length > 1 && <h3 className="px-1 mb-2 text-[15px] font-bold text-slate-900 first-letter:uppercase">{g.titulo}</h3>}
                <ol className="grid gap-2.5 lg:grid-cols-3">{g.tiendas.map((t) => <Tienda key={t.placeId || `${t.nombre}|${t.n}`} t={t} />)}</ol>
              </div>
            ))}

            {!todas.length && (
              <div className="bg-white/55 rounded-[1.4rem] p-5 text-center mt-4">
                <p className="font-semibold text-slate-800">{ia?.buscamos ? `Aún no tenemos «${ia.buscamos}» comprobado por aquí.` : `No hay nada que encaje ${dondeRadio(radioMostrado, centro.nombre)}.`}</p>
                <p className="text-sm text-slate-500 mt-1">{ia?.buscamos ? "Esta noche lo buscamos. Vuelve mañana y repite la búsqueda." : "Mueve el rosetón para buscar más lejos."}</p>
              </div>
            )}
            {todas.length > 0 && ia?.buscamos && (
              <p className="text-xs text-slate-500 mt-4 px-1">🔎 «{ia.buscamos}» lo buscamos esta noche en más tiendas. Mañana habrá más.</p>
            )}
          </section>
        )}
      </div>

      {/* Móvil: el botón al alcance del pulgar */}
      {conTexto && !buscando && ia?.pregunta !== texto.trim() && (
        <div className="sm:hidden cz-fade fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#fdf6ef] via-[#fdf6ef]/85 to-transparent pointer-events-none">
          <button type="button" onClick={buscar} className={`${BOTON_CTA} w-full h-14 text-lg pointer-events-auto`}>✨ Buscar tiendas</button>
        </div>
      )}
    </>
  );
}
