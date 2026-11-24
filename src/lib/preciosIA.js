// ============ PRECIOS DE LA IA (Gemini, nivel de pago, tarifa Standard) ============
// Comprobados el 24-11-2026 en la página oficial: https://aistudio.google.com/docs/pricing
// (ai.google.dev/gemini-api/docs/pricing redirige ahí). Dólares por millón de tokens.
// Si Google cambia la tarifa, se cambia SOLO aquí: el contador, el tope del día y el panel de gasto leen de este archivo.
//  · 2.5 Flash-Lite: entrada 0,10 $ · salida 0,40 $. Búsqueda: 1.500 peticiones gratis al día (compartidas con 2.5 Flash),
//    luego 35 $ cada 1.000.
//  · 2.5 Flash: entrada 0,30 $ · salida 2,50 $ (el pensamiento cuenta como salida). Búsqueda: igual que Flash-Lite.
//  · 3.x Flash (gemini-3.8-flash, gemini-3.6-flash; gemini-flash-latest apunta a uno de ellos): entrada 0,75 $ · salida 3,75 $
//    hasta el 31-12-2026 y 1,50 $ · 7,50 $ desde el 1-1-2027. Búsqueda: cada consulta, 5.000 gratis al mes y luego 14 $ cada 1.000
//    (aquí se cuentan todas como pagadas: así el contador nunca se queda corto).
//  · gemini-3-flash-preview: entrada 0,50 $ · salida 3,00 $.
// La página no dice si los tokens de los resultados de búsqueda (toolUsePromptTokenCount) se cobran: se apuntan aparte
// y el cuadre con AI Studio del panel de gasto dirá cuánto se queda corto el contador.

const TARIFAS = [
  { modelo: /^gemini-3-flash-preview/, tramos: [{ desde: "2000-01-01", entrada: 0.5, salida: 3 }], busqueda: 0.014, porConsulta: true },
  { modelo: /^gemini-(flash-latest|3)/, tramos: [{ desde: "2000-01-01", entrada: 0.75, salida: 3.75 }, { desde: "2027-01-01", entrada: 1.5, salida: 7.5 }], busqueda: 0.014, porConsulta: true },
  { modelo: /^gemini-(2\.5-flash-lite|flash-lite)/, tramos: [{ desde: "2000-01-01", entrada: 0.1, salida: 0.4 }], busqueda: 0.035, porConsulta: false },
  { modelo: /^gemini-2\.5-flash/, tramos: [{ desde: "2000-01-01", entrada: 0.3, salida: 2.5 }], busqueda: 0.035, porConsulta: false },
  { modelo: /^gemini-2\.0/, tramos: [{ desde: "2000-01-01", entrada: 0.1, salida: 0.4 }], busqueda: 0.035, porConsulta: false },
];

const hoyMadrid = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);

// { entrada, salida, busqueda, porConsulta } del modelo en esa fecha. Un modelo que no está en la lista paga como el más caro.
export function precioDe(modelo, ahora = new Date()) {
  const tarifa = TARIFAS.find((t) => t.modelo.test(String(modelo || ""))) || TARIFAS[1];
  const dia = hoyMadrid(ahora);
  const tramo = [...tarifa.tramos].reverse().find((t) => t.desde <= dia) || tarifa.tramos[0];
  return { entrada: tramo.entrada, salida: tramo.salida, busqueda: tarifa.busqueda, porConsulta: tarifa.porConsulta };
}
