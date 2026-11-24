// ============ GASTO DE LAS PRUEBAS DE PLANES ============
// Lo que monta /api/panel/comparar (npm run evals y /panel/comparar) va con su propio presupuesto: hasta 1 € al día
// (GASTO_PRUEBAS_MAX_DIA), el que dio Alejandro para pruebas. No cuenta en los 0,40 € de la web: así medir no deja a la
// gente ni al barrido sin IA. Se apunta aparte (ia:pruebas:dia) y el panel de gasto lo suma al saldo, porque se paga igual.
import { AsyncLocalStorage } from "node:async_hooks";

const contexto = new AsyncLocalStorage();

export const conPresupuestoDePruebas = (trabajo) => contexto.run(true, trabajo);
export const esGastoDePruebas = () => contexto.getStore() === true;
export const claveGastoPruebas = (dia) => `ia:pruebas:dia:${dia}`;
