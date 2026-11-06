"use client";
// Lo que comparten las pantallas del panel: la clave, la cabecera con el rosetón de fondo y la navegación.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);

// Lee /api/... con la clave del panel. Devuelve siempre un objeto; si falla, { exito: false, mensaje }
export async function pedir(url, clave, cuerpo) {
  try {
    const r = await fetch(url, {
      method: cuerpo ? "POST" : "GET",
      headers: { "x-clave": clave, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    });
    const d = await r.json().catch(() => null);
    if (d) return d;
    return { exito: false, status: r.status, mensaje: r.status === 404 ? "El servidor no tiene el panel: falta subir la última versión." : `El servidor respondió con un error ${r.status}${r.status === 504 ? " (tardó demasiado)" : ""}.` };
  } catch {
    return { exito: false, mensaje: "No se pudo conectar. Mira tu conexión y vuelve a probar." };
  }
}

function Rosa() {
  // 24 cristales, como el rosetón de la catedral
  return (
    <svg className="pn-rosa" viewBox="-100 -100 200 200" aria-hidden="true" fill="none" stroke="#f3ead8" strokeWidth=".5">
      {[96, 70, 34].map((r) => <circle key={r} r={r} />)}
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 15})`}>
          <path d="M0-34 C10-50 10-62 0-70 C-10-62 -10-50 0-34Z" />
          <circle cy="-83" r="11" />
        </g>
      ))}
    </svg>
  );
}

const SECCIONES = [["/panel", "Inicio"], ["/panel/negocios", "Negocios"], ["/panel/oficina", "Oficina"], ["/panel/mas", "Más datos"]];

export function Navegacion({ negocios = 0 }) {
  const ruta = usePathname();
  return (
    <nav className="pn-nav" aria-label="Secciones del panel">
      {SECCIONES.map(([href, texto]) => (
        <Link key={href} href={href} aria-current={ruta === href ? "page" : undefined}>
          {texto}{href === "/panel/negocios" && negocios > 0 && <span className="pn-globo tabular-nums">{negocios}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Marco({ negocios, derecha, children }) {
  return (
    <>
      <Rosa />
      <div className="pn-marco">
        <header className="pn-cabecera">
          <h1 className="pn-marca">Cazurronics</h1>
          {derecha}
        </header>
        <Navegacion negocios={negocios} />
        <main>{children}</main>
      </div>
    </>
  );
}

// La clave se pide una vez por pestaña y sirve para todas las pantallas. alEntrar comprueba que vale.
export function useClave(alEntrar) {
  const [clave, setClave] = useState("");
  const [lista, setLista] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (c) => {
    setError(""); setCargando(true);
    const d = await alEntrar(c);
    setCargando(false);
    if (!d?.exito) { setError(d?.mensaje || "No se ha podido entrar."); setLista(false); return false; }
    try { sessionStorage.setItem("cz-panel", c); } catch {}
    setClave(c); setLista(true);
    return true;
  };

  useEffect(() => {
    let guardada = "";
    try { guardada = sessionStorage.getItem("cz-panel") || ""; } catch {}
    if (!guardada) return;
    const t = setTimeout(() => { setClave(guardada); entrar(guardada); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { clave, setClave, lista, error, cargando, entrar };
}

export function Entrada({ acceso }) {
  const { clave, setClave, error, cargando, entrar } = acceso;
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-4">
      <Rosa />
      <form onSubmit={(e) => { e.preventDefault(); entrar(clave); }} className="pn-bloque w-full max-w-sm relative z-10" style={{ padding: 24 }}>
        <p className="pn-marca">Cazurronics</p>
        <p className="pn-apunte" style={{ marginBottom: 18 }}>Introduce la clave del panel.</p>
        <label htmlFor="clave-panel" className="sr-only">Clave</label>
        <input id="clave-panel" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave" autoFocus autoComplete="current-password"
          className="w-full rounded-2xl px-4 h-12 mb-3 bg-black/30 border border-[var(--borde)] text-[16px] outline-none" />
        {error && <p className="text-sm mb-3" style={{ color: "var(--mal)" }} role="alert">{error}</p>}
        <button disabled={cargando} className="pn-boton w-full" style={{ minHeight: 48 }}>{cargando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
