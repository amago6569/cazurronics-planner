// ============ EL MENSAJE A CADA LOCAL ============
// Lo comparten el parte del jefe por Telegram (lib/jefe) y «Hoy te toca» del panel de la oficina:
// qué texto se le manda (el borrador que cambiaste o el de siempre), por dónde y el enlace que lo abre.
// Nada de esto envía nada: el mensaje lo mandas tú desde Instagram o Gmail.
import { comando } from "./almacen";
import { DOMINIO } from "./captacion";

const MAX_TARJETAS = 3;
export const BORRADOR = (clave) => `captacion:borrador:${clave}`;
export const canal = (l) => (l.instagram ? "instagram" : l.email ? "correo" : null);

export function textoBase(l, recordar) {
  const m = l.mensajes;
  if (recordar) return canal(l) === "correo" ? m.recordatorioCorreo : m.recordatorioChat;
  return canal(l) === "correo" ? m.correoCorto : m.chat;
}

// Enlace que abre el mensaje ya escrito para que lo mandes tú
export function enlaceEnviar(l, texto, recordar) {
  if (canal(l) === "instagram") return { url: `https://ig.me/m/${l.instagram}`, nota: "Copia el mensaje de arriba y pégalo en el chat de Instagram que se abre." };
  if (canal(l) === "correo") {
    const asunto = recordar ? l.mensajes.asuntoRecordatorio : l.mensajes.asuntoCorto;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(l.email)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
    return url.length < 1900 ? { url, nota: "Se abre Gmail con el correo escrito: revisa y pulsa Enviar." } : { url: `${DOMINIO}/panel#captacion`, nota: "El correo es largo para un enlace: ábrelo desde el panel." };
  }
  return null;
}

// Las tarjetas de «Hoy te toca»: los locales listos y los que toca recordar, con el mensaje y el enlace puestos.
// g = lo que devuelve listarCaptacion(). Solo lee del almacén (0 €).
export async function tarjetasPanel(g) {
  const lista = [
    ...g.listos.slice(0, MAX_TARJETAS).map((l) => ({ l, recordar: false })),
    ...g.seguimiento.filter((l) => l.toca).slice(0, MAX_TARJETAS).map((l) => ({ l, recordar: true })),
  ];
  const borradores = await Promise.all(lista.map(({ l }) => comando(["GET", BORRADOR(l.clave)]).catch(() => null)));
  return lista.map(({ l, recordar }, i) => {
    const texto = borradores[i] || textoBase(l, recordar) || "";
    const abrir = enlaceEnviar(l, texto, recordar);
    return {
      clave: l.clave, nombre: l.nombre, tipo: l.tipo, recordar, texto,
      apariciones: l.stats?.apariciones || 0, fichas: l.stats?.detalle || 0,
      via: canal(l) === "instagram" ? `Instagram @${l.instagram}` : canal(l) === "correo" ? l.email : null,
      enlace: abrir?.url || null, nota: abrir?.nota || null,
    };
  });
}
