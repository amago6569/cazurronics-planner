// ============ PRUEBAS DE PLANES: npm run evals ============
// Monta los casos de evals/casos.json en la web publicada (/api/panel/comparar: no guarda el plan ni suma visitas),
// comprueba cada regla de PLANES.md y saca la tabla caso × regla, el tiempo medio y el coste.
//   PANEL_CLAVE      clave del panel. Nunca se escribe en ningún archivo. En el entorno de Claude la añade la red
//                    (secreto de red para cazurronics.es, cabecera x-clave) y basta EVALS_CLAVE_EN_RED=1.
//   EVALS_URL        web a probar (de serie https://cazurronics.es)
//   EVALS_MAX_EUROS  para antes de pasar de este gasto (de serie 1 €)
// Opciones: --casos 5 (los 5 primeros) · --solo humedo-20,martes-23 · --modo ahorro|sinIA|google · --json salida.json
// Sale con 1 si algún caso falla alguna regla, con 2 si no se pudo probar (sin clave, sin red, clave mal).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { REGLAS, comprobar, costeEuros, resolverFecha } from "../evals/reglas.js";

const args = process.argv.slice(2);
const opcion = (nombre) => { const i = args.indexOf(`--${nombre}`); return i >= 0 ? args[i + 1] : undefined; };
const URL_BASE = (process.env.EVALS_URL || "https://cazurronics.es").replace(/\/$/, "");
const CLAVE = process.env.PANEL_CLAVE || process.env.EVALS_CLAVE || "";
const MAX_EUROS = Number(process.env.EVALS_MAX_EUROS ?? 1);
const MODO = opcion("modo") || "ahorro";

const { casos: todos } = JSON.parse(await readFile(new URL("../evals/casos.json", import.meta.url), "utf8"));
const solo = opcion("solo")?.split(",").map((s) => s.trim());
const casos = solo ? todos.filter((c) => solo.includes(c.id)) : todos.slice(0, Number(opcion("casos")) || todos.length);

// Sin PANEL_CLAVE se prueba igual: en el entorno de Claude la clave la pone la red (secreto de red de cazurronics.es)
if (!CLAVE && !process.env.EVALS_CLAVE_EN_RED) {
  console.error("Falta PANEL_CLAVE en el entorno: sin ella no se puede pedir planes a la web.");
  process.exit(2);
}

async function pedirPlan(peticion) {
  const inicio = Date.now();
  const res = await fetch(`${URL_BASE}/api/panel/comparar`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(CLAVE ? { "x-clave": CLAVE } : {}) },
    body: JSON.stringify({ ...peticion, modo: MODO }),
    signal: AbortSignal.timeout(70000),
  });
  if (res.status === 401 || res.status === 403 || res.status === 429) throw Object.assign(new Error(`La web no acepta la clave del panel (${res.status})`), { fatal: true });
  const respuesta = await res.json();
  return { respuesta, segundos: Number(respuesta?.segundos) || Math.round((Date.now() - inicio) / 100) / 10 };
}

const filas = [];
let gastado = 0;
for (const caso of casos) {
  if (gastado >= MAX_EUROS) {
    console.error(`Parado: ya van ${gastado.toFixed(2)} € y el tope es ${MAX_EUROS} € (EVALS_MAX_EUROS).`);
    break;
  }
  const peticion = { ...caso.peticion, fecha: resolverFecha(caso.peticion.fecha) };
  let respuesta, segundos;
  try {
    ({ respuesta, segundos } = await pedirPlan(peticion));
  } catch (e) {
    if (e.fatal) { console.error(e.message); process.exit(2); }
    respuesta = { exito: false, mensaje: `Error al pedir el plan: ${e.message}` };
    segundos = 70;
  }
  const coste = costeEuros(respuesta || {});
  gastado += coste.ia + coste.maps;
  const reglas = comprobar({ caso, peticion, respuesta, segundos });
  filas.push({ id: caso.id, nombre: caso.nombre, fecha: peticion.fecha, segundos, coste, sinIA: Boolean(respuesta?.sinIA), paradas: (respuesta?.plan || []).map((p) => `${p.hora} ${p.titulo} (${p.tipo})`), mensaje: respuesta?.exito ? respuesta?.aviso || "" : respuesta?.mensaje || "", reglas });
  const fallos = REGLAS.filter((r) => !reglas[r].ok);
  console.log(`${fallos.length ? "✗" : "✓"} ${caso.id} · ${segundos} s · ${(coste.ia + coste.maps).toFixed(3)} €${fallos.length ? ` · falla: ${fallos.map((r) => `${r} (${reglas[r].motivo})`).join("; ")}` : ""}`);
}

// ---------- Tabla caso × regla ----------
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : "-");
const cabecera = ["caso", ...REGLAS, "s", "€"];
const lineas = filas.map((f) => [f.id, ...REGLAS.map((r) => (f.reglas[r].ok ? "✓" : "✗")), String(f.segundos), (f.coste.ia + f.coste.maps).toFixed(3)]);
const porRegla = REGLAS.map((r) => pct(filas.filter((f) => f.reglas[r].ok).length, filas.length));
const enteros = filas.filter((f) => REGLAS.every((r) => f.reglas[r].ok)).length;
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const resumen = {
  fecha: new Date().toISOString(), web: URL_BASE, modo: MODO, casos: filas.length,
  casosQueCumplenTodo: pct(enteros, filas.length),
  reglas: Object.fromEntries(REGLAS.map((r, i) => [r, porRegla[i]])),
  segundosMedia: Math.round(media(filas.map((f) => f.segundos)) * 10) / 10,
  eurosIA: Math.round(filas.reduce((s, f) => s + f.coste.ia, 0) * 1000) / 1000,
  eurosMapsComoMucho: Math.round(filas.reduce((s, f) => s + f.coste.maps, 0) * 1000) / 1000,
  planesSinIA: filas.filter((f) => f.sinIA).length,
};
const ancho = cabecera.map((c, i) => Math.max(c.length, ...lineas.map((l) => l[i].length), i ? porRegla[i - 1]?.length || 0 : 0));
const fila = (cols) => `| ${cols.map((c, i) => c.padEnd(ancho[i])).join(" | ")} |`;
console.log(`\n${fila(cabecera)}\n| ${ancho.map((a) => "-".repeat(a)).join(" | ")} |`);
for (const l of lineas) console.log(fila(l));
console.log(fila(["% aprobados", ...porRegla, String(resumen.segundosMedia), (resumen.eurosIA + resumen.eurosMapsComoMucho).toFixed(3)]));
console.log(`\nCasos que cumplen todo: ${resumen.casosQueCumplenTodo} (${enteros} de ${filas.length}). Tiempo medio ${resumen.segundosMedia} s. IA ${resumen.eurosIA} € · Google Maps como mucho ${resumen.eurosMapsComoMucho} € (0 € dentro de la capa gratis). Sin IA: ${resumen.planesSinIA}.`);

const salida = opcion("json") || `evals/resultados/${resumen.fecha.slice(0, 16).replace(/[:T]/g, "-")}-${MODO}.json`;
await mkdir(new URL("../evals/resultados/", import.meta.url), { recursive: true });
await writeFile(salida, JSON.stringify({ resumen, filas }, null, 1));
console.log(`Detalle en ${salida}`);
process.exit(filas.length && enteros === filas.length ? 0 : 1);
