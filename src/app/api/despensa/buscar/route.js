import { NextResponse } from "next/server";
import { buscarEnDespensa, leerPeticionDespensa } from "../../../../lib/despensaBuscar";
import { dentroDelLimite, dentroDelTopeDiario } from "../../../../lib/freno";
import { enSegundoPlano } from "../../../../lib/almacen";
import { registrar } from "../../../../lib/estadisticas";
import { mensajeParaUsuario } from "../../../../lib/gemini";

export const maxDuration = 30;

// Escribes lo que buscas y la IA elige entre las tiendas comprobadas de la Despensa (lib/despensaBuscar.js).
// Topes de serie: 15 cada 10 minutos y 60 al día por conexión; 200 al día para toda la web (DESPENSA_MAX_DIA, 0 = sin tope).
export async function POST(request) {
  try {
    const peticion = leerPeticionDespensa(await request.json().catch(() => null));
    if (peticion.error) return NextResponse.json({ exito: false, mensaje: peticion.error }, { status: 400 });
    if (!(await dentroDelLimite(request, "despensa", 15, 600)) || !(await dentroDelTopeDiario("despensa", 60, request))) {
      return NextResponse.json({ exito: false, mensaje: "Has buscado mucho seguido 🦁 Espera un poco o elige los productos aquí abajo." }, { status: 429 });
    }
    if (!(await dentroDelTopeDiario("despensa", Number(process.env.DESPENSA_MAX_DIA ?? 200)))) {
      return NextResponse.json({ exito: false, mensaje: "Hoy se han agotado las búsquedas con IA 🦁 Elige los productos aquí abajo, que eso sigue funcionando." }, { status: 429 });
    }
    const resultado = await buscarEnDespensa(peticion);
    enSegundoPlano(() => registrar("despensa"), "estadísticas");
    return NextResponse.json({ exito: true, ...resultado });
  } catch (error) {
    console.error("[despensa/buscar]", error?.message || error);
    return NextResponse.json({ exito: false, mensaje: mensajeParaUsuario(error).replace("tu plan", "tu búsqueda").replace("montando planes", "buscando") }, { status: 200 });
  }
}
