// npm test — El edificio de la oficina 3D: salas, rutas, dónde está cada uno y «Anoche en 1 minuto»
import { describe, expect, it } from "vitest";
import { DEPARTAMENTOS, RUTAS_EMPLEADOS } from "../src/lib/oficina";
import { dondeEsta, enTurno, leerCron, proximoTurno, quienesDeRuta, turnosDeCrons } from "../src/lib/turnos";
import { CAFE_SITIOS, SALAS, colocar, entrega, largo, planta, puntoEn, ruta } from "../src/app/panel/oficina/guion";
import { contadores, horaReal, montarRepeticion, poseEn } from "../src/app/panel/oficina/repeticion";
import vercel from "../vercel.json";

const sitios = planta(DEPARTAMENTOS);
const mesas = Object.values(sitios);
const dentro = ([x, z], s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;
const salaDe = (p) => Object.entries(SALAS).find(([, s]) => dentro(p, s))?.[0] || (Math.abs(p[1]) <= 1.2 ? "pasillo" : null);

describe("edificio", () => {
  it("cada empleado tiene mesa dentro de su sala y no se pisan", () => {
    const ids = DEPARTAMENTOS.flatMap((d) => d.empleados.map((e) => e.id));
    expect(ids.every((id) => sitios[id])).toBe(true);
    for (const m of mesas) expect(dentro(m.mesa, SALAS[m.sala]), m.id).toBe(true);
    for (const a of mesas) for (const b of mesas) if (a !== b) expect(Math.hypot(a.mesa[0] - b.mesa[0], a.mesa[1] - b.mesa[1])).toBeGreaterThan(1.5);
    expect(sitios.musica.sala).toBe("busqueda");
    expect(sitios.teatros.sala).toBe("busqueda");
    expect(sitios["despensa-tiendas"].sala).toBe("despensa");
    expect(sitios.captacion.sala).toBe("negocio");
  });

  it("la cafetería tiene sitio para todos y cada sitio está dentro", () => {
    expect(CAFE_SITIOS.length).toBeGreaterThanOrEqual(DEPARTAMENTOS.flatMap((d) => d.empleados).length);
    for (const s of CAFE_SITIOS) expect(dentro(s.pos, SALAS.cafe), s.id).toBe(true);
  });

  it("las rutas salen por la puerta, van por el pasillo y nunca atraviesan una pared", () => {
    const lugares = [...mesas, ...CAFE_SITIOS, entrega(0), entrega(2)];
    for (const a of lugares) for (const b of [sitios.musica, sitios.junta, CAFE_SITIOS[0], CAFE_SITIOS.at(-1), entrega(1)]) {
      if (a === b) continue;
      const r = ruta(a, b);
      expect(r[0]).toEqual(a.pos);
      expect(r.at(-1)).toEqual(b.pos);
      // Cada tramo recto se queda en una sala o cruza una puerta (de la sala al pasillo)
      for (let i = 1; i < r.length; i++) {
        for (let t = 0.02; t < 1; t += 0.05) {
          const p = [r[i - 1][0] + (r[i][0] - r[i - 1][0]) * t, r[i - 1][1] + (r[i][1] - r[i - 1][1]) * t];
          const sala = salaDe(p);
          expect(sala, `${a.id} → ${b.id}, tramo ${i}`).not.toBeNull();
          // Cruzar la línea de una pared solo se puede por su puerta
          if (Math.abs(p[1]) > 1.15 && Math.abs(p[1]) < 1.25) {
            expect(Object.values(SALAS).some((s) => Math.abs(s.puerta[0] - p[0]) < 0.7)).toBe(true);
          }
        }
      }
    }
  });

  it("puntoEn recorre la ruta de principio a fin", () => {
    const r = ruta(sitios.musica, CAFE_SITIOS[3]);
    expect(puntoEn(r, 0)).toMatchObject({ x: r[0][0], z: r[0][1] });
    const fin = puntoEn(r, largo(r) + 5);
    expect(fin.x).toBeCloseTo(r.at(-1)[0]); expect(fin.z).toBeCloseTo(r.at(-1)[1]);
  });
});

describe("turnos", () => {
  const deTramo = { t0: ["musica", "escena", "junta"], m3: ["pueblos"] };
  const turnos = turnosDeCrons(vercel.crons, deTramo, RUTAS_EMPLEADOS);

  it("lee los crons de vercel.json y sabe quién trabaja en cada uno", () => {
    expect(leerCron("30 3 * * 0,3")).toEqual({ hora: 3, min: 30, dias: [0, 3] });
    expect(quienesDeRuta("/api/barrido?jefe=1")).toEqual(["jefe"]);
    expect(quienesDeRuta("/api/despensa/tiendas?pasada=2", {}, RUTAS_EMPLEADOS)).toEqual(["despensa-tiendas"]);
    expect(quienesDeRuta("/api/barrido?guardia=verificador", {}, RUTAS_EMPLEADOS)).toEqual(["verificador"]);
    expect(turnos.verificador).toHaveLength(3);
    expect(turnos.repesca).toHaveLength(2);
    expect(turnos.musica).toEqual([{ hora: 2, min: 15, dias: null, tramo: "t0" }]);
    expect(turnos["despensa-productos"]).toHaveLength(3);
    expect(turnos.pueblos[0].dias).toEqual([0, 3]);
  });

  it("está en su mesa durante su turno y si no, donde le toca por su estado", () => {
    const e = { turnos: turnos.musica, estado: "ok" };
    const turno = Date.UTC(2026, 9, 29, 2, 15);
    expect(enTurno(e.turnos, turno + 60000)).toBe(true);
    expect(dondeEsta(e, turno + 60000)).toBe("mesa");
    expect(dondeEsta(e, turno + 3 * 3600000)).toBe("cafe");
    expect(dondeEsta({ ...e, estado: "error" }, turno + 3 * 3600000)).toBe("pendiente");
    expect(dondeEsta({ ...e, estado: "tarde" }, turno + 3 * 3600000)).toBe("sofa");
    expect(proximoTurno(e.turnos, turno + 3600000)).toBe(turno + 864e5);
    // Pueblos solo domingos y miércoles (29-10-2026 es jueves)
    expect(enTurno(turnos.pueblos, Date.UTC(2026, 9, 29, 3, 31))).toBe(false);
    expect(enTurno(turnos.pueblos, Date.UTC(2026, 9, 28, 3, 31))).toBe(true);
  });

  it("colocar reparte cafetería, sofá y mesas sin repetir sitio, y quien ha fallado va a la cafetería", () => {
    const donde = Object.fromEntries(DEPARTAMENTOS.flatMap((d) => d.empleados).map((e, i) => [e.id, i % 7 === 0 ? "sofa" : i % 5 === 0 ? "pendiente" : i === 3 ? "mesa" : "cafe"]));
    const r = colocar(donde, sitios);
    const usados = Object.values(r).map((x) => x.sitio.id);
    expect(new Set(usados).size).toBe(usados.length);
    expect(r[Object.keys(donde)[0]].modo).toBe("duerme");
    expect(r[Object.keys(donde)[3]]).toMatchObject({ modo: "teclea", sitio: sitios[Object.keys(donde)[3]] });
    // Nadie espera en la puerta del jefe: el que falló está sentado en la cafetería con su fallo apuntado
    expect(Object.values(r).some((x) => x.modo === "espera")).toBe(false);
    expect(r[Object.keys(donde)[5]]).toMatchObject({ modo: "sentado", pendiente: true });
    expect(r[Object.keys(donde)[5]].sitio.sala).toBe("cafe");
  });
});

describe("Anoche en 1 minuto", () => {
  const ahora = Date.UTC(2026, 9, 29, 10, 0);
  const iso = (h, m) => new Date(Date.UTC(2026, 9, 29, h, m)).toISOString();
  const golpes = [
    { tramo: "d5", empleados: ["teatros"], fin: iso(2, 1), busquedas: 6, eventos: 9, nuevos: 4, descartados: 2, errores: 0 },
    { tramo: "t0", empleados: ["musica", "escena", "junta"], fin: iso(2, 16), busquedas: 10, eventos: 12, nuevos: 5, descartados: 3, errores: 1 },
    { tramo: "t1", empleados: ["escena", "expo"], fin: iso(2, 46), busquedas: 10, eventos: 3, nuevos: 1, descartados: 0, errores: 0 },
  ];
  const departamentos = DEPARTAMENTOS.map((d) => ({ ...d, empleados: d.empleados.map((e) => ({ ...e, parte: e.id === "despensa-tiendas" ? { fin: iso(9, 1), texto: "2 tiendas nuevas" } : null })) }));
  const rep = montarRepeticion({
    golpes, departamentos,
    bandeja: [{ encontrado: iso(2, 16), empleado: "musica" }, { encontrado: iso(9, 0), empleado: "musica" }],
    charla: [{ de: "musica", a: "jefe", texto: "Traigo 5", cuando: iso(2, 16) }, { de: "tu", a: "jefe", texto: "Hola", cuando: iso(20, 0) }],
  }, sitios, ahora);

  it("cabe en un minuto, en orden, con la Despensa y sin perder ninguna cifra", () => {
    expect(rep.vacia).toBe(false);
    expect(rep.duracion).toBeLessThanOrEqual(60);
    expect(rep.golpes.map((g) => g.tramo)).toEqual(["d5", "t0", "t1", "despensa-tiendas"]);
    const fin = contadores(rep, rep.duracion);
    expect(fin).toEqual({ archivo: 10, buzon: 1, papelera: 5 });
    expect(contadores(rep, 0)).toEqual({ archivo: 0, buzon: 0, papelera: 0 });
    expect(rep.bocadillos).toHaveLength(1);
    expect(rep.bocadillos[0].quien).toBe("musica");
  });

  it("el reloj va de la hora del primer turno a la del último", () => {
    expect(horaReal(rep, rep.golpes[0].s)).toBe(Date.parse(golpes[0].fin));
    expect(horaReal(rep, rep.golpes[1].s)).toBe(Date.parse(golpes[1].fin));
  });

  it("cada uno sale de la cafetería, teclea en su mesa, lleva la carpeta y vuelve", () => {
    const t = rep.tramosDe.musica[0];
    expect(poseEn(rep, "musica", 0).modo).toBe("sentado");
    expect(poseEn(rep, "musica", (t.sIda + t.sIn) / 2).modo).toBe("anda");
    expect(poseEn(rep, "musica", (t.sIn + t.sOut) / 2)).toMatchObject({ modo: "teclea", x: sitios.musica.silla[0], z: sitios.musica.silla[1] });
    expect(poseEn(rep, "musica", (t.sOut + t.sMostrador) / 2)).toMatchObject({ modo: "anda", lleva: true });
    expect(poseEn(rep, "musica", rep.duracion).modo).toBe("sentado");
    // Escena trabaja en t0 y en t1: una sola estancia en su mesa
    expect(rep.tramosDe.escena).toHaveLength(1);
    // La Despensa no pasa por el control de fuentes
    expect(rep.tramosDe["despensa-tiendas"][0].aMostrador).toBeNull();
  });

  it("sin turnos en las últimas 24 h no hay repetición", () => {
    expect(montarRepeticion({ golpes: [], departamentos: DEPARTAMENTOS }, sitios, ahora).vacia).toBe(true);
  });
});
