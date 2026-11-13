// ============ LIGA CAZURRA: correo de enhorabuena a los ganadores ============
// Sale de la cuenta de Strato de Cazurronics (la misma que manda los códigos de entrada de la liga).
// Variables en Vercel (si faltan, no se manda nada y a Alejandro le llega la lista por Telegram para hacerlo a mano):
//   LIGA_SMTP_USUARIO   la dirección de correo de Strato (p. ej. la de Cazurronics)
//   LIGA_SMTP_CLAVE     su contraseña
//   LIGA_SMTP_HOST      (opcional) smtp.strato.de
//   LIGA_SMTP_PUERTO    (opcional) 465
// Cada correo va con copia oculta a esa misma dirección, para que Alejandro tenga todos en su buzón.
import { DOMINIO_LIGA } from "./textos";

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fechaLarga = (d) => { const [, m, dd] = d.split("-").map(Number); return `${dd} de ${MESES[m - 1]}`; };

export function correoConfigurado(env = process.env) { return Boolean(env.LIGA_SMTP_USUARIO && env.LIGA_SMTP_CLAVE); }

// El correo de un ganador: { asunto, texto, html }
export function correoGanador({ apodo, puesto, codigo, premio }, { desde, cierre }) {
  const enlace = `${DOMINIO_LIGA}/liga/premio.html?c=${encodeURIComponent(codigo)}`;
  const negocios = premio.negocios.map((n) => n.nombre).join(" y ");
  const asunto = `🏆 ¡Enhorabuena, ${apodo}! Has quedado ${puesto}.º en la Liga Cazurra`;
  const texto = [
    `¡Enhorabuena, ${apodo}!`,
    "",
    `Has quedado ${puesto}.º en la Liga Cazurra (del sábado ${fechaLarga(desde)} al sábado ${fechaLarga(cierre)}).`,
    "",
    `Tu premio: ${premio.texto}`,
    "",
    `Tu código: ${codigo}`,
    "",
    "Cómo canjearlo:",
    "1. Contesta a este correo (o escríbenos por Instagram a @cazurronics) en los próximos 7 días.",
    `2. Te ponemos en contacto con ${negocios}.`,
    "3. Enseña tu código en el negocio. Ellos ya saben que es el bueno.",
    "",
    `Cualquiera puede comprobar el código aquí: ${enlace}`,
    "",
    "Gracias por jugar. Nos vemos en la próxima liga.",
    "Cazurronics",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#16131b;line-height:1.5">
  <p style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b07d1a;margin:0 0 6px">Liga Cazurra</p>
  <h1 style="font-size:28px;margin:0 0 12px">¡Enhorabuena, ${esc(apodo)}!</h1>
  <p>Has quedado <b>${puesto}.º</b> en la Liga Cazurra (del sábado ${fechaLarga(desde)} al sábado ${fechaLarga(cierre)}).</p>
  <p style="margin:18px 0 6px;font-weight:700">Tu premio</p>
  <p style="margin:0;padding:14px 16px;border-radius:14px;background:#f6efe1">${esc(premio.texto)}</p>
  <p style="margin:18px 0 6px;font-weight:700">Tu código</p>
  <p style="margin:0;font-size:30px;font-weight:900;letter-spacing:.08em;font-family:ui-monospace,Menlo,monospace">${esc(codigo)}</p>
  <p style="margin:18px 0 6px;font-weight:700">Cómo canjearlo</p>
  <ol style="margin:0;padding-left:20px">
    <li>Contesta a este correo (o escríbenos por Instagram a @cazurronics) en los próximos 7 días.</li>
    <li>Te ponemos en contacto con ${esc(negocios)}.</li>
    <li>Enseña tu código en el negocio. Ellos ya saben que es el bueno.</li>
  </ol>
  <p style="margin:18px 0 0;font-size:14px;color:#5b554c">Cualquiera puede comprobar el código aquí: <a href="${esc(enlace)}">${esc(enlace.replace(/^https?:\/\//, ""))}</a></p>
  <p style="margin:24px 0 0">Gracias por jugar. Nos vemos en la próxima liga.<br>Cazurronics</p>
</div>`;
  return { asunto, texto, html };
}

let transporte = null;
async function transportar(env) {
  if (transporte) return transporte;
  const { default: nodemailer } = await import("nodemailer");
  const puerto = Number(env.LIGA_SMTP_PUERTO) || 465;
  transporte = nodemailer.createTransport({
    host: env.LIGA_SMTP_HOST || "smtp.strato.de", port: puerto, secure: puerto === 465,
    auth: { user: env.LIGA_SMTP_USUARIO, pass: env.LIGA_SMTP_CLAVE },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return transporte;
}

export async function mandarCorreo(para, { asunto, texto, html }, env = process.env) {
  const t = await transportar(env);
  const de = env.LIGA_SMTP_USUARIO;
  await t.sendMail({ from: { name: "Liga Cazurra", address: de }, to: para, bcc: de, replyTo: de, subject: asunto, text: texto, html });
}
