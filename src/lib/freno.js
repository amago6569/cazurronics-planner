// ============ FRENO ANTI-ABUSO ============
// Cada plan cuesta dinero de verdad (Gemini + Google Maps). Este límite por conexión no lo roza
// nadie que use la web con normalidad, pero impide que un script vacíe la cuota en un rato.
import { varios } from "./almacen";

// La IP de quien llama (en Vercel llega en x-real-ip / x-forwarded-for)
export function ipDe(request) {
  const h = request.headers;
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0]).trim() || "local";
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
