// Prueba supabase/liga.sql en un Postgres de verdad. Solo corre si hay uno a mano:
//   LIGA_PG="-h /tmp -p 5499 -U postgres" npm test
// (crea y borra una base «liga_pruebas»). Sin LIGA_PG se salta.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const PG = process.env.LIGA_PG;

describe.skipIf(!PG)("supabase/liga.sql en Postgres", () => {
  it("se instala dos veces seguidas y pasa sus pruebas", () => {
    const args = PG.split(/\s+/).filter(Boolean);
    const psql = (...x) => execFileSync("psql", [...args, "-v", "ON_ERROR_STOP=1", "-q", ...x], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    psql("-d", "postgres", "-c", "drop database if exists liga_pruebas", "-c", "create database liga_pruebas");
    try {
      psql("-d", "liga_pruebas", "-f", "tests/liga/sql/supabase-minimo.sql");
      psql("-d", "liga_pruebas", "-f", "supabase/liga.sql");
      psql("-d", "liga_pruebas", "-f", "supabase/liga.sql");
      const salida = execFileSync("psql", [...args, "-v", "ON_ERROR_STOP=1", "-q", "-d", "liga_pruebas", "-f", "tests/liga/sql/pruebas.sql"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      expect(salida).toBeDefined();
    } finally {
      psql("-d", "postgres", "-c", "drop database if exists liga_pruebas");
    }
  });
});
