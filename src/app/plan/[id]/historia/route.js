/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { leerJSON } from "../../../../lib/almacen";
import { idPlanValido } from "../../../../lib/votos";

// La historia vertical (1080×1920) de un plan, para que el usuario la suba a Instagram
// con la mención a @cazurronics. Mismo estilo que la historia del finde (/api/finde/imagen).
const ROSA = "#e11d48", NARANJA = "#f97316", TINTA = "#0f172a", GRIS = "#475569";
const FONDO = "linear-gradient(160deg, #fff1e6 0%, #ffe4e6 42%, #e0f2fe 100%)";
const tarjeta = { display: "flex", background: "rgba(255,255,255,0.82)", border: "3px solid white", boxShadow: "0 18px 40px -18px rgba(15,23,42,0.35)" };

// Rosetón y tipografías se leen del disco una vez por servidor
let recursosEnMemoria;
const cargarRecursos = () => (recursosEnMemoria ||= leerRecursos().catch((e) => { recursosEnMemoria = undefined; throw e; }));

async function leerRecursos() {
  const leer = (f) => readFile(join(process.cwd(), "public", f));
  const [roseton, negrita, media] = await Promise.all([
    leer("roseton.png"),
    leer("fonts/Fredoka-Bold.ttf").catch(() => null),
    leer("fonts/Fredoka-Medium.ttf").catch(() => null),
  ]);
  const fonts = [];
  if (negrita) fonts.push({ name: "Fredoka", data: negrita, weight: 700, style: "normal" });
  if (media) fonts.push({ name: "Fredoka", data: media, weight: 500, style: "normal" });
  return { roseton: `data:image/png;base64,${roseton.toString("base64")}`, fonts };
}

const corta = (t, n) => { const s = String(t || "").trim(); return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s; };

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!idPlanValido(id)) return new Response("Plan no válido", { status: 404 });
  try {
    const [plan, { roseton, fonts }] = await Promise.all([leerJSON(`plan:${id}`), cargarRecursos()]);
    if (!plan?.itinerario?.length) return new Response("Plan no encontrado", { status: 404 });
    const paradas = plan.itinerario.slice(0, 5);
    const fecha = new Date(`${plan.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });

    return new ImageResponse(
      (
        <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", background: FONDO, padding: "150px 76px 190px", fontFamily: "Fredoka, sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 96, height: 96, borderRadius: 96, overflow: "hidden", border: "4px solid white" }}>
              <img src={roseton} width={96} height={96} style={{ objectFit: "cover" }} alt="" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: TINTA }}>Cazurronics</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: GRIS }}>@cazurronics</div>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: ROSA, letterSpacing: 5, marginTop: 90 }}>MI PLAN EN {String(plan.zona || "León").toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: TINTA, lineHeight: 1.02, marginTop: 14 }}>Me lo ha montado la IA</div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 500, color: GRIS, marginTop: 20 }}>{fecha}</div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 60 }}>
            {paradas.map((p, i) => (
              <div key={i} style={{ ...tarjeta, alignItems: "center", borderRadius: 40, padding: "26px 30px", marginTop: i ? 22 : 0 }}>
                <div style={{ display: "flex", width: 72, height: 72, borderRadius: 72, background: `linear-gradient(135deg, #fb7185, ${NARANJA})`, color: "white", fontSize: 36, fontWeight: 700, alignItems: "center", justifyContent: "center", marginRight: 26 }}>{i + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: NARANJA }}>{p.hora || ""}</div>
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: TINTA, lineHeight: 1.1 }}>{corta(p.titulo, 30)}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ ...tarjeta, borderRadius: 999, alignSelf: "center", padding: "22px 44px", fontSize: 38, fontWeight: 700, color: TINTA }}>Pide el tuyo gratis en cazurronics.es</div>
        </div>
      ),
      { width: 1080, height: 1920, fonts, headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (e) {
    return new Response(`No se pudo crear la imagen: ${e.message}`, { status: 500 });
  }
}
