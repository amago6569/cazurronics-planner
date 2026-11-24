// Genera src/lib/municipiosFuera.js: los municipios de España que no son de la provincia de León.
// Uso (no hace falta instalar nada en el proyecto):
//   npm pack spanish-cities-info@2.4.2 && tar -xzf spanish-cities-info-2.4.2.tgz
//   node scripts/generar-municipios-fuera.cjs src/lib/municipiosFuera.js package/dist/data/cities.json
const fs = require("fs");
const path = require("path");
const c = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), "utf8"));
const n = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
const ARTICULO = /^(.*), (el|la|los|las|l|o|a|os|as|es|sa|lo|ses|els|les)$/i;
const variantes = (nom) => {
  const out = new Set();
  for (const parte of String(nom).split("/")) {
    let p = parte.trim();
    const m = p.match(ARTICULO);
    if (m) p = `${m[2]} ${m[1]}`;
    out.add(n(p));
    // «Burgo de Osma-Ciudad de Osma»: cada mitad también, si tiene más de una palabra
    if (p.includes("-")) for (const mitad of p.split("-")) if (mitad.trim().split(/\s+/).length > 1) out.add(n(mitad));
  }
  return [...out].filter((x) => x.length >= 4);
};
const provs = Object.keys(c);
const leonKey = provs.find((p) => n(p) === "leon");
const deLeon = new Set(c[leonKey].flatMap((x) => variantes(x[0])));
// Comarcas y valles de León que también son municipios de otra provincia (La Cabrera en Madrid, Luna en Zaragoza…)
const COMARCAS = ["bierzo", "el bierzo", "cabrera", "la cabrera", "luna", "babia", "laciana", "omana", "la omana", "maragateria", "la maragateria",
  "paramo", "el paramo", "orbigo", "ribera del orbigo", "montana leonesa", "tierra de campos", "valdeburon", "los arguellos", "arguellos", "gordon",
  "cepeda", "la cepeda", "ancares", "los ancares", "valduerna", "la valduerna", "jamuz", "valdeorras", "sil", "esla", "porma", "curueno", "torio", "bernesga",
  // pueblos de León (no municipios) que se llaman igual que un municipio de fuera
  "el acebo", "acebo", "robledo", "canales", "castro", "villanueva", "quintanilla", "san isidoro", "otero", "vega", "la vega", "villar",
  "fornela", "somoza", "la somoza", "tierras de leon", "riberas", "riaño", "riano", "valdejamuz", "la sobarriba", "sobarriba", "la ribera", "ribera"];
const sinArticulo = (x) => x.replace(/^(el|la|los|las) /, "");
// También sin el artículo: «La Antigua» es de León y «Antigua» un municipio de Las Palmas
const quitar = new Set([...deLeon, ...[...deLeon].map(sinArticulo), ...COMARCAS.map(n), ...COMARCAS.map(n).map(sinArticulo)]);
const fuera = new Set();
for (const p of provs) if (p !== leonKey) for (const x of c[p]) for (const v of variantes(x[0])) if (!quitar.has(v)) fuera.add(v);
const lista = [...fuera].sort();
const salida = `// Los municipios de España que NO son de la provincia de León (${lista.length} nombres, sin tildes y en minúsculas).
// Datos del INE, paquete spanish-cities-info 2.4.2 (licencia ISC). Generado una vez; quitados los nombres que también
// son de León (municipios y comarcas: La Cabrera, Luna, Babia…). Solo lo usa el servidor (lib/eventos.js): no va al navegador.
// Sirve para apartar de la agenda lo que la IA trae de otras provincias con un pueblo que no está en la lista de siempre
// (Valdemoro, Ciudad Rodrigo, Astudillo… el 24-11-2026).
export const MUNICIPIOS_FUERA = new Set(${JSON.stringify(lista.join("|"))}.split("|"));
`;
fs.writeFileSync(process.argv[2], salida);
console.log("nombres", lista.length, "bytes", salida.length, "deLeon", deLeon.size);
