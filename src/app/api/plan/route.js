import { mensajeParaUsuario } from '../../../lib/gemini';
import { NextResponse, after } from 'next/server';
import { leerPeticionPlan } from '../../../lib/planUtils';
import { montarPlan } from '../../../lib/montarPlan';
import { enSegundoPlano, guardarJSON, nuevoId, sinRomper } from '../../../lib/almacen';
import { dentroDelLimite, dentroDelTopeDiario } from '../../../lib/freno';
import { asegurarBarridoReciente } from '../../../lib/eventos';
import { claveLugar, esNegocio, esPrueba, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';

export const maxDuration = 60;

// Reparto del minuto que da Vercel: la IA tiene hasta el segundo 55 y la comprobación de sitios
// (Places, fotos, Street View) hasta el 58. Así, si algo va lento, la persona recibe un mensaje claro
// en vez de que Vercel corte la petición a medias.
const MS_IA = 55000;
const MS_TOTAL = 58000;

// Una persona normal no pide 20 planes en 10 minutos; un script que vacía la cuota, sí
const MAX_PLANES = 20;
const VENTANA_S = 600;

export async function POST(request) {
  const inicio = Date.now();
  try {
    const peticion = leerPeticionPlan(await request.json().catch(() => null));
    if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
    if (!(await dentroDelLimite(request, 'plan', MAX_PLANES, VENTANA_S))) {
      return NextResponse.json({ exito: false, mensaje: 'Has pedido muchos planes seguidos 🦁 Espera unos minutos y vuelve a probar.' }, { status: 429 });
    }
    // Techo de gasto por día: por conexión y para toda la web (se cambian con PLANES_MAX_IP_DIA y PLANES_MAX_DIA en Vercel; 0 = sin tope)
    if (!(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_IP_DIA ?? 100), request))) {
      return NextResponse.json({ exito: false, mensaje: 'Hoy has montado muchos planes 🦁 Vuelve mañana y seguimos.' }, { status: 429 });
    }
    if (!(await dentroDelTopeDiario('plan', Number(process.env.PLANES_MAX_DIA ?? 600)))) {
      return NextResponse.json({ exito: false, mensaje: 'Hoy se han agotado los planes gratuitos 🦁 Vuelve mañana y te montamos el planazo.' }, { status: 429 });
    }
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;
    // Si la agenda diaria está vacía o caducada (p. ej. en local, sin cron), se rellena en segundo plano
    after(() => sinRomper(asegurarBarridoReciente(), 'barrido diario'));
    // Todo el trabajo (agenda, IA, comprobación en Google Places) está en lib/montarPlan.js
    const montado = await montarPlan(peticion, { inicio, msIA: MS_IA, msTotal: MS_TOTAL });
    if (!montado.exito) return NextResponse.json({ exito: false, mensaje: montado.mensaje }, { status: 200 });
    const { plan: rutaFinal, prevision: previsionTiempo, masEseDia, nombreZona } = montado;

    // NUEVO: cada parada lleva su identificador de lugar (para estadísticas y valoraciones)
    for (const parada of rutaFinal) parada.lugarId = esNegocio(parada) ? claveLugar(parada) : null; // un evento no cuenta como local

    // NUEVO: guardamos el plan para poder compartirlo (/plan/ID) y votarlo en grupo
    const planId = nuevoId();
    const guardado = await sinRomper(guardarJSON(`plan:${planId}`, {
      id: planId, creado: Date.now(), fecha, apetece, zona: nombreZona,
      centro: [lat, lon], radio, presupuesto: { min: presupuestoMin, max: presupuestoMax },
      prevision: previsionTiempo, itinerario: rutaFinal, masEseDia,
    }, 120 * 24 * 3600), 'guardar plan');
    // Rankings y estadísticas en segundo plano: la respuesta no los espera
    if (!esPrueba(request)) enSegundoPlano(() => registrarApariciones(rutaFinal), 'apariciones');
    enSegundoPlano(() => registrar('plan'), 'estadísticas');

    return NextResponse.json({ exito: true, plan: rutaFinal, prevision: previsionTiempo, planId: guardado ? planId : null, masEseDia });
  } catch (error) {
    console.error('[plan]', error?.message || error);
    const mensaje = mensajeParaUsuario(error);
    return NextResponse.json({ exito: false, mensaje, ...(process.env.NODE_ENV === 'development' ? { detalle: error?.fallos || String(error?.stack || error).slice(0, 400) } : {}) }, { status: 200 });
  }
}
