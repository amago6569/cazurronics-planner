"use client";
// /panel — Inicio: lo básico y nada más. Cómo va la web, los locales con más interés, a quién escribir y cómo va la oficina.
// Solo lee contadores de Redis: abrirlo no llama a la IA. Lo demás está en /panel/mas.
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cifrasPeriodo, fraseHoy, PRESUPUESTO_IA_MES, techoEje } from "../../lib/panelCifras";
import { euros } from "../../lib/euros";
import { Entrada, Marco, fmt, pedir, useClave } from "./comun";
import { fallosQueTeTocan } from "./oficina/hoy";

const RANGOS = [[7, "7 días"], [14, "14"], [30, "30"]];

function Cambio({ valor }) {
  if (valor == null) return <span className="pn-delta" style={{ color: "var(--gris)", fontWeight: 400 }}>Sin periodo anterior para comparar</span>;
  return (
    <span className="pn-delta">
      <span className={valor >= 0 ? "pn-sube" : "pn-baja"}>{valor >= 0 ? "▲" : "▼"} {Math.abs(valor)} %</span>{" "}
      <span style={{ color: "var(--gris)", fontWeight: 400 }}>que el periodo anterior</span>
    </span>
  );
}

function Grafica({ serie }) {
  const [marcado, setMarcado] = useState(null);
  const W = 640, H = 210, I = 34, D = 40, A = 10, B = 24;
  const u = serie.length - 1;
  const max = techoEje(Math.max(1, ...serie.map((d) => Math.max(d.visitas, d.planes))));
  const x = (i) => I + (u ? i / u : 0) * (W - I - D);
  const y = (v) => H - B - (v / max) * (H - A - B);
  const linea = (k) => serie.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join("");
  const corta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const larga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const leer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setMarcado(Math.max(0, Math.min(u, Math.round(((px - I) / (W - I - D)) * u))));
  };
  if (!serie.length) return null;
  const i = marcado ?? u;
  const d = serie[i];
  return (
    <>
      <p className="pn-apunte tabular-nums" style={{ minHeight: 20, marginTop: 4 }}>{larga(d.fecha)}: {fmt(d.visitas)} visitas, {fmt(d.planes)} planes</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Visitas y planes de los últimos ${serie.length} días`} style={{ width: "100%", height: "auto", display: "block", marginTop: 8, touchAction: "pan-y" }} onPointerMove={leer} onPointerLeave={() => setMarcado(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={I} x2={W - D} y1={y(t)} y2={y(t)} stroke="var(--borde)" />
            <text x={I - 8} y={y(t) + 4} textAnchor="end" fontSize="13" fill="var(--gris)">{fmt(t)}</text>
          </g>
        ))}
        {[0, Math.floor(u / 2), u].map((k, n) => <text key={n} x={x(k)} y={H - 6} textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"} fontSize="13" fill="var(--gris)">{corta(serie[k].fecha)}</text>)}
        <path d={`${linea("visitas")}L${x(u)} ${y(0)}L${x(0)} ${y(0)}Z`} fill="var(--crema)" opacity=".07" />
        <path d={linea("visitas")} fill="none" stroke="var(--crema)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={linea("planes")} fill="none" stroke="var(--oro)" strokeWidth="2.2" strokeLinejoin="round" />
        {marcado != null && <line x1={x(i)} x2={x(i)} y1={A} y2={H - B} stroke="var(--gris)" strokeDasharray="3 3" />}
        <circle cx={x(i)} cy={y(d.visitas)} r="4" fill="var(--crema)" />
        <circle cx={x(i)} cy={y(d.planes)} r="4" fill="var(--oro)" />
        {marcado == null && (
          <>
            <text x={x(u) + 8} y={y(d.visitas) + 4} fontSize="14" fontWeight="700" fill="var(--crema)">{fmt(d.visitas)}</text>
            <text x={x(u) + 8} y={y(d.planes) + 4} fontSize="14" fontWeight="700" fill="var(--oro)">{fmt(d.planes)}</text>
          </>
        )}
      </svg>
    </>
  );
}

export default function Inicio() {
  const [datos, setDatos] = useState(null);
  const [oficina, setOficina] = useState(null);
  const [dias, setDias] = useState(14);
  const [fuente, setFuente] = useState("planner");

  const cargar = useCallback(async (c) => {
    const d = await pedir("/api/panel", c);
    if (d.exito) {
      setDatos(d);
      // La oficina va aparte: Inicio se ve al momento aunque ella tarde un poco
      pedir("/api/panel/oficina", c).then((o) => setOficina(o.exito ? o : { error: true }));
    }
    return d;
  }, []);
  const acceso = useClave(cargar);

  const c = useMemo(() => cifrasPeriodo(datos?.resumen?.porDia, dias), [datos, dias]);

  if (!acceso.lista || !datos) return <Entrada acceso={acceso} />;

  const solicitudes = (datos.solicitudes || []).filter((s) => !s.atendida).length;
  const oficinaBien = !!oficina && !oficina.error;
  const locales = oficina?.captacion?.length || 0;
  const fallos = oficinaBien ? fallosQueTeTocan(oficina.departamentos, oficina.fallanSeguido).fallos.length : 0;
  const negocios = solicitudes + locales;
  const pendiente = negocios + fallos;
  const gasto = oficina?.jefe?.cifras?.gasto;
  const flujo = oficina?.flujo;
  const lista = fuente === "planner" ? datos.lugares || [] : datos.tiendas || [];
  const midiendo = c.planner + c.despensa > 0;

  return (
    <Marco negocios={oficina ? negocios : undefined}>
      <Link href={negocios || !fallos ? "/panel/negocios" : "/panel/oficina"} className="pn-bloque pn-estado">
        <span className={`pn-punto ${pendiente ? "" : "bien"}`} aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{oficina?.error ? "No se ha podido leer la oficina. Recarga dentro de un rato." : oficina ? fraseHoy({ solicitudes, locales, fallos }) : "Mirando qué tienes hoy…"}</b>
          <span className="pn-apunte">
            {gasto ? `Gasto de IA: ${euros(gasto.mes)} de ${PRESUPUESTO_IA_MES} € este mes.` : "Sin datos de gasto todavía."}
            {datos.almacen === "memoria" ? " Datos en memoria: falta conectar Upstash." : ""}
          </span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="flex justify-between items-center gap-2.5 mb-3">
        <h2 className="pn-titulo">Cómo va la web</h2>
        <div className="pn-segmento" role="group" aria-label="Periodo">
          {RANGOS.map(([n, t]) => <button key={n} aria-pressed={dias === n} onClick={() => setDias(n)}>{t}</button>)}
        </div>
      </div>

      <div className="pn-bento">
        <div className="pn-bloque pn-cifra">
          <p className="pn-apunte">Visitas a la web</p>
          <span className="pn-grande">{fmt(c.visitas.valor)}</span>
          <Cambio valor={c.visitas.cambio} />
          <span className="pn-parte">{midiendo ? `Planner ${fmt(c.planner)} · Despensa ${fmt(c.despensa)}` : "Planner y Despensa se separan desde esta versión"}</span>
        </div>
        <div className="pn-bloque pn-cifra">
          <p className="pn-apunte">Planes hechos</p>
          <span className="pn-grande">{fmt(c.planes.valor)}</span>
          <Cambio valor={c.planes.cambio} />
        </div>
        <div className="pn-bloque pn-cifra">
          <p className="pn-apunte">Visitas a locales</p>
          <span className="pn-grande">{fmt(c.locales.valor)}</span>
          <Cambio valor={c.locales.cambio} />
          <span className="pn-parte">Planner {fmt(c.fichas)} · Despensa {fmt(c.comoLlegar)}</span>
        </div>
        <Link href="/panel/negocios" className="pn-bloque pn-cifra">
          <span className="pn-apunte">Negocios por contactar</span>
          <span className="pn-grande">{oficina ? fmt(negocios) : "…"}</span>
          <span className="pn-delta" style={{ color: "var(--oro)" }}>{negocios ? "Ver y escribirles →" : "Ver la lista →"}</span>
        </Link>

        <div className="pn-bloque pn-a8">
          <div className="flex flex-wrap justify-between gap-1.5">
            <h2 className="pn-titulo">Visitas y planes por día</h2>
            <div className="pn-leyenda"><span><i style={{ background: "var(--crema)" }} />Visitas</span><span><i style={{ background: "var(--oro)" }} />Planes</span></div>
          </div>
          <Grafica serie={c.serie} />
        </div>

        <Link href="/panel/oficina" className="pn-bloque pn-a4 pn-enlace flex flex-col">
          <span className="flex justify-between"><span className="pn-titulo">Oficina</span><span aria-hidden="true">→</span></span>
          <span className="pn-apunte" style={{ marginTop: 2 }}>{oficina?.error ? "No se ha podido leer." : oficina ? (oficina.enCurso?.length ? `${oficina.enCurso.length} trabajando ahora mismo.` : "Nadie trabajando ahora mismo.") : "Encendiendo las luces…"}</span>
          <span className="pn-mini">
            <span><b>{flujo ? fmt(flujo.buscan) : "…"}</b><em>búsquedas</em></span>
            <span><b>{flujo ? fmt(flujo.entran) : "…"}</b><em>nuevos</em></span>
            <span><b>{flujo ? fmt(flujo.sinFuente) : "…"}</b><em>a revisar</em></span>
            <span><b>{flujo ? fmt(flujo.agenda) : "…"}</b><em>en agenda</em></span>
          </span>
          <span className="pn-boton flojo" style={{ marginTop: "auto" }}>▶ Ver a la oficina trabajar</span>
        </Link>

        <div className="pn-bloque pn-ancho">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
            <h2 className="pn-titulo">Locales con más interés</h2>
            <div className="pn-segmento" role="group" aria-label="Sección">
              <button aria-pressed={fuente === "planner"} onClick={() => setFuente("planner")}>Planner</button>
              <button aria-pressed={fuente === "despensa"} onClick={() => setFuente("despensa")}>Despensa</button>
            </div>
          </div>
          {lista.length ? (
            <ul className="pn-filas">
              {fuente === "planner"
                ? lista.slice(0, 5).map((l) => (
                  <li key={l.clave}>
                    <span className="nombre">{l.nombre}<small>{fmt(l.stats.apariciones)} veces en planes · {fmt(l.stats.llamar)} llamadas · {fmt(l.stats.web)} a su web</small></span>
                    <span className="dato" title="Fichas abiertas">{fmt(l.stats.detalle)}</span>
                  </li>
                ))
                : lista.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <span className="nombre">{t.nombre}<small>{t.localidad ? `${t.localidad} · ` : ""}{fmt(t.web)} a su web</small></span>
                    <span className="dato" title="Veces que han pedido «Cómo llegar»">{fmt(t.llegar)}</span>
                  </li>
                ))}
            </ul>
          ) : <p className="pn-apunte" style={{ padding: "12px 0" }}>{fuente === "planner" ? "Cuando se hagan planes, aquí verás los locales que más interesan." : "Empieza a contar con esta versión: cada «Cómo llegar» de la Despensa sumará aquí."}</p>}
        </div>
      </div>
    </Marco>
  );
}
