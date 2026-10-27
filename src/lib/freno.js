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
export async function dentroDelLimite(request, nombre, max, segundos) {
  const clave = `freno:${nombre}:${ipDe(request)}`;
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
// max <= 0 lo desactiva. Si el almacén falla, nunca bloquea.
export async function dentroDelTopeDiario(nombre, max, request = null) {
  if (!(max > 0)) return true;
  const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // 2026-10-04
  const clave = `freno:dia:${nombre}:${request ? ipDe(request) : "todos"}:${dia}`;
  try {
    const [, cuenta] = await varios([["SET", clave, "0", "NX", "EX", 36 * 3600], ["INCRBY", clave, 1]]);
    return Number(cuenta) <= max;
  } catch (e) {
    console.error("[freno]", e?.message || e);
    return true;
  }
}
