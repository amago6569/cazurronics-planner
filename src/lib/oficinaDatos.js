// ============ DATOS DE LA OFICINA ============
// Reúne lo que deja apuntado cada tarea (barrido, Despensa, avisos, órdenes, encargos, novedades, charla) y lo
// ordena con montarOficina. Lo usan el panel (/api/panel/oficina) y el parte diario del jefe por Telegram.
import { leerJSON } from "./almacen";
import { hoyEnLeon, leerGastoDias, leerGastoIA, leerResumen } from "./estadisticas";
import { definirTramos, eventosProximos, leerBandeja, leerEncargos, leerEnCurso, leerPausas, leerRepesca, leerSinConfirmar, partesDeOrdenes } from "./eventos";
import { montarOficina, RUTAS_EMPLEADOS } from "./oficina";
import { leerDescartadas, montarReunion } from "./reunion";
import { EMPLEADO_DESPENSA, encargosDespensa } from "./despensa";
import { fallanSeguido, leerNovedades, leerRendimiento } from "./novedades";
import { leerCharla } from "./charla";
import { listarCaptacion } from "./captacion";
import { tarjetasPanel } from "./mensajeCaptacion";
import { turnosDeCrons } from "./turnos";
import vercel from "../../vercel.json";

const DIA = 864e5;

// Qué empleados firman las búsquedas de cada tramo del barrido (t0 → música, teatro y la Junta…)
function empleadosDeTramo() {
  return Object.fromEntries(definirTramos().map((t) => [t.id, [...new Set([...t.busquedas.map((b) => b.empleado || "junta"), ...(t.jcyl ? ["junta"] : [])])]]));
}

// Si le mandaste trabajar a mano después de su último turno, cuenta lo más reciente
function masReciente(a = {}, b = {}) {
  const r = { ...a };
  for (const [id, p] of Object.entries(b)) if (!r[id]?.fin || p.fin > r[id].fin) r[id] = p;
  return r;
}

// Lo que dejan apuntado las tareas de la Despensa y los avisos, en el mismo formato que los partes del barrido
function partesDeOtros({ productos, tiendas, fichas, captacion, finde, verificador, repesca }) {
  const p = {};
  if (verificador?.fin) p.verificador = { fin: verificador.fin, error: verificador.error || null, texto: verificador.texto, descartes: verificador.descartes || [] };
  if (repesca?.fin) p.repesca = { fin: repesca.fin, error: repesca.error || null, texto: repesca.texto };
  if (productos?.fin) p["despensa-productos"] = { fin: productos.fin, error: productos.combinaciones?.every((c) => c.error) ? "Fallaron todas las búsquedas" : null, texto: `${productos.combinaciones?.length || 0} búsquedas de producto` };
  if (tiendas?.fin) p["despensa-tiendas"] = { fin: tiendas.fin, error: tiendas.error || null, texto: tiendas.nada || `${tiendas.tiendas || 0} tiendas nuevas` };
  if (fichas?.fin) p["despensa-fichas"] = { fin: fichas.fin, error: fichas.fallidas && !fichas.investigadas ? fichas.error : null, texto: fichas.nada || `${fichas.investigadas || 0} tiendas investigadas` };
  if (captacion?.fin) p.captacion = { fin: captacion.fin, error: captacion.exito === false ? captacion.mensaje : null, texto: captacion.enviado ? "Te ha mandado un correo" : captacion.motivo || "Sin novedades" };
  if (finde?.fin) p.finde = { fin: finde.fin, error: finde.exito === false ? finde.mensaje : null, texto: finde.enviado ? "Te ha mandado el resumen" : finde.motivo || "Sin agenda del finde" };
  return p;
}

export async function datosOficina({ ahora = Date.now() } = {}) {
  const [barrido, bandeja, agenda, gasto, jefe, productos, tiendas, fichas, captacion, finde, ordenes, encargos, encargosDesp, novedades, rendimiento, charla, resumen, locales, verificador, repesca, colaRepesca, pausas, enCurso, sinConfirmar, descartadas, seguidos] = await Promise.all([
    leerJSON("eventos:ultimoBarrido"), leerBandeja(), eventosProximos(), leerGastoIA().catch(() => null), leerJSON("oficina:jefe"),
    leerJSON("despensa:ultimoBarrido"), leerJSON("despensa:g:ultimo"), leerJSON("despensa:fichas:ultimo"),
    leerJSON("oficina:turno:captacion"), leerJSON("oficina:turno:finde"),
    partesDeOrdenes().catch(() => ({})), leerEncargos().catch(() => ({})),
    encargosDespensa().catch(() => []), leerNovedades().catch(() => []), leerRendimiento().catch(() => ({})), leerCharla().catch(() => []),
    leerResumen(2).catch(() => null), listarCaptacion().catch(() => null),
    leerJSON("oficina:turno:verificador"), leerJSON("oficina:turno:repesca"), leerRepesca().catch(() => []),
    leerPausas().catch(() => ({})), leerEnCurso().catch(() => ({})), leerSinConfirmar().catch(() => []), leerDescartadas().catch(() => []),
    fallanSeguido(ahora).catch(() => []),
  ]);
  const hoy = hoyEnLeon();
  const nuevosHoy = (barrido?.tramos || []).filter((t) => t.fin && new Date(t.fin).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) === hoy).reduce((s, t) => s + (t.nuevos || 0), 0);
  // Los partes del barrido guardan el motivo de cada búsqueda fallida: al empleado le llega el último en cristiano
  const partes = { ...masReciente(barrido?.empleados, ordenes), ...partesDeOtros({ productos, tiendas, fichas, captacion, finde, verificador, repesca }) };
  for (const [nombre, f] of Object.entries(barrido?.fuentes || {})) {
    const p = partes[f.empleado || "junta"];
    if (p && !f.ok && f.error) p.motivos = [...(p.motivos || []), { busqueda: nombre, texto: f.error, tipo: f.tipo || null }].slice(0, 4);
  }
  const gastoMes = gasto?.[0]?.tareas?.reduce((s, t) => s + t.dolares, 0) ?? null;
  const gastoEuros = await leerGastoDias(gastoMes || 0).catch(() => null);
  const oficina = montarOficina(partes, {
    bandeja: bandeja.length,
    agenda: agenda.reduce((s, d) => s + d.eventos.length, 0),
    nuevosHoy,
    gastoMes, gasto: gastoEuros, fallanSeguido: seguidos,
    jefe,
    encargos: { ...encargos, [EMPLEADO_DESPENSA]: encargosDesp.map((texto) => ({ texto })) },
    rendimiento, pausas, enCurso, sinConfirmar: sinConfirmar.length,
  });
  // Cuándo trabaja cada uno (para saber si está en su mesa, en la cafetería…)
  const deTramo = empleadosDeTramo();
  const turnos = turnosDeCrons(vercel.crons, deTramo, RUTAS_EMPLEADOS);
  for (const d of oficina.departamentos) for (const e of d.empleados) e.turnos = turnos[e.id] || [];

  // Lo de las últimas 24 h, tramo a tramo: lo que se ve en «Anoche en 1 minuto» y en la tira del flujo
  const golpes = (barrido?.tramos || [])
    .filter((t) => t.fin && ahora - Date.parse(t.fin) < DIA && ahora >= Date.parse(t.fin))
    .map((t) => ({ tramo: t.tramo, empleados: deTramo[t.tramo] || [], fin: t.fin, busquedas: t.busquedas || 0, eventos: t.eventos || 0, nuevos: t.nuevos || 0, descartados: t.descartados || 0, errores: t.errores || 0 }))
    .sort((a, b) => a.fin.localeCompare(b.fin));
  const suma = (k) => golpes.reduce((s, g) => s + g[k], 0);
  const tarjetas = locales ? await tarjetasPanel(locales).catch(() => []) : [];
  // Solo cuenta como «tuyo» quien falla dos días seguidos: un fallo suelto lo arregla la Repesca
  const conFallo = oficina.departamentos.flatMap((d) => d.empleados).filter((e) => e.estado === "error" && seguidos.includes(e.id));
  const flujo = {
    buscan: suma("busquedas"), encontrados: suma("eventos"), entran: suma("nuevos"), sinFuente: suma("descartados"), fallos: suma("errores"),
    agenda: oficina.jefe.cifras.agenda,
    planesAyer: resumen?.porDia?.[1]?.plan ?? null, planesHoy: resumen?.porDia?.[0]?.plan ?? null,
    captacion: locales?.listos?.length ?? 0,
    pendientes: tarjetas.length + conFallo.length, // lo «por confirmar» no: lo resuelve el Verificador solo
    bandeja: bandeja.length, sinConfirmar: sinConfirmar.length, repesca: colaRepesca.length,
  };
  const repescaResumen = colaRepesca.slice(0, 12).map((r) => ({ nombre: r.nombre, empleado: r.b?.empleado || null, motivo: r.motivo, intentos: r.intentos }));
  const reunion = montarReunion({ departamentos: oficina.departamentos, flujo, sinConfirmar: sinConfirmar.length, repesca: colaRepesca.length, captacion: tarjetas.length, descartadas, ahora });
  return {
    ...oficina, bandeja, novedades, charla, turnosJefe: turnos.jefe || [], golpes, flujo, captacion: tarjetas,
    sinConfirmar: sinConfirmar.slice(0, 30), repesca: repescaResumen, reunion, enCurso: Object.keys(enCurso), fallanSeguido: seguidos,
  };
}
