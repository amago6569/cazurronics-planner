import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { leerJSON } from "../../../lib/almacen";
import { idPlanValido } from "../../../lib/votos";

export const alt = "Plan de Cazurronics Planner en León";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// La imagen que aparece al compartir el enlace: rosetón + las paradas del plan
export default async function Imagen({ params }) {
  const { id } = await params;
  const plan = idPlanValido(id) ? await leerJSON(`plan:${id}`) : null;
  const roseton = `data:image/png;base64,${(await readFile(join(process.cwd(), "public", "roseton.png"))).toString("base64")}`;
  const paradas = (plan?.itinerario || []).slice(0, 4);
  const fecha = plan ? new Date(`${plan.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #fff1e6 0%, #ffe4e6 45%, #e0f2fe 100%)", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 360, alignItems: "center" }}>
          <div style={{ display: "flex", width: 300, height: 300, borderRadius: 300, overflow: "hidden", border: "10px solid white", boxShadow: "0 30px 60px rgba(244,63,94,0.35)" }}>
            <img src={roseton} width={300} height={300} style={{ objectFit: "cover" }} alt="" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingLeft: 40 }}>
          <div style={{ display: "flex", fontSize: 26, color: "#e11d48", fontWeight: 700, letterSpacing: 4 }}>CAZURRONICS PLANNER</div>
          <div style={{ display: "flex", fontSize: 58, color: "#0f172a", fontWeight: 800, lineHeight: 1.05, marginTop: 10 }}>
            {plan ? `Plan en ${plan.zona || "León"}` : "Tu planazo en León"}
          </div>
          {fecha && <div style={{ display: "flex", fontSize: 28, color: "#64748b", marginTop: 8 }}>{fecha}</div>}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
            {paradas.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
                <div style={{ display: "flex", width: 44, height: 44, borderRadius: 44, background: "linear-gradient(135deg, #fb7185, #f97316)", color: "white", fontSize: 24, fontWeight: 800, alignItems: "center", justifyContent: "center", marginRight: 18 }}>{i + 1}</div>
                <div style={{ display: "flex", fontSize: 30, color: "#0f172a", fontWeight: 600 }}>{`${p.hora} · ${p.titulo}`.slice(0, 42)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#f97316", fontWeight: 700, marginTop: 34 }}>Entra y vota las paradas con tu grupo →</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
