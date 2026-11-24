"use client";
// /admin/gasto — cuánto saldo de la IA queda, cuánto se gasta y en qué. Google no da el saldo de AI Studio por API:
// se calcula con las recargas que apuntas aquí y el gasto de cada llamada (lib/gastoPanel.js). Abrirlo no gasta nada.
import { useCallback, useState } from "react";
import { Entrada, Marco, fmt, pedir, useClave } from "../../panel/comun";

const eur = (n, d = 2) => `${(Number(n) || 0).toFixed(d).replace(".", ",")} €`;
const pct = (n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1).replace(".", ",")} %`;
const enMadrid = (t, op) => new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", ...op });
const diaLargo = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const NOMBRE_FUNCION = { barrido: "Barrido de eventos", planes: "Planes y retoques", otros: "Otros (jefe, Despensa…)" };
const ORIGEN_FACTOR = { estimado: "estimado con la factura de noviembre", cuadre: "sale de tu último cuadre con AI Studio", vercel: "fijado en Vercel (GASTO_IA_AJUSTE)" };
// La hora de ahora para el campo de fecha (datetime-local va sin zona: la del móvil)
const ahoraLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function Saldo({ saldo, gasto, factor }) {
  if (!saldo) {
    return (
      <section className="pn-bloque">
        <h2 className="pn-titulo">Saldo de la IA</h2>
        <p className="pn-grande" style={{ fontSize: 44, marginTop: 8 }}>—</p>
        <p className="pn-apunte mt-2">Apunta abajo tu última recarga (o el saldo que marca AI Studio) y el panel lo calcula solo desde ahí.</p>
      </section>
    );
  }
  const bajo = saldo.euros < 3 || (saldo.diasQueQuedan != null && saldo.diasQueQuedan < 5);
  return (
    <section className="pn-bloque" aria-live="polite">
      <h2 className="pn-titulo">Saldo de la IA (calculado)</h2>
      <p className="pn-grande" style={{ fontSize: 64, marginTop: 8, color: bajo ? "var(--mal)" : "var(--crema)" }}>{eur(saldo.euros)}</p>
      <p className="mt-2" style={{ fontWeight: 600 }}>
        {saldo.diasQueQuedan == null ? "Aún no hay una semana de gasto para calcular cuánto dura."
          : `Te dura unos ${fmt(Math.max(0, saldo.diasQueQuedan))} días al ritmo de la última semana (${eur(gasto.media7)} al día).`}
      </p>
      {saldo.viejo && <p className="mt-2 text-sm" style={{ color: "var(--oro)" }} role="alert">El último punto de partida tiene más de 40 días: apunta el saldo de AI Studio abajo para que la cifra sea fiable.</p>}
      <p className="pn-apunte mt-2">Desde {enMadrid(saldo.desde, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}: {eur(saldo.recargado)} recargados y {eur(saldo.contadoEuros)} contados por la web, × {String(factor.valor).replace(".", ",")} porque Google cobra algo más de lo que cuenta la web ({ORIGEN_FACTOR[factor.origen]}).</p>
    </section>
  );
}

function Grafica({ dias, tope }) {
  const [marcado, setMarcado] = useState(null);
  // Medidas parecidas a las del móvil, para que las letras del eje no salgan diminutas
  const W = 380, H = 170, I = 46, A = 8, B = 22;
  const n = dias.length;
  const max = Math.max(tope || 0, ...dias.map((d) => d.euros), 0.1) * 1.1;
  const ancho = (W - I) / n;
  const y = (v) => H - B - (v / max) * (H - A - B);
  const leer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setMarcado(Math.max(0, Math.min(n - 1, Math.floor((px - I) / ancho))));
  };
  const i = marcado ?? n - 1;
  const total = dias.reduce((s, d) => s + d.euros, 0);
  return (
    <>
      <p className="pn-apunte tabular-nums" style={{ minHeight: 20 }}>{diaLargo(dias[i].fecha)}: {eur(dias[i].euros)}{i === n - 1 ? " (hoy, va a medias)" : ""}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gasto de la IA por día en los últimos ${n} días: ${eur(total)} en total`} preserveAspectRatio="xMinYMid meet" style={{ width: "100%", height: "auto", maxHeight: 240, display: "block", marginTop: 8, touchAction: "pan-y" }} onPointerMove={leer} onPointerDown={leer} onPointerLeave={() => setMarcado(null)}>
        {[0, max / 2].map((t) => (
          <g key={t}>
            <line x1={I} x2={W} y1={y(t)} y2={y(t)} stroke="var(--borde)" />
            <text x={I - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--gris)">{eur(t)}</text>
          </g>
        ))}
        {dias.map((d, k) => (
          <rect key={d.fecha} x={I + k * ancho + 1.5} width={Math.max(2, ancho - 3)} y={y(d.euros)} height={Math.max(0, y(0) - y(d.euros))} rx="2"
            fill={k === i ? "var(--oro)" : "var(--crema)"} opacity={k === i ? 1 : 0.55} />
        ))}
        {tope > 0 && <line x1={I} x2={W} y1={y(tope)} y2={y(tope)} stroke="var(--mal)" strokeWidth="1.5" strokeDasharray="5 4" />}
        <text x={I} y={H - 5} fontSize="12" fill="var(--gris)">{diaCorto(dias[0].fecha)}</text>
        <text x={W} y={H - 5} textAnchor="end" fontSize="12" fill="var(--gris)">hoy</text>
      </svg>
      {tope > 0 && <p className="pn-leyenda mt-2"><span><i style={{ background: "var(--mal)" }} />Tope de {eur(tope)} al día (desde el 24-11): pasado el tope, los planes salen sin IA</span></p>}
    </>
  );
}

function Lista({ titulo, filas, nombre, pie }) {
  return (
    <section className="pn-bloque">
      <h2 className="pn-titulo">{titulo}</h2>
      {filas.length ? (
        <ul className="pn-filas mt-1">
          {filas.map((f) => (
            <li key={nombre(f)}>
              <span className="nombre">{nombre(f)}<small className="tabular-nums">{fmt(f.llamadas)} llamadas</small></span>
              <span className="dato">{eur(f.euros)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="pn-apunte mt-2">Aún no hay llamadas apuntadas.</p>}
      {pie && <p className="pn-apunte mt-2">{pie}</p>}
    </section>
  );
}

function Errores({ errores }) {
  const total = (k) => errores.reduce((s, d) => s + (d[k] || 0), 0);
  const tipos = [...new Set(errores.flatMap((d) => Object.keys(d).filter((k) => k !== "fecha")))].sort();
  const NOMBRE = { 402: "sin saldo", 403: "clave o permiso", 429: "saturado", 500: "fallo de Google", 503: "Google caído" };
  return (
    <section className="pn-bloque">
      <h2 className="pn-titulo">Errores de Google, 7 días</h2>
      {tipos.length ? (
        <ul className="pn-filas mt-1">
          {tipos.map((k) => (
            <li key={k}>
              <span className="nombre">Error {k}<small>{NOMBRE[k] || "otro"} · {errores.filter((d) => d[k]).map((d) => `${diaCorto(d.fecha)}: ${d[k]}`).join(" · ")}</small></span>
              <span className="dato">{fmt(total(k))}</span>
            </li>
          ))}
        </ul>
      ) : <p className="pn-apunte mt-2">Ninguno. Google ha contestado bien a todas las llamadas.</p>}
    </section>
  );
}

function Recarga({ clave, recargas, alGuardar }) {
  const [euros, setEuros] = useState("");
  const [fecha, setFecha] = useState(ahoraLocal);
  const [estado, setEstado] = useState("");
  const enviar = async (e) => {
    e.preventDefault();
    setEstado("guardando");
    const d = await pedir("/api/admin/gasto", clave, { accion: "recarga", euros, fecha: new Date(fecha).toISOString() });
    if (!d.exito) return setEstado(d.mensaje || "No se ha podido guardar.");
    setEstado("ok"); setEuros("");
    alGuardar();
  };
  return (
    <section className="pn-bloque">
      <h2 className="pn-titulo">He recargado</h2>
      <p className="pn-apunte mt-1">Cada vez que metas dinero en AI Studio (aistudio.google.com → Billing), apúntalo aquí.</p>
      <form onSubmit={enviar} className="mt-3 grid gap-2">
        <label className="grid gap-1 text-sm min-w-0"><span className="pn-apunte">Euros</span>
          <input inputMode="decimal" required value={euros} onChange={(e) => setEuros(e.target.value)} placeholder="20" className="w-full min-w-0 rounded-2xl px-4 h-12 bg-black/30 border border-[var(--borde)] text-[16px] outline-none tabular-nums" />
        </label>
        <label className="grid gap-1 text-sm min-w-0"><span className="pn-apunte">Cuándo</span>
          <input type="datetime-local" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full min-w-0 rounded-2xl px-3 h-12 bg-black/30 border border-[var(--borde)] text-[16px] outline-none" />
        </label>
        <button disabled={estado === "guardando"} className="pn-boton" style={{ minHeight: 48 }}>{estado === "guardando" ? "Guardando…" : `He recargado ${euros ? eur(String(euros).replace(",", ".")) : "X €"}`}</button>
      </form>
      {estado === "ok" && <p className="text-sm mt-2" style={{ color: "var(--bien)" }} role="status">Apuntado. El saldo ya lo cuenta.</p>}
      {estado && !["ok", "guardando"].includes(estado) && <p className="text-sm mt-2" style={{ color: "var(--mal)" }} role="alert">{estado}</p>}
      {recargas.length > 0 && (
        <ul className="pn-filas mt-2">
          {recargas.slice(0, 5).map((r) => (
            <li key={r.t}><span className="nombre" style={{ fontWeight: 400 }}>{enMadrid(r.t, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span><span className="dato" style={{ fontSize: 18 }}>{eur(r.euros)}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cuadre({ clave, saldo, cuadre, alGuardar }) {
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState("");
  const real = Number(String(valor).replace(",", "."));
  const vivo = saldo && valor !== "" && real > 0 ? (saldo.euros - real) / real : null;
  const enviar = async (e) => {
    e.preventDefault();
    setEstado("guardando");
    const d = await pedir("/api/admin/gasto", clave, { accion: "cuadre", saldo: valor });
    if (!d.exito) return setEstado(d.mensaje || "No se ha podido guardar.");
    setEstado("ok"); setValor("");
    alGuardar();
  };
  const lejos = cuadre?.desviacion != null && Math.abs(cuadre.desviacion) > 0.05;
  return (
    <section className="pn-bloque">
      <h2 className="pn-titulo">Cuadre con AI Studio</h2>
      <p className="pn-apunte mt-1">Cada pocos días, mira el saldo en AI Studio (Billing) y ponlo aquí. Así el panel corrige cuánto se queda corto su contador.</p>
      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="saldo-aistudio">Saldo que marca AI Studio, en euros</label>
        <input id="saldo-aistudio" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Saldo en AI Studio, €" className="flex-1 min-w-0 rounded-2xl px-4 h-12 bg-black/30 border border-[var(--borde)] text-[16px] outline-none tabular-nums" />
        <button disabled={estado === "guardando"} className="pn-boton" style={{ minHeight: 48 }}>{estado === "guardando" ? "…" : "Cuadrar"}</button>
      </form>
      {vivo != null && <p className="text-sm mt-2 tabular-nums" style={{ color: Math.abs(vivo) > 0.05 ? "var(--oro)" : "var(--gris)" }}>El panel calcula {eur(saldo.euros)}: {pct(vivo)} frente a AI Studio.</p>}
      {estado && !["ok", "guardando"].includes(estado) && <p className="text-sm mt-2" style={{ color: "var(--mal)" }} role="alert">{estado}</p>}
      {cuadre && (
        <div className="mt-3 text-sm" role={lejos ? "alert" : undefined}>
          <p className="tabular-nums">Último cuadre, {enMadrid(cuadre.t, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}: AI Studio {eur(cuadre.saldoAIStudio)}{cuadre.saldoCalculado != null ? `, el panel calculaba ${eur(cuadre.saldoCalculado)}` : ""}{cuadre.desviacion != null ? ` (${pct(cuadre.desviacion)})` : ""}.</p>
          {lejos && <p className="mt-1" style={{ color: "var(--oro)" }}>Se desviaba más de un 5 %.{cuadre.factor != null ? ` El contador se corrige ahora × ${String(cuadre.factor).replace(".", ",")}.` : " Aún hay poco gasto para corregir el contador: vuelve a cuadrar en unos días."}</p>}
        </div>
      )}
    </section>
  );
}

function Llamadas({ llamadas }) {
  return (
    <details className="pn-plegable">
      <summary>Últimas {llamadas.length} llamadas a la IA</summary>
      <div>
        {llamadas.length ? (
          <ul className="pn-filas">
            {llamadas.map((l, k) => (
              <li key={`${l.t}-${k}`}>
                <span className="nombre" style={{ fontSize: 14 }}>
                  {enMadrid(l.t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {l.k}
                  <small className="tabular-nums">{l.m} · {fmt(l.e)} leídos · {fmt(l.s)} escritos{l.b ? ` · ${l.b} búsquedas` : ""}</small>
                </span>
                <span className="dato" style={{ fontSize: 16 }}>{eur(l.euros, 4)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="pn-apunte" style={{ padding: "0 8px 8px" }}>Se apuntan desde que se subió este panel.</p>}
      </div>
    </details>
  );
}

export default function Gasto() {
  const [datos, setDatos] = useState(null);
  const cargar = useCallback(async (c) => {
    const d = await pedir("/api/admin/gasto", c);
    if (d.exito) setDatos(d);
    return d;
  }, []);
  const acceso = useClave(cargar);
  if (!acceso.lista || !datos) return <Entrada acceso={acceso} />;

  const { saldo, gasto, factor, dias, porFuncion, periodoFuncion, porModelo, planes, llamadas, errores, recargas, cuadre } = datos;
  const recargar = () => cargar(acceso.clave);
  return (
    <Marco>
      <div className="grid gap-3">
        <Saldo saldo={saldo} gasto={gasto} factor={factor} />

        <section className="pn-bloque">
          <h2 className="pn-titulo">Gasto de la IA</h2>
          <div className="pn-mini">
            <span><b style={{ color: gasto.hoy >= gasto.tope ? "var(--mal)" : undefined }}>{eur(gasto.hoy)}</b><em>hoy</em></span>
            <span><b>{eur(gasto.ayer)}</b><em>ayer</em></span>
            <span><b>{eur(gasto.d7)}</b><em>7 días</em></span>
            <span><b>{eur(gasto.d30)}</b><em>30 días</em></span>
          </div>
          <Grafica dias={dias} tope={gasto.tope} />
        </section>

        <section className="pn-bloque">
          <h2 className="pn-titulo">Planes, 30 días</h2>
          <div className="pn-mini">
            <span><b>{fmt(planes.planes)}</b><em>planes</em></span>
            <span><b>{planes.pctCache} %</b><em>de la caché</em></span>
            <span><b>{planes.pctSinIA} %</b><em>sin IA</em></span>
            <span><b>{planes.costeMedio == null ? "—" : eur(planes.costeMedio, 3)}</b><em>por plan con IA</em></span>
          </div>
          <p className="pn-apunte">De la caché: el mismo pedido repetido, sale gratis y al instante. Sin IA: pasado el tope del día o sin saldo. El coste por plan es el de este mes.</p>
        </section>

        <Lista titulo={`En qué se gasta (${periodoFuncion})`} filas={porFuncion} nombre={(f) => NOMBRE_FUNCION[f.funcion] || f.funcion} />
        <Lista titulo="Por modelo (30 días)" filas={porModelo} nombre={(f) => f.modelo}
          pie="Los 2.5 entran en las 1.500 búsquedas gratis al día; los 3.x pagan cada búsqueda. Precios en src/lib/preciosIA.js." />
        <Errores errores={errores} />
        <Recarga clave={acceso.clave} recargas={recargas} alGuardar={recargar} />
        <Cuadre clave={acceso.clave} saldo={saldo} cuadre={cuadre} alGuardar={recargar} />
        <Llamadas llamadas={llamadas} />
        <button onClick={recargar} className="pn-boton flojo">Actualizar</button>
      </div>
    </Marco>
  );
}
