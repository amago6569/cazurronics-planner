// ============ LO QUE SE DICEN EN LA OFICINA (/panel/oficina) ============
// Cada turno real deja aquí frases cortas entre empleados, el jefe y tú: quién trae eventos nuevos, quién
// pregunta si algo ya lo tenemos, qué va a tu bandeja, quién ha fallado. Salen de plantillas con los datos
// del turno, sin IA: 0 €. La oficina en 3D las reproduce: el empleado va a la mesa del otro y lo dice en un bocadillo.
import { comando, varios } from "./almacen";

const CLAVE = "oficina:charla", MAX = 200, DIAS = 7;
export const JEFE = "jefe", TU = "tu";

// lineas = [{ de, a, texto, tipo? }] — tipo: "nuevos" | "repetido" | "duda" | "fallo" | "nada" | "orden" | "chat" | "aviso"
export async function apuntarCharla(lineas) {
  const lista = (lineas || []).filter((l) => l?.de && l?.texto).slice(0, 40);
  if (!lista.length) return 0;
  const base = Date.now();
  // Un segundo entre frase y frase: así se leen en orden aunque lleguen en el mismo lote
  const json = lista.map((l, i) => JSON.stringify({ de: l.de, a: l.a || JEFE, texto: String(l.texto).slice(0, 220), tipo: l.tipo || null, cuando: new Date(base + i * 1000).toISOString() }));
  await varios([["LPUSH", CLAVE, ...json], ["LTRIM", CLAVE, 0, MAX - 1], ["EXPIRE", CLAVE, DIAS * 86400]]);
  return lista.length;
}

// De la más antigua a la más reciente
export async function leerCharla(cuantas = MAX) {
  return ((await comando(["LRANGE", CLAVE, 0, cuantas - 1])) || [])
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean)
    .reverse();
}

const titulos = (lista, max = 2) => {
  const t = lista.slice(0, max).map((e) => `«${String(e.titulo || "").slice(0, 50)}»`).join(" y ");
  return lista.length > max ? `${t} y ${lista.length - max} más` : t;
};
// Siempre la misma frase para el mismo caso (sin azar: así los tests y la pantalla no bailan)
const una = (opciones, semilla) => opciones[[...String(semilla)].reduce((s, c) => s + c.charCodeAt(0), 0) % opciones.length];
const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;

// Lo que se dicen después de un turno de búsqueda.
// porEmpleado = { id: { busquedas, entran: [evento], repetidos: [evento], dudosos: [evento], error, encargo } }
export function charlaDeTurno(porEmpleado = {}) {
  const lineas = [];
  for (const [id, r] of Object.entries(porEmpleado)) {
    if (r.encargo) lineas.push({ de: JEFE, a: id, tipo: "orden", texto: `Alejandro te pide: «${String(r.encargo).slice(0, 80)}». Míralo en este turno.` });
    if (r.error) {
      lineas.push({ de: id, a: JEFE, tipo: "fallo", texto: `No he podido terminar: ${String(r.error).slice(0, 120)}` });
      lineas.push({ de: JEFE, a: id, tipo: "fallo", texto: una(["Tranquilo, se lo paso a la Repesca.", "Vale, la Repesca lo repite en unas horas."], id) });
      continue;
    }
    const entran = r.entran || [];
    const repetidos = r.repetidos || [];
    if (entran.length) {
      lineas.push({ de: id, a: JEFE, tipo: "nuevos", texto: `Traigo ${plural(entran.length, "evento nuevo", "eventos nuevos")}: ${titulos(entran)}.` });
      lineas.push({ de: JEFE, a: id, tipo: "nuevos", texto: una(["¡Bien! A la agenda.", "Perfecto, subidos a la web.", "Buen trabajo, ya salen en los planes."], id + entran.length) });
    }
    if (repetidos.length) {
      lineas.push({ de: id, a: JEFE, tipo: "repetido", texto: `¿Tenemos ya ${titulos(repetidos, 1)}?` });
      lineas.push({ de: JEFE, a: id, tipo: "repetido", texto: repetidos.length === 1 ? "Sí, ya estaba en la agenda. Busca lo que no tengamos." : `Sí, y ${plural(repetidos.length - 1, "otro", "otros")} más que traes también. Busca lo que no tengamos.` });
    }
    if (r.dudosos?.length) {
      lineas.push({ de: id, a: JEFE, tipo: "duda", texto: `${titulos(r.dudosos, 1)} no lo puedo comprobar en ninguna web.` });
      lineas.push({ de: JEFE, a: "verificador", tipo: "duda", texto: `Verificador, mira ${r.dudosos.length === 1 ? "ese" : `esos ${r.dudosos.length}`} antes de subirlo${r.dudosos.length === 1 ? "" : "s"}.` });
    }
    if (!entran.length && !repetidos.length && !r.dudosos?.length && r.busquedas) {
      lineas.push({ de: JEFE, a: id, tipo: "nada", texto: "¿Cómo vas?" });
      lineas.push({ de: id, a: JEFE, tipo: "nada", texto: `Nada nuevo en ${plural(r.busquedas, "búsqueda", "búsquedas")}. Esta semana está tranquila.` });
    }
  }
  return lineas;
}
