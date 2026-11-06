// Las cifras de Inicio (/panel): suma un periodo y lo compara con el anterior. Funciones puras, sin IA.
// porDia viene de leerResumen: el primero es hoy.

export const PRESUPUESTO_IA_MES = 30; // euros

const suma = (dias, claves) => dias.reduce((s, d) => s + claves.reduce((n, k) => n + (d[k] || 0), 0), 0);

// null si no hay con qué comparar (no vale decir «sube un 100 %» si antes no se medía)
export function variacion(ahora, antes) {
  if (!antes) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}

export function cifrasPeriodo(porDia = [], dias = 14) {
  const ult = porDia.slice(0, dias), ant = porDia.slice(dias, dias * 2);
  const cifra = (...claves) => {
    const valor = suma(ult, claves);
    return { valor, cambio: variacion(valor, suma(ant, claves)) };
  };
  return {
    visitas: cifra("visita"),
    planner: suma(ult, ["visita_planner"]),
    despensa: suma(ult, ["visita_despensa"]),
    planes: cifra("plan"),
    locales: cifra("detalle", "como_llegar"),
    fichas: suma(ult, ["detalle"]),
    comoLlegar: suma(ult, ["como_llegar"]),
    llamadas: suma(ult, ["llamar"]),
    serie: [...ult].reverse().map((d) => ({ fecha: d.fecha, visitas: d.visita || 0, planes: d.plan || 0 })),
  };
}

// Un techo redondo para el eje de la gráfica: 117 → 120, 7 → 10
export function techoEje(max) {
  if (max <= 10) return 10;
  const base = 10 ** Math.floor(Math.log10(max));
  const paso = base / 2;
  return Math.ceil(max / paso) * paso;
}

// Lo que te toca hoy, en una frase. solicitudes: las que te han escrito y aún no has atendido
export function fraseHoy({ solicitudes = 0, locales = 0, fallos = 0 } = {}) {
  const negocios = solicitudes + locales;
  const partes = [];
  if (negocios) partes.push(`${negocios} ${negocios === 1 ? "negocio" : "negocios"}`);
  if (fallos) partes.push(`${fallos} ${fallos === 1 ? "empleado que falla" : "empleados que fallan"}`);
  return partes.length ? `Tienes ${partes.join(" y ")} para hoy` : "Hoy no tienes nada pendiente";
}
