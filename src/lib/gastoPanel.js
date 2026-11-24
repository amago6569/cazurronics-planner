// ============ PANEL DE GASTO DE LA IA (/admin/gasto) ============
// Google no tiene una API para leer el saldo prepago de AI Studio (comprobado el 24-11-2026), así que el saldo se calcula:
//   saldo = punto de partida + recargas que apunta Alejandro − gasto real desde entonces
// El punto de partida es el último cuadre (el saldo que marcaba AI Studio cuando lo apuntó) o, si no hay, la primera recarga.
// El gasto real es el contador de la web (ia:dia, cada llamada con su precio de lib/preciosIA.js) por el factor del cuadre:
// cuánto se queda corto el contador frente a lo que de verdad cobra Google.
// Todo sale de Redis: leer el panel no gasta nada en Google.
import { aObjeto, comando, varios } from "./almacen";
import { CLAVE_LLAMADAS_IA, EUROS_POR_DOLAR, claveDetalleIA, claveErroresIA, funcionDeTarea, hoyEnLeon } from "./estadisticas";
import { ajusteContador, factorDelCuadre, topeDiaEuros } from "./topeGasto";
import { claveGastoPruebas } from "./modoPruebas";

export const CLAVE_RECARGAS = "ia:recargas";
export const CLAVE_CUADRE = "ia:cuadre";
export const CLAVE_FACTOR = "ia:factor";
const DIAS = 30; // lo que enseña el panel
const DIAS_SALDO = 40; // lo que se lee para el saldo (ia:dia caduca a los 40 días)
const redondo = (n, d = 2) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;
const json = (t) => { try { return JSON.parse(t); } catch { return null; } };
const fechaDe = (t) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(t));

// El factor que se usa: GASTO_IA_AJUSTE en Vercel, si no el del último cuadre, si no 1,5 (lo que se quedó corto en noviembre)
export function elegirFactor(guardado, env = process.env) {
  if (String(env.GASTO_IA_AJUSTE ?? "").trim() !== "") return { factor: ajusteContador(), origen: "vercel" };
  const cuadre = factorDelCuadre(guardado);
  return cuadre != null ? { factor: cuadre, origen: "cuadre" } : { factor: ajusteContador(), origen: "estimado" };
}

// Microdólares contados desde el instante t. Los días enteros salen de ia:dia; el día de t, de las llamadas sueltas si
// llegan hasta ese momento (son las 1.000 últimas) y si no, el día entero (se pasa por exceso, nunca por defecto).
export function contadoDesde(t, porDia, llamadas) {
  const diaT = fechaDe(t);
  let micro = 0;
  for (const [fecha, m] of Object.entries(porDia)) if (fecha > diaT) micro += Number(m) || 0;
  const delDia = llamadas.filter((l) => fechaDe(l.t) === diaT);
  const cubre = llamadas.length && Math.min(...llamadas.map((l) => l.t)) <= t;
  micro += cubre ? delDia.filter((l) => l.t >= t).reduce((s, l) => s + (Number(l.u) || 0), 0) : Number(porDia[diaT]) || 0;
  return micro;
}

// Saldo calculado en euros. null si aún no hay ni recargas ni cuadre apuntados
export function calcularSaldo({ recargas, cuadre, porDia, llamadas, factor }) {
  const ordenadas = [...recargas].sort((a, b) => a.t - b.t);
  const base = cuadre?.t ? { t: cuadre.t, saldo: Number(cuadre.saldoAIStudio) || 0 } : ordenadas.length ? { t: ordenadas[0].t - 1, saldo: 0 } : null;
  if (!base) return null;
  const recargado = ordenadas.filter((r) => r.t > base.t).reduce((s, r) => s + (Number(r.euros) || 0), 0);
  const contado = contadoDesde(base.t, porDia, llamadas);
  // Si el punto de partida es más viejo que los días guardados, falta gasto por contar: toca apuntar el saldo de AI Studio
  const masViejo = Object.keys(porDia).sort()[0];
  const viejo = Boolean(masViejo && fechaDe(base.t) < masViejo);
  return { euros: redondo(base.saldo + recargado - (contado / 1e6) * EUROS_POR_DOLAR * factor), desde: cuadre?.t ? base.t : base.t + 1, recargado: redondo(recargado), contadoEuros: redondo((contado / 1e6) * EUROS_POR_DOLAR, 3), viejo };
}

// Lo que dice el cuadre: desviación del saldo calculado frente al de AI Studio y el factor nuevo (lo que cobra Google / lo contado)
export function cuadrar({ saldoAIStudio, recargas, cuadreAnterior, porDia, llamadas, factor, ahora = Date.now() }) {
  const calculado = calcularSaldo({ recargas, cuadre: cuadreAnterior, porDia, llamadas, factor });
  const real = Number(saldoAIStudio);
  const desviacion = calculado && real > 0 ? redondo((calculado.euros - real) / real, 4) : null;
  let factorNuevo = null;
  if (calculado) {
    const base = cuadreAnterior?.t ? Number(cuadreAnterior.saldoAIStudio) || 0 : 0;
    const gastadoDeVerdad = base + calculado.recargado - real;
    // Con menos de 0,50 € contados el factor saldría de ruido: no se toca
    if (calculado.contadoEuros >= 0.5 && gastadoDeVerdad > 0) factorNuevo = factorDelCuadre(gastadoDeVerdad / calculado.contadoEuros);
  }
  return { t: ahora, saldoAIStudio: real, saldoCalculado: calculado?.euros ?? null, desviacion, factor: factorNuevo };
}

const fechasAtras = (n) => Array.from({ length: n }, (_, i) => hoyEnLeon(-i)).reverse();

async function leerBase() {
  const fechas = fechasAtras(DIAS_SALDO);
  const res = await varios([
    ...fechas.map((f) => ["GET", `ia:dia:${f}`]),
    ...fechas.map((f) => ["GET", claveGastoPruebas(f)]),
    ["LRANGE", CLAVE_LLAMADAS_IA, 0, 999],
    ["LRANGE", CLAVE_RECARGAS, 0, -1],
    ["GET", CLAVE_CUADRE],
    ["GET", CLAVE_FACTOR],
  ]);
  // Lo que se paga cada día: la web más las pruebas de planes (que tienen su propio tope, pero salen del mismo saldo)
  const pruebasPorDia = Object.fromEntries(fechas.map((f, i) => [f, Number(res[fechas.length + i]) || 0]));
  const porDia = Object.fromEntries(fechas.map((f, i) => [f, (Number(res[i]) || 0) + pruebasPorDia[f]]));
  const [llamadas, recargas, cuadre, factorGuardado] = res.slice(fechas.length * 2);
  return {
    fechas, porDia, pruebasPorDia,
    llamadas: (llamadas || []).map(json).filter((l) => l?.t),
    recargas: (recargas || []).map(json).filter((r) => r?.t && Number(r.euros) > 0),
    cuadre: json(cuadre),
    ...elegirFactor(factorGuardado),
  };
}

// Euros reales de cada día (contador × cambio × factor)
const realDe = (micro, factor) => (micro / 1e6) * EUROS_POR_DOLAR * factor;
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function leerPanelGasto() {
  const base = await leerBase();
  const { porDia, pruebasPorDia, llamadas, recargas, cuadre, factor } = base;
  const fechas = base.fechas.slice(-DIAS);
  const dias = fechas.map((f) => ({ fecha: f, euros: redondo(realDe(porDia[f], factor), 3) }));
  const hoy = dias.at(-1)?.euros || 0;
  const completos = dias.slice(0, -1); // sin hoy, que va a medias
  const media7 = media(completos.slice(-7).map((d) => d.euros));
  const saldo = calcularSaldo({ recargas, cuadre, porDia, llamadas, factor });

  // Detalle por función y modelo, planes y errores
  const fechas7 = fechas.slice(-7);
  const mes = hoyEnLeon().slice(0, 7);
  const delMes = fechas.filter((f) => f.startsWith(mes));
  const extra = await varios([
    ...fechas.map((f) => ["HGETALL", claveDetalleIA(f)]),
    ...fechas.map((f) => ["HGETALL", `stats:${f}`]),
    ...fechas7.map((f) => ["HGETALL", claveErroresIA(f)]),
    ["HGETALL", `ia:${mes}`],
  ]);
  const detalle = extra.slice(0, DIAS).map(aObjeto);
  const stats = extra.slice(DIAS, DIAS * 2).map(aObjeto);
  const errores = extra.slice(DIAS * 2, DIAS * 2 + 7).map(aObjeto);
  const mesIA = aObjeto(extra.at(-1));

  const porFuncion = {}, porModelo = {};
  for (const d of detalle) {
    for (const [campo, valor] of Object.entries(d)) {
      const [funcion, modelo, n] = campo.split("|");
      const f = (porFuncion[funcion] ||= { funcion, euros: 0, llamadas: 0 });
      const m = (porModelo[modelo] ||= { modelo, euros: 0, llamadas: 0 });
      if (n === "n") { f.llamadas += Number(valor) || 0; m.llamadas += Number(valor) || 0; } else { f.euros += realDe(Number(valor) || 0, factor); m.euros += realDe(Number(valor) || 0, factor); }
    }
  }
  // Antes del 25-11-2026 no se apuntaba la función de cada llamada por día: mientras no haya, sale la del mes por tareas
  let periodoFuncion = "30 días";
  if (!Object.keys(porFuncion).length) {
    periodoFuncion = "este mes";
    for (const [campo, valor] of Object.entries(mesIA)) {
      const corte = campo.lastIndexOf(":");
      const funcion = funcionDeTarea(campo.slice(0, corte)), dato = campo.slice(corte + 1);
      const f = (porFuncion[funcion] ||= { funcion, euros: 0, llamadas: 0 });
      if (dato === "llamadas") f.llamadas += Number(valor) || 0;
      if (dato === "microdolares") f.euros += realDe(Number(valor) || 0, factor);
    }
  }
  const ordenar = (o) => Object.values(o).map((x) => ({ ...x, euros: redondo(x.euros, 3) })).sort((a, b) => b.euros - a.euros);

  const suma = (lista, campo) => lista.reduce((s, x) => s + (Number(x[campo]) || 0), 0);
  const planes = suma(stats, "plan"), cache = suma(stats, "plan_cache"), sinIA = suma(stats, "plan_sin_ia");
  const planesMes = suma(stats.filter((_, i) => delMes.includes(fechas[i])), "plan") - suma(stats.filter((_, i) => delMes.includes(fechas[i])), "plan_sin_ia");
  const costePlanesMes = realDe(Number(mesIA["planes:microdolares"]) || 0, factor);

  return {
    exito: true,
    factor: { valor: redondo(factor, 2), origen: base.origen },
    saldo: saldo ? { ...saldo, diasQueQuedan: media7 > 0 ? Math.floor(saldo.euros / media7) : null } : null,
    gasto: { hoy: redondo(hoy), ayer: redondo(completos.at(-1)?.euros), d7: redondo(suma(dias.slice(-7), "euros")), d30: redondo(suma(dias, "euros")), media7: redondo(media7, 3), tope: topeDiaEuros(), pruebasHoy: redondo(realDe(pruebasPorDia[hoyEnLeon()] || 0, factor), 3) },
    dias,
    porFuncion: ordenar(porFuncion),
    periodoFuncion,
    porModelo: ordenar(porModelo),
    planes: {
      planes, cache, sinIA,
      pctCache: planes + cache ? Math.round((cache / (planes + cache)) * 100) : 0,
      pctSinIA: planes ? Math.round((sinIA / planes) * 100) : 0,
      costeMedio: planesMes > 0 ? redondo(costePlanesMes / planesMes, 4) : null,
    },
    llamadas: llamadas.slice(0, 50).map((l) => ({ ...l, euros: redondo(realDe(Number(l.u) || 0, factor), 5) })),
    errores: fechas7.map((f, i) => ({ fecha: f, ...Object.fromEntries(Object.entries(errores[i]).map(([k, v]) => [k, Number(v) || 0])) })),
    recargas: [...recargas].sort((a, b) => b.t - a.t),
    cuadre,
  };
}

// «He recargado X €»
export async function apuntarRecarga(euros, t = Date.now()) {
  const n = redondo(Number(String(euros).replace(",", ".")));
  if (!(n >= 1 && n <= 500)) return { exito: false, mensaje: "Pon una cantidad entre 1 y 500 €." };
  if (!(t > Date.now() - 60 * 864e5 && t <= Date.now() + 60000)) return { exito: false, mensaje: "La fecha tiene que ser de los últimos 60 días." };
  await comando(["LPUSH", CLAVE_RECARGAS, JSON.stringify({ t, euros: n })]);
  return { exito: true };
}

// El saldo que marca AI Studio ahora: guarda el cuadre y, si hay datos bastantes, el factor nuevo del contador
export async function apuntarCuadre(saldoAIStudio) {
  const real = redondo(Number(String(saldoAIStudio).replace(",", ".")));
  if (!(real >= 0 && real <= 1000)) return { exito: false, mensaje: "Pon el saldo que marca AI Studio, en euros." };
  const base = await leerBase();
  const cuadre = cuadrar({ saldoAIStudio: real, recargas: base.recargas, cuadreAnterior: base.cuadre, porDia: base.porDia, llamadas: base.llamadas, factor: base.factor });
  await varios([
    ["SET", CLAVE_CUADRE, JSON.stringify(cuadre)],
    ["LPUSH", "ia:cuadres", JSON.stringify(cuadre)],
    ["LTRIM", "ia:cuadres", 0, 19],
    ...(cuadre.factor != null && base.origen !== "vercel" ? [["SET", CLAVE_FACTOR, String(cuadre.factor)]] : []),
  ]);
  return { exito: true, cuadre };
}

// ---------- Avisos ----------
// saldo < 3 €, menos de 5 días al ritmo de la última semana, o ayer más del doble de la media de los 7 días anteriores
export function avisosDeGasto(panel) {
  const avisos = [];
  const s = panel?.saldo;
  if (s && s.euros < 3) avisos.push({ tipo: "saldo-bajo", texto: `💳 Quedan unos ${s.euros.toFixed(2).replace(".", ",")} € de saldo de la IA. Recarga en aistudio.google.com → Billing y apúntalo en cazurronics.es/admin/gasto.` });
  else if (s?.diasQueQuedan != null && s.diasQueQuedan < 5) avisos.push({ tipo: "pocos-dias", texto: `⏳ Al ritmo de la última semana, el saldo de la IA dura ${s.diasQueQuedan} días más (${s.euros.toFixed(2).replace(".", ",")} €).` });
  const dias = panel?.dias || [];
  const ayer = dias.at(-2)?.euros || 0;
  const antes = media(dias.slice(-9, -2).map((d) => d.euros));
  if (antes >= 0.05 && ayer > 2 * antes) avisos.push({ tipo: "gasto-doble", texto: `💸 Ayer la IA gastó ${ayer.toFixed(2).replace(".", ",")} €, más del doble de la media (${antes.toFixed(2).replace(".", ",")} €). Mira cazurronics.es/admin/gasto.` });
  return avisos;
}

// Se manda cada aviso una vez al día, por Telegram y por correo (el correo de Strato de Cazurronics, o AVISOS_CORREO)
export async function mandarAvisosDeGasto({ telegram, correo } = {}) {
  const avisos = avisosDeGasto(await leerPanelGasto());
  const dia = hoyEnLeon();
  const enviados = [];
  for (const a of avisos) {
    if (!(await comando(["SET", `oficina:aviso:${dia}:${a.tipo}`, "1", "NX", "EX", 2 * 24 * 3600]))) continue;
    await Promise.allSettled([telegram?.(a.texto), correo?.(a)]);
    enviados.push(a);
  }
  return enviados;
}
