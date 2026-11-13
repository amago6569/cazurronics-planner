// ============ LIGA CAZURRA: calendario ============
// Todo va en hora de Madrid. Regla de Alejandro (13-11-2026):
// - Cada «jornada» dura 24 horas y cambia a las 12:00 (de sábado 12:00 a domingo 11:59, y así).
//   Cada jornada salen 2 juegos con 3 intentos; cuenta el mejor intento de cada juego.
// - La semana va de sábado a las 12:00 al sábado siguiente a las 12:00 (7 jornadas). La primera: 14-11-2026.
// A cada jornada se le pone de nombre el día en que empieza: la de sábado 12:00 → domingo 11:59 es «2026-11-14».
// Ese es el «dia» que se guarda en Supabase con cada partida (no hace falta tocar la base de datos).

const ZONA = "Europe/Madrid";
const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
});

export const HORA_CAMBIO = 12; // a las 12:00 de Madrid cambian los juegos (y el sábado, la semana)
export const PRIMERA_SEMANA = "2026-11-14"; // sábado en que empieza la primera liga

// { dia: "2026-11-09", hora, minuto, semana: 1 (lunes) … 7 (domingo) } del reloj de Madrid
export function enMadrid(fecha = new Date()) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
  const semana = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute), semana };
}

// La jornada de liga en la que cae un momento: antes de las 12:00 aún es la del día anterior.
export function jornadaDe(fecha = new Date()) {
  const m = enMadrid(fecha);
  return m.hora < HORA_CAMBIO ? sumarDias(m.dia, -1) : m.dia;
}

export function esDia(texto) {
  return typeof texto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T12:00:00Z`))
    && new Date(`${texto}T12:00:00Z`).toISOString().slice(0, 10) === texto;
}

export function sumarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diaDeLaSemana(dia) { return ((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; } // 1 lunes … 7 domingo

// Primera y última jornada de la semana de liga (sábado … viernes). La semana cierra el sábado siguiente a las 12:00.
export function inicioSemana(dia) { return sumarDias(dia, -((diaDeLaSemana(dia) + 1) % 7)); } // el sábado de esa semana
export function finSemana(dia) { return sumarDias(inicioSemana(dia), 6); }
export function cierreSemana(dia) { return sumarDias(inicioSemana(dia), 7); } // el sábado en que se cierra a las 12:00

// Momento exacto (ISO) en que empieza una jornada: ese día a las 12:00 de Madrid
export function momentoJornada(dia) {
  for (const h of ["+01:00", "+02:00"]) { // invierno o verano
    const t = new Date(`${dia}T12:00:00${h}`);
    if (enMadrid(t).hora === HORA_CAMBIO && enMadrid(t).dia === dia) return t.toISOString();
  }
  return new Date(`${dia}T11:00:00Z`).toISOString();
}

// Ya no hay hueco entre semanas: al cerrar una a las 12:00 del sábado empieza la siguiente.
export function ligaAbierta() { return true; }

// Días desde el sábado de la primera liga: sirve para rotar los juegos sin guardar nada.
function numeroDeDia(dia) { return Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${PRIMERA_SEMANA}T12:00:00Z`)) / 86400000); }

// Los juegos de cada jornada: 2 (o 1 si solo hay uno), rotando por la lista para que cada uno salga lo mismo.
// Con 12 juegos, en las 6 primeras jornadas salen todos una vez y no se repite ninguno en jornadas seguidas.
export function juegosDelDia(dia, lista) {
  const n = lista.length;
  if (!n) return [];
  if (n === 1) return [lista[0]];
  const k = ((numeroDeDia(dia) % n) + n) % n;
  const a = lista[(2 * k) % n], b = lista[(2 * k + 1) % n];
  return a === b ? [a] : [a, b];
}
