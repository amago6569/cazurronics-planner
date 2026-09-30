import { NextResponse } from 'next/server';
import { presupuestoAPriceLevel, ajustarAlPresupuesto, obtenerLocalidad, obtenerPrevisionTiempo, enriquecerParada } from '../../../lib/planUtils';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fecha, apetece, presupuestoMin, presupuestoMax, radio, lat, lon } = body;
    const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
    const priceLevelObjetivo = presupuestoAPriceLevel(presupuestoMin, presupuestoMax);

    const nombreZona = await obtenerLocalidad(lat, lon, MAPS_KEY) || 'un punto de la provincia de León';
    const previsionTiempo = await obtenerPrevisionTiempo(lat, lon, fecha);
    
    const bloqueTiempo = previsionTiempo
      ? `PREVISIÓN DEL TIEMPO REAL: ${previsionTiempo}. ADAPTA EL PLAN PRINCIPAL ESTRICTAMENTE A ESTE CLIMA. Al final de la descripción añade SIEMPRE una nota secundaria: "(Alternativa por si cambia el tiempo: [sitio real])".` : '';

    const prompt = `
      Eres Cazurronics Planner. Crea un plan en León. 
      DATOS: Zona: ${nombreZona} (Lat ${lat}, Lon ${lon}). Radio: ${radio}km. Presupuesto TOTAL: ${presupuestoMin}€ - ${presupuestoMax}€. Apetece: "${apetece}". Fecha: ${fecha}.
      ${bloqueTiempo}
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

    return NextResponse.json({ exito: true, plan: rutaFinal, prevision: previsionTiempo });
  } catch (error) { return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 }); }
}