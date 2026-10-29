// ============ NOMBRES DE SITIOS ============
// Comparar el nombre que pone la IA con el de la ficha de Google, y dejar el de Google presentable.
// Va aparte para que lo usen a la vez lugares.js y planUtils.js sin importarse el uno al otro.

export function slug(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const PALABRAS_VACIAS = new Set(["bar", "restaurante", "cafeteria", "cafe", "pub", "taberna", "mesón", "meson", "de", "del", "la", "el", "los", "las", "y", "en", "leon", "casa", "museo"]);
const palabras = (t) => slug(t).split("-").filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));

// "Mesón El Abuelo" y "MESON EL ABUELO - Boñar" se parecen; "Bar La Fuente" y "Restaurante Casa Pepe", no
export const seParecen = (a, b) => {
  const sa = slug(a), sb = slug(b);
  if (!sa || !sb) return false;
  if (sa.includes(sb) || sb.includes(sa)) return true;
  const pb = new Set(palabras(b));
  return palabras(a).some((w) => pb.has(w));
};

// Nombre de Google más presentable: si viene todo en mayúsculas, a minúsculas con inicial en cada palabra
export const bonito = (n) => {
  const s = String(n || "").trim();
  if (!s || s !== s.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s\-(])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase()).replace(/ (De|Del|Y|En) /g, (m, w) => " " + w.toLowerCase() + " ");
};
