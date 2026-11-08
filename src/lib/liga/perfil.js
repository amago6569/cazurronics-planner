// ============ LIGA CAZURRA: correo, apodo y pueblo ============
// El apodo sale en el ranking público: corto, sin insultos y sin hacerse pasar por la web.

export function limpiarCorreo(texto) {
  const c = String(texto ?? "").trim().toLowerCase();
  if (c.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return null;
  return c;
}

export function limpiarCodigo(texto) {
  const c = String(texto ?? "").replace(/\s+/g, "");
  return /^\d{6,10}$/.test(c) ? c : null;
}

// «Pepé  Gómez» y «pepe gomez» son el mismo apodo
export function claveApodo(apodo) {
  return String(apodo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s");
}

// Lo que no puede aparecer DENTRO de un apodo (ya sin tildes y con 0→o, 1→i…): palabras largas que no salen sin querer.
const PROHIBIDO_DENTRO = [
  "mierda", "polla", "cabron", "gilipoll", "maricon", "hitler", "follar", "subnormal", "retrasad", "negrat", "sudaca", "chupamela",
  "comemela", "hijoput", "malparid", "violad", "violar", "corrida",
  // que nadie se haga pasar por la web
  "cazurronics", "admin", "moderador", "soporte",
];
// Las cortas solo se prohíben como palabra entera: si no, «puto» tumbaría «Cómputo», «cono» (coño) a «Conor» y «zorra» a «Zorrilla».
const PROHIBIDO_ENTERO = new Set([
  "puta", "puto", "putas", "putos", "cono", "pene", "moro", "eta", "franco", "facha", "zorra", "nazi", "nazis", "joder", "verga", "pajero",
  "mongol", "chocho", "marica", "follo", "oficial",
]);

export function apodoProhibido(apodo) {
  const clave = claveApodo(apodo);
  const palabras = String(apodo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .map(claveApodo);
  return PROHIBIDO_DENTRO.some((p) => clave.includes(p)) || palabras.some((w) => PROHIBIDO_ENTERO.has(w)) || PROHIBIDO_ENTERO.has(clave);
}

// Devuelve { apodo, clave } o { error }
export function comprobarApodo(texto) {
  const apodo = String(texto ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (apodo.length < 3) return { error: "El apodo tiene que tener al menos 3 letras." };
  if (apodo.length > 16) return { error: "El apodo puede tener como mucho 16 letras." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(apodo)) return { error: "Usa solo letras, números, espacios, puntos o guiones." };
  const clave = claveApodo(apodo);
  if (clave.length < 3) return { error: "El apodo tiene que tener al menos 3 letras o números." };
  if (apodoProhibido(apodo)) return { error: "Ese apodo no se puede usar. Prueba con otro." };
  return { apodo, clave };
}

export const FUERA = "Fuera de León";

// El pueblo ya no se pide (Alejandro, 8-11-2026). La columna de la base lo exige, así que va este relleno, que no se enseña.
export const SIN_PUEBLO = "sin indicar";

export function comprobarPueblo(texto) {
  const pueblo = String(texto ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (pueblo.length < 2) return { error: "Dinos tu pueblo o barrio (o «Fuera de León»)." };
  if (pueblo.length > 40) return { error: "El pueblo puede tener como mucho 40 letras." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'ºª()/-]*$/u.test(pueblo)) return { error: "Escribe el pueblo solo con letras." };
  if (apodoProhibido(pueblo)) return { error: "Ese pueblo no se puede usar." };
  return { pueblo };
}
