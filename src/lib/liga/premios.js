// ============ LIGA CAZURRA: premios de cada semana y códigos de los ganadores ============
// Los premios los ponen los negocios (Panel → Negocios → «Premios de la Liga»). Aquí van ya agrupados en packs
// del 1.º al 5.º puesto, tal como los aprobó Alejandro el 13-11-2026. Sin precios en euros.
// Para una semana nueva: añade otra entrada con la fecha del sábado en que empieza.
// Si entra el gimnasio que falta por confirmar, va al 5.º puesto junto a Momentos Coquette (regla de Alejandro, 13-11-2026).

export const PREMIOS = {
  "2026-11-14": [
    {
      puesto: 1, titulo: "Belleza y bienestar",
      texto: "Masaje facial (1 h) + masaje corporal (1 h) en Ataraxia con un 55 % de descuento y un neceser Eros con máscara de pestañas Revitalash.",
      negocios: [
        { nombre: "Ataraxia Beauty Balance", logo: "/liga/premios/ataraxia.jpg", instagram: "ataraxiabeautybalance" },
        { nombre: "Eros perfumería", logo: "/liga/premios/eros.jpg", instagram: "eros_perfumeria" },
      ],
    },
    {
      puesto: 2, titulo: "Detalle para regalar",
      texto: "Un ramo de flores de Floristería La Cala y un 20 % de descuento en Navarín Joyeros.",
      negocios: [
        { nombre: "Floristería La Cala", logo: "/liga/premios/la-cala.jpg", instagram: "floristerialacala" },
        { nombre: "Navarín Joyeros", logo: "/liga/premios/navarin.jpg", instagram: "navarin.joyeros" },
      ],
    },
    {
      puesto: 3, titulo: "Celebra y sal",
      texto: "Tu celebración con el local al 50 % en La Vuelta al Sol y entradas sin gastos de gestión en SBS Tickets.",
      negocios: [
        { nombre: "La Vuelta al Sol", logo: "/liga/premios/vuelta-al-sol.jpg", instagram: "lavueltaalsol_leon" },
        { nombre: "SBS Tickets", logo: "/liga/premios/sbs.jpg", instagram: "sbstickets" },
      ],
    },
    {
      puesto: 4, titulo: "Estilo",
      texto: "Descuento en una camiseta de ESGAYA y un 20 % de descuento en León en mí.",
      negocios: [
        { nombre: "ESGAYA", logo: "/liga/premios/esgaya.jpg", instagram: "esgaya.brand" },
        { nombre: "León en mí", logo: "/liga/premios/leon-en-mi.jpg", instagram: "leon_en_mi" },
      ],
    },
    {
      puesto: 5, titulo: "Un capricho",
      texto: "Un 10 % de descuento en Momentos Coquette.",
      negocios: [
        { nombre: "Momentos Coquette", logo: "/liga/premios/coquette.jpg", instagram: "momentos.coquette" },
      ],
    },
  ],
};

export function premiosDeSemana(inicio) { return PREMIOS[inicio] || null; }

// ─── Códigos de premio ───
// Cada ganador recibe un código que sale de una firma secreta (semana, puesto y su cuenta): no se puede inventar
// y se comprueba sin guardar nada, repitiendo el ranking final de esa semana. Formato: CZ-1ABCD-EFGH (el número es el puesto).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para que no se confundan

export function secretoCodigos(env = process.env) {
  return env.LIGA_CODIGOS_SECRETO || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || (env.NODE_ENV === "production" ? "" : "local");
}

export async function codigoPremio(semana, puesto, jugador, secreto = secretoCodigos()) {
  if (!secreto) throw new Error("falta el secreto de los códigos");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(secreto)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`liga-premio-v1|${semana}|${puesto}|${jugador}`)));
  let letras = "";
  for (let i = 0; i < 8; i++) letras += ALFABETO[f[i] % ALFABETO.length];
  return `CZ-${puesto}${letras.slice(0, 4)}-${letras.slice(4)}`;
}

// Lo que escribe la gente: minúsculas, espacios, guiones de más… → CZ-1ABCD-EFGH (o null si no lo parece)
export function limpiarCodigoPremio(texto) {
  const t = String(texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^CZ([1-9])([A-Z2-9]{4})([A-Z2-9]{4})$/.exec(t);
  return m ? `CZ-${m[1]}${m[2]}-${m[3]}` : null;
}
