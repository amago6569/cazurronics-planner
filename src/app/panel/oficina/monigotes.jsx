"use client";
// Los monigotes de la oficina (/panel/oficina) y sus utilidades: el sentado en su mesa y el que va andando.
export const fmt = (n) => new Intl.NumberFormat("es-ES").format(n || 0);
export const PIELES = ["#f6d2b8", "#e9b894", "#c98e66", "#f3c9a5", "#8d5a3b", "#fbe0c8"];
export const PELOS = ["#2b1d14", "#6b3f1d", "#c8902e", "#1f2937", "#9a3412", "#57534e", "#b45309"];
export const CAMISAS = { agenda: ["#f43f5e", "#fb7185", "#e11d48"], territorio: ["#0ea5e9", "#38bdf8", "#0284c7"], despensa: ["#f59e0b", "#fbbf24", "#d97706"], negocio: ["#8b5cf6", "#a78bfa", "#7c3aed"] };
export const ESTADOS = {
  ok: { texto: "Al día", punto: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  tarde: { texto: "Con retraso", punto: "bg-amber-500", pill: "bg-amber-50 text-amber-800 ring-amber-200" },
  error: { texto: "Con fallos", punto: "bg-rose-500", pill: "bg-rose-50 text-rose-700 ring-rose-200" },
  nuevo: { texto: "Aún no ha trabajado", punto: "bg-slate-300", pill: "bg-white/70 text-slate-500 ring-slate-200" },
};

export function hace(fecha) {
  if (!fecha) return "todavía no";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(fecha)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
export const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

// El monigote en su mesa. estado: ok (teclea) · tarde (duerme) · error (humo) · nuevo (silla vacía, a medias)
export function Monigote({ estado = "ok", semilla = 0, camisa = "#f43f5e", emoji = "💻", jefe = false, className = "" }) {
  const piel = PIELES[semilla % PIELES.length];
  const pelo = PELOS[(semilla * 3 + 1) % PELOS.length];
  const duerme = estado === "tarde";
  const teclea = estado === "ok";
  return (
    <svg viewBox="0 0 120 92" className={className} role="img" aria-label={ESTADOS[estado]?.texto}>
      <ellipse cx="60" cy="86" rx="46" ry="5" fill="rgba(15,23,42,0.08)" />
      {/* silla */}
      <rect x="34" y="20" width="52" height="46" rx="14" fill="rgba(15,23,42,0.10)" />
      {/* persona */}
      <g opacity={estado === "nuevo" ? 0.35 : 1}>
        <g className={duerme ? "" : "cz-respira"}>
          <rect x="40" y="44" width="40" height="23" rx="11" fill={camisa} />
          {jefe && <path d="M60 46 l-3.5 5 3.5 12 3.5-12z" fill="#0f172a" />}
          {jefe && <path d="M54 44 l6 5 6-5" fill="#fff" />}
          <g transform={duerme ? "rotate(14 60 34)" : undefined}>
            <circle cx="60" cy="31" r="13" fill={piel} />
            <path d={semilla % 2 ? "M47 29 q1-14 13-14 q12 0 13 14 q-6-7-13-7 q-7 0-13 7z" : "M47 30 q0-15 13-15 q13 0 13 15 q-3-4-6-5 q-7 3-20 5z"} fill={pelo} />
            {duerme ? (
              <><path d="M53.5 33 q2 1.6 4 0" stroke="#334155" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M62.5 33 q2 1.6 4 0" stroke="#334155" strokeWidth="1.4" fill="none" strokeLinecap="round" /></>
            ) : (
              <><circle cx="55.5" cy="32" r="1.5" fill="#1e293b" /><circle cx="64.5" cy="32" r="1.5" fill="#1e293b" /></>
            )}
            {estado === "error"
              ? <path d="M56 38.5 q4-2.4 8 0" stroke="#9f1239" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              : <path d="M56.5 37.5 q3.5 2.6 7 0" stroke="#9a3412" strokeWidth="1.4" fill="none" strokeLinecap="round" />}
            <circle cx="52" cy="36" r="2" fill="#fb7185" opacity=".25" />
            <circle cx="68" cy="36" r="2" fill="#fb7185" opacity=".25" />
          </g>
        </g>
        {/* manos sobre el teclado */}
        <rect x="37" y="58" width="12" height="7" rx="3.5" fill={piel} className={teclea ? "cz-teclea" : ""} />
        <rect x="71" y="58" width="12" height="7" rx="3.5" fill={piel} className={teclea ? "cz-teclea-2" : ""} />
      </g>
      {/* mesa */}
      <rect x="10" y="63" width="100" height="7" rx="3.5" fill="#fff" stroke="rgba(15,23,42,0.08)" />
      <rect x="18" y="70" width="5" height="14" rx="2" fill="rgba(15,23,42,0.14)" />
      <rect x="97" y="70" width="5" height="14" rx="2" fill="rgba(15,23,42,0.14)" />
      {/* portátil visto por detrás, con la pegatina del puesto */}
      <path d="M44 63 L48 45 H72 L76 63 Z" fill={estado === "error" ? "#fecdd3" : "#e2e8f0"} stroke="rgba(15,23,42,0.12)" />
      {teclea && <path d="M48 45 H72" stroke="#7dd3fc" strokeWidth="1.6" className="cz-brillo" />}
      <text x="60" y="58.5" textAnchor="middle" fontSize="10">{emoji}</text>
      {jefe && <><rect x="86" y="54" width="9" height="9" rx="2" fill="#fff" stroke="rgba(15,23,42,0.15)" /><path d="M95 56.5 q3 0 3 2.5 q0 2.5-3 2.5" stroke="rgba(15,23,42,0.25)" fill="none" /></>}
      {/* lo que le pasa */}
      {duerme && <><text x="78" y="28" fontSize="9" className="cz-zzz" fill="#64748b">z</text><text x="85" y="21" fontSize="11" className="cz-zzz" style={{ animationDelay: ".8s" }} fill="#64748b">z</text></>}
      {estado === "error" && <><circle cx="76" cy="44" r="4" fill="#94a3b8" className="cz-humo" /><circle cx="81" cy="40" r="4.5" fill="#fda4af" className="cz-humo" style={{ animationDelay: ".6s" }} /><text x="76" y="24" fontSize="10">❗</text></>}
    </svg>
  );
}

// Un monigote de pie que va andando (con un papel para el jefe o con su café)
export function Andarin({ semilla = 0, camisa = "#0ea5e9", lleva = "📄", className = "" }) {
  const piel = PIELES[semilla % PIELES.length];
  const pelo = PELOS[(semilla * 3 + 1) % PELOS.length];
  return (
    <svg viewBox="0 0 40 84" className={className} aria-hidden>
      <ellipse cx="20" cy="81" rx="13" ry="3" fill="rgba(15,23,42,0.12)" />
      <rect x="13" y="56" width="6" height="23" rx="3" fill="#334155" className="cz-paso" />
      <rect x="21" y="56" width="6" height="23" rx="3" fill="#475569" className="cz-paso-2" />
      <g className="cz-bote">
        <rect x="9" y="32" width="22" height="28" rx="9" fill={camisa} />
        <circle cx="20" cy="20" r="11" fill={piel} />
        <path d="M9 19 q0-12 11-12 q11 0 11 12 q-5-6-11-6 q-6 0-11 6z" fill={pelo} />
        <circle cx="16.5" cy="21" r="1.3" fill="#1e293b" /><circle cx="23.5" cy="21" r="1.3" fill="#1e293b" />
        <path d="M17 25.5 q3 2.2 6 0" stroke="#9a3412" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <rect x="28" y="38" width="6" height="14" rx="3" fill={piel} />
        <text x="31" y="54" textAnchor="middle" fontSize="10">{lleva}</text>
      </g>
    </svg>
  );
}
