// ============ CANDADO AL PARAR (hook Stop de .claude/settings.json) ============
// Antes de que Claude dé el trabajo por acabado:
//  1. npm run check (lint y pruebas). Gratis: siempre.
//  2. npm run evals con 5 casos, solo si el trabajo toca los planes (src/lib, src/app/api, evals, PLANES.md), hay clave
//     (PANEL_CLAVE, o EVALS_CON_PROXY=1 si la pone la red) y no se pasaron en las últimas 12 h.
//     Las pruebas de planes gastan (IA ≈ 0,04 € y Google Maps casi siempre en caché), por eso 5 casos y 2 veces al día como mucho.
// Si algo falla sale con 2 y cuenta el fallo por stderr: Claude lo ve y sigue trabajando.
// Si ya está dentro de un hook Stop (stop_hook_active), sale con 0 para no entrar en bucle.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

if (process.env.CLAUDE_PROJECT_DIR) process.chdir(process.env.CLAUDE_PROJECT_DIR);
const entrada = (() => { try { return JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { return {}; } })();
if (entrada.stop_hook_active) process.exit(0);

const MARCA = ".claude/.evals-ultima";
const HORAS_ENTRE_EVALS = 12;
const fallos = [];

function correr(script, args = []) {
  try {
    execFileSync("npm", ["run", "--silent", script, ...(args.length ? ["--", ...args] : [])], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 8 * 60 * 1000, shell: process.platform === "win32" });
    return null;
  } catch (e) {
    const salida = `${e.stdout || ""}\n${e.stderr || ""}`.split("\n").filter((l) => /✗|×|FAIL|[1-9]\d* errors?|\d+:\d+\s+error\s|AssertionError|falla|Falta|Parado/.test(l) && !/stderr \||^\s*\[/.test(l));
    return { codigo: e.status, lineas: salida.slice(0, 25) };
  }
}

const check = correr("check");
if (check) fallos.push("npm run check falla:", ...check.lineas);

// Solo en trabajos que tocan los planes: las pruebas gastan y cuentan dentro del tope de IA del día de la web
function tocaLosPlanes() {
  try {
    const opciones = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    const rutas = `${execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], opciones)}\n${execFileSync("git", ["status", "--porcelain"], opciones)}`;
    return /(^|\s)(src\/lib\/|src\/app\/api\/|evals\/|PLANES\.md)/m.test(rutas);
  } catch {
    return false;
  }
}

const ultima = (() => { try { return Number(readFileSync(MARCA, "utf8")) || 0; } catch { return 0; } })();
const conClave = process.env.PANEL_CLAVE || process.env.EVALS_CON_PROXY;
if (conClave && Date.now() - ultima > HORAS_ENTRE_EVALS * 3600 * 1000 && tocaLosPlanes()) {
  const evals = correr("evals", ["--casos", "5"]);
  if (!evals || evals.codigo === 1) {
    try { mkdirSync(".claude", { recursive: true }); writeFileSync(MARCA, String(Date.now())); } catch { /* sin marca: la próxima vez se repite */ }
  }
  if (evals?.codigo === 1) fallos.push("npm run evals (5 casos) no cumple PLANES.md:", ...evals.lineas);
}

if (fallos.length) {
  process.stderr.write(`${fallos.join("\n")}\n`);
  process.exit(2);
}
process.exit(0);
