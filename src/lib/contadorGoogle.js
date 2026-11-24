// ============ CUÁNTAS LLAMADAS DE PAGO HACE UN PLAN A GOOGLE MAPS ============
// Solo cuenta lo que NO sale de la caché (búsquedas 72 h, fichas 24 h, localidad 7 días): lo que Google puede cobrar.
// Lo usa /api/panel/comparar para que las pruebas de planes (npm run evals) sepan cuánto cuesta cada caso.
// Fuera de medirGoogle no hace nada: los planes de la web no cambian.
import { AsyncLocalStorage } from "node:async_hooks";

const almacen = new AsyncLocalStorage();

export async function medirGoogle(trabajo) {
  const cuenta = { busquedas: 0, fichas: 0, geocoding: 0 };
  const resultado = await almacen.run(cuenta, trabajo);
  return { resultado, google: cuenta };
}

export function contarGoogle(tipo) {
  const cuenta = almacen.getStore();
  if (cuenta && tipo in cuenta) cuenta[tipo]++;
}
