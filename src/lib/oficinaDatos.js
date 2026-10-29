// ============ DATOS DE LA OFICINA ============
// Reúne lo que deja apuntado cada tarea (barrido, Despensa, avisos, órdenes, encargos, novedades, charla) y lo
// ordena con montarOficina. Lo usan el panel (/api/panel/oficina) y el parte diario del jefe por Telegram.
import { leerJSON } from "./almacen";
import { hoyEnLeon, leerGastoIA } from "./estadisticas";
import { eventosProximos, leerBandeja, leerEncargos, partesDeOrdenes } from "./eventos";
import { montarOficina } from "./oficina";
import { EMPLEADO_DESPENSA, encargosDespensa } from "./despensa";
import { leerNovedades, leerRendimiento } from "./novedades";
import { leerCharla } from "./charla";

// Si le mandaste trabajar a mano después de su último turno, cuenta lo más reciente
function masReciente(a = {}, b = {}) {
  const r = { ...a };
  for (const [id, p] of Object.entries(b)) if (!r[id]?.fin || p.fin > r[id].fin) r[id] = p;
  return r;
}

// Lo que dejan apuntado las tareas de la Despensa y los avisos, en el mismo formato que los partes del barrido
function partesDeOtros({ productos, tiendas, fichas, captacion, finde }) {
  const p = {};
  if (productos?.fin) p["despensa-productos"] = { fin: productos.fin, error: productos.combinaciones?.every((c) => c.error) ? "Fallaron todas las búsquedas" : null, texto: `${productos.combinaciones?.length || 0} búsquedas de producto` };
  if (tiendas?.fin) p["despensa-tiendas"] = { fin: tiendas.fin, error: tiendas.error || null, texto: tiendas.nada || `${tiendas.tiendas || 0} tiendas nuevas` };
  if (fichas?.fin) p["despensa-fichas"] = { fin: fichas.fin, error: fichas.fallidas && !fichas.investigadas ? fichas.error : null, texto: fichas.nada || `${fichas.investigadas || 0} tiendas investigadas` };
  if (captacion?.fin) p.captacion = { fin: captacion.fin, error: captacion.exito === false ? captacion.mensaje : null, texto: captacion.enviado ? "Te ha mandado un correo" : captacion.motivo || "Sin novedades" };
  if (finde?.fin) p.finde = { fin: finde.fin, error: finde.exito === false ? finde.mensaje : null, texto: finde.enviado ? "Te ha mandado el resumen" : finde.motivo || "Sin agenda del finde" };
  return p;
}

export async function datosOficina() {
  const [barrido, bandeja, agenda, gasto, jefe, productos, tiendas, fichas, captacion, finde, ordenes, encargos, encargosDesp, novedades, rendimiento, charla] = await Promise.all([
    leerJSON("eventos:ultimoBarrido"), leerBandeja(), eventosProximos(), leerGastoIA().catch(() => null), leerJSON("oficina:jefe"),
    leerJSON("despensa:ultimoBarrido"), leerJSON("despensa:g:ultimo"), leerJSON("despensa:fichas:ultimo"),
    leerJSON("oficina:turno:captacion"), leerJSON("oficina:turno:finde"),
    partesDeOrdenes().catch(() => ({})), leerEncargos().catch(() => ({})),
    encargosDespensa().catch(() => []), leerNovedades().catch(() => []), leerRendimiento().catch(() => ({})), leerCharla().catch(() => []),
  ]);
  const hoy = hoyEnLeon();
  const nuevosHoy = (barrido?.tramos || []).filter((t) => t.fin && new Date(t.fin).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) === hoy).reduce((s, t) => s + (t.nuevos || 0), 0);
  const oficina = montarOficina({ ...masReciente(barrido?.empleados, ordenes), ...partesDeOtros({ productos, tiendas, fichas, captacion, finde }) }, {
    bandeja: bandeja.length,
    agenda: agenda.reduce((s, d) => s + d.eventos.length, 0),
    nuevosHoy,
    gastoMes: gasto?.[0]?.tareas?.reduce((s, t) => s + t.dolares, 0) ?? null,
    jefe,
    encargos: { ...encargos, [EMPLEADO_DESPENSA]: encargosDesp.map((texto) => ({ texto })) },
    rendimiento,
  });
  return { ...oficina, bandeja, novedades, charla };
}
