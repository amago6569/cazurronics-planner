// Negocios que dan premio en la Liga Cazurra. Los apunta Alejandro desde el panel (Negocios) y Claude los lee
// para el vídeo y la web. Un hash de Redis: campo = id, valor = JSON. El logo va dentro, ya encogido en el móvil.
import { aObjeto, comando, nuevoId } from "./almacen";

export const CLAVE_PREMIOS = "liga:premios";
export const ESTADOS_PREMIO = ["si", "hablando", "no"];
export const MAX_PREMIOS = 60;
export const MAX_LOGO = 150_000; // caracteres del data URL (~110 KB de imagen)

const LARGOS = { nombre: 80, premio: 160, instagram: 40, pueblo: 60, notas: 500 };
const LOGO_OK = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

const texto = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const notas = (v) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, LARGOS.notas);

// Devuelve { premio } limpio o { error } en cristiano
export function limpiarPremio(entrada, ahora = Date.now()) {
  const e = entrada || {};
  const nombre = texto(e.nombre, LARGOS.nombre);
  const premio = texto(e.premio, LARGOS.premio);
  if (!nombre) return { error: "Falta el nombre del negocio." };
  if (!premio) return { error: "Falta el premio que da." };
  const logo = typeof e.logo === "string" ? e.logo : "";
  if (logo && (logo.length > MAX_LOGO || !LOGO_OK.test(logo))) return { error: "El logo no vale. Prueba con otra imagen (JPG o PNG)." };
  let instagram = texto(e.instagram, LARGOS.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  if (instagram && !instagram.startsWith("@")) instagram = `@${instagram}`;
  return {
    premio: {
      nombre, premio,
      estado: ESTADOS_PREMIO.includes(e.estado) ? e.estado : "si",
      instagram, pueblo: texto(e.pueblo, LARGOS.pueblo), notas: notas(e.notas), logo,
      creado: Number(e.creado) > 0 ? Number(e.creado) : ahora,
      actualizado: ahora,
    },
  };
}

export async function leerPremios() {
  const todos = aObjeto((await comando(["HGETALL", CLAVE_PREMIOS])) || []);
  return Object.entries(todos)
    .map(([id, v]) => { try { return { id, ...JSON.parse(v) }; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (a.creado || 0) - (b.creado || 0));
}

const idValido = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(id);

export async function guardarPremio(entrada, id) {
  const { premio, error } = limpiarPremio(entrada);
  if (error) return { error };
  let campo = id;
  if (campo) {
    if (!idValido(campo)) return { error: "Ese negocio ya no existe. Recarga la página." };
    const antes = await comando(["HGET", CLAVE_PREMIOS, campo]);
    if (!antes) return { error: "Ese negocio ya no existe. Recarga la página." };
    try { premio.creado = JSON.parse(antes).creado || premio.creado; } catch { /* se queda la fecha nueva */ }
  } else {
    if (Number(await comando(["HLEN", CLAVE_PREMIOS])) >= MAX_PREMIOS) return { error: `Ya hay ${MAX_PREMIOS} negocios. Quita alguno antes de añadir otro.` };
    campo = nuevoId(12);
  }
  await comando(["HSET", CLAVE_PREMIOS, campo, JSON.stringify(premio)]);
  return { id: campo, premio: { id: campo, ...premio } };
}

export async function quitarPremio(id) {
  if (!idValido(id)) return false;
  return Number(await comando(["HDEL", CLAVE_PREMIOS, id])) > 0;
}
