// ============ DESPENSA: MERCADILLOS DE LOS PUEBLOS ============
// En León y en muchos pueblos hay mercado semanal (el de los miércoles y sábados de la Plaza Mayor, el de los jueves
// de Boñar...). Google Maps no los tiene como tienda, así que los busca la IA con Google (modelos 2.x: búsquedas gratis),
// una comarca por pasada nocturna, y se renuevan cada 30 días.
//  · Como los eventos: solo se publica un mercadillo con fuente comprobada (la página existe o la IA la ha consultado).
//  · El sitio se ubica con 1 búsqueda en Google Maps sin nota (cupo de 5.000 gratis al mes; ~80 al mes en total).
// Coste: 9 búsquedas de IA al mes (gratis) + ~80 de Google Maps (dentro del cupo gratis). 0 €.
import { guardarJSON, varios } from "./almacen";
import { llamarGemini, extraerJSON } from "./gemini";
import { comprobarUrl, dominioConsultado } from "./eventos";
import { ubicarEnMaps } from "./despensaTiendas";
import { esRedireccion, seguirRedireccion } from "./fuentes";
import { ZONAS } from "./zonas";

const DIAS_RENUEVA = 30;
const DIAS_CADUCA = 45;
const DIAS_REINTENTO_VACIA = 3;
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const clave = (zona) => `despensa:mercadillos:${zona}`;

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const limpiar = (t, max) => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// Lo que devuelve la IA, comprobado. null si no vale.
export function validarMercadillo(m) {
  if (!m || typeof m !== "object") return null;
  const pueblo = limpiar(m.pueblo, 60);
  // Las redirecciones de Google valen aquí: luego se siguen hasta la página real (lib/fuentes.js)
  const fuente = typeof m.fuente === "string" && /^https?:\/\//.test(m.fuente) ? m.fuente : null;
  const dias = [...new Set((Array.isArray(m.dias) ? m.dias : [m.dias]).map((d) => DIAS_SEMANA.find((x) => normalizar(x) === normalizar(d))).filter(Boolean))]
    .sort((a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b));
  if (!pueblo || !fuente || !dias.length) return null;
  return {
    pueblo,
    dias,
    horario: limpiar(m.horario, 40) || null,
    lugar: limpiar(m.lugar, 80) || null,
    que: limpiar(m.que, 140) || null,
    tipo: /productor|agroalimentari|ecologic|artesan/i.test(`${m.tipo} ${m.que}`) ? "productores" : "semanal",
    fuente,
  };
}

// "miércoles y sábado" · "lunes, jueves y sábado"
export const textoDias = (dias) => (dias.length > 1 ? `${dias.slice(0, -1).join(", ")} y ${dias[dias.length - 1]}` : dias[0] || "");

async function buscarMercadillos(zona) {
  const z = ZONAS.find((x) => x.id === zona);
  const prompt = `
    Eres el documentalista de Cazurronics, una web de planes en León (España). Busca en Internet los mercados
    semanales (mercadillos) y los mercados de productores que se hacen en ${z.nombre} (provincia de León).
    Pueblos de la zona: ${z.pueblos.join(", ")}.
    Mira las webs de los ayuntamientos, la Diputación de León, prensa local (Diario de León, Leonoticias, iLeón,
    El Bierzo Digital...) y guías. Haz varias búsquedas, también pueblo a pueblo.
    Solo mercados que se hacen ahora, cada semana o cada mes, al aire libre o en una plaza, con puestos de comida
    (fruta, verdura, embutido, queso, pan...). Nada de ferias de un solo día ni mercados medievales.
    REGLAS: no inventes nada; "fuente" es la página exacta donde lo has leído (no la web de Google). Sin fuente, no lo pongas.
    Si no encuentras ninguno, devuelve [].
    Devuelve SOLO un array JSON con este formato:
    [{"pueblo":"municipio exacto","dias":["miércoles","sábado"],"horario":"9:00-14:00 o null","lugar":"plaza o calle o null",
      "que":"lo que se vende, corto","tipo":"semanal o productores","fuente":"https://..."}]
  `;
  const { texto, dominios } = await llamarGemini(prompt, { para: "barrido", tarea: "despensa-mercadillos", temperatura: 0.1, msMax: 38000 });
  const lista = (extraerJSON(texto, "[") || []).map(validarMercadillo).filter(Boolean).slice(0, 15);
  // Fuente de verdad (como los eventos) y sitio en el mapa
  const buenos = await Promise.all(lista.map(async (m) => {
    if (esRedireccion(m.fuente)) {
      const real = await seguirRedireccion(m.fuente);
      if (!real) return null;
      m = { ...m, fuente: real };
    } else if (!dominioConsultado(m.fuente, dominios) && (await comprobarUrl(m.fuente)) !== "ok") return null;
    const sitio = await ubicarEnMaps(m.lugar ? `${m.lugar}, ${m.pueblo}` : m.pueblo).catch(() => null);
    return sitio ? { ...m, ...sitio, zona } : null;
  }));
  return buenos.filter(Boolean);
}

// La comarca que toca renovar (la más antigua), o null si todas están al día
async function zonaQueToca(ahora = Date.now()) {
  const res = await varios(ZONAS.map((z) => ["GET", clave(z.id)])).catch(() => []);
  let peor = null;
  ZONAS.forEach((z, i) => {
    let fecha = 0, vacia = false;
    try { const d = JSON.parse(res[i]); fecha = Date.parse(d?.fecha) || 0; vacia = !(d?.lista || []).length; } catch { /* nunca */ }
    // Una comarca sin ningún mercadillo se vuelve a mirar a los 3 días (suele ser que no se pudo comprobar la fuente)
    if (fecha < ahora - (vacia ? DIAS_REINTENTO_VACIA : DIAS_RENUEVA) * 86400000 && (!peor || fecha < peor.fecha)) peor = { zona: z.id, fecha };
  });
  return peor?.zona || null;
}

// Una comarca por llamada. Devuelve un resumen para el informe de la pasada.
export async function barrerMercadillos() {
  const zona = await zonaQueToca();
  if (!zona) return null;
  const lista = await buscarMercadillos(zona);
  await guardarJSON(clave(zona), { fecha: new Date().toISOString(), lista });
  return { mercadillos: zona, guardados: lista.length };
}

export async function leerMercadillos(zonas = ZONAS.map((z) => z.id)) {
  const res = await varios(zonas.map((z) => ["GET", clave(z)])).catch(() => []);
  const limite = Date.now() - DIAS_CADUCA * 86400000;
  return (res || []).flatMap((v) => {
    try {
      const d = JSON.parse(v);
      return d && Date.parse(d.fecha) > limite ? d.lista || [] : [];
    } catch { return []; }
  });
}

export async function resumenMercadillos() {
  const res = await varios(ZONAS.map((z) => ["GET", clave(z.id)])).catch(() => []);
  let total = 0, comarcas = 0;
  for (const v of res || []) {
    try { const d = JSON.parse(v); if (d?.fecha) { comarcas++; total += (d.lista || []).length; } } catch { /* sin datos */ }
  }
  return { total, comarcas, de: ZONAS.length };
}
