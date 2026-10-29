"use client";
// La oficina en 3D de verdad (three.js con @react-three/fiber), en una planta abierta tipo maqueta:
// cada empleado tiene su mesa en la zona de su departamento y el jefe su despacho de cristal.
// Lo que hacen sale de datos reales:
//  · sentado: teclea si ha cumplido su turno, se duerme si va con retraso y le sale humo si ha fallado;
//  · la charla del día (lib/charla) se reproduce en orden: quien habla se levanta, va andando por los pasillos
//    a la mesa del otro, se lo dice en un bocadillo, el otro contesta y vuelve a su sitio.
// Arrastra para girar, pellizca o usa la rueda para acercar, toca a alguien para ver su ficha.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { PRESS } from "../../../lib/estilos";
import { CAMISAS, PELOS, PIELES, hace } from "./monigotes";
import { CAFE, DESPACHO, ZONAS, episodios, largo, planta, puntoEn, ruta } from "./guion";

const LUZ = { ok: "#22c55e", tarde: "#f59e0b", error: "#ef4444", nuevo: "#38bdf8" };
const VISTAS = [
  { id: "todo", texto: "Toda", objetivo: [-0.5, 0, 1.6], camara: [16.5, 23, 27] },
  { id: "agenda", texto: "Agenda", objetivo: [-7.2, 0, -3.8], camara: [-1, 9, 6] },
  { id: "territorio", texto: "Territorio", objetivo: [2.7, 0, -4.5], camara: [8, 8, 4] },
  { id: "despensa", texto: "Despensa", objetivo: [2.7, 0, -0.6], camara: [7.5, 6.5, 7] },
  { id: "negocio", texto: "Negocio y café", objetivo: [-6.5, 0, 3.5], camara: [-2, 7, 11] },
  { id: "jefe", texto: "Jefe", objetivo: [10, 0, 2.5], camara: [14, 7, 10] },
];
const HABLA = 3800, PAUSA = 700;

// Las etiquetas HTML van a una capa nuestra encima del lienzo: si colgaran del propio lienzo, al cambiar de
// pestaña React lo quita antes que a ellas y salta un error al limpiarlas.
const Capa = createContext(null);
function Etiqueta(props) {
  const capa = useContext(Capa);
  return <Html portal={capa} zIndexRange={[30, 10]} pointerEvents="none" {...props} />;
} // ms que dura cada bocadillo y el respiro entre escenas

// ---------- Muebles ----------
function Mesa({ x, z, luz, grande = false }) {
  const w = grande ? 2.2 : 1.4;
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[w, 0.07, grande ? 1 : 0.75]} radius={0.03} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={grande ? "#7c4a2d" : "#f5efe6"} roughness={0.55} />
      </RoundedBox>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
        <mesh key={`${a}${b}`} position={[a * (w / 2 - 0.08), 0.36, b * 0.28]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      {/* Pantalla: de cara a quien se sienta; por detrás, el logo encendido del color de su estado */}
      <group position={[0, 0.78, 0.12]}>
        <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.08, 0.12, 0.08]} /><meshStandardMaterial color="#334155" /></mesh>
        <RoundedBox args={[0.62, 0.38, 0.04]} radius={0.015} position={[0, 0.32, 0]} castShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.32, -0.022]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.56, 0.32]} />
          <meshStandardMaterial color={luz} emissive={luz} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0, 0.32, 0.022]}>
          <circleGeometry args={[0.04, 20]} />
          <meshStandardMaterial color={luz} emissive={luz} emissiveIntensity={1.4} />
        </mesh>
      </group>
      <mesh position={[0, 0.79, -0.18]}><boxGeometry args={[0.42, 0.02, 0.13]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      <mesh position={[w / 2 - 0.2, 0.83, -0.1]} castShadow><cylinderGeometry args={[0.05, 0.045, 0.1, 14]} /><meshStandardMaterial color={grande ? "#0f172a" : "#fb7185"} /></mesh>
      {/* Silla */}
      <group position={[0, 0, -0.78]}>
        <RoundedBox args={[0.5, 0.08, 0.48]} radius={0.03} position={[0, 0.46, 0]} castShadow><meshStandardMaterial color="#334155" roughness={0.7} /></RoundedBox>
        <RoundedBox args={[0.5, 0.55, 0.07]} radius={0.03} position={[0, 0.78, -0.24]} castShadow><meshStandardMaterial color="#334155" roughness={0.7} /></RoundedBox>
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.03, 0.03, 0.44, 8]} /><meshStandardMaterial color="#64748b" /></mesh>
        <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.24, 0.24, 0.04, 16]} /><meshStandardMaterial color="#475569" /></mesh>
      </group>
    </group>
  );
}

function Planta({ x, z, alta = 1 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.24, 0.18, 0.44, 16]} /><meshStandardMaterial color="#e7d3bd" roughness={0.8} /></mesh>
      <mesh position={[0, 0.62 * alta + 0.25, 0]} castShadow scale={[1, alta, 1]}><icosahedronGeometry args={[0.42, 1]} /><meshStandardMaterial color="#4d9a5b" roughness={0.8} flatShading /></mesh>
      <mesh position={[0.15, 1.05 * alta + 0.2, 0.05]} castShadow scale={[1, alta, 1]}><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color="#5fb36c" roughness={0.8} flatShading /></mesh>
    </group>
  );
}

function Cafe() {
  const cx = (CAFE.x0 + CAFE.x1) / 2, cz = (CAFE.z0 + CAFE.z1) / 2;
  return (
    <group>
      <RoundedBox args={[CAFE.x1 - CAFE.x0, 0.02, CAFE.z1 - CAFE.z0]} radius={0.01} position={[cx, 0.011, cz]} receiveShadow><meshStandardMaterial color="#e2e8f0" /></RoundedBox>
      {/* Sofá */}
      <group position={[cx, 0, CAFE.z1 - 0.7]}>
        <RoundedBox args={[2.6, 0.4, 0.8]} radius={0.12} position={[0, 0.3, 0]} castShadow><meshStandardMaterial color="#f43f5e" roughness={0.8} /></RoundedBox>
        <RoundedBox args={[2.6, 0.6, 0.25]} radius={0.1} position={[0, 0.6, 0.3]} castShadow><meshStandardMaterial color="#e11d48" roughness={0.8} /></RoundedBox>
      </group>
      {/* Mesa baja y cafetera */}
      <mesh position={[cx, 0.25, cz + 0.6]} castShadow><cylinderGeometry args={[0.5, 0.5, 0.06, 24]} /><meshStandardMaterial color="#f5efe6" /></mesh>
      <mesh position={[cx, 0.12, cz + 0.6]}><cylinderGeometry args={[0.06, 0.06, 0.24, 8]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      <group position={[CAFE.x0 + 0.5, 0, CAFE.z0 + 0.6]}>
        <RoundedBox args={[0.9, 0.9, 0.6]} radius={0.05} position={[0, 0.45, 0]} castShadow><meshStandardMaterial color="#cbd5e1" /></RoundedBox>
        <RoundedBox args={[0.4, 0.45, 0.35]} radius={0.05} position={[0, 1.12, 0]} castShadow><meshStandardMaterial color="#0f172a" /></RoundedBox>
        <mesh position={[0, 1.2, 0.18]}><circleGeometry args={[0.05, 16]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} /></mesh>
      </group>
      <Planta x={CAFE.x1 - 0.4} z={CAFE.z0 + 0.5} alta={1.3} />
    </group>
  );
}

function Despacho() {
  const { x0, x1, z0, z1, puertaZ } = DESPACHO;
  const cristal = <meshStandardMaterial color="#bfdbfe" transparent opacity={0.28} roughness={0.1} metalness={0.2} />;
  const alto = 1.9;
  // La pared oeste tiene un hueco (la puerta) en el pasillo
  const tramos = [[z0, puertaZ - 0.8], [puertaZ + 0.8, z1]];
  return (
    <group>
      <RoundedBox args={[x1 - x0, 0.02, z1 - z0]} radius={0.01} position={[(x0 + x1) / 2, 0.011, (z0 + z1) / 2]} receiveShadow><meshStandardMaterial color="#cbd5e1" /></RoundedBox>
      <mesh position={[(x0 + x1) / 2, alto / 2, z0]}><boxGeometry args={[x1 - x0, alto, 0.05]} />{cristal}</mesh>
      {tramos.map(([a, b]) => (
        <mesh key={a} position={[x0, alto / 2, (a + b) / 2]}><boxGeometry args={[0.05, alto, b - a]} />{cristal}</mesh>
      ))}
      {[[x0, z0], [x0, puertaZ - 0.8], [x0, puertaZ + 0.8], [x0, z1], [x1, z0]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, alto / 2, z]} castShadow><boxGeometry args={[0.09, alto, 0.09]} /><meshStandardMaterial color="#334155" /></mesh>
      ))}
      <mesh position={[(x0 + x1) / 2, alto, z0]}><boxGeometry args={[x1 - x0, 0.08, 0.09]} /><meshStandardMaterial color="#334155" /></mesh>
      {/* Alfombra, estantería y planta del despacho */}
      <mesh position={[DESPACHO.mesa[0], 0.025, DESPACHO.mesa[1] + 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.8, 40]} /><meshStandardMaterial color="#fda4af" /></mesh>
      <group position={[x1 - 0.35, 0, z0 + 1.6]}>
        <RoundedBox args={[0.4, 1.8, 1.6]} radius={0.03} position={[0, 0.9, 0]} castShadow><meshStandardMaterial color="#7c4a2d" /></RoundedBox>
        {[0.5, 0.95, 1.4].map((y, i) => <mesh key={y} position={[-0.21, y, 0]}><boxGeometry args={[0.02, 0.32, 1.3]} /><meshStandardMaterial color={["#f43f5e", "#0ea5e9", "#f59e0b"][i]} /></mesh>)}
      </group>
      <Planta x={x1 - 0.5} z={z1 - 0.6} alta={1.4} />
    </group>
  );
}

function Edificio() {
  return (
    <group>
      {/* Losa de la maqueta */}
      <RoundedBox args={[27, 0.6, 20.5]} radius={0.2} position={[-0.4, -0.3, -1.2]} receiveShadow><meshStandardMaterial color="#e8d5bf" roughness={0.9} /></RoundedBox>
      {/* Pared del fondo y la izquierda, con ventanales */}
      <mesh position={[-0.4, 1.6, -11.3]} receiveShadow castShadow><boxGeometry args={[27, 3.2, 0.3]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      <mesh position={[-13.75, 1.6, -1.2]} receiveShadow castShadow><boxGeometry args={[0.3, 3.2, 20.5]} /><meshStandardMaterial color="#f1f5f9" /></mesh>
      {[-9, -3, 3, 9].map((x) => (
        <mesh key={x} position={[x, 1.75, -11.14]}><planeGeometry args={[3.8, 1.7]} /><meshStandardMaterial color="#bae6fd" emissive="#e0f2fe" emissiveIntensity={0.5} /></mesh>
      ))}
      {[-7, 0, 6].map((z) => (
        <mesh key={z} position={[-13.59, 1.75, z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3.6, 1.7]} /><meshStandardMaterial color="#bae6fd" emissive="#e0f2fe" emissiveIntensity={0.5} /></mesh>
      ))}
      {/* Pizarra con el logo */}
      <mesh position={[-0.4, 1.85, -11.12]}><planeGeometry args={[2.6, 1.3]} /><meshStandardMaterial color="#0f172a" /></mesh>
      {["#f43f5e", "#fb923c", "#facc15"].map((c, i) => (
        <mesh key={c} position={[-1.2 + i * 0.8, 1.85, -11.1]}><circleGeometry args={[0.28, 24]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} /></mesh>
      ))}
      <Planta x={-12.9} z={-10.4} alta={1.5} />
      <Planta x={6.8} z={-10.4} alta={1.2} />
      <Planta x={-12.9} z={8.3} />
    </group>
  );
}

function Alfombras({ sitios }) {
  const zonas = Object.entries(ZONAS).map(([id, z]) => {
    const suyos = Object.values(sitios).filter((s) => s.dep === id);
    if (!suyos.length) return null;
    const xs = suyos.map((s) => s.mesa[0]), zs = suyos.map((s) => s.mesa[1]);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, z0 = Math.min(...zs) - 1.25, z1 = Math.max(...zs) + 0.65;
    return { id, ...z, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, cartel: [x0 + 0.2, z0] };
  }).filter(Boolean);
  return zonas.map((z) => (
    <group key={z.id}>
      <RoundedBox args={[z.w, 0.025, z.d]} radius={0.012} position={[z.x, 0.013, z.z]} receiveShadow><meshStandardMaterial color={z.color} roughness={0.95} /></RoundedBox>
      <Etiqueta position={[z.x, 2.7, z.cartel[1]]} center>
        <span className="select-none whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 shadow-sm">{z.nombre}</span>
      </Etiqueta>
    </group>
  ));
}

// ---------- Personas ----------
function Persona({ e, sitio, estado, camisa, piel, pelo, jefe, poses, bocadillo, alTocar, semilla, fuera }) {
  const g = useRef(), cuerpo = useRef(), cabeza = useRef(), brazoI = useRef(), brazoD = useRef(), piernaI = useRef(), piernaD = useRef(), humo = useRef();
  const [encima, setEncima] = useState(false);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + semilla;
    const p = poses.get(e.id);
    if (!g.current) return;
    if (p) {
      // De pie: andando o hablando en la mesa de otro
      g.current.position.set(p.x, 0, p.z);
      g.current.rotation.y = p.giro;
      cuerpo.current.position.y = p.andando ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
      const paso = p.andando ? Math.sin(t * 9) * 0.6 : 0;
      piernaI.current.rotation.x = paso; piernaD.current.rotation.x = -paso;
      brazoI.current.rotation.x = -paso * 0.8; brazoD.current.rotation.x = p.hablando ? -1.1 + Math.sin(t * 6) * 0.25 : paso * 0.8;
      cabeza.current.rotation.x = 0; cabeza.current.rotation.z = p.hablando ? Math.sin(t * 2.5) * 0.08 : 0;
      cuerpo.current.rotation.x = 0;
      if (humo.current) humo.current.visible = false;
      return;
    }
    // Sentado en su silla, mirando a la cámara
    g.current.position.set(sitio.silla[0], 0, sitio.silla[1] - 0.05);
    g.current.rotation.y = 0;
    cuerpo.current.position.y = -0.3;
    piernaI.current.rotation.x = piernaD.current.rotation.x = -1.45;
    if (estado === "tarde") {
      cabeza.current.rotation.x = 0.55 + Math.sin(t * 1.2) * 0.05;
      cuerpo.current.rotation.x = 0.18;
      brazoI.current.rotation.x = brazoD.current.rotation.x = -0.9;
    } else if (estado === "error") {
      cabeza.current.rotation.z = Math.sin(t * 7) * 0.12;
      brazoI.current.rotation.x = -2.6 + Math.sin(t * 8) * 0.2; brazoD.current.rotation.x = -2.6 + Math.cos(t * 8) * 0.2;
      cuerpo.current.rotation.x = 0;
    } else if (jefe) {
      cabeza.current.rotation.y = Math.sin(t * 0.5) * 0.4;
      brazoI.current.rotation.x = -1.2; brazoD.current.rotation.x = -1.2;
      cuerpo.current.rotation.x = 0;
    } else {
      // Teclea: brazos adelante y manos que van y vienen
      cabeza.current.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.04;
      cabeza.current.rotation.y = estado === "nuevo" ? Math.sin(t * 0.8) * 0.5 : Math.sin(t * 0.4) * 0.1;
      brazoI.current.rotation.x = -1.25 + Math.sin(t * 14) * 0.12; brazoD.current.rotation.x = -1.25 + Math.cos(t * 14) * 0.12;
      cuerpo.current.rotation.x = 0.05;
    }
    if (humo.current) {
      humo.current.visible = estado === "error";
      humo.current.children.forEach((b, i) => {
        const f = (t * 0.6 + i / 3) % 1;
        b.position.set(Math.sin(f * 6 + i) * 0.15, 1.6 + f * 1.1, 0);
        b.scale.setScalar(0.12 + f * 0.25);
        b.material.opacity = 0.55 * (1 - f);
      });
    }
  });
  const traje = jefe ? "#0f172a" : camisa;
  return (
    <group ref={g} onPointerOver={(ev) => { ev.stopPropagation(); setEncima(true); }} onPointerOut={() => setEncima(false)}
      onClick={(ev) => { ev.stopPropagation(); if (ev.delta > 8) return; alTocar(); }}>
      <group ref={cuerpo}>
        {/* Piernas (giran desde la cadera) */}
        {[[-0.11, piernaI], [0.11, piernaD]].map(([x, r]) => (
          <group key={x} ref={r} position={[x, 0.82, 0]}>
            <mesh position={[0, -0.38, 0]} castShadow><boxGeometry args={[0.16, 0.76, 0.18]} /><meshStandardMaterial color={jefe ? "#1e293b" : "#334155"} /></mesh>
            <mesh position={[0, -0.75, 0.06]} castShadow><boxGeometry args={[0.17, 0.08, 0.3]} /><meshStandardMaterial color="#0f172a" /></mesh>
          </group>
        ))}
        <RoundedBox args={[0.5, 0.62, 0.3]} radius={0.1} position={[0, 1.12, 0]} castShadow><meshStandardMaterial color={traje} roughness={0.6} /></RoundedBox>
        {jefe && <mesh position={[0, 1.2, 0.155]}><boxGeometry args={[0.08, 0.36, 0.02]} /><meshStandardMaterial color="#f43f5e" /></mesh>}
        {/* Brazos (giran desde el hombro) */}
        {[[-0.32, brazoI], [0.32, brazoD]].map(([x, r]) => (
          <group key={x} ref={r} position={[x, 1.38, 0]}>
            <mesh position={[0, -0.24, 0]} castShadow><boxGeometry args={[0.13, 0.5, 0.14]} /><meshStandardMaterial color={traje} roughness={0.6} /></mesh>
            <mesh position={[0, -0.52, 0]}><sphereGeometry args={[0.07, 12, 10]} /><meshStandardMaterial color={piel} /></mesh>
          </group>
        ))}
        <group ref={cabeza} position={[0, 1.66, 0]}>
          <mesh castShadow><sphereGeometry args={[0.24, 24, 18]} /><meshStandardMaterial color={piel} roughness={0.7} /></mesh>
          <mesh position={[0, 0.07, -0.02]} scale={[1.06, 0.75, 1.06]}><sphereGeometry args={[0.24, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={jefe ? "#9ca3af" : pelo} roughness={0.9} /></mesh>
          {estado === "tarde" && !fuera ? (
            [-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0.01, 0.225]}><boxGeometry args={[0.07, 0.012, 0.01]} /><meshStandardMaterial color="#1e293b" /></mesh>)
          ) : (
            [-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0.02, 0.215]}><sphereGeometry args={[0.03, 10, 8]} /><meshStandardMaterial color="#0f172a" /></mesh>)
          )}
          <mesh position={[0, -0.08, 0.22]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.05, 0.012, 6, 12, Math.PI]} /><meshStandardMaterial color="#9f1239" /></mesh>
        </group>
        {e.emoji && !jefe && (
          <Etiqueta position={[0, 1.13, 0.17]} center distanceFactor={9}>
            <span className="select-none text-[22px] leading-none">{e.emoji}</span>
          </Etiqueta>
        )}
      </group>
      <group ref={humo} visible={false}>
        {[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#64748b" transparent opacity={0.4} depthWrite={false} /></mesh>)}
      </group>
      {estado === "tarde" && !fuera && (
        <Etiqueta position={[0.25, 2.1, 0]} center distanceFactor={10}>
          <span className="select-none text-xl font-black text-sky-500 animate-pulse">z<sup>z</sup></span>
        </Etiqueta>
      )}
      {(bocadillo || encima) && (
        <Etiqueta position={[0, 2.35, 0]} center zIndexRange={[40, 20]}>
          {bocadillo ? (
            <div className="cz-fade relative w-[170px] sm:w-[240px] -translate-y-1/2 rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 select-none">
              <p className="text-[11px] font-bold text-rose-500 mb-0.5">{bocadillo.titulo}</p>
              {bocadillo.texto}
            </div>
          ) : (
            <span className="select-none whitespace-nowrap rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white">{jefe ? "👔 El jefe" : `${e.emoji} ${e.nombre}`}</span>
          )}
        </Etiqueta>
      )}
    </group>
  );
}

// ---------- El director: reproduce la charla ----------
function Director({ escenas, sitios, poses, alCambiar, enMarcha }) {
  const estado = useRef({ i: 0, inicio: null, fase: null });
  useFrame(({ clock }) => {
    if (!escenas.length) return;
    const ahora = clock.elapsedTime * 1000;
    const s = estado.current;
    if (s.inicio == null) s.inicio = ahora;
    if (!enMarcha) { s.inicio = ahora - (s.pausadoEn ?? 0); return; }
    const esc = escenas[s.i % escenas.length];
    const t = ahora - s.inicio;
    s.pausadoEn = t;
    const quien = sitios[esc.quien], a = sitios[esc.a];
    const ida = esc.anda ? ruta(quien, a) : null;
    const vel = ida ? Math.max(1.8, largo(ida) / 5.5) : 1;
    const tAndar = ida ? (largo(ida) / vel) * 1000 : 0;
    const tHablar = HABLA * (esc.respuesta ? 2 : 1);
    const total = tAndar * 2 + tHablar + PAUSA;

    let fase;
    if (t < tAndar) fase = "ida";
    else if (t < tAndar + HABLA) fase = "habla";
    else if (esc.respuesta && t < tAndar + tHablar) fase = "responde";
    else if (t < tAndar * 2 + tHablar) fase = "vuelta";
    else fase = "pausa";

    if (ida) {
      if (fase === "ida") poses.set(esc.quien, { ...puntoEn(ida, (t / 1000) * vel), andando: true });
      else if (fase === "vuelta") poses.set(esc.quien, { ...puntoEn([...ida].reverse(), ((t - tAndar - tHablar) / 1000) * vel), andando: true });
      else if (fase === "pausa") poses.delete(esc.quien);
      else {
        // De pie al lado de la mesa del otro, mirándole
        const [x, z] = a.visita;
        poses.set(esc.quien, { x, z, giro: Math.atan2(a.mesa[0] - x, a.mesa[1] - 0.6 - z), hablando: fase === "habla", andando: false });
      }
    }
    if (fase !== s.fase) {
      s.fase = fase;
      alCambiar(esc, fase);
    }
    if (t >= total) {
      poses.delete(esc.quien);
      s.i++; s.inicio = ahora; s.fase = null;
    }
  });
  return null;
}

// Mueve la cámara con suavidad a la sala elegida (si no la estás moviendo tú)
function Camara({ vista, controles, tocando }) {
  const { camera, size } = useThree();
  const llegado = useRef(false);
  useEffect(() => { llegado.current = false; }, [vista, size.width, size.height]);
  useFrame(() => {
    const c = controles.current;
    if (!c || llegado.current || tocando.current) return;
    const v = VISTAS.find((x) => x.id === vista) || VISTAS[0];
    // En una pantalla estrecha (móvil en vertical) la cámara se aleja para que quepa la sala entera
    const k = Math.min(2.1, Math.max(1, 1.3 / (size.width / size.height)));
    // …y mira un poco más cerca, para que la oficina no quede baja con el cielo vacío arriba
    const o = { x: v.objetivo[0] + (k - 1) * 3, y: v.objetivo[1], z: v.objetivo[2] + (k - 1) * 4 };
    const destino = { x: o.x + (v.camara[0] - v.objetivo[0]) * k, y: o.y + (v.camara[1] - v.objetivo[1]) * k, z: o.z + (v.camara[2] - v.objetivo[2]) * k };
    camera.position.lerp(destino, 0.06);
    c.target.lerp(o, 0.08);
    c.update();
    if (camera.position.distanceTo(destino) < 0.05) llegado.current = true;
  });
  return null;
}

const nombreDe = (id, porId) => (id === "jefe" ? "👔 Jefe" : id === "tu" ? "📱 Tú" : porId[id] ? `${porId[id].emoji} ${porId[id].nombre}` : id);

export default function Oficina3D({ departamentos, charla = [], alElegir }) {
  const sitios = useMemo(() => planta(departamentos), [departamentos]);
  const porId = useMemo(() => Object.fromEntries(departamentos.flatMap((d) => d.empleados.map((e) => [e.id, { ...e, dep: d.id }]))), [departamentos]);
  const escenas = useMemo(() => episodios(charla.slice(-60), sitios), [charla, sitios]);
  // Dónde está cada uno que se ha levantado: lo escribe el director y lo leen las personas en cada fotograma
  const [poses] = useState(() => new Map());
  const controles = useRef(), tocando = useRef(false);
  const capa = useRef(null);
  const [vista, setVista] = useState("todo");
  const [enMarcha, setEnMarcha] = useState(true);
  const [ahora, setAhora] = useState({ esc: null, fase: null });

  const alCambiar = (esc, fase) => setAhora({ esc, fase });
  // Quién tiene bocadillo en cada momento
  const bocadillos = {};
  const { esc, fase } = ahora;
  const fuera = esc?.anda && fase !== "pausa" ? esc.quien : null; // quien está levantado
  if (esc && (fase === "habla" || fase === "responde")) {
    const habla = fase === "habla" ? esc.quien : esc.a;
    const linea = fase === "habla" ? esc : esc.respuesta;
    const para = fase === "habla" ? esc.a : esc.quien;
    // Lo que va o viene de Alejandro lo dice el jefe con el móvil en la mano
    const donde = sitios[habla] ? habla : "jefe";
    bocadillos[donde] = { titulo: `${nombreDe(habla, porId)} → ${nombreDe(para, porId)}`, texto: linea.texto };
  }

  return (
    <div className="relative rounded-[2rem] overflow-hidden ring-1 ring-white/80 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.5)] bg-gradient-to-b from-sky-100 via-rose-50 to-amber-50">
      <div className="relative h-[64dvh] min-h-[420px] sm:h-[620px] touch-none">
        <div ref={capa} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        <Capa.Provider value={capa}>
        <Canvas shadows dpr={[1, 1.75]} camera={{ position: VISTAS[0].camara, fov: 32, near: 0.5, far: 120 }}
          fallback={<p className="p-6 text-sm text-slate-600">Tu navegador no puede mostrar la oficina en 3D. Usa la vista de lista.</p>}>
          <hemisphereLight args={["#fff7ed", "#cbd5e1", 1.1]} />
          <directionalLight position={[14, 22, 12]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
            shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} />
          <directionalLight position={[-10, 8, 14]} intensity={0.35} color="#fecdd3" />
          <Edificio />
          <Alfombras sitios={sitios} />
          <Cafe />
          <Despacho />
          {Object.values(sitios).map((s) => (
            <Mesa key={s.id} x={s.mesa[0]} z={s.mesa[1]} grande={s.id === "jefe"} luz={s.id === "jefe" ? "#f43f5e" : LUZ[porId[s.id]?.estado] || LUZ.nuevo} />
          ))}
          {Object.values(porId).map((e, i) => (
            <Persona key={e.id} e={e} sitio={sitios[e.id]} estado={e.estado} semilla={i * 1.7}
              camisa={(CAMISAS[e.dep] || CAMISAS.agenda)[i % 3]} piel={PIELES[(i * 7) % PIELES.length]} pelo={PELOS[(i * 5) % PELOS.length]}
              poses={poses} bocadillo={bocadillos[e.id]} fuera={fuera === e.id} alTocar={() => alElegir(e)} />
          ))}
          <Persona e={{ id: "jefe", emoji: "👔", nombre: "El jefe" }} sitio={sitios.jefe} estado="ok" jefe semilla={3}
            piel={PIELES[0]} pelo={PELOS[3]} poses={poses} bocadillo={bocadillos.jefe} fuera={fuera === "jefe"} alTocar={() => alElegir({ jefe: true })} />
          <Director escenas={escenas} sitios={sitios} poses={poses} alCambiar={alCambiar} enMarcha={enMarcha} />
          <OrbitControls ref={controles} enablePan={false} minDistance={6} maxDistance={70} minPolarAngle={0.35} maxPolarAngle={1.2}
            onStart={() => { tocando.current = true; }} onEnd={() => { tocando.current = false; }} />
          <Camara vista={vista} controles={controles} tocando={tocando} />
        </Canvas>
        </Capa.Provider>
      </div>

      {/* Lo que está pasando ahora, en una línea */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-white/85 py-1.5 pl-3 pr-1.5 text-xs text-slate-700 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
          <span className="truncate">
            {esc ? <>📼 <b>{nombreDe(esc.quien, porId)}</b> · {hace(esc.cuando)}</> : escenas.length ? "📼 Reproduciendo lo que ha pasado" : "Aún no hay conversaciones: salen en cuanto el equipo trabaje un turno"}
          </span>
          {escenas.length > 0 && (
            <button onClick={() => setEnMarcha((x) => !x)} className={`${PRESS} shrink-0 h-7 w-7 rounded-full bg-slate-900 text-white text-[11px]`} aria-label={enMarcha ? "Pausar" : "Seguir"}>{enMarcha ? "❚❚" : "▶"}</button>
          )}
        </div>
      </div>

      {/* Salas: al alcance del pulgar */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-full bg-white/80 p-1 ring-1 ring-slate-900/5 backdrop-blur">
          {VISTAS.map((v) => (
            <button key={v.id} onClick={() => { tocando.current = false; setVista(v.id); }} className={`${PRESS} shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ${vista === v.id ? "bg-slate-900 text-white" : "text-slate-600"}`}>{v.texto}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
