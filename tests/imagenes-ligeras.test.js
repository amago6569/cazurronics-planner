// npm test — Las imágenes de las páginas de contenido pesan poco (24-11-2026).
// El rosetón decorativo (300 KB) y el fondo desenfocado (142 KB) retrasaban la carga de la agenda:
// el contenido principal salía a los 4,1 s en un móvil lento. Con versiones ligeras, a 1,3 s.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..");
const COMPONENTES = join(RAIZ, "src", "app", "components");
const MAX_KB = 80;

const usadas = readdirSync(COMPONENTES).filter((n) => /\.jsx?$/.test(n)).flatMap((n) => {
  const texto = readFileSync(join(COMPONENTES, n), "utf8");
  const rutas = [...texto.matchAll(/<img src="(\/[^"]+\.(?:png|jpe?g|webp))"/g), ...texto.matchAll(/url\('(\/[^']+\.(?:png|jpe?g|webp))'\)/g)].map((m) => m[1]);
  return rutas.map((r) => [n, r]);
});

describe("imágenes ligeras en los componentes", () => {
  it("encuentra las imágenes", () => expect(usadas.length).toBeGreaterThanOrEqual(3));
  it.each(usadas)(`%s usa %s (< ${MAX_KB} KB)`, (_c, ruta) => {
    const archivo = join(RAIZ, "public", ruta);
    expect(existsSync(archivo)).toBe(true);
    expect(Math.round(statSync(archivo).size / 1024)).toBeLessThan(MAX_KB);
  });
});
