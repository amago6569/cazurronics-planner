// ============ LOS TURNOS DE LA OFICINA ============
// Cuándo trabaja cada empleado, sacado de los crons de vercel.json (en hora UTC), y dónde está ahora:
// en su mesa durante su turno, en la cafetería si ya lo ha hecho, dormido en el sofá si se lo ha saltado
// y también en la cafetería si ha fallado (con su fallo apuntado: lo repasa lo primero al empezar su próximo turno). Funciones puras: sirven en el servidor y en el navegador.

// Un tramo del barrido cabe en un minuto, pero así se le ve en su mesa: 5 min antes y 15 después de la hora
export const ANTES = 5 * 60000, DESPUES = 15 * 60000;

// "15 2 * * 0,3" → { hora: 2, min: 15, dias: [0, 3] } (dias = null si es todos los días; 0 = domingo, en UTC)
export function leerCron(s) {
  const [min, hora, , , dias] = String(s).trim().split(/\s+/);
  return { hora: Number(hora), min: Number(min), dias: dias === "*" || dias == null ? null : dias.split(",").map(Number) };
}

// Rutas que no son de un empleado de la lista (el resto las declara cada empleado en lib/oficina.js → rutas)
const RUTAS_FIJAS = [["/api/telegram/diario", "jefe"], ["/api/barrido?jefe=1", "jefe"], ["/api/barrido?jefe=2", "jefe"]];
// Una ruta de cron casa con la de un empleado si el camino es el mismo y lleva sus mismos parámetros
function casa(u, patron) {
  const p = new URL(patron, "http://x");
  return p.pathname === u.pathname && [...p.searchParams].every(([k, v]) => u.searchParams.get(k) === v);
}

// Qué empleados trabajan en cada ruta de cron. deTramo = { t0: ["musica", "escena", "junta"], ... }
// rutas = [["/api/despensa/barrido", "despensa-productos"], ...] (RUTAS_EMPLEADOS de lib/oficina.js)
export function quienesDeRuta(ruta, deTramo = {}, rutas = []) {
  const u = new URL(ruta, "http://x");
  if (u.pathname === "/api/barrido" && u.searchParams.has("tramo")) return deTramo[u.searchParams.get("tramo")] || [];
  return [...new Set([...RUTAS_FIJAS, ...rutas].filter(([p]) => casa(u, p)).map(([, id]) => id))];
}

// crons = vercel.json → crons. Devuelve { empleado: [{ hora, min, dias, tramo }] } ordenado por hora
export function turnosDeCrons(crons = [], deTramo = {}, rutas = []) {
  const t = {};
  for (const c of crons) {
    const cron = leerCron(c.schedule);
    const tramo = new URL(c.path, "http://x").searchParams.get("tramo");
    for (const id of quienesDeRuta(c.path, deTramo, rutas)) (t[id] ||= []).push({ ...cron, ...(tramo ? { tramo } : {}) });
  }
  for (const l of Object.values(t)) l.sort((a, b) => a.hora * 60 + a.min - (b.hora * 60 + b.min));
  return t;
}

// Las horas de inicio (ms) de sus turnos entre desde y hasta
function inicios(turnos = [], desde, hasta) {
  const r = [];
  const dia0 = Date.UTC(new Date(desde).getUTCFullYear(), new Date(desde).getUTCMonth(), new Date(desde).getUTCDate());
  for (let d = dia0; d <= hasta; d += 864e5) {
    const dow = new Date(d).getUTCDay();
    for (const t of turnos) {
      if (t.dias && !t.dias.includes(dow)) continue;
      const ms = d + t.hora * 3600000 + t.min * 60000;
      if (ms >= desde && ms <= hasta) r.push(ms);
    }
  }
  return r.sort((a, b) => a - b);
}

export const enTurno = (turnos, ahora) => inicios(turnos, ahora - DESPUES, ahora + ANTES).length > 0;
export const proximoTurno = (turnos, ahora) => inicios(turnos, ahora + 1, ahora + 8 * 864e5)[0] ?? null;
// Cuántos turnos le tocan en un día cualquiera (los de pueblos solo domingos y miércoles)
export const turnosAlDia = (turnos = []) => turnos.filter((t) => !t.dias).length;

// "mesa" | "pendiente" (ha fallado: espera su turno en la cafetería con el fallo apuntado) | "sofa" (se ha saltado el turno) | "cafe"
// enCurso: está trabajando ahora mismo de verdad (la tarea lo apunta al empezar) · descanso: la reunión le dio días libres
export function dondeEsta(e, ahora) {
  if (e.enCurso) return "mesa";
  if (e.descanso) return "cafe";
  if (enTurno(e.turnos, ahora)) return "mesa";
  if (e.estado === "error") return "pendiente";
  if (e.estado === "tarde") return "sofa";
  return "cafe";
}
