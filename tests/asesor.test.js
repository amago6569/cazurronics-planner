// npm test — Bot de Telegram: cifras que ve el asesor y seguridad del aviso
import { afterEach, describe, expect, it } from "vitest";
import { resumirInstagram, resumirWeb } from "../src/lib/asesor";
import { leerMetricas } from "../src/lib/instagram";
import { chatDelDueno, secretoValido, trocear } from "../src/lib/telegram";

const dia = (fecha, cifras = {}) => ({ fecha, ...cifras });

describe("resumirWeb", () => {
  it("compara los últimos 7 días con los 7 anteriores", () => {
    const porDia = [
      ...Array.from({ length: 7 }, (_, i) => dia(`2026-10-${28 - i}`, { plan: 10, visita: 40 })),
      ...Array.from({ length: 7 }, (_, i) => dia(`2026-10-${21 - i}`, { plan: 5, visita: 40 })),
    ];
    const r = resumirWeb({ porDia });
    expect(r.esta.plan).toBe(70);
    expect(r.anterior.plan).toBe(35);
    expect(r.texto).toMatch(/planes: 70 \(semana anterior 35, \+100 %\)/);
    expect(r.texto).toMatch(/visitas: 280 \(semana anterior 280, \+0 %\)/);
  });

  it("no se rompe sin datos", () => {
    expect(resumirWeb(null).texto).toMatch(/sin datos/);
  });
});

describe("resumirInstagram", () => {
  it("avisa si aún no hay fotos guardadas", () => {
    expect(resumirInstagram([])).toMatch(/todavía no hay datos/);
  });

  it("calcula los seguidores ganados en 7 días y lista publicaciones", () => {
    const fotos = [
      { fecha: "2026-10-28", usuario: "cazurronics", seguidores: 940, ayer: { alcance: 300 }, publicaciones: [{ fecha: "2026-10-27", tipo: "reel", alcance: 1200, texto: "Planes gratis" }] },
      { fecha: "2026-10-21", usuario: "cazurronics", seguidores: 920, ayer: { alcance: 50 }, publicaciones: [] },
    ];
    const t = resumirInstagram(fotos);
    expect(t).toMatch(/seguidores: 940 \(hace 7 días 920, \+20\)/);
    expect(t).toMatch(/2026-10-27 reel: alcance 1200/);
    expect(t).toMatch(/2026-10-27: 300/);
  });
});

describe("leerMetricas", () => {
  it("lee tanto total_value como values", () => {
    expect(leerMetricas([
      { name: "reach", total_value: { value: 12 } },
      { name: "views", values: [{ value: 3 }, { value: 7 }] },
      { name: "rara", values: [] },
    ])).toEqual({ reach: 12, views: 7 });
  });
});

describe("telegram", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it("solo acepta el secreto exacto", () => {
    process.env.TELEGRAM_SECRETO = "abc123";
    expect(secretoValido("abc123")).toBe(true);
    expect(secretoValido("abc124")).toBe(false);
    expect(secretoValido("")).toBe(false);
    delete process.env.TELEGRAM_SECRETO;
    expect(secretoValido("")).toBe(false);
  });

  it("solo contesta al chat del dueño", () => {
    process.env.TELEGRAM_CHAT_ID = "12345";
    expect(chatDelDueno(12345)).toBe(true);
    expect(chatDelDueno(999)).toBe(false);
    delete process.env.TELEGRAM_CHAT_ID;
    expect(chatDelDueno(12345)).toBe(false);
  });

  it("parte los mensajes largos por saltos de línea", () => {
    const texto = Array.from({ length: 50 }, (_, i) => `línea ${i} ${"x".repeat(100)}`).join("\n");
    const trozos = trocear(texto, 1000);
    expect(trozos.length).toBeGreaterThan(4);
    expect(trozos.every((t) => t.length <= 1000)).toBe(true);
    expect(trozos.join("\n")).toBe(texto);
  });
});

describe("emparejar el bot", () => {
  it("solo empareja con el código vigente y una sola vez", async () => {
    const { abrirEmparejamiento, emparejar, leerDueno } = await import("../src/lib/telegram");
    const codigo = await abrirEmparejamiento();
    expect(await emparejar(111, "otro-codigo")).toBe(false);
    expect(await emparejar(111, undefined)).toBe(false);
    expect(await leerDueno()).toBeNull();
    expect(await emparejar(222, codigo)).toBe(true);
    expect(await leerDueno()).toBe("222");
    expect(await emparejar(333, codigo)).toBe(false);
    expect(await leerDueno()).toBe("222");
  });
});
