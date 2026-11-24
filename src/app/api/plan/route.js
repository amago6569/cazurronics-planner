import { mensajeParaUsuario } from '../../../lib/gemini';
import { NextResponse, after } from 'next/server';
import { leerPeticionPlan } from '../../../lib/planUtils';
import { montarPlan } from '../../../lib/montarPlan';
import { enSegundoPlano, guardarJSON, nuevoId, sinRomper } from '../../../lib/almacen';
import { cupoPorHora, dentroDelTopeDiario, devolverCupo, mensajeCupoHora } from '../../../lib/freno';
import { asegurarBarridoReciente } from '../../../lib/eventos';
import { claveLugar, esNegocio, esPrueba, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';
import { dentroDelGastoDelDia } from '../../../lib/topeGasto';
import { guardarPlanEnCache, leerPlanEnCache } from '../../../lib/cachePlanes';

export const maxDuration = 60;

// Reparto del minuto que da Vercel: la IA tiene hasta el segundo 55 y la comprobación de sitios
// (Places, fotos, Street View) hasta el 58. Así, si algo va lento, la persona recibe un mensaje claro
// en vez de que Vercel corte la petición a medias.
const MS_IA = 55000;
const MS_TOTAL = 58000;

// Regla de Alejandro (24-11-2026; antes 3): cada conexión, como mucho 10 planes por hora (PLANES_MAX_HORA en Vercel).
// Un plan que no sale (nada que encaje) no gasta cupo: se devuelve.
const maxPorHora = () => Math.max(1, Number(process.env.PLANES_MAX_HORA ?? 10) || 10);

export async function POST(request) {
  const inicio = Date.now();
  // Lo que se ha contado para esta petición: si al final no hay plan (también si algo revienta), se devuelve
  const contados = [];
  const devolver = () => devolverCupo(...contados.splice(0));
  try {
    const peticion = leerPeticionPlan(await request.json().catch(() => null));
    if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
    // El mismo pedido hace poco: el plan ya montado, al instante y sin gastar (lib/cachePlanes.js)
    const enCache = await sinRomper(leerPlanEnCache(peticion), 'caché de planes');
    if (enCache) {
      enSegundoPlano(() => registrar('plan_cache'), 'estadísticas');
      return NextResponse.json(enCache);
    }
    const cupo = await cupoPorHora(request, 'plan', maxPorHora());
    if (!cupo.ok) {
      return NextResponse.json({ exito: false, mensaje: mensajeCupoHora(maxPorHora(), cupo.minutos), esperaMin: cupo.minutos }, { status: 429 });
    }
    contados.push(cupo.clave);
    // Techos de gasto del día (Alejandro, 24-11-2026): pasado cualquiera de ellos el plan NO se niega, sale sin IA (0 € de IA).
    //  · por conexión (PLANES_MAX_IP_DIA, 6) y para toda la web (PLANES_MAX_DIA, 40 planes con IA)
    //  · en euros (GASTO_IA_MAX_DIA, 0,40 €; lib/topeGasto.js)
    // Si el almacén falla, el de toda la web y el de euros no dejan pasar a la IA: sin contador no hay techo.
    let sinIA = !(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_IP_DIA ?? 6), request));
    if (!sinIA) sinIA = !(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_DIA ?? 40), null, false));
    if (!sinIA) sinIA = !(await dentroDelGastoDelDia('usuario'));
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;
    // Si la agenda diaria está vacía o caducada (p. ej. en local, sin cron), se rellena en segundo plano
    after(() => sinRomper(asegurarBarridoReciente(), 'barrido diario'));
    // Todo el trabajo (agenda, IA, comprobación en Google Places) está en lib/montarPlan.js
    const montado = await montarPlan(peticion, { inicio, msIA: MS_IA, msTotal: MS_TOTAL, sinIA });
    if (montado.sinIA) enSegundoPlano(() => registrar('plan_sin_ia'), 'estadísticas');
    // Cuántos planes salen vacíos y cuántos se salvan con toda la provincia (para decidir con datos el tope de ampliados)
    if (montado.vacio || montado.ampliado) enSegundoPlano(() => registrar(montado.ampliado ? 'plan_ampliado' : 'plan_vacio'), 'estadísticas');
    if (!montado.exito) {
      await devolver();
      return NextResponse.json({ exito: false, mensaje: montado.mensaje }, { status: 200 });
    }
    const { plan: rutaFinal, prevision: previsionTiempo, masEseDia, nombreZona, aviso } = montado;
    // Si el texto nombraba un pueblo fuera del radio, el plan se hizo allí (lib/pueblos.js): el plan guardado lleva ese centro
    const centro = montado.centro || [lat, lon];
    const radioPlan = montado.radio || radio;

    // NUEVO: cada parada lleva su identificador de lugar (para estadísticas y valoraciones)
    for (const parada of rutaFinal) parada.lugarId = esNegocio(parada) ? claveLugar(parada) : null; // un evento no cuenta como local

    // NUEVO: guardamos el plan para poder compartirlo (/plan/ID) y votarlo en grupo
    const planId = nuevoId();
    const guardado = await sinRomper(guardarJSON(`plan:${planId}`, {
      id: planId, creado: Date.now(), fecha, apetece, zona: nombreZona,
      centro, radio: radioPlan, presupuesto: { min: presupuestoMin, max: presupuestoMax },
      prevision: previsionTiempo, itinerario: rutaFinal, masEseDia, ...(aviso ? { aviso } : {}),
    }, 120 * 24 * 3600), 'guardar plan');
    // Rankings y estadísticas en segundo plano: la respuesta no los espera
    if (!esPrueba(request)) enSegundoPlano(() => registrarApariciones(rutaFinal), 'apariciones');
    enSegundoPlano(() => registrar('plan'), 'estadísticas');

    const respuesta = { exito: true, plan: rutaFinal, prevision: previsionTiempo, planId: guardado ? planId : null, masEseDia, ...(aviso ? { aviso } : {}) };
    enSegundoPlano(() => guardarPlanEnCache(peticion, respuesta, { sinIA: Boolean(montado.sinIA) }), 'caché de planes');
    return NextResponse.json(respuesta);
  } catch (error) {
    console.error('[plan]', error?.message || error);
    await devolver();
    const mensaje = mensajeParaUsuario(error);
    return NextResponse.json({ exito: false, mensaje, ...(process.env.NODE_ENV === 'development' ? { detalle: error?.fallos || String(error?.stack || error).slice(0, 400) } : {}) }, { status: 200 });
  }
}
