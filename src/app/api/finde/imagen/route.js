/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eventosProximos } from "../../../../lib/eventos";
import { hoyEnLeon } from "../../../../lib/estadisticas";
import { calcularFinde, corto, diaCortoDe, horaInicio, mayus } from "../../../../lib/finde";
import { zonaPorId } from "../../../../lib/zonas";

export const dynamic = "force-dynamic";

// Las imágenes del resumen del finde, listas para subir a Instagram:
//  /api/finde/imagen?n=1            carrusel 4:5 (1080×1350) · n = nº de diapositiva
//  /api/finde/imagen?n=1&f=historia historia vertical (1080×1920)
//  /api/finde/imagen?f=og           la que sale al pegar el enlace /finde (1200×630)
// Las diapositivas que hay dependen de la semana (/api/finde las lista).
const ROSA = "#e11d48", NARANJA = "#f97316", TINTA = "#0f172a", GRIS = "#475569";
const FONDO = "linear-gradient(160deg, #fff1e6 0%, #ffe4e6 42%, #e0f2fe 100%)";
const tarjeta = { display: "flex", background: "rgba(255,255,255,0.82)", border: "3px solid white", boxShadow: "0 18px 40px -18px rgba(15,23,42,0.35)" };

async function cargarRecursos() {
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

// El rosetón dentro de un círculo, recortado y sin deformarlo
const Circulo = ({ roseton, tam, borde = 4, sombra }) => (
  <div style={{ display: "flex", width: tam, height: tam, borderRadius: tam, overflow: "hidden", border: `${borde}px solid white`, ...(sombra ? { boxShadow: sombra } : {}) }}>
    <img src={roseton} width={tam} height={tam} style={{ objectFit: "cover" }} alt="" />
  </div>
);

const Marca = ({ roseton, tam = 76 }) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <Circulo roseton={roseton} tam={tam} />
    <div style={{ display: "flex", flexDirection: "column", marginLeft: 20 }}>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: TINTA }}>Cazurronics</div>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: GRIS }}>@cazurronics</div>
    </div>
  </div>
);

const Pie = ({ texto = "cazurronics.es  ·  Gratis  ·  Local  ·  Cerca" }) => (
  <div style={{ display: "flex", justifyContent: "center", fontSize: 28, fontWeight: 500, color: GRIS }}>{texto}</div>
);

const Marco = ({ alto, roseton, children }) => (
  <div style={{ width: 1080, height: alto, display: "flex", flexDirection: "column", background: FONDO, padding: "70px 70px 56px", fontFamily: "Fredoka, sans-serif" }}>
    <Marca roseton={roseton} />
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: 30, marginBottom: 30 }}>{children}</div>
    <Pie />
  </div>
);

const Etiqueta = ({ children, color = ROSA }) => <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 5, color }}>{String(children).toUpperCase()}</div>;

function Fila({ hora, titulo, sub, precio, tam = 1 }) {
  return (
    <div style={{ ...tarjeta, borderRadius: 34, padding: `${26 * tam}px 30px`, alignItems: "center", marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 150, flexShrink: 0, marginRight: 26, padding: "14px 0", borderRadius: 24, background: TINTA, color: "white" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 500, opacity: 0.8 }}>{hora[0]}</div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{hora[1]}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: TINTA, lineHeight: 1.1 }}>{titulo}</div>
        {sub && <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: GRIS, marginTop: 8 }}>{sub}{precio ? `  ·  ${precio}` : ""}</div>}
      </div>
    </div>
  );
}

const subDe = (e) => corto([e.lugar, e.localidad && e.localidad !== "León" ? e.localidad : null].filter(Boolean).join(" · ") || "León", 44);
const filaDeEvento = (e, i, conDia = false) => (
  <Fila key={i} hora={[conDia ? diaCortoDe(e.fecha).toUpperCase() : "HORA", horaInicio(e) || "Todo el día"]} titulo={corto(e.titulo, 62)} sub={subDe(e)} precio={e.precio ? corto(e.precio, 14) : null} />
);

function Diapositiva({ d, p, roseton, alto }) {
  if (d.tipo === "portada") {
    return (
      <Marco alto={alto} roseton={roseton}>
        <Etiqueta>Selección de la semana</Etiqueta>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 100, fontWeight: 700, color: TINTA, lineHeight: 1.0, letterSpacing: -3, marginTop: 10 }}>
          <div style={{ display: "flex" }}>Lo mejor</div>
          <div style={{ display: "flex" }}>del finde</div>
          <div style={{ display: "flex", color: ROSA }}>en León</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "white", background: `linear-gradient(90deg, ${ROSA}, ${NARANJA})`, padding: "12px 30px", borderRadius: 999 }}>{p.rango}</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: ROSA }}>Desliza para ver más</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          {p.destacados.length ? p.destacados.map((e, i) => filaDeEvento(e, i, true)) : <div style={{ display: "flex", fontSize: 36, fontWeight: 500, color: GRIS }}>Estamos cerrando la agenda. Todo lo que pasa, en cazurronics.es</div>}
        </div>
      </Marco>
    );
  }
  if (d.tipo === "dia") {
    const dia = p.dias.find((x) => x.fecha === d.fecha);
    return (
      <Marco alto={alto} roseton={roseton}>
        <Etiqueta>En León</Etiqueta>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 700, color: TINTA, letterSpacing: -3, marginTop: 6, marginBottom: 30 }}>{`${mayus(dia.nombre)} ${dia.numero}`}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>{dia.leon.slice(0, alto > 1500 ? 4 : 3).map((e, i) => filaDeEvento(e, i))}</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: GRIS, marginTop: 4 }}>{`${dia.total} planes este día · lista completa en cazurronics.es/finde`}</div>
      </Marco>
    );
  }
  if (d.tipo === "provincia") {
    return (
      <Marco alto={alto} roseton={roseton}>
        <Etiqueta>Fuera de la capital</Etiqueta>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: TINTA, letterSpacing: -3, marginTop: 6, marginBottom: 30 }}>Por la provincia</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {p.provincia.slice(0, alto > 1500 ? 5 : 4).map((e, i) => (
            <Fila key={i} hora={[diaCortoDe(e.fecha).toUpperCase(), horaInicio(e) || "Todo el día"]} titulo={corto(e.titulo, 56)} sub={corto([zonaPorId(e.zona)?.corto, e.localidad].filter(Boolean).join(" · ") || "León", 44)} precio={e.precio ? corto(e.precio, 14) : null} />
          ))}
        </div>
      </Marco>
    );
  }
  return (
    <Marco alto={alto} roseton={roseton}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Circulo roseton={roseton} tam={330} borde={10} sombra="0 30px 60px -20px rgba(244,63,94,0.5)" />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, color: TINTA, lineHeight: 1.02, letterSpacing: -3, marginTop: 44 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>Guárdalo y</div>
          <div style={{ display: "flex", justifyContent: "center", color: ROSA }}>mándaselo al grupo</div>
        </div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 500, color: GRIS, marginTop: 28 }}>¿Sin ideas? Te montamos el plan gratis</div>
        <div style={{ display: "flex", marginTop: 38, fontSize: 40, fontWeight: 700, color: "white", background: `linear-gradient(90deg, ${ROSA}, ${NARANJA})`, padding: "20px 46px", borderRadius: 999 }}>cazurronics.es/finde</div>
      </div>
    </Marco>
  );
}

// La que sale al pegar el enlace (WhatsApp, X, Facebook...)
function Vista({ p, roseton }) {
  return (
    <div style={{ width: 1200, height: 630, display: "flex", background: FONDO, padding: 56, fontFamily: "Fredoka, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 330 }}>
        <Circulo roseton={roseton} tam={290} borde={10} sombra="0 30px 60px rgba(244,63,94,0.35)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingLeft: 34 }}>
        <Etiqueta>Selección de la semana</Etiqueta>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, color: TINTA, lineHeight: 1.02, letterSpacing: -2, marginTop: 8 }}>
          <div style={{ display: "flex" }}>Lo mejor del finde</div>
          <div style={{ display: "flex", color: ROSA }}>en León</div>
        </div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: ROSA, marginTop: 10 }}>{p.rango}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
          {p.destacados.slice(0, 3).map((e, i) => (
            <div key={i} style={{ display: "flex", fontSize: 29, fontWeight: 500, color: TINTA, marginTop: 6 }}>{`${diaCortoDe(e.fecha)} ${horaInicio(e) || ""}  ·  ${corto(e.titulo, 40)}`}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export async function GET(request) {
  try {
    const q = new URL(request.url).searchParams;
    const formato = q.get("f");
    const [pack, { roseton, fonts }] = await Promise.all([
      eventosProximos(10).then((d) => calcularFinde(d, hoyEnLeon())),
      cargarRecursos(),
    ]);
    const cabeceras = { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" };
    if (formato === "og") return new ImageResponse(<Vista p={pack} roseton={roseton} />, { width: 1200, height: 630, fonts, headers: cabeceras });

    const n = Number(q.get("n") || 1);
    const d = pack.diapositivas[n - 1];
    if (!Number.isInteger(n) || !d) return new Response(`n debe ser un número del 1 al ${pack.diapositivas.length}`, { status: 404 });
    const alto = formato === "historia" ? 1920 : 1350;
    return new ImageResponse(<Diapositiva d={d} p={pack} roseton={roseton} alto={alto} />, { width: 1080, height: alto, fonts, headers: cabeceras });
  } catch (e) {
    return new Response(`No se pudo crear la imagen: ${e.message}`, { status: 500 });
  }
}
