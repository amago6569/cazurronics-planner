import { NextResponse } from 'next/server';
import { presupuestoAPriceLevel, ajustarAlPresupuesto, obtenerLocalidad, obtenerPrevisionTiempo, enriquecerParada } from '../../../lib/planUtils';
import { guardarJSON, nuevoId, sinRomper } from '../../../lib/almacen';
import { eventosDelDia, eventosParaPrompt } from '../../../lib/eventos';
import { claveLugar, preferenciasComunidad, registrarApariciones } from '../../../lib/lugares';
import { registrar } from '../../../lib/estadisticas';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = body;
    const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
    const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);

    const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de la provincia de León';
    const previsionTiempo = await obtenerPrevisionTiempo(lat, lon, fecha);

    // NUEVO: agenda verificada del barrido diario + lo que la comunidad ha valorado en esa zona.
    // Si el almacén falla o está vacío, el plan se genera exactamente igual que antes.
    const [eventosDia, prefs] = await Promise.all([
      sinRomper(eventosDelDia(fecha, { lat, lon, radio }), 'eventos'),
      sinRomper(preferenciasComunidad(lat, lon, radio), 'preferencias'),
    ]);
    const bloqueAgenda = eventosParaPrompt(eventosDia || []);
    const bloqueComunidad = [
      prefs?.favoritos?.length ? `FAVORITOS DE LA COMUNIDAD CAZURRONICS en esta zona (gente que fue y le encantó; priorízalos si encajan): ${prefs.favoritos.join(', ')}.` : '',
      prefs?.evitar?.length ? `EVITA estos sitios (malas experiencias reales de usuarios): ${prefs.evitar.join(', ')}.` : '',
    ].filter(Boolean).join('\n');
    
    const bloqueTiempo = previsionTiempo
      ? `PREVISIÓN DEL TIEMPO REAL: ${previsionTiempo}. ADAPTA EL PLAN PRINCIPAL ESTRICTAMENTE A ESTE CLIMA. Al final de la descripción añade SIEMPRE una nota secundaria: "(Alternativa por si cambia el tiempo: [sitio real])".` : '';

    const prompt = `
      Eres Cazurronics Planner. Crea un plan en León. 
      DATOS: Zona: ${nombreZona} (Lat ${lat}, Lon ${lon}). Radio: ${radio}km. Presupuesto TOTAL: ${presupuestoMin}€ - ${presupuestoMax}€. Apetece: "${apetece}". Fecha: ${fecha}.
      ${bloqueTiempo}
      ${bloqueAgenda}
      ${bloqueComunidad}
      INSTRUCCIONES:
      1. Busca en Google Search eventos efímeros para ${fecha} y sitios bien valorados.
      2. No inventes nada. No te salgas del radio.
      3. Devuelve SOLO JSON estricto con este formato:
      [{"hora": "12:00", "titulo": "Nombre Oficial", "descripcion": "Descripción del sitio.", "precio": "10€", "resenas": "4.5/5", "transporte": "5 min andando", "lat": 42.59, "lon": -5.56, "tipo": "bar", "telefono": "No disponible", "web": "No disponible", "horario": "12:00 - 16:00"}]
    `;

    const resGoogle = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.2 } })
    });
    const datosGoogle = await resGoogle.json();
    if (!resGoogle.ok) throw new Error("Error en la IA");

    let textoIA = datosGoogle.candidates[0].content.parts[0].text;
    const jsonLimpio = textoIA.substring(textoIA.indexOf('['), textoIA.lastIndexOf(']') + 1);
    const rutaBruta = JSON.parse(jsonLimpio);

    const rutaValidada = [];
    let problemaGlobal = null;

    for (const paradaBruta of rutaBruta) {
      const { parada, problemaConfigPlaces } = await enriquecerParada(paradaBruta, { lat, lon, radio, priceLevelObjetivo, nombreZona, mapsKey: MAPS_KEY });
      if (problemaConfigPlaces) problemaGlobal = problemaConfigPlaces;
      if (parada) rutaValidada.push(parada);
    }

    if (rutaValidada.length === 0) return NextResponse.json({ exito: false, mensaje: problemaGlobal ? `Error en Google Places: ${problemaGlobal}` : "No encontramos locales reales en esa zona. Amplía el radio." }, { status: 200 });

    const rutaFinal = ajustarAlPresupuesto(rutaValidada, presupuestoMax);
    if (rutaFinal.length === 0) return NextResponse.json({ exito: false, mensaje: "Presupuesto muy bajo para esta zona." }, { status: 200 });

    // NUEVO: cada parada lleva su identificador de lugar (para estadísticas y valoraciones)
    for (const parada of rutaFinal) parada.lugarId = claveLugar(parada);

    // NUEVO: guardamos el plan para poder compartirlo (/plan/ID) y votarlo en grupo
    const planId = nuevoId();
    const guardado = await sinRomper(guardarJSON(`plan:${planId}`, {
      id: planId, creado: Date.now(), fecha, apetece, zona: nombreZona,
      centro: [lat, lon], radio, presupuesto: { min: presupuestoMin, max: presupuestoMax },
      prevision: previsionTiempo, itinerario: rutaFinal,
    }, 120 * 24 * 3600), 'guardar plan');
    await Promise.all([
      sinRomper(registrarApariciones(rutaFinal), 'apariciones'),
      sinRomper(registrar('plan'), 'estadísticas'),
    ]);

    return NextResponse.json({ exito: true, plan: rutaFinal, prevision: previsionTiempo, planId: guardado ? planId : null });
  } catch (error) { return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 }); }
}