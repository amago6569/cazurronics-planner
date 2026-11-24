// ============ TOPE DE GASTO DE LA IA POR DÍA ============
// Regla de Alejandro (24-11-2026): la IA no pasa de 0,40 € al día. Lo que se gasta ya se apunta en ia:dia:<hoy>
// (registrarGastoIA, en microdólares). Aquí solo se lee ese contador antes de cada llamada a Gemini.
//  · Tareas de fondo (barrido, Verificador, Despensa por la noche): paran en GASTO_FONDO_MAX_DIA (0,25 € de serie).
//    El tramo que no se hace lo repite la Repesca otro día.
//  · Planes, retoques, buscador de la Despensa y el jefe: paran en GASTO_IA_MAX_DIA (0,40 € de serie).
//    Un plan que llega al tope sale igual, montado sin IA con los locales ya comprobados (lib/planSinIA.js).
// Si el almacén no responde no se puede contar: se para (sin contador no hay techo).
import { comando, recordar } from "./almacen";
import { EUROS_POR_DOLAR, hoyEnLeon } from "./estadisticas";

const numero = (v, porDefecto) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? n : porDefecto;
};
// El contador se queda corto: del 1 al 17-11-2026 marcó 8,29 € y Google facturó 12,61 € (x1,52). Hasta que el panel de gasto
// cuadre con AI Studio, el tope compara con el contador x1,5 (GASTO_IA_AJUSTE en Vercel para cambiarlo)
export const ajusteContador = () => numero(process.env.GASTO_IA_AJUSTE, 1.5) || 1;
export const topeDiaEuros = () => numero(process.env.GASTO_IA_MAX_DIA, 0.4);
export const topeFondoEuros = () => Math.min(topeDiaEuros(), numero(process.env.GASTO_FONDO_MAX_DIA, 0.25));

// Lo que va de hoy, en euros. Se recuerda 20 s por instancia: un barrido de 10 búsquedas no lee 10 veces
export function gastoDeHoyEuros() {
  const dia = hoyEnLeon();
  return recordar(`tope-gasto:${dia}`, 20000, async () => ((Number(await comando(["GET", `ia:dia:${dia}`])) || 0) / 1e6) * EUROS_POR_DOLAR * ajusteContador());
}

// Lo que corre solo, sin nadie esperando
const DE_FONDO = new Set(["barrido"]);

// true = puede llamar a la IA. «para» es el de llamarGemini (usuario, barrido, despensa, asesor)
export async function dentroDelGastoDelDia(para = "usuario") {
  const tope = DE_FONDO.has(para) ? topeFondoEuros() : topeDiaEuros();
  if (!(tope > 0)) return true; // 0 = sin tope
  try {
    return (await gastoDeHoyEuros()) < tope;
  } catch (e) {
    console.error("[tope-gasto]", e?.message || e);
    return false;
  }
}
