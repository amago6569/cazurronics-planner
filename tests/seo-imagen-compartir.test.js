// npm test — Toda página que define su propio openGraph lleva imagen al compartir.
// Next no mezcla openGraph entre el layout y la página: si la página pone el suyo sin «images»,
// en WhatsApp sale sin foto (24-11-2026: 11 de las 195 páginas del sitemap, la agenda por zonas y hoy/mañana).
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "src", "app");
const archivos = (dir) => readdirSync(dir).flatMap((n) => {
  const ruta = join(dir, n);
  return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(js|jsx)$/.test(n) ? [ruta] : [];
});

// El objeto openGraph de un archivo, con sus llaves anidadas
function bloquesOpenGraph(texto) {
  const bloques = [];
  for (const m of texto.matchAll(/openGraph:\s*\{/g)) {
    let nivel = 0, i = m.index + m[0].length - 1;
    for (; i < texto.length; i++) {
      if (texto[i] === "{") nivel++;
      else if (texto[i] === "}" && --nivel === 0) break;
    }
    bloques.push(texto.slice(m.index, i + 1));
  }
  return bloques;
}

describe("imagen al compartir", () => {
  const conOpenGraph = archivos(RAIZ).map((ruta) => ({ ruta, bloques: bloquesOpenGraph(readFileSync(ruta, "utf8")) })).filter((a) => a.bloques.length);

  it("encuentra las páginas con openGraph propio", () => {
    expect(conOpenGraph.length).toBeGreaterThanOrEqual(4);
  });

  it.each(conOpenGraph.map((a) => [relative(RAIZ, a.ruta), a]))("%s lleva imagen", (_n, { ruta, bloques }) => {
    // Vale con «images» en el objeto o con un opengraph-image.js en su carpeta (Next lo añade solo)
    const imagenDeArchivo = existsSync(join(dirname(ruta), "opengraph-image.js"));
    for (const b of bloques) expect(imagenDeArchivo || /\bimages\s*:/.test(b), b.slice(0, 120)).toBe(true);
  });
});
