// ============ LIGA CAZURRA: calendario ============
// Todo va en hora de Madrid: el día cambia a medianoche de aquí, no de Londres ni de donde esté el servidor.
// La semana va de lunes a domingo y cierra el domingo a las 22:00 (lo que se juegue después ya no puntúa).

const ZONA = "Europe/Madrid";
const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
});

export const HORA_CIERRE = 22; // domingo a las 22:00

// { dia: "2026-11-09", hora, minuto, semana: 1 (lunes) … 7 (domingo) }
export function enMadrid(fecha = new Date()) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
  const semana = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute), semana };
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

export function lunesDe(dia) { return sumarDias(dia, 1 - diaDeLaSemana(dia)); }
export function domingoDe(dia) { return sumarDias(lunesDe(dia), 6); }

// Se puede puntuar salvo el domingo de 22:00 a 24:00 (la semana ya está cerrada y el lunes empieza otra).
export function ligaAbierta(fecha = new Date()) {
  const m = enMadrid(fecha);
  return !(m.semana === 7 && m.hora >= HORA_CIERRE);
}

// Días desde un lunes fijo: sirve para rotar los juegos sin guardar nada.
function numeroDeDia(dia) { return Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse("2026-11-02T12:00:00Z")) / 86400000); }

// Los juegos de cada día: 2 (o 1 si solo hay uno), rotando por la lista para que cada uno salga lo mismo.
// Con 7 juegos, cada uno sale 2 veces por semana y nunca dos días seguidos el mismo par.
export function juegosDelDia(dia, lista) {
  const n = lista.length;
  if (!n) return [];
  if (n === 1) return [lista[0]];
  const k = ((numeroDeDia(dia) % n) + n) % n;
  const a = lista[(2 * k) % n], b = lista[(2 * k + 1) % n];
  return a === b ? [a] : [a, b];
}
