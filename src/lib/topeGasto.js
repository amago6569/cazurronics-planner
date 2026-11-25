// ============ TOPE DE GASTO DE LA IA POR DÍA ============
// Regla de Alejandro (24-11-2026): la IA no pasa de 0,40 € al día. Lo que se gasta ya se apunta en ia:dia:<hoy>
// (registrarGastoIA, en microdólares). Aquí solo se lee ese contador antes de cada llamada a Gemini.
//  · Tareas de fondo (barrido, Verificador, Despensa por la noche): paran en GASTO_FONDO_MAX_DIA (0,25 € de serie).
//    El tramo que no se hace lo repite la Repesca otro día.
//    Miércoles y domingos toca barrer todos los pueblos (tramos m0-m22 de vercel.json): esos días el fondo llega a
//    GASTO_FONDO_MAX_DIA_PUEBLOS (0,60 €) y el total sube lo mismo, para que a los planes les quede lo de siempre.
//    Regla de Alejandro del 25-11-2026: ese miércoles el tope de 0,25 € paró el barrido de pueblos a las 9:20
//    (57 búsquedas, 8 de 23 grupos) y ~2,20 € más al mes le parecen bien para mirarlos todos.
//  · Planes, retoques, buscador de la Despensa y el jefe: paran en GASTO_IA_MAX_DIA (0,40 € de serie).
//    Un plan que llega al tope sale igual, montado sin IA con los locales ya comprobados (lib/planSinIA.js).
//  · Pruebas de planes (/api/panel/comparar): su propio tope, GASTO_PRUEBAS_MAX_DIA (1 € de serie), y no cuentan en los otros.
// Si el almacén no responde no se puede contar: se para (sin contador no hay techo).
import { comando, recordar } from "./almacen";
import { EUROS_POR_DOLAR, hoyEnLeon } from "./estadisticas";
import { claveGastoPruebas, esGastoDePruebas } from "./modoPruebas";

const numero = (v, porDefecto) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? n : porDefecto;
};
// El contador se queda corto: del 1 al 17-11-2026 marcó 8,29 € y Google facturó 12,61 € (x1,52). Hasta que el panel de gasto
// cuadre con AI Studio, el tope compara con el contador x1,5 (GASTO_IA_AJUSTE en Vercel para cambiarlo)
export const ajusteContador = () => numero(process.env.GASTO_IA_AJUSTE, 1.5) || 1;
// Cuando Alejandro apunta en /admin/gasto el saldo que marca AI Studio, el panel calcula cuánto se queda corto el contador
// y lo guarda en ia:factor. Solo vale entre 1 y 2 (por debajo de 1 cuenta como 1: el tope nunca se afloja por debajo de lo
// contado). Fuera de 0,5-3 es un dato mal metido y se ignora. GASTO_IA_AJUSTE en Vercel manda sobre todo.
export function factorDelCuadre(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0.5 || n > 3) return null;
  return Math.min(2, Math.max(1, n));
}
async function ajusteReal() {
  if (String(process.env.GASTO_IA_AJUSTE ?? "").trim() !== "") return ajusteContador();
  const cuadre = factorDelCuadre(await comando(["GET", "ia:factor"]).catch(() => null));
  return cuadre ?? ajusteContador();
}
// 0 = domingo, 3 = miércoles, en hora de León (el contador ia:dia también va por el día de León)
const DIAS_DE_PUEBLOS = new Set([0, 3]);
const SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const esDiaDePueblos = (ahora = new Date()) =>
  DIAS_DE_PUEBLOS.has(SEMANA[new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(ahora)]);
const topeFondoNormal = () => numero(process.env.GASTO_FONDO_MAX_DIA, 0.25);
// 0 en Vercel = sin tope: los días de pueblos tampoco se pone
const topeFondoPueblos = () => (topeFondoNormal() > 0 ? Math.max(topeFondoNormal(), numero(process.env.GASTO_FONDO_MAX_DIA_PUEBLOS, 0.6)) : 0);
export const topeDiaEuros = (ahora = new Date()) => {
  const base = numero(process.env.GASTO_IA_MAX_DIA, 0.4);
  return base > 0 && esDiaDePueblos(ahora) ? base + topeFondoPueblos() - topeFondoNormal() : base;
};
export const topeFondoEuros = (ahora = new Date()) => Math.min(topeDiaEuros(ahora), esDiaDePueblos(ahora) ? topeFondoPueblos() : topeFondoNormal());

// Lo que va de hoy, en euros. Se recuerda 20 s por instancia: un barrido de 10 búsquedas no lee 10 veces
export function gastoDeHoyEuros() {
  const dia = hoyEnLeon();
  return recordar(`tope-gasto:${dia}`, 20000, async () => ((Number(await comando(["GET", `ia:dia:${dia}`])) || 0) / 1e6) * EUROS_POR_DOLAR * (await ajusteReal()));
}
export const topePruebasEuros = () => numero(process.env.GASTO_PRUEBAS_MAX_DIA, 1);
// Lo de las pruebas se lee sin recordar: una pasada de 20 casos no debe colarse por los 20 s de memoria
async function gastoPruebasDeHoyEuros() {
  return ((Number(await comando(["GET", claveGastoPruebas(hoyEnLeon())])) || 0) / 1e6) * EUROS_POR_DOLAR * (await ajusteReal());
}

// Lo que corre solo, sin nadie esperando
const DE_FONDO = new Set(["barrido"]);

// true = puede llamar a la IA. «para» es el de llamarGemini (usuario, barrido, despensa, asesor)
export async function dentroDelGastoDelDia(para = "usuario") {
  const pruebas = esGastoDePruebas();
  const tope = pruebas ? topePruebasEuros() : DE_FONDO.has(para) ? topeFondoEuros() : topeDiaEuros();
  if (!(tope > 0)) return true; // 0 = sin tope
  try {
    return (await (pruebas ? gastoPruebasDeHoyEuros() : gastoDeHoyEuros())) < tope;
  } catch (e) {
    console.error("[tope-gasto]", e?.message || e);
    return false;
  }
}
