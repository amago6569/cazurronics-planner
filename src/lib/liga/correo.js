// ============ LIGA CAZURRA: correo de enhorabuena a los ganadores ============
// Sale de la cuenta de Strato de Cazurronics (la misma que manda los códigos de entrada de la liga).
// Variables en Vercel (si faltan, no se manda nada y a Alejandro le llega la lista por Telegram para hacerlo a mano):
//   LIGA_SMTP_USUARIO   la dirección de correo de Strato (p. ej. la de Cazurronics)
//   LIGA_SMTP_CLAVE     su contraseña
//   LIGA_SMTP_HOST      (opcional) smtp.strato.de
//   LIGA_SMTP_PUERTO    (opcional) 465
// Cada correo va con copia oculta a esa misma dirección, para que Alejandro tenga todos en su buzón.

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fechaLarga = (d) => { const [, m, dd] = d.split("-").map(Number); return `${dd} de ${MESES[m - 1]}`; };

export function correoConfigurado(env = process.env) { return Boolean(env.LIGA_SMTP_USUARIO && env.LIGA_SMTP_CLAVE); }

// El correo de un ganador: { asunto, texto, html }
export function correoGanador({ apodo, puesto, codigo, premio }, { desde, cierre }) {
  const negocios = premio.negocios.map((n) => n.nombre).join(" y ");
  const ig = (n) => (n.instagram ? `https://instagram.com/${n.instagram}` : "");
  const mensaje = `Hola, soy ${apodo} y he quedado ${puesto}.º en la Liga Cazurra de Cazurronics. Mi código de ganador es ${codigo}.`;
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
    `1. Escribe por Instagram a cada negocio de tu premio (${negocios}) en los próximos 7 días:`,
    ...premio.negocios.map((n) => `   · ${n.nombre}${n.instagram ? `: @${n.instagram} (${ig(n)})` : ""}`),
    "2. Diles que has ganado en la Liga Cazurra de Cazurronics y mándales tu código. Puedes copiar esto:",
    `   «${mensaje}»`,
    "3. Ellos comprueban el código y te dicen cómo recoger tu premio.",
    "",
    "¿Algún problema? Contesta a este correo.",
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
    <li>Escribe por Instagram a cada negocio de tu premio en los próximos 7 días:
      <ul style="margin:6px 0;padding-left:18px">${premio.negocios.map((n) => `<li><b>${esc(n.nombre)}</b>${n.instagram ? `: <a href="${esc(ig(n))}">@${esc(n.instagram)}</a>` : ""}</li>`).join("")}</ul>
    </li>
    <li>Diles que has ganado en la Liga Cazurra de Cazurronics y mándales tu código. Puedes copiar esto:
      <p style="margin:6px 0;padding:10px 14px;border-left:3px solid #b07d1a;background:#f6efe1">${esc(mensaje)}</p>
    </li>
    <li>Ellos comprueban el código y te dicen cómo recoger tu premio.</li>
  </ol>
  <p style="margin:12px 0 0">¿Algún problema? Contesta a este correo.</p>
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
