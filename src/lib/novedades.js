// ============ NOVEDADES (/panel/oficina) ============
// Lo que entra nuevo en la web (eventos en la agenda, tiendas en la Despensa) se apunta aquí con quién lo
// encontró, para que Alejandro vea de un vistazo qué hay de nuevo. Solo guarda lo de los últimos 7 días.
// No llama a la IA: 0 €.
import { aObjeto, comando, varios } from "./almacen";

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

// ============ CUÁNTO RINDE CADA EMPLEADO ============
// Por día: búsquedas que hace y eventos que de verdad entran nuevos en la agenda. Con 14 días de datos se ve
// quién busca mucho para nada y se le puede bajar el ritmo sin perder eventos. 0 €.
const RINDE = "oficina:rinde", DIAS_RINDE = 30;
const diaDe = (ms) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// cuentas = { empleado: { busquedas, nuevos } }
export async function apuntarRendimiento(cuentas, ahora = Date.now()) {
  const clave = `${RINDE}:${diaDe(ahora)}`;
  const cmds = [];
  for (const [quien, c] of Object.entries(cuentas || {})) {
    for (const dato of ["busquedas", "nuevos", "fallos"]) if (c?.[dato]) cmds.push(["HINCRBY", clave, `${quien}:${dato}`, c[dato]]);
  }
  if (!cmds.length) return;
  await varios([...cmds, ["EXPIRE", clave, DIAS_RINDE * 86400]]);
}

// { empleado: { busquedas, nuevos, porBusqueda, dias } } de los últimos `dias` días (hoy incluido)
export async function leerRendimiento(dias = 14, ahora = Date.now()) {
  const fechas = Array.from({ length: dias }, (_, i) => diaDe(ahora - i * 86400000));
  const res = await varios(fechas.map((f) => ["HGETALL", `${RINDE}:${f}`]));
  const total = {};
  res.forEach((r) => {
    const obj = Array.isArray(r) ? aObjeto(r) : r || {};
    const vistos = new Set();
    for (const [campo, valor] of Object.entries(obj)) {
      const corte = campo.lastIndexOf(":");
      const quien = campo.slice(0, corte), dato = campo.slice(corte + 1);
      const t = (total[quien] ||= { busquedas: 0, nuevos: 0, dias: 0 });
      t[dato] = (t[dato] || 0) + (Number(valor) || 0);
      if (!vistos.has(quien)) { vistos.add(quien); t.dias++; }
    }
  });
  for (const t of Object.values(total)) t.porBusqueda = t.busquedas ? Math.round((t.nuevos / t.busquedas) * 100) / 100 : null;
  return total;
}

// Empleados que han fallado alguna búsqueda hoy Y ayer. Un fallo suelto lo arregla la Repesca y no merece aviso
export async function fallanSeguido(ahora = Date.now()) {
  const [hoy, ayer] = await varios([diaDe(ahora), diaDe(ahora - 86400000)].map((f) => ["HGETALL", `${RINDE}:${f}`]));
  const conFallos = (r) => new Set(Object.entries(Array.isArray(r) ? aObjeto(r) : r || {})
    .filter(([campo, v]) => campo.endsWith(":fallos") && Number(v) > 0).map(([campo]) => campo.slice(0, -":fallos".length)));
  const deAyer = conFallos(ayer);
  return [...conFallos(hoy)].filter((q) => deAyer.has(q));
}
