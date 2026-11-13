// ============ LIGA CAZURRA: ganadores de cada semana ============
// Al cerrar la semana (sábado 12:00), los 5 primeros del ranking se llevan los packs de premios.js.
// No se guarda nada: la lista sale siempre del ranking final de Supabase y los códigos de una firma secreta.
import { cierreSemana, finSemana, momentoJornada } from "./calendario";
import { PREMIOS, codigoPremio, premiosDeSemana } from "./premios";

// Margen tras el cierre: una partida empezada a las 11:59 aún puede terminar (máximo 15 minutos)
export const MARGEN_CIERRE_MS = 20 * 60 * 1000;

export function semanaCerrada(inicio, ahora = Date.now()) {
  return ahora >= Date.parse(momentoJornada(cierreSemana(inicio))) + MARGEN_CIERRE_MS;
}

// [{ puesto, apodo, jugador, puntos, codigo, premio }] (solo si esa semana tiene premios y ya ha cerrado)
export async function ganadoresDe(s, inicio, { ahora = Date.now(), forzar = false } = {}) {
  const packs = premiosDeSemana(inicio);
  if (!packs?.length) return [];
  if (!forzar && !semanaCerrada(inicio, ahora)) return [];
  const filas = await s.ranking(inicio, finSemana(inicio), packs.length, null);
  const lista = [];
  for (const f of filas) {
    const puesto = Number(f.posicion);
    const premio = packs.find((p) => p.puesto === puesto);
    if (!premio) continue;
    lista.push({ puesto, apodo: f.apodo, jugador: f.jugador, puntos: Number(f.puntos), codigo: await codigoPremio(inicio, puesto, f.jugador), premio });
  }
  return lista;
}

// ¿Es bueno este código? Repite el ranking final de las semanas con premios ya cerradas.
export async function comprobarCodigo(s, codigo, ahora = Date.now(), semanas = null) {
  for (const inicio of semanas || Object.keys(PREMIOS)) {
    if (!semanaCerrada(inicio, ahora)) continue;
    const g = (await ganadoresDe(s, inicio, { ahora })).find((x) => x.codigo === codigo);
    if (g) return { inicio, ...g };
  }
  return null;
}
