// ============ «ANOCHE EN 1 MINUTO» ============
// Lo que pasó en las últimas 24 h, con sus horas reales, contado en un minuto. Funciones puras para probarlas.
// Cada turno («golpe»): el empleado sale de la cafetería, va a su mesa, teclea, lleva la carpeta al control de
// fuentes y vuelve. Desde el mostrador vuelan las carpetas: lo nuevo al archivo, lo dudoso a tu buzón y lo que no
// tenía fuente a la papelera. Los contadores suben con las cifras reales de cada turno. La charla sale en bocadillos.
import { CAFE_SITIOS, entrega, largo, puntoEn, ruta } from "./guion";

export const DURACION = 60; // segundos en pantalla
const SEP_MIN = 1.6, SEP_MAX = 4.5, INICIO = 1.5, COLA = 7;
const TECLEA = 1.5, EN_MOSTRADOR = 0.5, VUELO = 1.1, VEL = 11, BOCADILLO = 2.6;
const DIA = 864e5;

// La Despensa y Negocio no van por tramos del barrido
const sinTramo = (e) => e.id.startsWith("despensa-") || e.id === "captacion" || e.id === "finde";
const andar = (puntos) => Math.min(1.8, Math.max(0.5, largo(puntos) / VEL));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Pasa de hora real a segundo de pantalla (y al revés) por tramos rectos entre los golpes
function interpolar(marcas, v, de, a) {
  if (!marcas.length) return 0;
  if (v <= marcas[0][de]) return marcas[0][a];
  for (let i = 1; i < marcas.length; i++) {
    const [p, q] = [marcas[i - 1], marcas[i]];
    if (v <= q[de]) return p[a] + ((v - p[de]) / (q[de] - p[de] || 1)) * (q[a] - p[a]);
  }
  return marcas.at(-1)[a];
}

// golpes: los del barrido (servidor). departamentos: para sumar los turnos de la Despensa y Negocio.
// bandeja: los dudosos (con encontrado y empleado). charla: lo que se dijeron.
export function montarRepeticion({ golpes = [], departamentos = [], bandeja = [], charla = [] } = {}, sitios = {}, ahora = Date.now()) {
  const otros = departamentos.flatMap((d) => d.empleados)
    .filter((e) => sinTramo(e) && e.parte?.fin && ahora - Date.parse(e.parte.fin) < DIA && ahora >= Date.parse(e.parte.fin))
    .filter((e) => !golpes.some((g) => g.empleados.includes(e.id)))
    .map((e) => ({ tramo: e.id, empleados: [e.id], fin: e.parte.fin, texto: e.parte.texto || null, sinMostrador: true }));
  const lista = [...golpes.map((g) => ({ ...g, dudosos: 0 })), ...otros]
    .map((g) => ({ ...g, real: Date.parse(g.fin) }))
    .sort((a, b) => a.real - b.real);
  if (!lista.length) return { vacia: true, duracion: 0, golpes: [], vuelos: [], bocadillos: [], tramosDe: {}, marcas: [] };

  // Los dudosos de la bandeja, al turno que los trajo (el más cercano en el tiempo, de su mismo empleado)
  for (const e of bandeja) {
    const t = Date.parse(e.encontrado || "");
    if (!t) continue;
    const g = lista.filter((x) => !x.sinMostrador && Math.abs(x.real - t) < 15 * 60000).sort((a, b) => Number(b.empleados.includes(e.empleado)) - Number(a.empleados.includes(e.empleado)) || Math.abs(a.real - t) - Math.abs(b.real - t))[0];
    if (g) g.dudosos++;
  }

  // Segundo de pantalla de cada golpe: separados al menos SEP_MIN, como mucho SEP_MAX
  let s = INICIO;
  lista.forEach((g, i) => {
    if (i) s += clamp(((g.real - lista[i - 1].real) / 60000) * 0.05, SEP_MIN, SEP_MAX);
    g.s = s;
  });
  const factor = s + COLA > DURACION ? (DURACION - COLA - INICIO) / Math.max(0.01, s - INICIO) : 1;
  for (const g of lista) g.s = INICIO + (g.s - INICIO) * factor;
  const duracion = Math.max(DURACION * 0.5, lista.at(-1).s + COLA);
  const marcas = [[lista[0].real - 10 * 60000, 0], ...lista.map((g) => [g.real, g.s]), [lista.at(-1).real + 10 * 60000, duracion]];

  // Cada empleado empieza en la cafetería (en un sitio fijo)
  const ids = [...new Set(lista.flatMap((g) => g.empleados))].filter((id) => sitios[id]);
  const cafe = Object.fromEntries(ids.map((id, i) => [id, CAFE_SITIOS[i % CAFE_SITIOS.length]]));

  // Sus estancias en la mesa: golpes seguidos (menos de un ciclo entre ellos) se juntan en una sola
  const tramosDe = {};
  const vuelos = [];
  let enMostrador = 0;
  for (const id of ids) {
    const suyos = lista.filter((g) => g.empleados.includes(id));
    const grupos = [];
    for (const g of suyos) {
      const ultimo = grupos.at(-1);
      if (ultimo && g.s - ultimo.at(-1).s < TECLEA + 4) ultimo.push(g);
      else grupos.push([g]);
    }
    tramosDe[id] = grupos.map((gr) => {
      const mesa = sitios[id];
      const ida = ruta(cafe[id], mesa);
      const sIn = gr[0].s, sOut = gr.at(-1).s + TECLEA;
      const conMostrador = gr.some((g) => !g.sinMostrador);
      const puesto = entrega(enMostrador++);
      const aMostrador = conMostrador ? ruta(mesa, puesto) : null;
      const vuelta = conMostrador ? ruta(puesto, cafe[id]) : ruta(mesa, cafe[id]);
      const llega = sOut + (aMostrador ? andar(aMostrador) : 0);
      // Las carpetas de los golpes que lleva él (el primero de cada golpe) salen cuando llega al mostrador
      if (conMostrador) {
        for (const g of gr.filter((x) => x.empleados.find((e) => sitios[e]) === id && !x.sinMostrador)) {
          if (g.nuevos) vuelos.push({ destino: "archivo", n: g.nuevos, s0: llega + EN_MOSTRADOR * 0.5, tramo: g.tramo });
          if (g.dudosos) vuelos.push({ destino: "buzon", n: g.dudosos, s0: llega + EN_MOSTRADOR * 0.5 + 0.25, tramo: g.tramo });
          if (g.descartados) vuelos.push({ destino: "papelera", n: g.descartados, s0: llega + EN_MOSTRADOR * 0.5 + 0.5, tramo: g.tramo });
        }
      }
      return {
        ida, sIda: sIn - andar(ida), sIn, sOut,
        aMostrador, puesto, sMostrador: llega, vuelta, sVuelta: llega + (aMostrador ? EN_MOSTRADOR : 0),
        golpes: gr.map((g) => g.tramo),
      };
    });
  }

  // La charla, en bocadillos (como mucho uno por persona a la vez y tres en pantalla)
  const desde = marcas[0][0], hasta = marcas.at(-1)[0];
  const bocadillos = [];
  for (const l of charla) {
    const t = Date.parse(l.cuando || "");
    if (!(t >= desde && t <= hasta)) continue;
    const quien = l.de === "tu" ? "jefe" : l.de;
    const s0 = interpolar(marcas, t, 0, 1);
    const activos = bocadillos.filter((b) => b.s0 <= s0 && s0 < b.s0 + BOCADILLO);
    if (activos.length >= 3 || activos.some((b) => b.quien === quien)) continue;
    bocadillos.push({ quien, de: l.de, a: l.a, texto: l.texto, s0 });
  }

  return { vacia: false, duracion, golpes: lista, vuelos: vuelos.sort((a, b) => a.s0 - b.s0), bocadillos, tramosDe, cafe, marcas };
}

export const horaReal = (rep, s) => interpolar(rep.marcas, s, 1, 0);

// Dónde está alguien en el segundo s de la repetición: { x, z, giro, modo, lleva }
export function poseEn(rep, id, s) {
  const tramos = rep.tramosDe[id];
  const enCafe = rep.cafe?.[id];
  if (!tramos || !enCafe) return null;
  for (const t of tramos) {
    if (s < t.sIda) break;
    if (s < t.sIn) return { ...puntoEn(t.ida, (s - t.sIda) * (largo(t.ida) / andar(t.ida))), modo: "anda" };
    if (s < t.sOut) return { x: t.ida.at(-1)[0], z: t.ida.at(-1)[1], giro: 0, modo: "teclea" };
    if (t.aMostrador && s < t.sMostrador) return { ...puntoEn(t.aMostrador, (s - t.sOut) * (largo(t.aMostrador) / andar(t.aMostrador))), modo: "anda", lleva: true };
    if (t.aMostrador && s < t.sVuelta) return { x: t.puesto.pos[0], z: t.puesto.pos[1], giro: t.puesto.giro, modo: "entrega" };
    const dv = andar(t.vuelta);
    if (s < t.sVuelta + dv) return { ...puntoEn(t.vuelta, (s - t.sVuelta) * (largo(t.vuelta) / dv)), modo: "anda" };
  }
  return { x: enCafe.pos[0], z: enCafe.pos[1], giro: enCafe.giro, modo: "sentado" };
}

// Lo que ya ha caído en cada sitio en el segundo s: { archivo, buzon, papelera }
export function contadores(rep, s) {
  const c = { archivo: 0, buzon: 0, papelera: 0 };
  for (const v of rep.vuelos) if (s >= v.s0 + VUELO) c[v.destino] += v.n;
  return c;
}

// Las carpetas que están volando: { destino, t (0 → 1) }
export const enVuelo = (rep, s) => rep.vuelos.filter((v) => s >= v.s0 && s < v.s0 + VUELO).map((v) => ({ ...v, t: (s - v.s0) / VUELO }));
export const bocadillosEn = (rep, s) => rep.bocadillos.filter((b) => s >= b.s0 && s < b.s0 + BOCADILLO);
