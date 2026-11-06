"use client";
// /panel/negocios — una sola lista: quién te ha escrito, a quién escribir y quién no ha contestado.
// Nada se envía solo: los botones dejan el mensaje preparado y lo mandas tú.
import { useCallback, useState } from "react";
import Captacion from "../../components/Captacion";
import { Entrada, Marco, pedir, useClave } from "../comun";

const whatsapp = (t) => `https://wa.me/${t.replace(/\D/g, "").replace(/^(?!34)(\d{9})$/, "34$1")}`;
const cuando = (f) => new Date(f).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Solicitud({ s, alCambiar }) {
  return (
    <li className="pn-bloque flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 style={{ fontSize: 16.5, lineHeight: 1.25, fontWeight: 700 }}>{s.nombreLocal}</h3>
        <span className="pn-apunte tabular-nums shrink-0">{cuando(s.fecha)}</span>
      </div>
      {s.mensaje && <p className="whitespace-pre-line" style={{ fontSize: 14 }}>{s.mensaje}</p>}
      <div className="flex flex-wrap gap-2 mt-auto">
        {s.email && <a className="pn-boton" href={`mailto:${s.email}`}>Escribir un correo</a>}
        {s.telefono && <a className="pn-boton flojo" href={whatsapp(s.telefono)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {s.telefono && <a className="pn-boton flojo" href={`tel:${s.telefono}`}>Llamar</a>}
        <button className="pn-boton flojo" onClick={() => alCambiar(s, !s.atendida)}>{s.atendida ? "Volver a pendientes" : "Ya está atendido"}</button>
      </div>
      {!s.enviadoAlSheet && <p className="pn-apunte" style={{ color: "var(--oro)" }}>Esta no llegó a tu hoja de Google, pero aquí está guardada.</p>}
    </li>
  );
}

export default function Negocios() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [verAtendidas, setVerAtendidas] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async (c) => {
    const d = await pedir("/api/panel", c);
    if (d.exito) setSolicitudes(d.solicitudes || []);
    return d;
  }, []);
  const acceso = useClave(cargar);

  if (!acceso.lista) return <Entrada acceso={acceso} />;

  const cambiar = async (s, atendida) => {
    setAviso("");
    const d = await pedir("/api/panel", acceso.clave, { accion: "solicitud", id: s.id, atendida });
    if (d.exito) setSolicitudes((l) => l.map((x) => (x.id === s.id ? { ...x, atendida } : x)));
    else setAviso(d.mensaje || "No se ha podido guardar. Prueba otra vez.");
  };
  const pendientes = solicitudes.filter((s) => !s.atendida);
  const atendidas = solicitudes.filter((s) => s.atendida);

  return (
    <Marco>
      <section className="mb-5">
        <h2 className="pn-titulo mb-2">Te han escrito ellos</h2>
        {aviso && <p className="text-sm mb-2" style={{ color: "var(--mal)" }} role="alert">{aviso}</p>}
        {pendientes.length ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pendientes.map((s) => <Solicitud key={s.id} s={s} alCambiar={cambiar} />)}
          </ul>
        ) : <p className="pn-apunte">Ningún negocio espera respuesta. Llegan desde el botón «Destácalo» de la web.</p>}
        {atendidas.length > 0 && (
          <div className="mt-3">
            <button className="pn-boton flojo" onClick={() => setVerAtendidas((x) => !x)}>{verAtendidas ? "Ocultar" : "Ver"} los {atendidas.length} ya atendidos</button>
            {verAtendidas && <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">{atendidas.map((s) => <Solicitud key={s.id} s={s} alCambiar={cambiar} />)}</ul>}
          </div>
        )}
      </section>
      <Captacion clave={acceso.clave} />
    </Marco>
  );
}
