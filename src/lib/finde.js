// ============ RESUMEN DEL FINDE ============
// Elige lo mejor del próximo fin de semana (viernes, sábado y domingo) a partir de la agenda que ya
// han barrido los crons. No gasta nada en IA: puntúa cada plan, no repite y reparte por tipo.
// De aquí salen: la página /finde, los textos para WhatsApp e Instagram y las imágenes del carrusel.
import { cuandoEs, deduplicar, esDeVariosDias, familia, leerHora, ordenarPorHora } from "./agenda";
import { zonaDe, zonaPorId } from "./zonas";

// Dirección pública para los textos que se copian y pegan (en local no queremos "localhost")
export const DOMINIO = (process.env.NEXT_PUBLIC_SITE_URL || "https://cazurronics.es").replace(/\/$/, "");

const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ICONOS = { mercado: "🧺", musica: "🎶", expo: "🖼️", escena: "🎭", fiesta: "🎉", feria: "🎪", visita: "🚶", deporte: "⚽", gastro: "🍷", infantil: "🧸" };
const HASHTAGS = "#leon #queHacerEnLeon #planesenleon #findeenleon #leonespaña #barriohumedo #cazurronics";

const dow = (f) => new Date(`${f}T12:00:00Z`).getUTCDay();
const numDia = (f) => Number(f.slice(8, 10));
const mesCorto = (f) => MESES[Number(f.slice(5, 7)) - 1];
export const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const sumar = (f, n) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const corto = (t, max) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cortado = s.slice(0, max - 1);
  return `${cortado.slice(0, Math.max(cortado.lastIndexOf(" "), max - 12)).trim()}…`;
};

// Los días del próximo fin de semana: de lunes a jueves, el viernes que viene; viernes: los tres días;
// sábado: sábado y domingo; domingo: el fin de semana siguiente (el de hoy ya se acaba).
export function fechasDelFinde(hoy) {
  const d = dow(hoy);
  if (d === 5) return [hoy, sumar(hoy, 1), sumar(hoy, 2)];
  if (d === 6) return [hoy, sumar(hoy, 1)];
  const viernes = sumar(hoy, d === 0 ? 5 : 5 - d);
  return [viernes, sumar(viernes, 1), sumar(viernes, 2)];
}

export const diaCortoDe = (fecha) => DIA_CORTO[dow(fecha)];

export function rangoTexto(fechas) {
  const a = fechas[0], b = fechas[fechas.length - 1];
  if (a === b) return `${DIA_CORTO[dow(a)]} ${numDia(a)} ${mesCorto(a)}`;
  return `${DIA_CORTO[dow(a)]} ${numDia(a)}${mesCorto(a) !== mesCorto(b) ? ` ${mesCorto(a)}` : ""} – ${DIA_CORTO[dow(b)]} ${numDia(b)} ${mesCorto(b)}`;
}

// ---------- Elegir lo mejor ----------
const GRATIS = /grat|libre/i;
const ES_CAPITAL = (e) => ["leon", "alfoz"].includes(zonaDe(e));

// Más puntos = más ganas de compartirlo: con hora y sitio claros, de fuente fiable, gratis, de tarde o de noche
export function puntuar(e) {
  const h = leerHora(e.hora);
  return (e.origen === "jcyl" ? 2 : 0) + (e.verificado ? 1 : 0) + (h.min != null ? 2 : 0) + (e.lugar ? 1 : 0)
    + (GRATIS.test(e.precio || "") ? 1 : 0) + (e.descripcion ? 1 : 0)
    + (["musica", "escena", "fiesta", "feria", "gastro"].includes(familia(e)) ? 1 : 0)
    + (h.min != null && h.min >= 17 * 60 ? 1 : 0);
}

// Los mejores n, sin pasarse de "max" del mismo tipo (que no sean todo conciertos), luego por hora
function elegir(lista, n, { max = 2, por = (e) => familia(e) || "otro" } = {}) {
  const cuenta = {};
  const elegidos = [];
  const ordenados = lista.map((e, i) => ({ e, i, p: puntuar(e) })).sort((a, b) => b.p - a.p || a.i - b.i);
  for (const { e } of ordenados) {
    const k = por(e);
    if ((cuenta[k] || 0) >= max) continue;
    cuenta[k] = (cuenta[k] || 0) + 1;
    elegidos.push(e);
    if (elegidos.length >= n) break;
  }
  return ordenarPorHora(elegidos);
}

// Solo lo que hace falta para pintarlo (así el JSON y las páginas pesan poco)
function ficha(e, dia) {
  // Lo que dura varios días conserva su fecha de inicio (para decir "Hasta el 30 oct"); lo demás, el día en que se elige
  const fecha = esDeVariosDias(e) ? (e.fecha || dia) : (e._dia || dia || e.fecha);
  return {
    titulo: e.titulo, fecha, hora: e.hora || null, lugar: e.lugar || null, localidad: e.localidad || null,
    precio: e.precio || null, categoria: e.categoria || null, fuente: e.fuente || null,
    descripcion: e.descripcion ? String(e.descripcion).slice(0, 140) : null,
    fechaFin: e.fechaFin || null, diasSemana: e.diasSemana || null, permanente: Boolean(e.permanente),
    zona: zonaDe(e), cuando: esDeVariosDias(e) ? cuandoEs(e) : null, puntos: puntuar(e),
  };
}
export const horaInicio = (e) => { const t = leerHora(e.hora).texto; return t ? t.split("–")[0] : null; };
const icono = (e) => ICONOS[familia(e)] || "📍";

// ---------- El resumen ----------
// dias = lo que devuelve eventosProximos() · hoy = "AAAA-MM-DD" (hoy en León)
export function calcularFinde(dias, hoy) {
  const fechas = fechasDelFinde(hoy);
  const porFecha = Object.fromEntries((dias || []).map((d) => [d.fecha, d.eventos || []]));

  const brutos = fechas.map((fecha) => {
    const propios = deduplicar((porFecha[fecha] || []).filter((e) => !esDeVariosDias(e) && e.titulo));
    return { fecha, propios, capital: propios.filter(ES_CAPITAL) };
  });

  const elegidosLeon = brutos.map((d) => elegir(d.capital, 4));
  const diasPack = brutos.map((d, i) => ({
    fecha: d.fecha, nombre: NOMBRE_DIA[dow(d.fecha)], numero: numDia(d.fecha), mes: mesCorto(d.fecha),
    total: d.propios.length, leon: elegidosLeon[i].map((e) => ficha(e, d.fecha)),
  }));

  // El resto de la provincia, lo mejor de los tres días, con un máximo de dos por zona
  const provinciaTodos = brutos.flatMap((d) => d.propios.filter((e) => !ES_CAPITAL(e)).map((e) => ({ ...e, _dia: d.fecha })));
  // (por día y, dentro de cada día, por hora)
  const provincia = elegir(provinciaTodos, 5, { max: 2, por: (e) => zonaDe(e) }).map((e) => ficha(e)).sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Lo que dura varios días (exposiciones, ferias, mercados): una sola vez
  const largos = deduplicar(fechas.flatMap((f) => (porFecha[f] || []).filter((e) => esDeVariosDias(e) && e.titulo)));
  const largosCapital = largos.filter(ES_CAPITAL);
  const enMarcha = elegir(largosCapital.length >= 3 ? largosCapital : largos, 3, { max: 2 }).map((e) => ficha(e, fechas[0]));

  // Los tres que abren la portada: los mejores de la capital, de tipos distintos
  const destacados = elegir(elegidosLeon.flatMap((l, i) => l.map((e) => ({ ...e, _dia: brutos[i].fecha }))), 3, { max: 1 }).map((e) => ficha(e));

  const total = brutos.reduce((s, d) => s + d.propios.length, 0) + largos.length;
  const diapositivas = [
    { tipo: "portada" },
    ...diasPack.filter((d) => d.leon.length).map((d) => ({ tipo: "dia", fecha: d.fecha })),
    ...(provincia.length ? [{ tipo: "provincia" }] : []),
    { tipo: "cierre" },
  ];

  const pack = { hoy, fechas, rango: rangoTexto(fechas), total, hayContenido: destacados.length > 0 || provincia.length > 0 || enMarcha.length > 0, dias: diasPack, provincia, enMarcha, destacados, diapositivas };
  pack.whatsapp = textoWhatsApp(pack);
  pack.instagram = textoInstagram(pack);
  pack.imagenes = diapositivas.map((_, i) => `${DOMINIO}/api/finde/imagen?n=${i + 1}`);
  pack.historias = diapositivas.map((_, i) => `${DOMINIO}/api/finde/imagen?n=${i + 1}&f=historia`);
  return pack;
}

// ---------- Textos para copiar y pegar ----------
const lineaDia = (e) => `• ${horaInicio(e) ? `${horaInicio(e)} · ` : ""}${corto(e.titulo, 70)}${e.lugar ? ` — ${corto(e.lugar, 40)}` : ""}${e.precio ? ` (${corto(e.precio, 18)})` : ""}`;

export function textoWhatsApp(p) {
  if (!p.hayContenido) return `🦁 *Finde en León* (${p.rango})\n\nTodavía estamos cerrando la agenda. Mira lo último que hay: ${DOMINIO}/agenda-leon?ref=wa`;
  const t = [`🦁 *Lo mejor del finde en León* (${p.rango})`, ""];
  for (const d of p.dias.filter((x) => x.leon.length)) {
    t.push(`*${mayus(d.nombre)} ${d.numero}*`, ...d.leon.map(lineaDia), "");
  }
  if (p.provincia.length) {
    t.push("🏔️ *Por la provincia*");
    t.push(...p.provincia.map((e) => `• ${mayus(DIA_CORTO[dow(e.fecha)])}${horaInicio(e) ? ` ${horaInicio(e)}` : ""} · ${corto(e.titulo, 60)} — ${corto(e.localidad || zonaPorId(e.zona)?.corto || "León", 28)}`), "");
  }
  if (p.enMarcha.length) t.push(`📌 *Todo el finde*: ${p.enMarcha.map((e) => corto(e.titulo, 50)).join(" · ")}`, "");
  t.push(`👉 Todo el finde, con fuentes: ${DOMINIO}/finde?ref=wa`, `✨ ¿Sin ideas? Te monto la ruta gratis: ${DOMINIO}/?ref=wa-finde`);
  return t.join("\n");
}

export function textoInstagram(p) {
  if (!p.hayContenido) return `🦁 Estamos cerrando la agenda del finde en León.\n\nTodo lo que pasa, en el link de la bio 👆\n\n${HASHTAGS}`;
  const t = [`🦁 Lo mejor del finde en León (${p.rango})`, ""];
  for (const d of p.dias.filter((x) => x.leon.length)) {
    const dos = [...d.leon].sort((a, b) => b.puntos - a.puntos).slice(0, 2); // los dos mejores del día
    t.push(`${icono(dos[0])} ${mayus(d.nombre)}: ${dos.map((e) => corto(e.titulo, 45)).join(" + ")}`);
  }
  if (p.provincia.length) t.push(`🏔️ Y por la provincia: ${p.provincia.slice(0, 2).map((e) => `${corto(e.titulo, 36)} (${corto(e.localidad || zonaPorId(e.zona)?.corto || "León", 18)})`).join(" · ")}`);
  t.push("", "📌 Guárdalo y mándaselo a tu grupo 👇", "Todo el finde, con horas y fuentes, en el link de la bio: cazurronics.es/finde", "", HASHTAGS);
  return t.join("\n");
}
