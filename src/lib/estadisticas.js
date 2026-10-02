// ============ ANALÍTICA PROPIA (idea 10) ============
// Contadores por día sin cookies ni librerías externas: visitas, planes, compartidos,
// gente que vuelve, clics en "Llamar"... y de qué campaña viene cada visita (utm_source).
import { comando, varios, aObjeto } from "./almacen";

export const METRICAS = [
  "visita", "vuelve", "plan", "retoque", "compartir", "abre_compartido",
  "voto", "valoracion", "detalle", "llamar", "web",
];

const DIAS_GUARDADOS = 120 * 24 * 3600;

// Fecha de hoy en León (no en UTC), formato AAAA-MM-DD
export function hoyEnLeon(desplazamientoDias = 0) {
  const d = new Date(Date.now() + desplazamientoDias * 864e5);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
}

export function limpiarFuente(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

export async function registrar(metrica, { fuente } = {}) {
  if (!METRICAS.includes(metrica)) return;
  const dia = hoyEnLeon();
  const c = [
    ["HINCRBY", `stats:${dia}`, metrica, 1],
    ["EXPIRE", `stats:${dia}`, DIAS_GUARDADOS],
    ["HINCRBY", "stats:total", metrica, 1],
  ];
  const f = limpiarFuente(fuente);
  if (metrica === "visita" && f) {
    c.push(["HINCRBY", `fuentes:${dia}`, f, 1], ["EXPIRE", `fuentes:${dia}`, DIAS_GUARDADOS], ["HINCRBY", "fuentes:total", f, 1]);
  }
  await varios(c);
}

const numeros = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0]));

export async function leerResumen(dias = 14) {
  const fechas = Array.from({ length: dias }, (_, i) => hoyEnLeon(-i));
  const res = await varios([
    ["HGETALL", "stats:total"],
    ["HGETALL", "fuentes:total"],
    ...fechas.map((f) => ["HGETALL", `stats:${f}`]),
  ]);
  return {
    total: numeros(aObjeto(res[0])),
    fuentes: numeros(aObjeto(res[1])),
    porDia: fechas.map((fecha, i) => ({ fecha, ...numeros(aObjeto(res[i + 2])) })),
  };
}

export async function totalPlanes() {
  const t = aObjeto(await comando(["HGETALL", "stats:total"]));
  return Number(t.plan) || 0;
}
