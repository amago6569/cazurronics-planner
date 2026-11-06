"use client";
// /panel/mas — lo que no hace falta mirar a diario: de dónde vienen las visitas, barridos a mano, gasto por tarea,
// las tripas de la Despensa y las estadísticas de locales. Los botones que gastan búsquedas viven solo aquí.
import { useCallback, useState } from "react";
import PanelDespensa from "../../components/PanelDespensa";
import { Entrada, Marco, fmt, pedir, useClave } from "../comun";

const pct = (a, b) => (b ? `${Math.round(((a || 0) / b) * 100)} %` : "—");
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

// Cada barrido va por tramos, uno detrás de otro, para que cada uno quepa en el minuto de Vercel
const BARRIDOS = {
  diario: { texto: "Barrido diario", ids: [...Array.from({ length: 8 }, (_, i) => `t${i}`), "d2", "d3", "d4", "d5"] },
  novedades: { texto: "Novedades", ids: ["r"] },
  gordo: { texto: "Pueblos", ids: Array.from({ length: 23 }, (_, i) => `m${i}`) },
};

const NOMBRES_TAREA = {
  "barrido-eventos": "Barrido de eventos", "eventos-a-peticion": "Eventos a petición", planes: "Planes", retoques: "Retoques",
  "despensa-tiendas": "Despensa: tiendas", "despensa-mercadillos": "Despensa: mercadillos", "despensa-fichas": "Despensa: fichas", "despensa-buscador": "Despensa: buscador",
};
const dolaresES = (n) => `~${n.toFixed(2).replace(".", ",")} $`;
const miles = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n));

function GastoIA({ gasto }) {
  const [mes, setMes] = useState(0);
  if (!gasto?.length) return null;
  const { tareas } = gasto[mes] || { tareas: [] };
  const total = tareas.reduce((s, t) => s + t.dolares, 0);
  return (
    <section className="pn-bloque">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="pn-titulo">Gasto de la IA por tarea · {dolaresES(total)}</h2>
        <div className="pn-segmento" role="group" aria-label="Mes">
          {gasto.map((g, i) => <button key={g.mes} aria-pressed={mes === i} onClick={() => setMes(i)}>{i === 0 ? "Este mes" : "Mes pasado"}</button>)}
        </div>
      </div>
      {tareas.length ? (
        <ul className="pn-filas">
          {tareas.map((t) => (
            <li key={t.tarea}>
              <span className="nombre">{NOMBRES_TAREA[t.tarea] || t.tarea}<small className="tabular-nums">{t.llamadas} llamadas · {t.busquedas} búsquedas · {miles(t.entrada)} leídos, {miles(t.salida)} escritos</small></span>
              <span className="dato">{dolaresES(t.dolares)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="pn-apunte">Aún no hay datos de este mes. Se apuntan solos en cada llamada a la IA.</p>}
      <p className="pn-apunte mt-3">Coste aproximado con la tarifa de Google. La factura real puede ser menor por las búsquedas gratis del día.</p>
    </section>
  );
}

function Barridos({ clave, barrido, agenda, alTerminar }) {
  const [barriendo, setBarriendo] = useState(null);
  const [aviso, setAviso] = useState("");
  const barrer = async (tipo) => {
    const { ids } = BARRIDOS[tipo];
    setAviso("");
    let saltados = 0, horas = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        setBarriendo({ tipo, hecho: i, total: ids.length });
        const d = await pedir("/api/panel", clave, { accion: "barrido", tramo: ids[i] });
        if (d?.saltado) { saltados++; horas = Math.max(horas, d.horas || 1); }
      }
      await alTerminar();
      if (saltados) setAviso(saltados === ids.length
        ? `Ya estaba hecho hace unas ${horas} h: no se ha repetido para no gastar búsquedas de Google.`
        : `${saltados} de ${ids.length} partes ya estaban hechas hace poco y se han saltado para no gastar búsquedas de Google.`);
    } finally { setBarriendo(null); }
  };
  return (
    <section className="pn-bloque">
      <h2 className="pn-titulo">Agenda y barridos</h2>
      <p className="pn-apunte mb-3">{barrido ? `Última pasada: ${new Date(barrido.fin || barrido.inicio).toLocaleString("es-ES")} · ${barrido.total ?? 0} planes en la agenda${barrido.descartados ? ` · ${barrido.descartados} descartados por fuente falsa` : ""}` : "Todavía no se ha hecho ningún barrido"}</p>
      <p className="pn-apunte mb-2">Se hacen solos cada noche. Lanzarlos a mano puede gastar búsquedas de Google; si se hizo hace poco, no se repite.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(BARRIDOS).map(([tipo, b]) => (
          <button key={tipo} onClick={() => barrer(tipo)} disabled={!!barriendo} className="pn-boton flojo">
            {barriendo?.tipo === tipo ? `${b.texto}: ${barriendo.hecho + 1}/${barriendo.total}…` : `${b.texto} (${b.ids.length === 1 ? "1 min" : `~${b.ids.length} min`})`}
          </button>
        ))}
      </div>
      {aviso && <p className="text-sm mb-3" style={{ color: "var(--oro)" }} role="status">{aviso}</p>}
      {barrido?.tramos && (
        <details className="pn-plegable mb-3">
          <summary>Cómo fue cada tramo</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {barrido.tramos.map((t) => (
              <div key={t.tramo} className="flex items-center justify-between gap-2 text-xs rounded-xl px-3 py-2" style={{ background: "var(--panel)" }}>
                <span className="truncate">{t.fin ? (t.errores ? "Con fallos" : "Bien") : "Pendiente"} · {t.nombre}</span>
                <span className="shrink-0 font-semibold tabular-nums">{t.fin ? `${t.eventos} · +${t.nuevos ?? 0}${t.descartados ? ` · −${t.descartados}` : ""}` : ""}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {barrido?.fuentes && Object.keys(barrido.fuentes).length > 0 && (
        <details className="pn-plegable mb-3">
          <summary>{Object.keys(barrido.fuentes).length} búsquedas fallaron en la última pasada</summary>
          <ul className="space-y-1 text-xs">{Object.entries(barrido.fuentes).map(([f, r]) => <li key={f} className="rounded-xl px-3 py-2" style={{ background: "var(--panel)" }}><b>{f}</b>: {r.error}</li>)}</ul>
        </details>
      )}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {agenda.map((d) => (
          <div key={d.fecha} className="shrink-0 w-14 text-center rounded-xl py-2" style={{ background: "var(--panel)" }}>
            <p className="text-[10px]" style={{ color: "var(--gris)" }}>{diaCorto(d.fecha)}</p>
            <p className="text-lg font-bold tabular-nums">{d.eventos}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Locales({ clave, lugares, alTerminar }) {
  const [busqueda, setBusqueda] = useState("");
  const [encontrados, setEncontrados] = useState(null);
  const [copiado, setCopiado] = useState("");
  const [reinicio, setReinicio] = useState("");
  const buscar = async (e) => {
    e.preventDefault();
    if (busqueda.trim().length < 2) { setEncontrados(null); return; }
    const d = await pedir(`/api/panel?buscar=${encodeURIComponent(busqueda.trim())}`, clave);
    setEncontrados(d.exito ? d.lugares : []);
  };
  const copiar = async (l) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/negocio/${l.enlaceNegocio}`); setCopiado(l.clave); setTimeout(() => setCopiado(""), 2000); } catch {}
  };
  const reiniciar = async () => {
    setReinicio("haciendo");
    const d = await pedir("/api/panel", clave, { accion: "reiniciar-locales" });
    if (d?.exito) { await alTerminar(); setReinicio("hecho"); } else setReinicio("error");
  };
  const lista = encontrados || lugares;
  return (
    <section className="pn-bloque">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="pn-titulo">{encontrados ? `Resultados para «${busqueda}»` : "Locales que más salen en los planes"}</h2>
          <p className="pn-apunte">El botón copia el enlace privado con las estadísticas de ese local, para mandárselo.</p>
        </div>
        <form onSubmit={buscar} className="flex gap-2">
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); if (!e.target.value) setEncontrados(null); }} placeholder="Buscar un local…" aria-label="Buscar un local" className="w-full sm:w-56 rounded-2xl px-4 h-11 text-[16px] sm:text-sm bg-black/30 border border-[var(--borde)] outline-none" />
          <button className="pn-boton flojo">Buscar</button>
        </form>
      </div>
      {encontrados && !encontrados.length && <p className="pn-apunte">Ningún local con ese nombre ha salido todavía en un plan.</p>}
      {lista.length > 0 && (
        <div className="overflow-x-auto no-scrollbar -mx-2">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs" style={{ color: "var(--gris)" }}><th className="px-2 py-2 font-medium">Local</th><th className="px-2 font-medium text-right">Planes</th><th className="px-2 font-medium text-right">Fichas</th><th className="px-2 font-medium text-right">Llamadas</th><th className="px-2 font-medium text-right">Web</th><th className="px-2 font-medium text-right">Bien / mal</th><th className="px-2" /></tr></thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.clave} style={{ borderTop: "1px solid rgba(243,234,216,.09)" }}>
                  <td className="px-2 py-2.5"><span className="font-semibold">{l.nombre}</span>{l.tipo && <span className="text-xs" style={{ color: "var(--gris)" }}> · {l.tipo}</span>}</td>
                  <td className="px-2 text-right tabular-nums">{fmt(l.stats.apariciones)}</td>
                  <td className="px-2 text-right tabular-nums">{fmt(l.stats.detalle)}</td>
                  <td className="px-2 text-right tabular-nums">{fmt(l.stats.llamar)}</td>
                  <td className="px-2 text-right tabular-nums">{fmt(l.stats.web)}</td>
                  <td className="px-2 text-right tabular-nums">{l.stats.bien} / {l.stats.mal}</td>
                  <td className="px-2 text-right">{l.enlaceNegocio && <button onClick={() => copiar(l)} className="pn-boton flojo" style={{ minHeight: 36, padding: "0 12px", fontSize: 12 }}>{copiado === l.clave ? "¡Copiado!" : "Enlace del local"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 pt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs" style={{ borderTop: "1px solid rgba(243,234,216,.09)", color: "var(--gris)" }}>
        <span className="min-w-0 flex-1">Los números son acumulados desde el lanzamiento: incluyen planes de prueba. Solo cuentan locales reales.</span>
        {reinicio === "seguro" ? (
          <>
            <span className="w-full sm:w-auto font-semibold" style={{ color: "var(--mal)" }}>¿Seguro? Se borran apariciones, fichas, llamadas y valoraciones de todos los locales.</span>
            <button onClick={reiniciar} className="pn-boton" style={{ minHeight: 36, fontSize: 12 }}>Sí, empezar de cero</button>
            <button onClick={() => setReinicio("")} className="pn-boton flojo" style={{ minHeight: 36, fontSize: 12 }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setReinicio("seguro")} disabled={reinicio === "haciendo"} className="pn-boton flojo" style={{ minHeight: 36, fontSize: 12 }}>{reinicio === "haciendo" ? "Borrando…" : "Empezar estadísticas de cero"}</button>
        )}
        {reinicio === "hecho" && <span className="w-full font-semibold" style={{ color: "var(--bien)" }}>Hecho: las estadísticas de locales empiezan de cero.</span>}
        {reinicio === "error" && <span className="w-full font-semibold" style={{ color: "var(--mal)" }}>No se pudo borrar. Inténtalo otra vez.</span>}
      </div>
    </section>
  );
}

export default function MasDatos() {
  const [datos, setDatos] = useState(null);
  const cargar = useCallback(async (c) => {
    const d = await pedir("/api/panel?mas=1", c);
    if (d.exito) setDatos(d);
    return d;
  }, []);
  const acceso = useClave(cargar);
  if (!acceso.lista || !datos) return <Entrada acceso={acceso} />;

  const { resumen } = datos;
  const t = resumen.porDia.reduce((acc, d) => { for (const [k, v] of Object.entries(d)) if (k !== "fecha") acc[k] = (acc[k] || 0) + v; return acc; }, {});
  const fuentes = Object.entries(resumen.fuentes).sort((a, b) => b[1] - a[1]);
  const recargar = () => cargar(acceso.clave);

  return (
    <Marco>
      <div className="space-y-3">
        <section className="pn-bloque">
          <h2 className="pn-titulo mb-3">Más cifras de los últimos 14 días</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[["Compartidos", t.compartir, `${pct(t.compartir, t.plan)} de los planes`], ["Vuelven", t.vuelve, `${pct(t.vuelve, t.visita)} de las visitas`], ["Votos en grupo", t.voto], ["Valoraciones", t.valoracion]].map(([n, v, nota]) => (
              <div key={n}>
                <p className="pn-apunte">{n}</p>
                <p className="pn-grande" style={{ fontSize: 34, marginTop: 4 }}>{fmt(v)}</p>
                {nota && <p className="pn-apunte" style={{ fontSize: 12 }}>{nota}</p>}
              </div>
            ))}
          </div>
        </section>
        <section className="pn-bloque">
          <h2 className="pn-titulo">De dónde vienen</h2>
          <p className="pn-apunte mb-2">Usa enlaces con ?ref=nombre en cada pieza: QR de bares, bio, reels…</p>
          {fuentes.length ? (
            <ul className="pn-filas">{fuentes.slice(0, 12).map(([f, n]) => <li key={f}><span className="nombre truncate">{f}</span><span className="dato">{fmt(n)}</span></li>)}</ul>
          ) : <p className="pn-apunte">Aún no hay visitas registradas.</p>}
        </section>
        <Barridos clave={acceso.clave} barrido={datos.barrido} agenda={datos.agenda} alTerminar={recargar} />
        <GastoIA gasto={datos.gastoIA} />
        <PanelDespensa clave={acceso.clave} despensa={datos.despensa} alTerminar={recargar} />
        <Locales clave={acceso.clave} lugares={datos.lugares} alTerminar={recargar} />
      </div>
    </Marco>
  );
}
