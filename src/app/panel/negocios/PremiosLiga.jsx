"use client";
// Premios de la Liga Cazurra: cada negocio que da premio, con su logo. Lo rellena Alejandro desde el móvil
// y Claude lo lee para el vídeo y la web. El logo se encoge aquí (máx. 320 px) antes de subirlo.
import { useCallback, useEffect, useRef, useState } from "react";
import { pedir } from "../comun";

const ESTADOS = { si: ["Confirmado", "var(--bien)"], hablando: ["Hablando", "var(--oro)"], no: ["No participa", "var(--mal)"] };
const VACIO = { nombre: "", premio: "", estado: "si", instagram: "", pueblo: "", notas: "", logo: "" };
const LADO = 320;

// Foto o imagen → data URL pequeño. WebP si el navegador sabe; si no, JPEG sobre blanco.
function encoger(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(img.width * escala));
      lienzo.height = Math.max(1, Math.round(img.height * escala));
      const ctx = lienzo.getContext("2d");
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      let dato = lienzo.toDataURL("image/webp", 0.85);
      if (!dato.startsWith("data:image/webp")) {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        dato = lienzo.toDataURL("image/jpeg", 0.85);
      }
      URL.revokeObjectURL(url);
      resolver(dato);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("imagen")); };
    img.src = url;
  });
}

function Logo({ src, nombre, lado = 64 }) {
  return (
    <span className="grid place-items-center shrink-0 overflow-hidden" style={{ width: lado, height: lado, borderRadius: 16, background: src ? "#fff" : "var(--panel-2)", border: "1px solid var(--borde)" }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={`Logo de ${nombre || "negocio"}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <span style={{ fontStretch: "70%", fontWeight: 800, fontSize: lado * 0.38, color: "var(--gris)" }}>{(nombre || "?").trim().charAt(0).toUpperCase() || "?"}</span>}
    </span>
  );
}

function Campo({ id, etiqueta, children }) {
  return <label htmlFor={id} className="flex flex-col gap-1.5"><span className="pn-apunte" style={{ fontWeight: 600 }}>{etiqueta}</span>{children}</label>;
}
const ENTRADA = "w-full rounded-2xl px-4 py-3 bg-black/30 border border-[var(--borde)] text-[16px] outline-none focus:border-[var(--oro)] transition-colors";

function Formulario({ inicial, clave, alGuardar, alCerrar }) {
  const [f, setF] = useState({ ...VACIO, ...inicial });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const primero = useRef(null);
  const cambia = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    primero.current?.focus();
    const esc = (e) => { if (e.key === "Escape") alCerrar(); };
    document.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = antes; };
  }, [alCerrar]);

  const subirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    try { const logo = await encoger(archivo); setF((x) => ({ ...x, logo })); }
    catch { setError("No se ha podido leer esa imagen. Prueba con una foto JPG o PNG."); }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.premio.trim()) { setError("Falta el nombre o el premio."); return; }
    setGuardando(true); setError("");
    const premio = { ...f };
    delete premio.id;
    const d = await pedir("/api/panel/premios", clave, { premio, id: inicial?.id });
    setGuardando(false);
    if (!d.exito) { setError(d.mensaje || "No se ha podido guardar."); return; }
    alGuardar(d.premio);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: "rgba(4,3,6,.72)" }} onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <form onSubmit={guardar} role="dialog" aria-modal="true" aria-labelledby="premio-titulo"
        className="pn-bloque w-full md:max-w-lg flex flex-col gap-3.5 overflow-y-auto premio-hoja"
        style={{ background: "#141218", maxHeight: "92dvh", borderRadius: "24px 24px 0 0", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto md:hidden" style={{ width: 40, height: 4, borderRadius: 2, background: "var(--borde)" }} aria-hidden="true" />
        <h2 id="premio-titulo" style={{ fontStretch: "72%", fontWeight: 800, fontSize: 26, lineHeight: 1, textTransform: "uppercase" }}>{inicial?.id ? "Editar negocio" : "Nuevo negocio"}</h2>

        <div className="flex items-center gap-3">
          <Logo src={f.logo} nombre={f.nombre} lado={72} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="pn-boton flojo cursor-pointer" style={{ alignSelf: "flex-start" }}>
              {f.logo ? "Cambiar logo" : "Subir logo"}
              <input type="file" accept="image/*" onChange={subirLogo} className="sr-only" />
            </label>
            {f.logo && <button type="button" className="pn-apunte text-left underline" onClick={() => setF((x) => ({ ...x, logo: "" }))}>Quitar logo</button>}
          </div>
        </div>

        <Campo id="pr-nombre" etiqueta="Nombre del negocio *"><input ref={primero} id="pr-nombre" value={f.nombre} onChange={cambia("nombre")} maxLength={80} autoComplete="off" placeholder="Ej.: Bar La Esquina" className={ENTRADA} /></Campo>
        <Campo id="pr-premio" etiqueta="Premio que da *"><input id="pr-premio" value={f.premio} onChange={cambia("premio")} maxLength={160} autoComplete="off" placeholder="Ej.: Cena para dos" className={ENTRADA} /></Campo>
        <div>
          <span className="pn-apunte" style={{ fontWeight: 600 }}>Estado</span>
          <div className="pn-segmento mt-1.5 w-full" role="group" aria-label="Estado">
            {Object.entries(ESTADOS).map(([k, [t]]) => <button key={k} type="button" className="flex-1" aria-pressed={f.estado === k} onClick={() => setF((x) => ({ ...x, estado: k }))}>{t}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Campo id="pr-insta" etiqueta="Instagram"><input id="pr-insta" value={f.instagram} onChange={cambia("instagram")} maxLength={40} autoComplete="off" autoCapitalize="none" placeholder="@cuenta" className={ENTRADA} /></Campo>
          <Campo id="pr-pueblo" etiqueta="Pueblo o barrio"><input id="pr-pueblo" value={f.pueblo} onChange={cambia("pueblo")} maxLength={60} autoComplete="off" placeholder="Ej.: León, Húmedo" className={ENTRADA} /></Campo>
        </div>
        <Campo id="pr-notas" etiqueta="Notas"><textarea id="pr-notas" value={f.notas} onChange={cambia("notas")} maxLength={500} rows={3} placeholder="Condiciones, fechas, contacto…" className={ENTRADA} style={{ resize: "vertical" }} /></Campo>

        {error && <p className="text-sm" style={{ color: "var(--mal)" }} role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          <button type="button" className="pn-boton flojo" style={{ minHeight: 50 }} onClick={alCerrar}>Cancelar</button>
          <button className="pn-boton" style={{ minHeight: 50, background: "var(--oro)" }} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}

function Ficha({ p, alEditar, alQuitar }) {
  const [seguro, setSeguro] = useState(false);
  const [color, texto] = [ESTADOS[p.estado]?.[1] || "var(--bien)", ESTADOS[p.estado]?.[0] || "Confirmado"];
  useEffect(() => { if (!seguro) return; const t = setTimeout(() => setSeguro(false), 4000); return () => clearTimeout(t); }, [seguro]);
  return (
    <li className="pn-bloque premio-ficha flex gap-3.5 items-start">
      <Logo src={p.logo} nombre={p.nombre} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 style={{ fontSize: 17, lineHeight: 1.2, fontWeight: 700, overflowWrap: "anywhere" }}>{p.nombre}</h3>
          <span className="shrink-0 uppercase" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color, border: "1px solid currentColor", borderRadius: 999, padding: "2px 8px" }}>{texto}</span>
        </div>
        <p style={{ fontSize: 14.5, overflowWrap: "anywhere" }}><span style={{ color: "var(--oro)", fontWeight: 700 }}>Premio · </span>{p.premio}</p>
        {(p.instagram || p.pueblo) && <p className="pn-apunte" style={{ overflowWrap: "anywhere" }}>{[p.instagram, p.pueblo].filter(Boolean).join(" · ")}</p>}
        {p.notas && <p className="pn-apunte whitespace-pre-line" style={{ overflowWrap: "anywhere" }}>{p.notas}</p>}
        <div className="flex gap-2 mt-1.5">
          <button className="pn-boton flojo" style={{ minHeight: 38, fontSize: 13 }} onClick={() => alEditar(p)}>Editar</button>
          <button className="pn-boton flojo" style={{ minHeight: 38, fontSize: 13, color: "var(--mal)" }} onClick={() => (seguro ? alQuitar(p) : setSeguro(true))}>{seguro ? "¿Seguro? Pulsa otra vez" : "Quitar"}</button>
        </div>
      </div>
    </li>
  );
}

// Manda a Alejandro (al buzón de la Liga) el correo que recibe un ganador, con un código de prueba.
function PruebaCorreo({ clave }) {
  const [estado, setEstado] = useState({ cargando: false, texto: "", bien: false });
  const probar = async () => {
    setEstado({ cargando: true, texto: "", bien: false });
    const d = await pedir("/api/liga/cierre", clave, { prueba: true });
    setEstado({ cargando: false, texto: d.mensaje || (d.exito ? "Enviado." : "No se pudo mandar."), bien: !!d.exito });
  };
  return (
    <div className="flex flex-col items-start gap-1.5 mb-3">
      <button className="pn-boton flojo" style={{ minHeight: 38, fontSize: 13 }} onClick={probar} disabled={estado.cargando}>
        {estado.cargando ? "Enviando…" : "Probar correo de ganador"}
      </button>
      {estado.texto && <p className="text-sm" style={{ color: estado.bien ? "var(--bien)" : "var(--mal)" }} role="status">{estado.texto}</p>}
    </div>
  );
}

export default function PremiosLiga({ clave }) {
  const [premios, setPremios] = useState(null);
  const [abierto, setAbierto] = useState(null); // null cerrado · {} nuevo · premio para editar
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const d = await pedir("/api/panel/premios", clave);
    if (d.exito) setPremios(d.premios || []);
    else { setPremios((x) => x || []); setAviso(d.mensaje || "No se ha podido cargar la lista."); }
  }, [clave]);
  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t); }, [cargar]);

  const guardado = (p) => {
    setPremios((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p]));
    setAbierto(null);
  };
  const quitar = async (p) => {
    setAviso("");
    const d = await pedir("/api/panel/premios", clave, { quitar: p.id });
    if (d.exito || d.status === 404) setPremios((l) => l.filter((x) => x.id !== p.id));
    else setAviso(d.mensaje || "No se ha podido quitar.");
  };
  const cerrar = useCallback(() => setAbierto(null), []);

  const lista = premios || [];
  const confirmados = lista.filter((p) => p.estado === "si").length;
  const hablando = lista.filter((p) => p.estado === "hablando").length;

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2.5">
        <div>
          <h2 className="pn-titulo">Premios de la Liga</h2>
          <p className="pn-apunte tabular-nums">{premios ? `${confirmados} confirmados · ${hablando} hablando · ${lista.length} en total` : "Cargando…"}</p>
        </div>
        <button className="pn-boton" style={{ background: "var(--oro)" }} onClick={() => setAbierto({})}>+ Añadir negocio</button>
      </div>
      <PruebaCorreo clave={clave} />
      {aviso && <p className="text-sm mb-2" style={{ color: "var(--mal)" }} role="alert">{aviso}</p>}
      {premios && !lista.length && (
        <div className="pn-bloque text-center flex flex-col items-center gap-1" style={{ borderStyle: "dashed", padding: 28 }}>
          <b>Todavía no hay negocios</b>
          <span className="pn-apunte">Pulsa «Añadir negocio» y pon su logo, su nombre y el premio que da.</span>
        </div>
      )}
      {lista.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {lista.map((p) => <Ficha key={p.id} p={p} alEditar={setAbierto} alQuitar={quitar} />)}
        </ul>
      )}
      {abierto && <Formulario inicial={abierto} clave={clave} alGuardar={guardado} alCerrar={cerrar} />}
    </section>
  );
}
