// ============ FRENO ANTI-ABUSO ============
// Cada plan cuesta dinero de verdad (Gemini + Google Maps). Este límite por conexión no lo roza
// nadie que use la web con normalidad, pero impide que un script vacíe la cuota en un rato.
import { comando, varios } from "./almacen";

// La IP de quien llama (en Vercel llega en x-real-ip / x-forwarded-for)
export function ipDe(request) {
  const h = request.headers;
  // Si no llega x-real-ip, el ÚLTIMO valor de x-forwarded-for es el que añade el proxy; el primero lo puede inventar el cliente
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",").pop()).trim() || "local";
}

// true = puede seguir · false = se ha pasado de "max" peticiones en "segundos".
// Si el almacén falla, nunca bloquea: es mejor un plan de más que dejar a alguien sin el suyo.
// «quien»: cuenta por persona (id de su cuenta) en vez de por conexión. Sirve donde hay sesión: en una wifi o con
// datos móviles muchos comparten la misma IP y se frenarían entre ellos.
export async function dentroDelLimite(request, nombre, max, segundos, quien = null) {
  const clave = `freno:${nombre}:${quien ? `u:${quien}` : ipDe(request)}`;
  try {
    const [, cuenta] = await varios([["SET", clave, "0", "NX", "EX", segundos], ["INCRBY", clave, 1]]);
    return Number(cuenta) <= max;
  } catch (e) {
    console.error("[freno]", e?.message || e);
    return true;
  }
}

// Freno a quien prueba claves del equipo a ciegas: tras 10 fallos en 15 minutos, esa conexión tiene que esperar.
// Solo cuentan los fallos, así que el equipo usa el panel sin límite. Devuelve "ok", "mal" o "bloqueado".
export async function claveConFreno(request, valida) {
  const clave = `freno:clave:${ipDe(request)}`;
  try {
    if (Number(await comando(["GET", clave])) >= 10) return "bloqueado";
    if (!valida) await varios([["SET", clave, "0", "NX", "EX", 900], ["INCRBY", clave, 1]]);
  } catch (e) {
    console.error("[freno]", e?.message || e);
  }
  return valida ? "ok" : "mal";
}

// Respuesta común cuando la clave no vale (401) o se ha pasado de intentos (429)
export function respuestaClave(acceso) {
  const bloqueado = acceso === "bloqueado";
  return Response.json({ exito: false, mensaje: bloqueado ? "Demasiados intentos. Espera 15 minutos." : "Clave incorrecta" }, { status: bloqueado ? 429 : 401 });
}

// Tope por DÍA (hora de Madrid). Sin "request" cuenta a todo el mundo junto (techo de gasto si algo dispara las
// peticiones desde muchas conexiones); con "request" cuenta solo a esa conexión.
// max <= 0 lo desactiva. Si el almacén falla no se puede contar, y "siFalla" decide: por defecto deja pasar,
// pero los techos de gasto pasan false, porque sin contador no hay techo y la factura quedaría sin freno.
// La clave del contador de hoy (para devolver un intento que no dio plan con devolverCupo)
export function claveTopeDiario(nombre, request = null) {
  const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // 2026-10-04
  return `freno:dia:${nombre}:${request ? ipDe(request) : "todos"}:${dia}`;
}

export async function dentroDelTopeDiario(nombre, max, request = null, siFalla = true) {
  if (!(max > 0)) return true;
  const clave = claveTopeDiario(nombre, request);
  try {
    const [, cuenta] = await varios([["SET", clave, "0", "NX", "EX", 36 * 3600], ["INCRBY", clave, 1]]);
    return Number(cuenta) <= max;
  } catch (e) {
    console.error("[freno]", e?.message || e);
    return siFalla;
  }
}

// ---------- Planes por hora y persona ----------
// Regla de Alejandro (17-11-2026): cada persona, como mucho 3 planes por hora. Cuenta por conexión (IP).
// Devuelve { ok, minutos, clave }: minutos = cuánto falta para que se libere el cupo (cuando ok es false).
// Si el almacén falla, deja pasar: los techos diarios de gasto siguen frenando.
export async function cupoPorHora(request, nombre, max, segundos = 3600) {
  const clave = `freno:hora:${nombre}:${ipDe(request)}`;
  try {
    const [, cuenta, ttl] = await varios([["SET", clave, "0", "NX", "EX", segundos], ["INCRBY", clave, 1], ["TTL", clave]]);
    if (Number(cuenta) <= max) return { ok: true, minutos: 0, clave };
    // El intento rechazado no se queda contado: así nadie se alarga la espera por darle otra vez al botón
    await comando(["DECR", clave]).catch(() => null);
    return { ok: false, minutos: Math.max(1, Math.ceil(Math.max(0, Number(ttl) || segundos) / 60)), clave };
  } catch (e) {
    console.error("[freno]", e?.message || e);
    return { ok: true, minutos: 0, clave: null };
  }
}

// Devuelve un intento que no ha dado plan (la IA falló, no había nada...): un fallo nuestro no gasta cupo
export async function devolverCupo(...claves) {
  for (const clave of claves.filter(Boolean)) {
    try { await comando(["DECR", clave]); } catch (e) { console.error("[freno]", e?.message || e); }
  }
}

// Mensaje para la persona cuando ya ha hecho sus planes de esta hora
export function mensajeCupoHora(max, minutos) {
  const espera = minutos >= 60 ? "una hora" : minutos === 1 ? "1 minuto" : `${minutos} minutos`;
  return `Ya has montado ${max} planes en la última hora 🦁 Para que la web siga siendo gratis para todos, el siguiente podrás pedirlo en ${espera}. Mientras, puedes cambiar paradas del plan que ya tienes.`;
}
