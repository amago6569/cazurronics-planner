import { NextResponse } from "next/server";
import { renovarTokenSiToca, guardarFotoInstagram, instagramConfigurado } from "../../../../lib/instagram";
import { enviarTelegram, leerDueno, telegramConfigurado } from "../../../../lib/telegram";
import { resumenSemanal } from "../../../../lib/asesor";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel cada mañana (ver vercel.json):
// 1) guarda la foto de las cifras de Instagram del día (y renueva el token una vez por semana);
// 2) los lunes te manda por Telegram el resumen de la semana con una recomendación.
// Si falta alguna variable, se salta esa parte sin fallar.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  const hecho = { instagram: "sin token", resumen: "no toca" };
  if (await instagramConfigurado()) {
    try {
      await renovarTokenSiToca();
      const foto = await guardarFotoInstagram();
      hecho.instagram = `guardado (${foto.seguidores} seguidores, ${foto.publicaciones.length} publicaciones)`;
    } catch (e) {
      console.error("[telegram-diario] instagram", e?.message || e);
      hecho.instagram = `error: ${String(e?.message || e).slice(0, 200)}`;
    }
  }
  const lunes = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(new Date()) === "Mon";
  const dueno = lunes && telegramConfigurado() ? await leerDueno() : null;
  if (dueno) {
    try {
      await enviarTelegram(dueno, `📊 Resumen de la semana\n\n${await resumenSemanal()}`);
      hecho.resumen = "enviado";
    } catch (e) {
      console.error("[telegram-diario] resumen", e?.message || e);
      hecho.resumen = `error: ${String(e?.message || e).slice(0, 200)}`;
    }
  }
  return NextResponse.json({ exito: true, ...hecho });
}
