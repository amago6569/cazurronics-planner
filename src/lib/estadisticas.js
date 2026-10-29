// ============ ANALÍTICA PROPIA (idea 10) ============
// Contadores por día sin cookies ni librerías externas: visitas, planes, compartidos,
// gente que vuelve, clics en "Llamar"... y de qué campaña viene cada visita (utm_source).
import { comando, varios, aObjeto } from "./almacen";

export const METRICAS = [
  "visita", "vuelve", "plan", "retoque", "compartir", "abre_compartido",
  "voto", "valoracion", "detalle", "llamar", "web", "despensa",
];

const DIAS_GUARDADOS = 120 * 24 * 3600;
// Peticiones con búsqueda de Google gratis al día en los modelos Gemini 2.x
export const BUSQUEDAS_GRATIS_DIA = 1500;

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

// ============ GASTO DE LA IA POR TAREA ============
// Cada llamada a Gemini suma aquí sus tokens, búsquedas y coste aproximado, por mes y por tarea
// (barrido de eventos, planes, Despensa...). Así el panel enseña qué tarea se lleva la factura.
// Solo mide: no cambia nada de lo que hace la IA.
const MESES_GASTO = 400 * 24 * 3600;
const mesEnLeon = (desplazamientoMeses = 0) => {
  const [a, m] = hoyEnLeon().split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + desplazamientoMeses, 1));
  return d.toISOString().slice(0, 7);
};

export async function registrarGastoIA(tarea, uso) {
  const t = limpiarFuente(tarea) || "otra";
  const clave = `ia:${mesEnLeon()}`;
  // Búsqueda de un 2.x: gratis mientras el día no pase de 1.500 peticiones con búsqueda (cuota de Google)
  let extra = 0;
  if (uso?.peticionGratis) {
    const dia = `ia:gratis:${hoyEnLeon()}`;
    const [n] = await varios([["INCRBY", dia, 1], ["EXPIRE", dia, 3 * 24 * 3600]]);
    if (Number(n) > BUSQUEDAS_GRATIS_DIA) extra = Number(uso.precioPeticion) || 0;
  }
  await varios([
    ["HINCRBY", clave, `${t}:llamadas`, 1],
    ["HINCRBY", clave, `${t}:entrada`, Math.round(Number(uso?.entrada) || 0)],
    ["HINCRBY", clave, `${t}:salida`, Math.round(Number(uso?.salida) || 0)],
    ["HINCRBY", clave, `${t}:busquedas`, Math.round(Number(uso?.consultas) || 0)],
    ["HINCRBY", clave, `${t}:microdolares`, Math.round(((Number(uso?.dolares) || 0) + extra) * 1e6)],
    ["EXPIRE", clave, MESES_GASTO],
  ]);
}

// { mes, tareas: [{ tarea, llamadas, entrada, salida, busquedas, dolares }] } de este mes y el anterior, la más cara primero
export async function leerGastoIA() {
  const meses = [mesEnLeon(), mesEnLeon(-1)];
  const res = await varios(meses.map((m) => ["HGETALL", `ia:${m}`]));
  return meses.map((mes, i) => {
    const porTarea = {};
    for (const [campo, valor] of Object.entries(aObjeto(res[i]))) {
      const corte = campo.lastIndexOf(":");
      const tarea = campo.slice(0, corte), dato = campo.slice(corte + 1);
      (porTarea[tarea] ||= { tarea })[dato] = Number(valor) || 0;
    }
    const tareas = Object.values(porTarea).map(({ microdolares = 0, ...r }) => ({ llamadas: 0, entrada: 0, salida: 0, busquedas: 0, ...r, dolares: microdolares / 1e6 }))
      .sort((a, b) => b.dolares - a.dolares);
    return { mes, tareas };
  });
}
