// ============ LA OFICINA (/panel/oficina) ============
// Cada tarea automática de la web es un "empleado" con su mesa: qué busca, cuándo trabaja y cómo le ha ido.
//
// AÑADIR UN EMPLEADO NUEVO (una tarea nueva de la web): basta una entrada aquí, en su departamento.
//   { id, emoji, nombre, puesto, horario, turno (horas entre turnos), rutas: ["/api/su-cron?param=x"] }
// y que su tarea deje su parte en Redis (oficina:turno:<id> con { fin, texto, error }). Con eso sale solo su
// monigote con mesa propia en la sala de su departamento (o en el anexo si la sala está llena), su ficha, su chat,
// su sitio en «Anoche en 1 minuto» y su hora de turno sacada de vercel.json. Un departamento nuevo va al anexo.
// El jefe resume el día y avisa de quien va con retraso o con fallos. Funciones puras: el servidor reúne
// los datos (lib/eventos, lib/despensa...) y aquí solo se ordenan para el panel. No llaman a la IA: 0 €.
import { EMPLEADOS_BUSCADORES, TIPOS } from "./eventos";
import { LIMITE_DIA_EUROS, euros } from "./euros";

// turno = horas entre un turno y el siguiente (para saber si alguien se lo ha saltado)
const NOMBRES_TIPO = {
  musica: ["🎸", "Música en directo"], escena: ["🎭", "Teatro, cine y espectáculos"], expo: ["🖼️", "Exposiciones y museos"],
  fiestas: ["🎉", "Fiestas y tradiciones"], mercados: ["🛍️", "Mercados y ferias"], gastro: ["🍷", "Gastronomía"],
  deporte: ["⚽", "Deporte en directo"], carreras: ["🏃", "Carreras y marchas"], naturaleza: ["🥾", "Rutas y naturaleza"],
  familia: ["🧒", "Niños y familias"], talleres: ["🎓", "Talleres y charlas"], noche: ["🌙", "Noche"],
};

export const DEPARTAMENTOS = [
  {
    id: "agenda", nombre: "Agenda por tipo de plan", nota: "Capital y provincia, esta semana y las dos siguientes",
    empleados: TIPOS.map((t) => ({ id: t.id, emoji: NOMBRES_TIPO[t.id][0], nombre: NOMBRES_TIPO[t.id][1], puesto: t.tema[0].toUpperCase() + t.tema.slice(1), horario: "Cada madrugada", turno: 24 })),
  },
  {
    id: "territorio", nombre: "Territorio", nota: "Que no se escape nada de ningún pueblo",
    empleados: [
      { id: "pueblos", emoji: "🏘️", nombre: "Pueblos", puesto: "Los 216 municipios uno a uno, con todas sus pedanías", horario: "Domingos y miércoles", turno: 96 },
      { id: "comarcas", emoji: "🗺️", nombre: "Comarcas", puesto: "Las 8 comarcas: cultura, fiestas, deporte y rutas", horario: "Cada madrugada", turno: 24 },
      { id: "capital", emoji: "🦁", nombre: "León a fondo", puesto: "La capital por tipo de sitio: salas, centros cívicos, barrios", horario: "Domingos y miércoles", turno: 96 },
      { id: "ultima", emoji: "⚡", nombre: "Última hora", puesto: "Lo anunciado para hoy y los 3 próximos días", horario: "Mediodía y tarde", turno: 12 },
      { id: "teatros", emoji: "🎟️", nombre: "Carteleras", puesto: "Qué obra hay en cada teatro y auditorio", horario: "Cada madrugada", turno: 24 },
      { id: "junta", emoji: "🏛️", nombre: "Datos de la Junta", puesto: "Agenda cultural oficial de Castilla y León", horario: "Cada madrugada", turno: 24 },
    ],
  },
  {
    id: "despensa", nombre: "Despensa de León", nota: "Tiendas y productores de producto local",
    empleados: [
      { id: "despensa-productos", emoji: "🧺", nombre: "Productos", puesto: "Dónde comprar cada producto y lo que pide la gente", horario: "Cada noche", turno: 24, rutas: ["/api/despensa/barrido"] },
      { id: "despensa-tiendas", emoji: "🏪", nombre: "Tiendas", puesto: "Tiendas de la provincia en Google Maps", horario: "Cada noche", turno: 24, rutas: ["/api/despensa/tiendas"] },
      { id: "despensa-fichas", emoji: "🏅", nombre: "Fichas", puesto: "Premios y especialidades de cada tienda", horario: "Cada tarde", turno: 24, rutas: ["/api/despensa/fichas"] },
    ],
  },
  {
    id: "negocio", nombre: "Negocio", nota: "Avisos que te llegan por correo",
    empleados: [
      { id: "captacion", emoji: "📣", nombre: "Captación", puesto: "Te avisa de los locales listos para escribirles", horario: "Cada mañana", turno: 24, rutas: ["/api/captacion/aviso"] },
      { id: "finde", emoji: "📅", nombre: "Resumen del finde", puesto: "Texto e imágenes del finde para redes", horario: "Jueves por la mañana", turno: 168, rutas: ["/api/finde/aviso"] },
    ],
  },
  {
    id: "control", nombre: "Control de calidad", nota: "Arreglan lo que el barrido deja a medias (lib/guardia.js)",
    empleados: [
      { id: "verificador", emoji: "🕵️", nombre: "Verificador", puesto: "Vuelve a comprobar los eventos sin fuente segura: confirma, tira los falsos y sube el resto avisándote", horario: "8:50, 13:50 y 19:50", turno: 12, rutas: ["/api/barrido?guardia=verificador"] },
      { id: "repesca", emoji: "🚑", nombre: "Repesca", puesto: "Repite las búsquedas que fallaron (Google lento o saturado)", horario: "7:50 y 15:50", turno: 16, rutas: ["/api/barrido?guardia=repesca"] },
    ],
  },
];

// Las rutas de cron de cada empleado, para saber cuándo le toca: [["/api/despensa/barrido", "despensa-productos"], ...]
export const RUTAS_EMPLEADOS = DEPARTAMENTOS.flatMap((d) => d.empleados.flatMap((e) => (e.rutas || []).map((r) => [r, e.id])));

// Estado de una mesa: "error" (falló la mayoría de su trabajo), "tarde" (se ha saltado su turno), "ok", "nuevo" (aún no ha
// trabajado) o "descanso" (la reunión le ha dado unos días libres)
export function estadoEmpleado(emp, parte, ahora = Date.now(), descanso = null) {
  if (descanso) return "descanso";
  if (!parte?.fin) return "nuevo";
  if (parte.busquedas && parte.errores >= Math.ceil(parte.busquedas / 2)) return "error";
  if (parte.error) return "error";
  const horas = (ahora - Date.parse(parte.fin)) / 3600000;
  return horas > emp.turno * 1.5 + 2 ? "tarde" : "ok";
}

// partes = { idEmpleado: { fin, busquedas?, eventos?, descartados?, errores?, texto?, error? } }
export function montarOficina(partes = {}, { bandeja = 0, agenda = 0, nuevosHoy = 0, gastoMes = null, jefe = null, encargos = {}, rendimiento = {}, pausas = {}, enCurso = {}, sinConfirmar = 0, fallanSeguido = [], gasto = null } = {}, ahora = Date.now()) {
  const departamentos = DEPARTAMENTOS.map((d) => ({
    ...d,
    empleados: d.empleados.map((e) => ({
      ...e, parte: partes[e.id] || null, estado: estadoEmpleado(e, partes[e.id], ahora, pausas[e.id]),
      descanso: pausas[e.id] || null, enCurso: enCurso[e.id] || null,
      // Los que buscan con la IA aceptan órdenes desde su ficha: trabajar ya o un encargo
      ordenes: EMPLEADOS_BUSCADORES.includes(e.id) || e.id === "despensa-productos", encargos: (encargos[e.id] || []).map((x) => x.texto),
      ...(e.id === "despensa-productos" ? { conComarca: true } : {}),
      // Lo que ha rendido en los últimos 14 días: búsquedas hechas y eventos que de verdad entraron nuevos
      rinde: rendimiento[e.id] || null,
    })),
  }));
  const todos = departamentos.flatMap((d) => d.empleados);
  const cuenta = (estado) => todos.filter((e) => e.estado === estado);
  const [tarde, error] = [cuenta("tarde"), cuenta("error")];
  const encontrados = todos.reduce((s, e) => s + (e.parte?.eventos || 0), 0);
  const descartados = todos.reduce((s, e) => s + (e.parte?.descartados || 0), 0);

  const lineas = [];
  lineas.push(`El equipo ha encontrado ${encontrados} eventos en su último turno y hay ${agenda} en la agenda de las próximas 3 semanas.`);
  if (nuevosHoy) lineas.push(`Hoy han entrado ${nuevosHoy} eventos nuevos.`);
  if (descartados) lineas.push(`${descartados} se han quedado fuera por no tener una fuente que se pueda comprobar.`);
  if (bandeja) lineas.push(`${bandeja} ${bandeja === 1 ? "evento espera" : "eventos esperan"} la segunda comprobación del Verificador.`);
  if (sinConfirmar) lineas.push(`${sinConfirmar} ${sinConfirmar === 1 ? "evento está subido" : "eventos están subidos"} «por confirmar»: el Verificador los sigue mirando solo.`);
  const pendientes = Object.values(encargos).reduce((s, l) => s + l.length, 0);
  if (pendientes) lineas.push(`Hay ${pendientes} ${pendientes === 1 ? "encargo tuyo pendiente" : "encargos tuyos pendientes"} para el próximo turno.`);
  // Un fallo suelto lo arregla la Repesca: solo se nombra a quien falla dos días seguidos
  const seguidos = todos.filter((e) => fallanSeguido.includes(e.id));
  if (seguidos.length) lineas.push(`Fallan dos días seguidos: ${seguidos.map((e) => e.nombre).join(", ")}. Mira el motivo en su ficha.`);
  else if (error.length) lineas.push(`${error.length === 1 ? "Uno ha tenido" : `${error.length} han tenido`} algún fallo suelto: la Repesca se encarga.`);
  if (gasto?.hoy > LIMITE_DIA_EUROS) lineas.push(`⚠️ La IA lleva ${euros(gasto.hoy)} hoy, más de ${euros(LIMITE_DIA_EUROS)}. Mira la tarjeta de gasto.`);
  const descansan = cuenta("descanso");
  if (descansan.length) lineas.push(`De descanso: ${descansan.map((e) => e.nombre).join(", ")}.`);
  if (tarde.length) lineas.push(`Van con retraso: ${tarde.map((e) => e.nombre).join(", ")}.${jefe?.repetido ? " Ya he mandado repetir uno." : " Los mando repetir en mi próxima ronda."}`);
  if (!error.length && !tarde.length) lineas.push("Todo el mundo ha cumplido su turno.");
  // Con una semana de datos ya se ve quién busca mucho para nada
  const flojos = todos.filter((e) => e.rinde?.dias >= 7 && e.rinde.busquedas >= 10 && e.rinde.nuevos === 0);
  if (flojos.length) lineas.push(`En ${Math.max(...flojos.map((e) => e.rinde.dias))} días no han traído nada nuevo: ${flojos.map((e) => e.nombre).join(", ")}. Se les puede bajar el ritmo.`);

  return {
    departamentos,
    jefe: {
      lineas,
      ronda: jefe?.fin || null,
      cifras: { gasto, equipo: todos.length, alDia: cuenta("ok").length, tarde: tarde.length, error: error.length, encontrados, bandeja, agenda, gastoMes, sinConfirmar },
    },
  };
}
