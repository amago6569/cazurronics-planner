import { mensajeParaUsuario } from '../../../lib/gemini';
import { NextResponse, after } from 'next/server';
import { leerPeticionPlan } from '../../../lib/planUtils';
import { montarPlan } from '../../../lib/montarPlan';
import { enSegundoPlano, guardarJSON, nuevoId, sinRomper } from '../../../lib/almacen';
import { claveTopeDiario, cupoPorHora, dentroDelTopeDiario, devolverCupo, mensajeCupoHora } from '../../../lib/freno';
import { asegurarBarridoReciente } from '../../../lib/eventos';
import { claveLugar, esNegocio, esPrueba, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';

export const maxDuration = 60;

// Reparto del minuto que da Vercel: la IA tiene hasta el segundo 55 y la comprobación de sitios
// (Places, fotos, Street View) hasta el 58. Así, si algo va lento, la persona recibe un mensaje claro
// en vez de que Vercel corte la petición a medias.
const MS_IA = 55000;
const MS_TOTAL = 58000;

// Regla de Alejandro (17-11-2026): cada persona, como mucho 3 planes por hora (se cambia con PLANES_MAX_HORA en Vercel).
// Un plan que no sale (fallo de la IA, nada que encaje) no gasta cupo: se devuelve.
const maxPorHora = () => Math.max(1, Number(process.env.PLANES_MAX_HORA ?? 3) || 3);

export async function POST(request) {
  const inicio = Date.now();
  // Lo que se ha contado para esta petición: si al final no hay plan (también si algo revienta), se devuelve
  const contados = [];
  const devolver = () => devolverCupo(...contados.splice(0));
  try {
    const peticion = leerPeticionPlan(await request.json().catch(() => null));
    if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
    const cupo = await cupoPorHora(request, 'plan', maxPorHora());
    if (!cupo.ok) {
      return NextResponse.json({ exito: false, mensaje: mensajeCupoHora(maxPorHora(), cupo.minutos), esperaMin: cupo.minutos }, { status: 429 });
    }
    contados.push(cupo.clave);
    // Techo de gasto por día: por conexión y para toda la web (se cambian con PLANES_MAX_IP_DIA y PLANES_MAX_DIA en Vercel; 0 = sin tope).
    // 40 al día (Alejandro, 17-11-2026; antes 25). Con 3 por hora y persona, nadie lo agota solo; peor caso ~7 € más al mes
    // El de conexión es más bajo que el total para que una sola no deje a todos sin planes; si el almacén falla, el total no deja pasar
    contados.push(claveTopeDiario('plan', request));
    if (!(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_IP_DIA ?? 6), request))) {
      await devolver();
      return NextResponse.json({ exito: false, mensaje: 'Hoy has montado muchos planes 🦁 Vuelve mañana y seguimos.' }, { status: 429 });
    }
    contados.push(claveTopeDiario('plan'));
    if (!(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_DIA ?? 40), null, false))) {
      await devolver();
      return NextResponse.json({ exito: false, mensaje: 'Hoy se han agotado los planes gratuitos 🦁 Vuelve mañana y te montamos el planazo.' }, { status: 429 });
    }
    // El techo de toda la web sí se queda contado aunque el plan falle: ese intento ya gasta IA
    contados.pop();
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;
    // Si la agenda diaria está vacía o caducada (p. ej. en local, sin cron), se rellena en segundo plano
    after(() => sinRomper(asegurarBarridoReciente(), 'barrido diario'));
    // Todo el trabajo (agenda, IA, comprobación en Google Places) está en lib/montarPlan.js
    const montado = await montarPlan(peticion, { inicio, msIA: MS_IA, msTotal: MS_TOTAL });
    // Cuántos planes salen vacíos y cuántos se salvan con toda la provincia (para decidir con datos el tope de ampliados)
    if (montado.vacio || montado.ampliado) enSegundoPlano(() => registrar(montado.ampliado ? 'plan_ampliado' : 'plan_vacio'), 'estadísticas');
    if (!montado.exito) {
      await devolver();
      return NextResponse.json({ exito: false, mensaje: montado.mensaje }, { status: 200 });
    }
    const { plan: rutaFinal, prevision: previsionTiempo, masEseDia, nombreZona, aviso } = montado;

    // NUEVO: cada parada lleva su identificador de lugar (para estadísticas y valoraciones)
    for (const parada of rutaFinal) parada.lugarId = esNegocio(parada) ? claveLugar(parada) : null; // un evento no cuenta como local

    // NUEVO: guardamos el plan para poder compartirlo (/plan/ID) y votarlo en grupo
    const planId = nuevoId();
    const guardado = await sinRomper(guardarJSON(`plan:${planId}`, {
      id: planId, creado: Date.now(), fecha, apetece, zona: nombreZona,
      centro: [lat, lon], radio, presupuesto: { min: presupuestoMin, max: presupuestoMax },
      prevision: previsionTiempo, itinerario: rutaFinal, masEseDia, ...(aviso ? { aviso } : {}),
    }, 120 * 24 * 3600), 'guardar plan');
    // Rankings y estadísticas en segundo plano: la respuesta no los espera
    if (!esPrueba(request)) enSegundoPlano(() => registrarApariciones(rutaFinal), 'apariciones');
    enSegundoPlano(() => registrar('plan'), 'estadísticas');

    return NextResponse.json({ exito: true, plan: rutaFinal, prevision: previsionTiempo, planId: guardado ? planId : null, masEseDia, ...(aviso ? { aviso } : {}) });
  } catch (error) {
    console.error('[plan]', error?.message || error);
    await devolver();
    const mensaje = mensajeParaUsuario(error);
    return NextResponse.json({ exito: false, mensaje, ...(process.env.NODE_ENV === 'development' ? { detalle: error?.fallos || String(error?.stack || error).slice(0, 400) } : {}) }, { status: 200 });
  }
}
