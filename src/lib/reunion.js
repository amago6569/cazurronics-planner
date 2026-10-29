// ============ LA REUNIÓN DEL EQUIPO (/panel/oficina) ============
// Cada día, con los datos reales de la oficina, cada empleado propone algo y tú dices sí o no:
//  · quien lleva una semana sin traer nada propone descansar 7 días (ahorra búsquedas);
//  · quien está de descanso propone volver;
//  · el que más trae pide un encargo para buscar más a fondo;
//  · la Repesca y el Verificador proponen ponerse ya con lo que tienen en cola;
//  · Captación recuerda los locales listos para escribirles.
// Sin IA: plantillas con las cifras de verdad (0 €). Lo que dices que no, no vuelve a salir en 7 días.
import { comando, varios, aObjeto } from "./almacen";

const NO = "oficina:reunion:no";
const PRIORIDAD = { guardia: 0, ir: 1, descanso: 2, volver: 3, ficha: 4, info: 5 };
const dia = (ms) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const coma = (n) => String(n).replace(".", ",");

// Devuelve { abre, propuestas: [{ id, quien, texto, propuesta, boton, accion }] }
// accion: { tipo: "descanso" | "volver", empleado, dias? } · { tipo: "guardia", que } · { tipo: "ficha", empleado } · { tipo: "ir", destino } · null
export function montarReunion({ departamentos = [], flujo = {}, sinConfirmar = 0, repesca = 0, captacion = 0, descartadas = [], ahora = Date.now() } = {}) {
  const hoy = dia(ahora);
  const todos = departamentos.flatMap((d) => d.empleados);
  const p = [];
  for (const e of todos) {
    const r = e.rinde;
    if (e.descanso) {
      p.push({ id: `volver:${e.id}`, quien: e.id, texto: `Estoy de descanso hasta el ${e.descanso}.`, propuesta: "Si me necesitas antes, vuelvo mañana a mi turno.", boton: "🔙 Que vuelva", accion: { tipo: "volver", empleado: e.id } });
    } else if (e.ordenes && r?.dias >= 7 && r.busquedas >= 10 && r.nuevos === 0) {
      const ahorro = Math.round((r.busquedas / r.dias) * 7);
      p.push({ id: `descanso:${e.id}`, quien: e.id, texto: `En ${r.dias} días he hecho ${r.busquedas} búsquedas y no he traído nada nuevo.`, propuesta: `Me tomo 7 días de descanso: ahorramos unas ${ahorro} búsquedas.`, boton: "🏖️ Que descanse", accion: { tipo: "descanso", empleado: e.id, dias: 7 } });
    }
  }
  const estrella = todos.filter((e) => e.ordenes && !e.descanso && e.rinde?.nuevos >= 10).sort((a, b) => b.rinde.nuevos - a.rinde.nuevos)[0];
  if (estrella) {
    const r = estrella.rinde;
    p.push({ id: `estrella:${estrella.id}`, quien: estrella.id, texto: `Llevo ${r.nuevos} eventos nuevos en ${r.dias} días${r.porBusqueda != null ? ` (${coma(r.porBusqueda)} por búsqueda)` : ""}.`, propuesta: "Dame un encargo concreto y lo busco a fondo en mi próximo turno (0 €).", boton: "📝 Darle un encargo", accion: { tipo: "ficha", empleado: estrella.id } });
  }
  if (repesca > 0) p.push({ id: `repesca:${hoy}`, quien: "repesca", texto: `Tengo ${repesca} ${repesca === 1 ? "búsqueda que falló" : "búsquedas que fallaron"} en cola.`, propuesta: "Las repito ahora (gratis, dentro del cupo de Google).", boton: "🚑 Repítelas ya", accion: { tipo: "guardia", que: "repesca" } });
  if (flujo.bandeja > 0) p.push({ id: `verificar:${hoy}`, quien: "verificador", texto: `Tengo ${flujo.bandeja} ${flujo.bandeja === 1 ? "evento" : "eventos"} sin fuente segura por mirar.`, propuesta: "Los compruebo ya y subo los buenos.", boton: "🕵️ Compruébalos ya", accion: { tipo: "guardia", que: "verificador" } });
  if (sinConfirmar > 0) p.push({ id: `sinconfirmar:${hoy}`, quien: "verificador", texto: `He subido ${sinConfirmar} ${sinConfirmar === 1 ? "evento" : "eventos"} sin poder confirmarlos.`, propuesta: "Los sigo mirando yo en cada turno: los confirmo o los quito. Si alguno no te cuadra, díselo al jefe.", boton: null, accion: null });
  if (captacion > 0) p.push({ id: `captacion:${hoy}`, quien: "captacion", texto: `Hay ${captacion} ${captacion === 1 ? "local listo" : "locales listos"} para escribirles.`, propuesta: "Mándales el mensaje hoy: ya está escrito con sus cifras.", boton: "✉️ Ir a escribirles", accion: { tipo: "ir", destino: "hoy" } });
  if (flujo.buscan > 0 && flujo.entran === 0) p.push({ id: `nada:${hoy}`, quien: "jefe", texto: `Anoche no entró nada nuevo en ${flujo.buscan} búsquedas.`, propuesta: "Es normal si la semana está tranquila. Si se repite, la reunión propondrá descansos.", boton: null, accion: null });

  const fuera = new Set(descartadas);
  const propuestas = p.filter((x) => !fuera.has(x.id))
    .sort((a, b) => (PRIORIDAD[a.accion?.tipo || "info"] - PRIORIDAD[b.accion?.tipo || "info"]))
    .slice(0, 8);
  const abre = propuestas.length
    ? `Reunión de hoy: ${propuestas.length} ${propuestas.length === 1 ? "propuesta" : "propuestas"}. Tú decides.`
    : "Reunión de hoy: nada que proponer, todo en orden.";
  return { abre, propuestas };
}

export async function descartarPropuesta(id) {
  await varios([["HSET", NO, String(id).slice(0, 80), new Date().toISOString()], ["EXPIRE", NO, 7 * 24 * 3600]]);
}
export async function leerDescartadas() {
  return Object.keys(aObjeto(await comando(["HGETALL", NO])) || {});
}
