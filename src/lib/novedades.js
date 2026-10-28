// ============ NOVEDADES (/panel/oficina) ============
// Lo que entra nuevo en la web (eventos en la agenda, tiendas en la Despensa) se apunta aquí con quién lo
// encontró, para que Alejandro vea de un vistazo qué hay de nuevo. Solo guarda lo de los últimos 7 días.
// No llama a la IA: 0 €.
import { comando, varios } from "./almacen";

const CLAVE = "oficina:novedades", MAX = 600, DIAS = 7, POR_VEZ = 60;

// cosas = [{ tipo: "evento" | "tienda", titulo, fecha?, localidad?, lugar?, producto?, fuente?, quien }]
export async function apuntarNovedades(cosas) {
  const lista = (cosas || []).filter((c) => c?.titulo).slice(0, POR_VEZ);
  if (!lista.length) return 0;
  const cuando = new Date().toISOString();
  const json = lista.map((c) => JSON.stringify(Object.fromEntries(Object.entries({ ...c, cuando }).filter(([, v]) => v != null && v !== ""))));
  // LPUSH mete el último el primero: al revés, para que el lote quede en su orden
  await varios([["LPUSH", CLAVE, ...json.reverse()], ["LTRIM", CLAVE, 0, MAX - 1], ["EXPIRE", CLAVE, (DIAS + 1) * 86400]]);
  return lista.length;
}

export async function leerNovedades(ahora = Date.now()) {
  const desde = new Date(ahora - DIAS * 86400000).toISOString();
  return (await comando(["LRANGE", CLAVE, 0, MAX - 1]) || [])
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter((n) => n && n.cuando >= desde);
}
