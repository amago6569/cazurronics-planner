/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Cazurronics Planner · tu planazo en León";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// La imagen que sale al compartir cualquier página de la web que no tenga una propia
// (los planes compartidos y /finde tienen la suya)
export default async function Imagen() {
  const roseton = `data:image/png;base64,${(await readFile(join(process.cwd(), "public", "roseton.png"))).toString("base64")}`;
  const fonts = [];
  try {
    fonts.push({ name: "Fredoka", data: await readFile(join(process.cwd(), "public", "fonts", "Fredoka-Bold.ttf")), weight: 700, style: "normal" });
    fonts.push({ name: "Fredoka", data: await readFile(join(process.cwd(), "public", "fonts", "Fredoka-Medium.ttf")), weight: 500, style: "normal" });
  } catch {}
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #fff1e6 0%, #ffe4e6 45%, #e0f2fe 100%)", padding: 56, fontFamily: "Fredoka, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 360 }}>
          <div style={{ display: "flex", width: 310, height: 310, borderRadius: 310, overflow: "hidden", border: "10px solid white", boxShadow: "0 30px 60px rgba(244,63,94,0.35)" }}>
            <img src={roseton} width={310} height={310} style={{ objectFit: "cover" }} alt="" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingLeft: 36 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#e11d48", letterSpacing: 5 }}>CAZURRONICS</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, color: "#0f172a", lineHeight: 1.02, letterSpacing: -2, marginTop: 10 }}>
            <div style={{ display: "flex" }}>Tu planazo</div>
            <div style={{ display: "flex", color: "#e11d48" }}>en León</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "#475569", marginTop: 20 }}>Rutas y planes a tu medida. Gratis.</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#f97316", marginTop: 26 }}>cazurronics.es</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
