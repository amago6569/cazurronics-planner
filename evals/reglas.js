// ============ LAS REGLAS DE UN PLAN, COMPROBADAS CON CÓDIGO ============
// Lo que dice PLANES.md, regla a regla. Funciones puras: reciben la petición, el caso y lo que devolvió la web.
// Cada regla devuelve { ok, motivo }. «motivo» explica en cristiano qué parada falla.
import { enProvinciaLeon } from "../src/lib/provincia";
import { haversineKm, parsePrecio } from "../src/lib/planUtils";
import { seParecen } from "../src/lib/nombres";
import { rutaConocida } from "../src/lib/rutas";

export const REGLAS = ["real", "leon", "sin-repetir", "hora", "donde", "precio", "abierto", "presupuesto", "andando", "lo-pedido", "rapido"];

const MAX_KM_ANDANDO = 1.2; // 15 min a 4,8 km/h, en línea recta
const MAX_SEGUNDOS = 5;
const CON_HORARIO = new Set(["bar", "restaurante", "cafeteria", "discoteca", "museo"]);
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const sinTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const texto = (v) => typeof v === "string" && v.trim() !== "" && !/^no disponible$/i.test(v.trim());
const nombre = (p) => `«${String(p?.titulo || "sin nombre").slice(0, 40)}»`;

// «21:30» → 1290. Lo que no es HH:MM → null
export function minutos(hora) {
  const m = String(hora || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
}
// De madrugada (antes de las 6:00) cuenta como el final del día anterior: 00:30 va después de las 23:00
const enLaNoche = (min) => (min != null && min < 6 * 60 ? min + 24 * 60 : min);

// ---------- Fechas relativas de los casos ----------
const fechaMadrid = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
export function resolverFecha(spec, ahora = new Date()) {
  const hoy = fechaMadrid(ahora);
  const base = new Date(`${hoy}T12:00:00Z`);
  const mas = (n) => fechaMadrid(new Date(base.getTime() + n * 86400000));
  const s = sinTildes(spec);
  if (s === "hoy") return hoy;
  if (s === "manana") return mas(1);
  const dia = DIAS.indexOf(s);
  if (dia >= 0) return mas(((dia - base.getUTCDay() + 7) % 7) || 7); // el próximo, nunca hoy
  const fija = s.match(/^proximo:(\d{2})-(\d{2})$/);
  if (fija) {
    const este = `${hoy.slice(0, 4)}-${fija[1]}-${fija[2]}`;
    return este >= hoy ? este : `${Number(hoy.slice(0, 4)) + 1}-${fija[1]}-${fija[2]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Fecha de caso que no se entiende: ${spec}`);
}

// ---------- Horario de Google: «lunes: 12:00–16:00, 20:00–0:00 | martes: Cerrado | …» ----------
function franjasDelDia(horario, dia) {
  const linea = String(horario || "").split("|").map((t) => t.trim()).find((t) => sinTildes(t).startsWith(`${DIAS[dia]}:`));
  if (!linea) return null;
  const resto = sinTildes(linea.slice(linea.indexOf(":") + 1));
  if (/cerrado/.test(resto)) return [];
  if (/24 horas/.test(resto)) return [[0, 48 * 60]];
  const franjas = [];
  for (const m of resto.matchAll(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g)) {
    const ini = Number(m[1]) * 60 + Number(m[2]);
    let fin = Number(m[3]) * 60 + Number(m[4]);
    if (fin <= ini) fin += 24 * 60; // cierra pasada la medianoche
    franjas.push([ini, fin]);
  }
  return franjas.length ? franjas : null;
}
// true = abierto · false = cerrado · null = sin horario de ese día
export function abiertoA(horario, fecha, hora) {
  const min = minutos(hora);
  if (min == null) return null;
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const hoy = franjasDelDia(horario, dia);
  const ayer = min < 6 * 60 ? franjasDelDia(horario, (dia + 6) % 7) : null;
  if (hoy == null && ayer == null) return null;
  if ((hoy || []).some(([a, b]) => min >= a && min < b)) return true;
  if ((ayer || []).some(([a, b]) => min + 24 * 60 >= a && min + 24 * 60 < b)) return true;
  return false;
}

// ---------- Cada regla ----------
const fallo = (motivo) => ({ ok: false, motivo });
const bien = { ok: true, motivo: "" };
const primeraQueFalla = (plan, prueba, motivo) => {
  const p = plan.find((x) => !prueba(x));
  return p ? fallo(motivo(p)) : bien;
};

export function comprobar({ caso, peticion, respuesta, segundos }) {
  const plan = Array.isArray(respuesta?.plan) && respuesta?.exito ? respuesta.plan : [];
  const espera = caso.espera || {};
  const r = {};

  r.real = primeraQueFalla(plan, (p) => Boolean(p.placeId) || /^https?:\/\//.test(String(p.fuente || "")) || Boolean(rutaConocida(p.titulo)),
    (p) => `${nombre(p)} no tiene ficha de Google, ni enlace de la agenda, ni está en la lista de rutas`);

  r.leon = primeraQueFalla(plan, (p) => enProvinciaLeon(Number(p.lat), Number(p.lon)), (p) => `${nombre(p)} está fuera de la provincia`);

  r["sin-repetir"] = bien;
  for (let i = 0; i < plan.length && r["sin-repetir"].ok; i++) {
    for (let j = i + 1; j < plan.length; j++) {
      const a = plan[i], b = plan[j];
      if ((a.placeId && a.placeId === b.placeId) || seParecen(a.titulo, b.titulo)) { r["sin-repetir"] = fallo(`${nombre(a)} y ${nombre(b)} son el mismo sitio`); break; }
    }
  }

  r.hora = primeraQueFalla(plan, (p) => minutos(p.hora) != null, (p) => `${nombre(p)} lleva «${p.hora || "sin hora"}»`);
  r.donde = primeraQueFalla(plan, (p) => texto(p.direccion) || texto(p.lugar), (p) => `${nombre(p)} no lleva dirección ni lugar`);
  r.precio = primeraQueFalla(plan, (p) => texto(p.precio), (p) => `${nombre(p)} no lleva precio`);

  r.abierto = primeraQueFalla(plan, (p) => !CON_HORARIO.has(sinTildes(p.tipo)) || abiertoA(p.horario, peticion.fecha, p.hora) === true,
    (p) => (abiertoA(p.horario, peticion.fecha, p.hora) === false ? `${nombre(p)} está cerrado a las ${p.hora}` : `${nombre(p)} no tiene horario de ese día`));

  const total = plan.reduce((s, p) => s + parsePrecio(p.precio), 0);
  r.presupuesto = total <= Number(peticion.presupuestoMax) + 0.001 ? bien : fallo(`suma ${Math.round(total * 10) / 10} € y el máximo es ${peticion.presupuestoMax} €`);

  r.andando = bien;
  if (!caso.zonaLibre) {
    const orden = [...plan].sort((a, b) => (enLaNoche(minutos(a.hora)) ?? 9999) - (enLaNoche(minutos(b.hora)) ?? 9999));
    for (let i = 1; i < orden.length; i++) {
      const km = haversineKm(Number(orden[i - 1].lat), Number(orden[i - 1].lon), Number(orden[i].lat), Number(orden[i].lon));
      if (!(km <= MAX_KM_ANDANDO)) { r.andando = fallo(`de ${nombre(orden[i - 1])} a ${nombre(orden[i])} hay ${Number.isFinite(km) ? `${km.toFixed(1)} km` : "una distancia que no se sabe"}`); break; }
    }
  }

  r["lo-pedido"] = loPedido(plan, respuesta, espera);
  r.rapido = Number(segundos) < MAX_SEGUNDOS ? bien : fallo(`${segundos} s`);
  return r;
}

function loPedido(plan, respuesta, espera) {
  if (espera.fuera) return plan.length === 0 && texto(respuesta?.mensaje) ? bien : fallo("tenía que decir que es fuera de León y no dar plan");
  if (plan.length === 0) return espera.vacioVale && texto(respuesta?.mensaje) ? bien : fallo(`sin plan: ${String(respuesta?.mensaje || "sin mensaje").slice(0, 80)}`);
  const tipos = new Set((espera.tipos || []).map(sinTildes));
  const sobra = plan.find((p) => tipos.size && !tipos.has(sinTildes(p.tipo)));
  if (sobra) return fallo(`${nombre(sobra)} (${sobra.tipo}) no es lo pedido`);
  if (espera.n && plan.length !== espera.n && !texto(respuesta?.aviso)) return fallo(`pidió ${espera.n} y salen ${plan.length} sin aviso`);
  if (espera.min && plan.length < espera.min && !texto(respuesta?.aviso)) return fallo(`salen ${plan.length} de ${espera.min} sin aviso`);
  const desde = minutos(espera.desde);
  if (desde != null) {
    const pronto = plan.find((p) => (enLaNoche(minutos(p.hora)) ?? 0) < desde);
    if (pronto) return fallo(`${nombre(pronto)} a las ${pronto.hora}, antes de las ${espera.desde}`);
  }
  return bien;
}

// ---------- Coste de un caso ----------
// IA: lo que mide la propia llamada (uso.dolares). Google Maps: precio de lista de cada llamada que NO salió de la caché,
// por si ya se pasó la capa gratis del mes (dentro de ella es 0 €). Precio aproximado: se cuadra con la factura en la fase 4.
export const DOLARES_GOOGLE = { busquedas: 0.032, fichas: 0.02, geocoding: 0.005 };
export const EUROS_POR_DOLAR = 0.9;
export function costeEuros({ uso, google }) {
  const ia = Number(uso?.dolares) || 0;
  const maps = Object.entries(DOLARES_GOOGLE).reduce((s, [k, precio]) => s + (Number(google?.[k]) || 0) * precio, 0);
  return { ia: ia * EUROS_POR_DOLAR, maps: maps * EUROS_POR_DOLAR };
}
