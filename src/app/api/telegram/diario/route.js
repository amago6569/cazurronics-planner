import { NextResponse } from "next/server";
import { renovarTokenSiToca, guardarFotoInstagram, instagramConfigurado } from "../../../../lib/instagram";
import { asegurarBotones, enviarTelegram, leerDueno, telegramConfigurado } from "../../../../lib/telegram";
import { parteDiario } from "../../../../lib/jefe";
import { resumenSemanal } from "../../../../lib/asesor";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel cada mañana (ver vercel.json):
// 1) guarda la foto de las cifras de Instagram del día (y renueva el token una vez por semana);
// 2) cada día te manda por Telegram el parte del jefe: lo que ha hecho el equipo, tu bandeja y los locales listos
//    para escribirles, con botones (sustituye al correo de captación);
// 3) los lunes, además, el resumen de la semana con una recomendación.
// Si falta alguna variable, se salta esa parte sin fallar.
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ exito: false, mensaje: "No autorizado" }, { status: 401 });
  }
  const hecho = { instagram: "sin token", resumen: "no toca", jefe: "sin Telegram" };
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
  const dueno = telegramConfigurado() ? await leerDueno() : null;
  if (dueno) {
    try {
      await asegurarBotones().catch((e) => console.error("[telegram-diario] botones", e?.message || e));
      const mensajes = await parteDiario();
      for (const m of mensajes) await enviarTelegram(dueno, m.texto, m.botones);
      hecho.jefe = `enviado (${mensajes.length} mensajes)`;
    } catch (e) {
      console.error("[telegram-diario] jefe", e?.message || e);
      hecho.jefe = `error: ${String(e?.message || e).slice(0, 200)}`;
    }
  }
  if (dueno && lunes) {
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
