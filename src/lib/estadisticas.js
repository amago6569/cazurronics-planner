// ============ ANALÍTICA PROPIA (idea 10) ============
// Contadores por día sin cookies ni librerías externas: visitas, planes, compartidos,
// gente que vuelve, clics en "Llamar"... y de qué campaña viene cada visita (utm_source).
import { comando, varios, aObjeto } from "./almacen";
import { claveGastoPruebas } from "./modoPruebas";

export const METRICAS = [
  "visita", "vuelve", "plan", "retoque", "compartir", "abre_compartido",
  "voto", "valoracion", "detalle", "llamar", "web", "despensa", "plan_vacio", "plan_ampliado", "ia_filtrada",
  "visita_planner", "visita_despensa", "como_llegar", "web_tienda",
  "plan_sin_ia", "plan_cache",
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

// Para el panel de gasto: cada tarea cae en una de tres funciones
export function funcionDeTarea(tarea) {
  const t = String(tarea || "");
  if (/^pruebas/.test(t)) return "pruebas";
  if (/^(barrido|verificador|repesca|eventos)/.test(t)) return "barrido";
  if (/^(planes|retoques)/.test(t)) return "planes";
  return "otros";
}
// Las últimas llamadas a la IA, una por línea (las 1.000 más recientes), y el detalle de cada día por función y modelo
export const CLAVE_LLAMADAS_IA = "ia:llamadas";
export const claveDetalleIA = (dia) => `ia:detalle:${dia}`;
export const claveErroresIA = (dia) => `ia:errores:${dia}`;

// Un error de Google al llamar a la IA (402 sin saldo, 429 saturado, 5xx caído…), por día, para el panel de gasto
export async function registrarErrorIA(estado) {
  const dia = hoyEnLeon();
  await varios([["HINCRBY", claveErroresIA(dia), String(Number(estado) || "otro"), 1], ["EXPIRE", claveErroresIA(dia), 8 * 24 * 3600]]);
}

// prueba: la llamada viene de /api/panel/comparar (lib/modoPruebas.js). Va a su propio contador del día, no al de la web
export async function registrarGastoIA(tarea, uso, { prueba = false } = {}) {
  const t = `${prueba ? "pruebas-" : ""}${limpiarFuente(tarea) || "otra"}`;
  const diaGasto = prueba ? claveGastoPruebas(hoyEnLeon()) : `ia:dia:${hoyEnLeon()}`;
  const clave = `ia:${mesEnLeon()}`;
  // Búsqueda de un 2.x: gratis mientras el día no pase de 1.500 peticiones con búsqueda (cuota de Google)
  let extra = 0;
  if (uso?.peticionGratis) {
    const dia = `ia:gratis:${hoyEnLeon()}`;
    const [n] = await varios([["INCRBY", dia, 1], ["EXPIRE", dia, 3 * 24 * 3600]]);
    if (Number(n) > BUSQUEDAS_GRATIS_DIA) extra = Number(uso.precioPeticion) || 0;
  }
  const micro = Math.round(((Number(uso?.dolares) || 0) + extra) * 1e6);
  await varios([
    ["HINCRBY", clave, `${t}:llamadas`, 1],
    ["HINCRBY", clave, `${t}:entrada`, Math.round(Number(uso?.entrada) || 0)],
    ["HINCRBY", clave, `${t}:salida`, Math.round(Number(uso?.salida) || 0)],
    ["HINCRBY", clave, `${t}:busquedas`, Math.round(Number(uso?.consultas) || 0)],
    ["HINCRBY", clave, `${t}:microdolares`, Math.round(((Number(uso?.dolares) || 0) + extra) * 1e6)],
    ["EXPIRE", clave, MESES_GASTO],
    // El total del día, para el tope, la tarjeta de gasto de la oficina y el aviso de 1 € al día (las pruebas, aparte)
    ["INCRBY", diaGasto, micro],
    ["EXPIRE", diaGasto, 40 * 24 * 3600],
    // Panel de gasto: la llamada suelta y el día por función y modelo
    ["LPUSH", CLAVE_LLAMADAS_IA, JSON.stringify({ t: Date.now(), f: funcionDeTarea(t), k: t, m: String(uso?.modelo || "?").slice(0, 40), e: Math.round(Number(uso?.entrada) || 0), s: Math.round(Number(uso?.salida) || 0), h: Math.round(Number(uso?.herramienta) || 0), b: Math.round(Number(uso?.consultas) || 0), u: micro })],
    ["LTRIM", CLAVE_LLAMADAS_IA, 0, 999],
    ["HINCRBY", claveDetalleIA(hoyEnLeon()), `${funcionDeTarea(t)}|${String(uso?.modelo || "?").slice(0, 40)}`, micro],
    ["HINCRBY", claveDetalleIA(hoyEnLeon()), `${funcionDeTarea(t)}|${String(uso?.modelo || "?").slice(0, 40)}|n`, 1],
    ["EXPIRE", claveDetalleIA(hoyEnLeon()), 40 * 24 * 3600],
  ]);
}

// Google factura en dólares; para la oficina lo pasamos a euros con un cambio aproximado
export const EUROS_POR_DOLAR = 0.9;

// Lo que lleva gastado la IA en euros: hoy, ayer y el mes (con su previsión, estirando lo que va de mes a todos sus días).
// dolaresMes viene de leerGastoIA (el total por tareas del mes)
export async function leerGastoDias(dolaresMes = 0) {
  const hoy = hoyEnLeon();
  const [a, m, d] = hoy.split("-").map(Number);
  const diasMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const [deHoy, deAyer] = await varios([["GET", `ia:dia:${hoy}`], ["GET", `ia:dia:${hoyEnLeon(-1)}`]]);
  const redondo = (n) => Math.round(n * 100) / 100;
  const mes = redondo((Number(dolaresMes) || 0) * EUROS_POR_DOLAR);
  return {
    hoy: redondo(((Number(deHoy) || 0) / 1e6) * EUROS_POR_DOLAR), ayer: redondo(((Number(deAyer) || 0) / 1e6) * EUROS_POR_DOLAR),
    mes, prevision: redondo((mes / d) * diasMes),
  };
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
