// ============ LIGA CAZURRA: cierre de semana ============
// Lo llama un cron cada día (vercel.json, /api/liga/cierre). Si una semana con premios cerró hace menos de 3 días:
// saca los 5 primeros, manda a cada uno su correo de enhorabuena con su premio y su código, y le pasa a Alejandro
// la lista por Telegram (apodo, puntos, código, correo). Cada ganador recibe su correo una sola vez.
import { leerJSON, guardarJSON } from "../almacen";
import { enviarTelegram, leerDueno, telegramConfigurado } from "../telegram";
import { cierreSemana, momentoJornada } from "./calendario";
import { correoConfigurado, correoGanador, fechaLarga, mandarCorreo } from "./correo";
import { ganadoresDe, semanaCerrada } from "./ganadores";
import { PREMIOS } from "./premios";

const DIAS_PARA_AVISAR = 3;

async function avisarAlejandro(texto, deps) {
  try {
    if (deps.telegram) return await deps.telegram(texto);
    if (!telegramConfigurado()) return;
    const chat = await leerDueno();
    if (chat) await enviarTelegram(chat, texto);
  } catch (e) { console.error("[liga cierre] telegram:", e?.message || e); }
}

export function semanasPorAvisar(ahora = Date.now()) {
  return Object.keys(PREMIOS).filter((inicio) => semanaCerrada(inicio, ahora)
    && ahora < Date.parse(momentoJornada(cierreSemana(inicio))) + DIAS_PARA_AVISAR * 86400000);
}

// deps (para las pruebas): { leer, guardar, mandar, telegram, env }
export async function cerrarSemanas(s, ahora = Date.now(), deps = {}) {
  const env = deps.env || process.env;
  const leer = deps.leer || leerJSON, guardar = deps.guardar || guardarJSON;
  const mandar = deps.mandar || ((para, c) => mandarCorreo(para, c, env));
  const informe = [];
  for (const inicio of semanasPorAvisar(ahora)) {
    const clave = `liga:avisados:${inicio}`;
    let hechos;
    try { hechos = (await leer(clave)) || {}; } catch (e) {
      // Sin saber a quién se avisó ya, mejor no mandar nada (no repetir correos): se reintenta mañana.
      await avisarAlejandro(`Liga Cazurra: no he podido mirar a quién se avisó ya (${e?.message || e}). Mañana lo reintento.`, deps);
      informe.push({ inicio, error: "almacén" });
      continue;
    }
    const ganadores = await ganadoresDe(s, inicio, { ahora });
    const cierre = cierreSemana(inicio);
    if (!ganadores.length) {
      if (!hechos.vacia) {
        await avisarAlejandro(`Liga Cazurra (semana del ${fechaLarga(inicio)}): cerrada sin nadie en el ranking. No hay premios que dar.`, deps);
        await guardar(clave, { ...hechos, vacia: true }, 60 * 86400).catch(() => null);
      }
      informe.push({ inicio, ganadores: 0 });
      continue;
    }
    const puedeMandar = correoConfigurado(env);
    const lineas = [];
    let nuevos = 0;
    for (const g of ganadores) {
      const ya = hechos[g.puesto];
      let estado = ya ? `correo ya enviado (${ya.correo})` : "";
      if (!ya) {
        let correo = null;
        try { correo = await s.correoDe(g.jugador); } catch (e) { estado = `no pude leer su correo: ${e?.message || e}`; }
        if (correo && puedeMandar) {
          try {
            await mandar(correo, correoGanador(g, { desde: inicio, cierre }));
            hechos[g.puesto] = { correo, codigo: g.codigo, enviado: new Date(ahora).toISOString() };
            await guardar(clave, hechos, 60 * 86400);
            estado = `correo enviado a ${correo}`; nuevos++;
          } catch (e) { estado = `no se pudo mandar el correo a ${correo} (${e?.message || e}); mañana se reintenta`; }
        } else if (correo) estado = `correo SIN mandar (falta LIGA_SMTP_USUARIO / LIGA_SMTP_CLAVE en Vercel): ${correo}`;
        else if (!estado) estado = "cuenta sin correo (¿la borró?)";
      }
      lineas.push(`${g.puesto}.º ${g.apodo} · ${g.puntos} pts · ${g.codigo}\n   ${g.premio.titulo}: ${g.premio.negocios.map((n) => n.nombre).join(" + ")}\n   ${estado}`);
    }
    // A Alejandro solo le escribimos cuando hay algo nuevo (o falta configurar el correo)
    if (nuevos || !puedeMandar || lineas.some((l) => l.includes("no se pudo") || l.includes("no pude"))) {
      await avisarAlejandro(`🏆 Liga Cazurra: ganadores de la semana del ${fechaLarga(inicio)} al ${fechaLarga(cierre)}\n\n${lineas.join("\n\n")}\n\nPasa a cada negocio el código de su ganador. Se comprueba en cazurronics.es/liga/premio.html`, deps);
    }
    informe.push({ inicio, ganadores: ganadores.length, nuevos });
  }
  return informe;
}
