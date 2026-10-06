import { llamarGemini, extraerJSON, mensajeParaUsuario } from '../../../lib/gemini';
import { NextResponse } from 'next/server';
import { presupuestoAPriceLevel, parsePrecio, obtenerLocalidad, enriquecerParada, leerPeticionPlan } from '../../../lib/planUtils';
import { enSegundoPlano, leerJSON, guardarJSON, sinRomper } from '../../../lib/almacen';
import { dentroDelLimite, dentroDelTopeDiario } from '../../../lib/freno';
import { claveLugar, esNegocio, esPrueba, registrarApariciones, sitiosComprobados, sitiosParaPrompt } from '../../../lib/lugares';
import { planesConGoogle } from '../../../lib/montarPlan';
import { registrar } from '../../../lib/estadisticas';

export const maxDuration = 60;

// Mismo reparto del minuto que en /api/plan (ver allí)
const MS_IA = 52000;
const MS_TOTAL = 58000;
const MAX_RETOQUES = 40; // por conexión y cada 10 minutos
const VENTANA_S = 600;

export async function POST(request) {
  const inicio = Date.now();
  try {
    const body = await request.json().catch(() => null);
    const peticion = leerPeticionPlan(body);
    if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
    const { itinerarioActual, indice, planId } = body;
    const instruccion = String(body.instruccion ?? '').trim().slice(0, 300);
    const paradaAntigua = Array.isArray(itinerarioActual) && itinerarioActual.length <= 30 && Number.isInteger(indice) ? itinerarioActual[indice] : null;
    if (!instruccion || !paradaAntigua || typeof paradaAntigua !== 'object') {
      return NextResponse.json({ exito: false, mensaje: "No he entendido qué parada cambiar. Ábrela otra vez y dime qué prefieres." }, { status: 400 });
    }
    if (!(await dentroDelLimite(request, 'retoque', MAX_RETOQUES, VENTANA_S))) {
      return NextResponse.json({ exito: false, mensaje: 'Has pedido muchos cambios seguidos 🦁 Espera unos minutos y vuelve a probar.' }, { status: 429 });
    }
    // Techo de gasto por día (RETOQUES_MAX_IP_DIA y RETOQUES_MAX_DIA en Vercel; 0 = sin tope)
    if (!(await dentroDelTopeDiario('retoque', Number(process.env.RETOQUES_MAX_IP_DIA ?? 200), request)) || !(await dentroDelTopeDiario('retoque', Number(process.env.RETOQUES_MAX_DIA ?? 1500)))) {
      return NextResponse.json({ exito: false, mensaje: 'Hoy se han hecho muchos cambios 🦁 Vuelve mañana y seguimos.' }, { status: 429 });
    }
    const { fecha, presupuestoMin, presupuestoMax, radio, lat, lon } = peticion;

    const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
    const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);
    const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de León';
    const sumaOtras = itinerarioActual.reduce((suma, p, i) => i === indice ? suma : suma + parsePrecio(p?.precio), 0);
    const presDisp = Math.max(Number(presupuestoMax) - sumaOtras, 3);
    const nombresYa = itinerarioActual.filter((p, i) => i !== indice && p?.titulo).map(p => p.titulo);
    // Modo ahorro (PLANES_SIN_GOOGLE=1): sin búsqueda en Google; la IA elige entre los locales comprobados del radio
    // y lo que conoce, y Google Places lo comprueba después igual que siempre
    const conGoogle = planesConGoogle();
    const sitios = conGoogle ? null : await sinRomper(sitiosComprobados(lat, lon, radio, 30), 'sitios comprobados');
    const bloqueSitios = conGoogle ? '' : sitiosParaPrompt((sitios || []).filter((x) => !nombresYa.includes(x.n) && x.n !== paradaAntigua.titulo));

    const prompt = `
      Cazurronics Planner. Cambia la parada "${paradaAntigua.titulo}" (${paradaAntigua.hora}).
      El usuario pide: "${instruccion}".
      RESTRICCIONES: Centro Lat ${lat}, Lon ${lon}. Radio: ${radio}km. Máx presupuesto: ${presDisp}€. Fecha: ${fecha}. NO repitas: ${nombresYa.join(', ')}.
      ${bloqueSitios}
      Devuelve SOLO un JSON así:
      "lugar": solo si es un evento o ruta: el local, plaza o recinto concreto donde es; si es un negocio normal, null.
      {"hora": "${paradaAntigua.hora}", "titulo": "Sitio nuevo", "descripcion": "...", "precio": "8€", "resenas": "4.5/5", "transporte": "...", "lat": 42.5, "lon": -5.5, "tipo": "${paradaAntigua.tipo}", "lugar": null, "telefono": "No", "web": "No", "horario": "12-23"}
    `;

    const { texto: textoIA } = await llamarGemini(prompt, { para: 'usuario', temperatura: 0.3, google: conGoogle, json: !conGoogle, msMax: Math.min(50000, inicio + MS_IA - Date.now()) });
    const propuesta = extraerJSON(textoIA, '{');
    if (!propuesta || typeof propuesta.titulo !== 'string' || !propuesta.titulo.trim()) throw new SyntaxError('La IA no devolvió una parada');
    const { parada } = await enriquecerParada(propuesta, { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY, limite: inicio + MS_TOTAL });

    if (!parada) return NextResponse.json({ exito: false, mensaje: "No hay alternativas viables." }, { status: 200 });

    // NUEVO: identificador del lugar + actualizar el plan guardado (el enlace compartido ve el cambio)
    parada.lugarId = esNegocio(parada) ? claveLugar(parada) : null; // un evento no cuenta como local
    if (typeof planId === 'string' && /^[0-9a-zA-Z]{6,20}$/.test(planId)) {
      await sinRomper((async () => {
        const guardado = await leerJSON(`plan:${planId}`);
        if (guardado?.itinerario?.[indice]) {
          guardado.itinerario[indice] = parada;
          guardado.editado = Date.now();
          await guardarJSON(`plan:${planId}`, guardado, 120 * 24 * 3600);
        }
      })(), 'actualizar plan');
    }
    // Rankings y estadísticas en segundo plano: la respuesta no los espera
    if (!esPrueba(request)) enSegundoPlano(() => registrarApariciones([parada]), 'apariciones');
    enSegundoPlano(() => registrar('retoque'), 'estadísticas');

    return NextResponse.json({ exito: true, parada });
  } catch (error) {
    console.error('[retocar]', error?.message || error);
    return NextResponse.json({ exito: false, mensaje: mensajeParaUsuario(error) }, { status: 200 });
  }
}
