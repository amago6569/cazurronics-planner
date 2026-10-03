import { llamarGemini } from '../../../lib/gemini';
import { NextResponse } from 'next/server';
import { presupuestoAPriceLevel, parsePrecio, obtenerLocalidad, enriquecerParada } from '../../../lib/planUtils';
import { leerJSON, guardarJSON, sinRomper } from '../../../lib/almacen';
import { claveLugar, esPrueba, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { itinerarioActual, indice, instruccion, fecha, presupuestoMin, presupuestoMax, radio, lat, lon, planId } = await request.json();
    const paradaAntigua = itinerarioActual[indice];
    const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
    const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);
    const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de León';
    const sumaOtras = itinerarioActual.reduce((suma, p, i) => i === indice ? suma : suma + parsePrecio(p.precio), 0);
    const presDisp = Math.max(Number(presupuestoMax) - sumaOtras, 3);
    const nombresYa = itinerarioActual.filter((_, i) => i !== indice).map(p => p.titulo);

    const prompt = `
      Cazurronics Planner. Cambia la parada "${paradaAntigua.titulo}" (${paradaAntigua.hora}). 
      El usuario pide: "${instruccion}".
      RESTRICCIONES: Centro Lat ${lat}, Lon ${lon}. Radio: ${radio}km. Máx presupuesto: ${presDisp}€. Fecha: ${fecha}. NO repitas: ${nombresYa.join(', ')}.
      Devuelve SOLO un JSON así:
      {"hora": "${paradaAntigua.hora}", "titulo": "Sitio nuevo", "descripcion": "...", "precio": "8€", "resenas": "4.5/5", "transporte": "...", "lat": 42.5, "lon": -5.5, "tipo": "${paradaAntigua.tipo}", "telefono": "No", "web": "No", "horario": "12-23"}
    `;

    const { texto: textoIA } = await llamarGemini(prompt, { para: 'usuario', temperatura: 0.3 });
    const jsonLimpio = textoIA.substring(textoIA.indexOf('{'), textoIA.lastIndexOf('}') + 1);
    const { parada } = await enriquecerParada(JSON.parse(jsonLimpio), { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY });

    if (!parada) return NextResponse.json({ exito: false, mensaje: "No hay alternativas viables." }, { status: 200 });

    // NUEVO: identificador del lugar + actualizar el plan guardado (el enlace compartido ve el cambio)
    parada.lugarId = claveLugar(parada);
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
    await Promise.all([
      sinRomper(esPrueba(request) ? null : registrarApariciones([parada]), 'apariciones'),
      sinRomper(registrar('retoque'), 'estadísticas'),
    ]);

    return NextResponse.json({ exito: true, parada });
  } catch (error) { return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 }); }
}