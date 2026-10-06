"use client";
// /panel/comparar — solo para el equipo (clave = PANEL_CLAVE).
// Monta los mismos planes con el sistema de siempre (Gemini busca en Google en cada plan) y con el de ahorro
// (sin búsqueda: agenda verificada + locales comprobados), y los enseña lado a lado con lo que cuesta cada uno.
// No guarda los planes ni suma estadísticas.
import { useEffect, useState } from "react";
import Fondo from "../../components/Fondo";
import { GLASS, BOTON_OSCURO, TITULO_GRADIENTE } from "../../../lib/estilos";

const CASOS = [
  { apetece: "comer y luego salir de fiesta", lat: 42.5987, lon: -5.5671, radio: 5, presupuestoMin: 20, presupuestoMax: 60, zona: "León" },
  { apetece: "plan cultural tranquilo: museos y un buen café", lat: 42.5987, lon: -5.5671, radio: 3, presupuestoMin: 0, presupuestoMax: 30, zona: "León" },
  { apetece: "algo con niños por la mañana", lat: 42.5499, lon: -6.5983, radio: 15, presupuestoMin: 0, presupuestoMax: 40, zona: "Ponferrada" },
  { apetece: "comer cocido maragato y ver la ciudad", lat: 42.4589, lon: -6.0563, radio: 10, presupuestoMin: 20, presupuestoMax: 50, zona: "Astorga" },
  { apetece: "tapas por el Húmedo y algo de música en directo", lat: 42.5975, lon: -5.5685, radio: 3, presupuestoMin: 15, presupuestoMax: 40, zona: "León" },
  { apetece: "plan de tarde con amigos", lat: 42.2997, lon: -5.8992, radio: 20, presupuestoMin: 10, presupuestoMax: 40, zona: "La Bañeza" },
  { apetece: "cita romántica: cena y una copa", lat: 42.5987, lon: -5.5671, radio: 5, presupuestoMin: 40, presupuestoMax: 100, zona: "León" },
  { apetece: "una ruta corta y comer bien", lat: 42.2932, lon: -5.517, radio: 20, presupuestoMin: 15, presupuestoMax: 45, zona: "Valencia de Don Juan" },
  { apetece: "mercadillo y vermú", lat: 42.5987, lon: -5.5671, radio: 10, presupuestoMin: 0, presupuestoMax: 25, zona: "León" },
  { apetece: "naturaleza y comer en un pueblo de montaña", lat: 42.9726, lon: -5.0019, radio: 30, presupuestoMin: 15, presupuestoMax: 40, zona: "Riaño" },
];

const proximoSabado = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
};
const euros = (dolares) => (dolares == null ? "—" : `${(dolares * 0.92).toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €`);
const media = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null);

function Columna({ titulo, r }) {
  if (!r) return <div className="rounded-2xl bg-white/50 p-4 text-sm text-slate-500 animate-pulse">{titulo}: montando el plan…</div>;
  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-900/5">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-900">{titulo}</p>
        <p className="text-xs text-slate-500 tabular-nums">{r.segundos ?? "—"} s</p>
      </div>
      {r.exito ? (
        <ol className="space-y-1.5 text-sm">
          {r.plan.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-400 tabular-nums w-11 shrink-0">{p.hora}</span>
              <span className="text-slate-800">{p.titulo} <span className="text-slate-400">· {p.tipo}{p.resenas ? ` · ${p.resenas}` : ""}{p.precio ? ` · ${p.precio}` : ""}</span></span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-rose-600">{r.mensaje}</p>
      )}
      <p className="mt-3 pt-2 border-t border-slate-900/5 text-xs text-slate-500 tabular-nums">
        IA: {euros(r.uso?.dolares)} · búsquedas en Google: {r.uso?.consultas ?? "—"} · tokens: {r.uso ? `${r.uso.entrada} + ${r.uso.salida}` : "—"}
      </p>
    </div>
  );
}

export default function Comparar() {
  const [clave, setClave] = useState("");
  const [fecha, setFecha] = useState(proximoSabado);
  const [resultados, setResultados] = useState([]); // [{ google, ahorro }]
  const [enMarcha, setEnMarcha] = useState(false);
  const [error, setError] = useState("");

  // La clave que ya se puso en /panel (misma pestaña)
  useEffect(() => {
    let guardada = "";
    try { guardada = sessionStorage.getItem("cz-panel") || ""; } catch {}
    if (!guardada) return;
    const t = requestAnimationFrame(() => setClave(guardada));
    return () => cancelAnimationFrame(t);
  }, []);

  const pedir = async (caso, modo) => {
    const r = await fetch("/api/panel/comparar", {
      method: "POST", headers: { "x-clave": clave, "Content-Type": "application/json" },
      body: JSON.stringify({ ...caso, fecha, modo }),
    }).catch(() => null);
    if (r?.status === 401) throw new Error("Clave incorrecta");
    return (r && (await r.json().catch(() => null))) || { exito: false, mensaje: "Sin respuesta del servidor" };
  };

  const empezar = async () => {
    setError(""); setEnMarcha(true); setResultados([]);
    try { sessionStorage.setItem("cz-panel", clave); } catch {}
    try {
      for (let i = 0; i < CASOS.length; i++) {
        setResultados((rs) => [...rs, {}]);
        const [google, ahorro] = await Promise.all([pedir(CASOS[i], "google"), pedir(CASOS[i], "ahorro")]);
        setResultados((rs) => rs.map((x, j) => (j === i ? { google, ahorro } : x)));
      }
    } catch (e) {
      setError(e.message);
    } finally { setEnMarcha(false); }
  };

  const costes = (modo) => resultados.map((r) => r[modo]?.uso?.dolares).filter((n) => typeof n === "number");
  const mG = media(costes("google")), mA = media(costes("ahorro"));
  const okG = resultados.filter((r) => r.google?.exito).length, okA = resultados.filter((r) => r.ahorro?.exito).length;

  return (
    <main className="min-h-[100dvh] px-4 py-8 sm:py-12">
      <Fondo />
      <div className="mx-auto max-w-5xl space-y-5">
        <header className={`${GLASS} rounded-[2rem] p-6`}>
          <p className="text-3xl mb-1">⚖️</p>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${TITULO_GRADIENTE}`}>Comparar: con Google vs ahorro</h1>
          <p className="text-sm text-slate-600 mt-1">Monta {CASOS.length} planes con los dos sistemas y enseña el resultado y el coste de la IA de cada uno. No se guardan ni cuentan en las estadísticas.</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave del panel" className="flex-1 bg-white/80 border border-white rounded-2xl px-4 h-11 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300" />
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-white/80 border border-white rounded-2xl px-4 h-11 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-rose-300" />
            <button onClick={empezar} disabled={enMarcha || !clave} className={`${BOTON_OSCURO} disabled:opacity-50`}>{enMarcha ? `Montando ${resultados.length}/${CASOS.length}…` : "Empezar"}</button>
          </div>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </header>

        {resultados.length > 0 && (
          <section className={`${GLASS} rounded-[2rem] p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center`}>
            <div><p className="text-xs text-slate-500">Coste medio con Google</p><p className="text-xl font-bold text-slate-900 tabular-nums">{euros(mG)}</p></div>
            <div><p className="text-xs text-slate-500">Coste medio ahorro</p><p className="text-xl font-bold text-slate-900 tabular-nums">{euros(mA)}</p></div>
            <div><p className="text-xs text-slate-500">Ahorro por plan</p><p className="text-xl font-bold text-emerald-600 tabular-nums">{mG && mA != null ? `${Math.round((1 - mA / mG) * 100)} %` : "—"}</p></div>
            <div><p className="text-xs text-slate-500">Planes que salen bien</p><p className="text-xl font-bold text-slate-900 tabular-nums">{okG} vs {okA}</p></div>
          </section>
        )}

        {resultados.map((r, i) => (
          <section key={i} className={`${GLASS} rounded-[2rem] p-5`}>
            <p className="text-sm font-semibold text-slate-900 mb-3">{i + 1}. “{CASOS[i].apetece}” <span className="font-normal text-slate-500">· {CASOS[i].zona}, {CASOS[i].radio} km, {CASOS[i].presupuestoMin}-{CASOS[i].presupuestoMax} €</span></p>
            <div className="grid gap-3 md:grid-cols-2">
              <Columna titulo="Con Google (el de ahora)" r={r.google} />
              <Columna titulo="Ahorro (sin búsqueda)" r={r.ahorro} />
            </div>
          </section>
        ))}
        <p className="text-xs text-slate-500 px-2">Coste aproximado con la tarifa pública de Gemini (lib/gemini.js), en euros a 0,92 €/$. No incluye Google Places, que es igual en los dos.</p>
      </div>
    </main>
  );
}
