// ============ PLANES EN GRUPO (idea 2) ============
// Cualquiera con el enlace del plan puede votar cada parada (👍 / 👎).
// Guardamos un voto por persona y parada: "indice|votante" → 1, -1 o 0 (voto retirado).
import { comando, varios, aObjeto } from "./almacen";

export const idPlanValido = (id) => typeof id === "string" && /^[0-9a-zA-Z]{6,20}$/.test(id);
export const votanteValido = (v) => typeof v === "string" && /^[\w-]{8,40}$/.test(v);

const DURACION_VOTOS = 120 * 24 * 3600;

// El voto y su caducidad van en una sola petición al almacén
export async function votar(planId, indice, votante, voto) {
  const v = [1, -1, 0].includes(Number(voto)) ? Number(voto) : 0;
  await varios([
    ["HSET", `votos:${planId}`, `${Number(indice)}|${votante}`, v],
    ["EXPIRE", `votos:${planId}`, DURACION_VOTOS],
  ]);
}

// Votos en crudo (para leerlos a la vez que el plan)
export const leerVotos = (planId) => comando(["HGETALL", `votos:${planId}`]);

// De los votos en crudo al resumen que pinta la página: cuántos 👍/👎 tiene cada parada, los míos y cuánta gente ha votado
export function resumirVotos(crudoLista, numParadas, votante) {
  const crudo = aObjeto(crudoLista);
  const porParada = Array.from({ length: numParadas }, () => ({ arriba: 0, abajo: 0 }));
  const mios = Array.from({ length: numParadas }, () => 0);
  const personas = new Set();
  for (const [campo, valor] of Object.entries(crudo)) {
    const [i, quien] = campo.split("|");
    const n = Number(valor);
    const idx = Number(i);
    if (!porParada[idx] || !n) continue;
    personas.add(quien);
    if (n > 0) porParada[idx].arriba++; else porParada[idx].abajo++;
    if (quien === votante) mios[idx] = n;
  }
  return { porParada, mios, participantes: personas.size };
}

export async function resumenVotos(planId, numParadas, votante) {
  return resumirVotos(await leerVotos(planId), numParadas, votante);
}
