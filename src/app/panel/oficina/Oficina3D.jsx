"use client";
// La oficina en 3D (three.js con @react-three/fiber): un edificio visto en isométrico, con una sala por cada paso
// del trabajo (ver guion.js). Cada empleado está donde toca según su horario real (vercel.json) y su estado:
// en su mesa durante su turno, en la cafetería si ya lo ha hecho, dormido en el sofá si se lo ha saltado y
// esperando en la puerta del jefe si ha fallado. «Anoche en 1 minuto» repite las últimas 24 h con sus cifras.
// Un dedo mueve la planta, dos dedos (o la rueda) acercan, y tocar a alguien abre su ficha. Ver esto no gasta IA.
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, MapControls } from "@react-three/drei";
import { PRESS } from "../../../lib/estilos";
import { dondeEsta, proximoTurno } from "../../../lib/turnos";
import { CAMISAS, PELOS, PIELES, fmt } from "./monigotes";
import { BARRA, CAFE_MESAS, CAFE_SITIOS, CAFE_SOFAS, DESTINOS, EDIFICIO, MOSTRADOR, SALAS, colocar, planta } from "./guion";
import { bocadillosEn, contadores, enVuelo, horaReal, montarRepeticion, poseEn } from "./repeticion";

// ---------- Materiales y piezas compartidas (low-poly, sin sombras en tiempo real) ----------
const MATS = new Map();
function mat(color, extra) {
  const k = extra ? `${color}|${JSON.stringify(extra)}` : color;
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
  return MATS.get(k);
}
const CRISTAL = new THREE.MeshLambertMaterial({ color: "#cfe3f0", transparent: true, opacity: 0.22, depthWrite: false });
const CRISTAL_VENTANA = new THREE.MeshLambertMaterial({ color: "#b9d7ea", emissive: "#dbeafe", emissiveIntensity: 0.35 });
const CAJA = new THREE.BoxGeometry(1, 1, 1);
const CIL = new THREE.CylinderGeometry(1, 1, 1, 10);
const BOLA = new THREE.IcosahedronGeometry(1, 1);
const DISCO = new THREE.CircleGeometry(1, 24);

const C = {
  suelo: "#c9cdd3", pasillo: "#e3e5e8", pared: "#f3f2ef", marco: "#2b2f36", madera: "#b98552", maderaOscura: "#8a5a35",
  negro: "#23262d", pantalla: "#1d2026", verde: "#4f8f4a", verdeClaro: "#6aa85c", maceta: "#e7e2da", acera: "#d4d6d9", asfalto: "#8f949b",
};
const LUZ = { ok: "#22c55e", tarde: "#f59e0b", error: "#ef4444", nuevo: "#38bdf8" };
const OFFSET = new THREE.Vector3(30, 33, 30);
const ALTO = 2.8; // paredes exteriores

function Caja({ p, s, c, m, ...r }) {
  return <mesh geometry={CAJA} material={m || mat(c)} position={p} scale={s} {...r} />;
}
function Cil({ p, r = 0.5, h = 1, c, m, ...x }) {
  return <mesh geometry={CIL} material={m || mat(c)} position={p} scale={[r, h, r]} {...x} />;
}

// Las etiquetas HTML van a una capa nuestra encima del lienzo (si colgaran del lienzo, al cambiar de pestaña
// React lo quitaría antes que a ellas y saltaría un error al limpiarlas)
const Capa = createContext(null);
function Etiqueta(props) {
  const capa = useContext(Capa);
  return <Html portal={capa} zIndexRange={[30, 10]} pointerEvents="none" {...props} />;
}

// ---------- Reloj de la repetición: lo leen solo las piezas que cambian con él (8 veces por segundo) ----------
function crearReloj() {
  let s = 0, paso = -1;
  const subs = new Set();
  return {
    get: () => s,
    set(v) { s = v; const p = Math.floor(v * 8); if (p !== paso) { paso = p; subs.forEach((f) => f()); } },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
}
const useSegundo = (reloj) => useSyncExternalStore(reloj.subscribe, () => Math.floor(reloj.get() * 8) / 8, () => 0);

// ---------- El edificio ----------
function Ventana({ x, z, ancho, giro = 0 }) {
  return (
    <group position={[x, 1.55, z]} rotation={[0, giro, 0]}>
      <Caja p={[0, 0, 0]} s={[ancho, 1.5, 0.04]} m={CRISTAL_VENTANA} />
      <Caja p={[0, 0.78, 0.03]} s={[ancho + 0.1, 0.08, 0.06]} c={C.marco} />
      <Caja p={[0, -0.78, 0.03]} s={[ancho + 0.1, 0.08, 0.06]} c={C.marco} />
      {[-0.5, 0, 0.5].map((f) => <Caja key={f} p={[f * ancho, 0, 0.03]} s={[0.07, 1.5, 0.06]} c={C.marco} />)}
    </group>
  );
}

// Tabique de media altura con cristal encima y huecos para las puertas. eje "x": va a lo largo de x (en z fijo)
function Tabique({ eje, fijo, desde, hasta, puertas = [], bajo = 1, alto = 2.3 }) {
  const tramos = [];
  let a = desde;
  for (const p of [...puertas].sort((m, n) => m - n)) { tramos.push([a, p - 0.7]); a = p + 0.7; }
  tramos.push([a, hasta]);
  return tramos.filter(([m, n]) => n - m > 0.05).map(([m, n]) => {
    const c = (m + n) / 2, l = n - m;
    const pos = (y) => (eje === "x" ? [c, y, fijo] : [fijo, y, c]);
    const tam = (h, g) => (eje === "x" ? [l, h, g] : [g, h, l]);
    const postes = [m, n, ...Array.from({ length: Math.floor(l / 2.6) }, (_, i) => m + (i + 1) * (l / (Math.floor(l / 2.6) + 1)))];
    return (
      <group key={m}>
        <Caja p={pos(bajo / 2)} s={tam(bajo, 0.14)} c={C.pared} />
        <Caja p={pos(bajo + (alto - bajo) / 2)} s={tam(alto - bajo, 0.03)} m={CRISTAL} />
        <Caja p={pos(alto)} s={tam(0.07, 0.08)} c={C.marco} />
        {postes.map((q) => <Caja key={q} p={eje === "x" ? [q, (alto + bajo) / 2, fijo] : [fijo, (alto + bajo) / 2, q]} s={[0.06, alto - bajo, 0.06]} c={C.marco} />)}
      </group>
    );
  });
}

function Edificio() {
  const { x0, x1, z0, z1 } = EDIFICIO;
  const ancho = x1 - x0, fondo = z1 - z0;
  const puertasAtras = ["busqueda", "control", "archivo", "despacho"].map((s) => SALAS[s].puerta[0]);
  const puertasDelante = ["cafe", "despensa", "negocio", "escaparate"].map((s) => SALAS[s].puerta[0]);
  return (
    <group>
      {/* Losa, calle y acera */}
      <Caja p={[0, -0.22, 1]} s={[ancho + 0.6, 0.4, fondo + 0.6 + 2]} c="#b9bec6" />
      <Caja p={[0, -0.05, z1 + 1.2]} s={[ancho + 3, 0.1, 2.2]} c={C.acera} />
      <Caja p={[0, -0.12, z1 + 3.6]} s={[ancho + 3, 0.1, 2.6]} c={C.asfalto} />
      {[-12, -6, 0, 6, 12].map((x) => <Caja key={x} p={[x, -0.06, z1 + 3.6]} s={[2, 0.01, 0.16]} c="#f8fafc" />)}
      {/* Suelos de cada sala y el pasillo */}
      {Object.entries(SALAS).map(([id, s]) => <Caja key={id} p={[(s.x0 + s.x1) / 2, 0.005, (s.z0 + s.z1) / 2]} s={[s.x1 - s.x0, 0.01, s.z1 - s.z0]} c={s.suelo} />)}
      <Caja p={[0, 0.005, 0]} s={[ancho, 0.01, 2.4]} c={C.pasillo} />
      {/* Paredes exteriores de atrás y de la izquierda, altas y con ventanales */}
      <Caja p={[0, ALTO / 2, z0 - 0.12]} s={[ancho + 0.25, ALTO, 0.25]} c={C.pared} />
      <Caja p={[x0 - 0.12, ALTO / 2, 0]} s={[0.25, ALTO, fondo]} c={C.pared} />
      <Caja p={[0, ALTO + 0.04, z0 - 0.12]} s={[ancho + 0.3, 0.08, 0.3]} c={C.marco} />
      <Caja p={[x0 - 0.12, ALTO + 0.04, 0]} s={[0.3, 0.08, fondo]} c={C.marco} />
      {[-13.5, -4.5, 2.5, 14.5].map((x) => <Ventana key={x} x={x} z={z0 + 0.02} ancho={x === 14.5 ? 1.8 : 3} />)}
      {[-6, 6.5, 9.4].map((z) => <Ventana key={z} x={x0 + 0.02} z={z} ancho={z === -6 ? 3.6 : 2.2} giro={Math.PI / 2} />)}
      {/* Pasillo: tabiques bajos hacia la cámara, más altos al fondo; tabiques entre salas */}
      <Tabique eje="x" fijo={-1.2} desde={x0} hasta={x1} puertas={puertasAtras} bajo={0.45} alto={2} />
      <Tabique eje="x" fijo={1.2} desde={x0} hasta={x1} puertas={puertasDelante} bajo={1} alto={2.3} />
      {[-1, 6, 11].map((x) => <Tabique key={x} eje="z" fijo={x} desde={z0} hasta={-1.2} bajo={0.9} />)}
      {[-6, 0, 5].map((x) => <Tabique key={x} eje="z" fijo={x} desde={1.2} hasta={z1} bajo={0.9} />)}
      {/* Delante y a la derecha, un bordillo (para ver dentro); el escaparate, de cristal hasta arriba */}
      <Caja p={[(x0 + 5) / 2, 0.15, z1]} s={[5 - x0, 0.3, 0.14]} c={C.pared} />
      <Caja p={[x1, 0.15, 0]} s={[0.14, 0.3, fondo]} c={C.pared} />
      <Tabique eje="x" fijo={z1} desde={5} hasta={x1} bajo={0.35} alto={2.5} />
    </group>
  );
}

// ---------- Muebles ----------
function Escritorio({ x, z, luz, grande = false }) {
  const w = grande ? 2.2 : 1.4, d = grande ? 0.95 : 0.75;
  return (
    <group position={[x, 0, z]}>
      <Caja p={[0, 0.74, 0]} s={[w, 0.06, d]} c={grande ? C.maderaOscura : C.madera} />
      <Caja p={[-w / 2 + 0.05, 0.36, 0]} s={[0.06, 0.72, d - 0.1]} c={C.maderaOscura} />
      <Caja p={[w / 2 - 0.05, 0.36, 0]} s={[0.06, 0.72, d - 0.1]} c={C.maderaOscura} />
      {/* Dos pantallas negras; por detrás, el piloto del color de su estado */}
      {(grande ? [0] : [-0.33, 0.33]).map((dx) => (
        <group key={dx} position={[dx, 0.77, 0.16]}>
          <Caja p={[0, 0.08, 0]} s={[0.06, 0.16, 0.06]} c={C.negro} />
          <Caja p={[0, 0.34, 0]} s={[0.6, 0.36, 0.04]} c={C.pantalla} />
          <Caja p={[0, 0.34, -0.022]} s={[0.52, 0.29, 0.005]} m={mat(luz, { emissive: luz, emissiveIntensity: 0.55 })} />
        </group>
      ))}
      <Caja p={[0, 0.78, -0.15]} s={[0.45, 0.02, 0.14]} c="#e5e7eb" />
      {/* Silla negra */}
      <group position={[0, 0, -0.78]}>
        <Caja p={[0, 0.46, 0]} s={[0.5, 0.08, 0.46]} c={C.negro} />
        <Caja p={[0, 0.8, -0.23]} s={[0.48, 0.6, 0.07]} c={C.negro} />
        <Cil p={[0, 0.22, 0]} r={0.03} h={0.44} c="#4b5563" />
        <Cil p={[0, 0.03, 0]} r={0.24} h={0.04} c="#374151" />
      </group>
    </group>
  );
}

function Planta({ x, z, alta = 1 }) {
  return (
    <group position={[x, 0, z]}>
      <Cil p={[0, 0.22, 0]} r={0.22} h={0.44} c={C.maceta} />
      <mesh geometry={BOLA} material={mat(C.verde)} position={[0, 0.55 + 0.3 * alta, 0]} scale={[0.4, 0.5 * alta, 0.4]} />
      <mesh geometry={BOLA} material={mat(C.verdeClaro)} position={[0.12, 0.9 + 0.45 * alta, 0.05]} scale={[0.28, 0.38 * alta, 0.28]} />
    </group>
  );
}

function Lampara({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Cil p={[0, 0.02, 0]} r={0.18} h={0.04} c={C.marco} />
      <Cil p={[0, 0.8, 0]} r={0.025} h={1.6} c={C.marco} />
      <Cil p={[0, 1.65, 0]} r={0.22} h={0.3} m={mat("#f3e6c8", { emissive: "#fde68a", emissiveIntensity: 0.6 })} />
    </group>
  );
}

// Sofá mirando hacia +x (largo en z)
function Sofa({ x, z, largo = 2.2, color = "#6b7f99" }) {
  return (
    <group position={[x, 0, z]}>
      <Caja p={[0, 0.25, 0]} s={[0.85, 0.3, largo]} c={color} />
      <Caja p={[0.05, 0.43, 0]} s={[0.7, 0.1, largo - 0.3]} c={color} />
      <Caja p={[-0.33, 0.62, 0]} s={[0.22, 0.6, largo]} c={color} />
      {[-1, 1].map((k) => <Caja key={k} p={[0, 0.5, k * (largo / 2 - 0.08)]} s={[0.85, 0.32, 0.16]} c={color} />)}
    </group>
  );
}

function Estanteria({ x, z, ancho, alto = 2, fondo = 0.42, baldas = 4, color = C.maderaOscura }) {
  return (
    <group position={[x, 0, z]}>
      <Caja p={[-ancho / 2, alto / 2, 0]} s={[0.05, alto, fondo]} c={color} />
      <Caja p={[ancho / 2, alto / 2, 0]} s={[0.05, alto, fondo]} c={color} />
      <Caja p={[0, alto / 2, -fondo / 2]} s={[ancho, alto, 0.03]} c={color} />
      {Array.from({ length: baldas + 1 }, (_, i) => <Caja key={i} p={[0, 0.06 + (i * (alto - 0.1)) / baldas, 0]} s={[ancho, 0.04, fondo]} c={color} />)}
    </group>
  );
}

// Archivadores (instanciados): se llenan según los eventos que hay en la agenda
const ESTANTES_ARCHIVO = [
  { x: 8.5, z: -10.55, ancho: 4.2, alto: 2.2, baldas: 4 },
  { x: 8.5, z: -8, ancho: 3.4, alto: 1.5, baldas: 3 },
  { x: 8.5, z: -5.8, ancho: 3.4, alto: 1.5, baldas: 3 },
];
const COLORES_ARCHIVO = ["#f43f5e", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#64748b"].map((c) => new THREE.Color(c));
function Archivadores({ agenda }) {
  const ref = useRef();
  const huecos = useMemo(() => ESTANTES_ARCHIVO.flatMap((e) => Array.from({ length: e.baldas }, (_, b) => {
    const n = Math.floor((e.ancho - 0.2) / 0.13);
    return Array.from({ length: n }, (_, i) => [e.x - e.ancho / 2 + 0.16 + i * 0.13, 0.08 + (b * (e.alto - 0.1)) / e.baldas + 0.17, e.z + 0.02]);
  }).flat()), []);
  const llenos = Math.min(huecos.length, Math.round((Math.min(agenda, 500) / 500) * huecos.length) + (agenda > 0 ? 3 : 0));
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < huecos.length; i++) {
      o.position.set(...huecos[i]);
      o.scale.set(i < llenos ? 0.1 : 0.0001, 0.32, 0.3);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORES_ARCHIVO[(i * 7) % COLORES_ARCHIVO.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [huecos, llenos]);
  return (
    <group>
      {ESTANTES_ARCHIVO.map((e) => <Estanteria key={e.z} {...e} />)}
      <instancedMesh ref={ref} args={[CAJA, mat("#ffffff"), huecos.length]} />
    </group>
  );
}

// Tarros y quesos de la Despensa (instanciados)
function Productos() {
  const ref = useRef();
  const lista = useMemo(() => Array.from({ length: 3 }, (_, b) => Array.from({ length: 14 }, (_, i) => [-5.25 + i * 0.34, 0.12 + b * 0.42, 9.62])).flat(), []);
  useEffect(() => {
    const m = ref.current, o = new THREE.Object3D();
    const col = ["#b45309", "#dc2626", "#facc15", "#65a30d", "#7c2d12", "#f5f5f4"].map((c) => new THREE.Color(c));
    lista.forEach((p, i) => {
      o.position.set(p[0], p[1] + 0.1, p[2]);
      o.scale.set(0.12, i % 3 === 0 ? 0.12 : 0.2, 0.12);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col[(i * 5) % col.length]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [lista]);
  return <instancedMesh ref={ref} args={[CIL, mat("#ffffff"), lista.length]} />;
}

function Cafeteria() {
  return (
    <group>
      {/* Barra con cafetera y taburetes */}
      <Caja p={[(BARRA.x0 + BARRA.x1) / 2, 0.52, BARRA.z]} s={[BARRA.x1 - BARRA.x0, 1.04, 0.6]} c={C.maderaOscura} />
      <Caja p={[(BARRA.x0 + BARRA.x1) / 2, 1.07, BARRA.z]} s={[BARRA.x1 - BARRA.x0 + 0.1, 0.06, 0.7]} c="#e5e7eb" />
      <group position={[-10.6, 1.1, BARRA.z]}>
        <Caja p={[0, 0.25, 0]} s={[0.5, 0.5, 0.4]} c="#94a3b8" />
        <Caja p={[0, 0.55, 0]} s={[0.5, 0.1, 0.42]} c={C.negro} />
        <Cil p={[0, 0.3, 0.2]} r={0.04} h={0.03} m={mat("#f59e0b", { emissive: "#f59e0b", emissiveIntensity: 1 })} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[-15.2 + i * 0.95, 0, 2.6]}>
          <Cil p={[0, 0.36, 0]} r={0.03} h={0.72} c={C.marco} />
          <Cil p={[0, 0.74, 0]} r={0.2} h={0.06} c={C.negro} />
        </group>
      ))}
      {/* Mesas redondas con tres sillas */}
      {CAFE_MESAS.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cil p={[x, 0.74, z]} r={0.55} h={0.05} c={C.madera} />
          <Cil p={[x, 0.37, z]} r={0.05} h={0.74} c={C.marco} />
          {[[0, -0.8], [-0.85, 0], [0.85, 0]].map(([dx, dz]) => (
            <group key={`${dx}${dz}`} position={[x + dx, 0, z + dz]}>
              <Caja p={[0, 0.45, 0]} s={[0.42, 0.06, 0.42]} c={C.madera} />
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Caja key={`${a}${b}`} p={[a * 0.17, 0.22, b * 0.17]} s={[0.04, 0.44, 0.04]} c={C.marco} />)}
            </group>
          ))}
          <Cil p={[x + 0.15, 0.81, z + 0.1]} r={0.05} h={0.09} c="#f8fafc" />
        </group>
      ))}
      {/* Sofás para echarse, con lámparas de pie */}
      {CAFE_SOFAS.map(([x, z], i) => <Sofa key={z} x={x} z={z} color={i ? "#b45309" : "#6b7f99"} />)}
      <Lampara x={-15.5} z={4.6} />
      <Lampara x={-15.5} z={10.5} />
      <Caja p={[-14.6, 0.2, 7.5]} s={[0.5, 0.4, 0.5]} c={C.madera} />
      <Planta x={-6.6} z={10.4} alta={1.4} />
      <Planta x={-6.6} z={6.2} />
      {/* Fuente de agua */}
      <group position={[-6.55, 0, 2.2]}>
        <Caja p={[0, 0.5, 0]} s={[0.4, 1, 0.4]} c="#e5e7eb" />
        <Cil p={[0, 1.2, 0]} r={0.16} h={0.4} m={mat("#7dd3fc", { transparent: true, opacity: 0.7 })} />
      </group>
    </group>
  );
}

function Despacho({ luz }) {
  return (
    <group>
      <mesh geometry={DISCO} material={mat("#9f1239")} position={[13.5, 0.02, -5.8]} rotation={[-Math.PI / 2, 0, 0]} scale={1.9} />
      <Escritorio x={13.5} z={-6.2} luz={luz} grande />
      <Estanteria x={13.5} z={-10.55} ancho={3} alto={2.1} />
      {[0.35, 0.87, 1.39].map((y, i) => <Caja key={y} p={[13.5 - 0.3 * i, y + 0.12, -10.5]} s={[2.2, 0.28, 0.25]} c={["#f43f5e", "#0ea5e9", "#f59e0b"][i]} />)}
      {/* Globo terráqueo encima */}
      <Cil p={[12.5, 2.2, -10.5]} r={0.1} h={0.08} c={C.marco} />
      <mesh geometry={BOLA} material={mat("#3b82f6")} position={[12.5, 2.48, -10.5]} scale={0.24} />
      {/* Telescopio junto a la ventana */}
      <group position={[15.1, 0, -9.6]}>
        {[0, 2.1, 4.2].map((a) => <Caja key={a} p={[Math.sin(a) * 0.2, 0.5, Math.cos(a) * 0.2]} s={[0.04, 1, 0.04]} c={C.marco} rotation={[Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2]} />)}
        <Cil p={[0, 1.15, 0.1]} r={0.08} h={0.9} c="#e5e7eb" rotation={[1.1, 0, 0]} />
      </group>
      <Sofa x={11.55} z={-8.4} largo={1.8} color="#334155" />
      <Lampara x={11.5} z={-10.4} />
      <Planta x={11.6} z={-2} alta={1.3} />
      {/* Tu buzón, junto a la puerta */}
      <group position={[DESTINOS.buzon[0], 0, DESTINOS.buzon[2]]}>
        <Caja p={[0, 0.45, 0]} s={[0.08, 0.9, 0.08]} c={C.marco} />
        <Caja p={[0, 1, 0]} s={[0.5, 0.35, 0.35]} c="#dc2626" />
      </group>
    </group>
  );
}

function Control({ sinFuente }) {
  const [mx, mz] = MOSTRADOR;
  const lleno = Math.min(1, sinFuente / 40);
  return (
    <group>
      <Caja p={[mx, 0.52, mz]} s={[3.4, 1.04, 0.8]} c={C.maderaOscura} />
      <Caja p={[mx, 1.07, mz]} s={[3.5, 0.06, 0.9]} c="#f1f5f9" />
      <Caja p={[mx - 1.2, 0.52, mz - 0.9]} s={[0.8, 1.04, 1.2]} c={C.maderaOscura} />
      {/* Flexo y lupa: aquí se comprueba que cada evento tiene fuente */}
      <group position={[mx + 1.1, 1.1, mz]}>
        <Cil p={[0, 0.02, 0]} r={0.12} h={0.04} c={C.marco} />
        <Caja p={[0, 0.25, 0]} s={[0.03, 0.5, 0.03]} c={C.marco} />
        <Cil p={[0.1, 0.5, 0]} r={0.12} h={0.12} m={mat("#fde68a", { emissive: "#fde68a", emissiveIntensity: 0.8 })} />
      </group>
      <Cil p={[mx - 0.4, 1.12, mz + 0.05]} r={0.13} h={0.02} m={mat("#bae6fd", { emissive: "#bae6fd", emissiveIntensity: 0.3 })} rotation={[Math.PI / 2, 0, 0]} />
      {[0, 1, 2].map((i) => <Caja key={i} p={[mx - 0.9 + i * 0.05, 1.12 + i * 0.03, mz]} s={[0.32, 0.03, 0.24]} c={["#fde68a", "#fecaca", "#bbf7d0"][i]} />)}
      {/* Papelera de lo que no tenía fuente (se llena) */}
      <group position={[DESTINOS.papelera[0], 0, DESTINOS.papelera[2]]}>
        <Cil p={[0, 0.4, 0]} r={0.42} h={0.8} c="#475569" />
        <Cil p={[0, 0.06 + 0.72 * lleno, 0]} r={0.38} h={0.12 + 1.44 * lleno * 0.5} c="#f8fafc" />
      </group>
      {/* Mesa de entrada del archivo */}
      <Caja p={[DESTINOS.archivo[0], 0.42, DESTINOS.archivo[2]]} s={[1.4, 0.84, 0.6]} c={C.madera} />
      <Planta x={-0.5} z={-10.4} alta={1.2} />
      <Planta x={5.5} z={-10.4} />
    </group>
  );
}

function Busqueda() {
  return (
    <group>
      {/* Alfombras: agenda (rosa) delante… y territorio (azul) en la última fila */}
      <Caja p={[-8.4, 0.015, -7.1]} s={[14, 0.01, 5.7]} c="#f6d4d8" />
      <Caja p={[-8.4, 0.015, -3.1]} s={[14, 0.01, 2.6]} c="#cfe6f3" />
      {/* Pizarra con el logo */}
      <Caja p={[-8.4, 1.7, -10.84]} s={[2.8, 1.3, 0.05]} c="#0f172a" />
      {["#f43f5e", "#fb923c", "#facc15"].map((c, i) => <Cil key={c} p={[-9.2 + i * 0.8, 1.7, -10.8]} r={0.28} h={0.02} m={mat(c, { emissive: c, emissiveIntensity: 0.3 })} rotation={[Math.PI / 2, 0, 0]} />)}
      <Planta x={-15.4} z={-10.4} alta={1.5} />
      <Planta x={-1.6} z={-10.4} alta={1.2} />
      <Planta x={-15.4} z={-1.9} />
    </group>
  );
}

function Escaparate({ planes }) {
  const tarjetas = Math.min(8, planes || 0);
  return (
    <group>
      {/* Mesa con los planes de ayer y una pantalla con la cifra */}
      <Caja p={[8.5, 0.4, 7]} s={[2.6, 0.8, 1.2]} c={C.madera} />
      {Array.from({ length: tarjetas }, (_, i) => (
        <Caja key={i} p={[7.6 + (i % 4) * 0.6, 0.86, 6.75 + Math.floor(i / 4) * 0.5]} s={[0.42, 0.02, 0.3]} c={["#fecdd3", "#fed7aa", "#fef08a", "#bae6fd"][i % 4]} rotation={[0, (i % 3) * 0.12 - 0.12, 0]} />
      ))}
      <group position={[12.5, 0, 5]}>
        <Caja p={[0, 0.6, 0]} s={[0.1, 1.2, 0.1]} c={C.marco} />
        <Caja p={[0, 1.55, 0]} s={[2, 1.1, 0.08]} c={C.pantalla} />
        <Caja p={[0, 1.55, 0.045]} s={[1.85, 0.95, 0.01]} m={mat("#fb7185", { emissive: "#fb7185", emissiveIntensity: 0.5 })} />
      </group>
      <Sofa x={5.6} z={8.5} largo={2} color="#e11d48" />
      <Planta x={15.4} z={2} alta={1.3} />
      <Planta x={15.4} z={10.3} />
      {/* En la calle: gente mirando el escaparate (más cuantos más planes) y árboles */}
      {Array.from({ length: Math.min(7, Math.ceil((planes || 0) / 6)) }, (_, i) => (
        <group key={i} position={[6.5 + i * 1.3, 0, 12.1 + (i % 2) * 0.4]} rotation={[0, Math.PI, 0]}>
          <Caja p={[0, 0.45, 0]} s={[0.3, 0.9, 0.2]} c="#334155" />
          <Caja p={[0, 1.15, 0]} s={[0.42, 0.55, 0.26]} c={["#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6"][i % 4]} />
          <mesh geometry={BOLA} material={mat(PIELES[i % PIELES.length])} position={[0, 1.6, 0]} scale={0.17} />
        </group>
      ))}
      {[-13, -3, 3.5, 15].map((x) => (
        <group key={x} position={[x, 0, 12.1]}>
          <Cil p={[0, 0.6, 0]} r={0.07} h={1.2} c={C.maderaOscura} />
          <mesh geometry={BOLA} material={mat(C.verde)} position={[0, 1.6, 0]} scale={[0.65, 0.75, 0.65]} />
        </group>
      ))}
    </group>
  );
}

function Despensa() {
  return (
    <group>
      <Estanteria x={-3} z={9.7} ancho={5} alto={1.3} fondo={0.4} baldas={3} />
      <Productos />
      {[[-5.4, 6.4], [-5.4, 7.1]].map(([x, z]) => <Caja key={z} p={[x, 0.25, z]} s={[0.6, 0.5, 0.5]} c="#c08a4e" />)}
      <Planta x={-0.5} z={10.4} />
    </group>
  );
}

function Negocio() {
  return (
    <group>
      {/* Corcho con notas */}
      <group position={[2.5, 0, 9.7]}>
        {[-0.9, 0.9].map((x) => <Caja key={x} p={[x, 0.7, 0]} s={[0.06, 1.4, 0.06]} c={C.marco} />)}
        <Caja p={[0, 1.25, 0]} s={[2, 1, 0.05]} c="#c69c6d" />
        {Array.from({ length: 7 }, (_, i) => <Caja key={i} p={[-0.7 + (i % 4) * 0.45, 1.05 + Math.floor(i / 4) * 0.4, 0.04]} s={[0.3, 0.25, 0.01]} c={["#fde68a", "#fecdd3", "#bbf7d0", "#bae6fd"][i % 4]} />)}
      </group>
      <Planta x={4.5} z={10.4} alta={1.2} />
    </group>
  );
}

// ---------- Personas ----------
// La pose la escribe el director en cada fotograma: { x, z, giro, modo, lleva }
// modo: anda · teclea · sentado · duerme · espera · entrega · jefe
function Persona({ e, poses, piel, pelo, camisa, alTocar, semilla, jefe, rotulo }) {
  const g = useRef(), cuerpo = useRef(), cabeza = useRef(), brazoI = useRef(), brazoD = useRef(), piernaI = useRef(), piernaD = useRef(), humo = useRef(), carpeta = useRef(), taza = useRef();
  const [humos] = useState(() => [0, 1, 2].map(() => new THREE.MeshLambertMaterial({ color: "#64748b", transparent: true, opacity: 0.4, depthWrite: false })));
  useFrame(({ clock }) => {
    const p = poses.get(e.id);
    if (!g.current) return;
    g.current.visible = !!p;
    if (!p) return;
    const t = clock.elapsedTime + semilla;
    g.current.position.set(p.x, 0, p.z);
    g.current.rotation.y = p.giro || 0;
    const sentado = ["teclea", "sentado", "duerme", "jefe"].includes(p.modo);
    const anda = p.modo === "anda";
    cuerpo.current.position.y = sentado ? (p.modo === "duerme" ? -0.38 : -0.32) : anda ? Math.abs(Math.sin(t * 10)) * 0.05 : 0;
    cuerpo.current.rotation.x = p.modo === "duerme" ? -0.25 : p.modo === "teclea" ? 0.06 : 0;
    const paso = anda ? Math.sin(t * 10) * 0.6 : 0;
    piernaI.current.rotation.x = sentado ? -1.45 : paso;
    piernaD.current.rotation.x = sentado ? -1.45 : -paso;
    cabeza.current.rotation.set(0, 0, 0);
    if (p.modo === "teclea") {
      brazoI.current.rotation.x = -1.25 + Math.sin(t * 14) * 0.12; brazoD.current.rotation.x = -1.25 + Math.cos(t * 14) * 0.12;
      cabeza.current.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.04;
    } else if (p.modo === "jefe") {
      brazoI.current.rotation.x = brazoD.current.rotation.x = -1.2;
      cabeza.current.rotation.y = Math.sin(t * 0.5) * 0.4;
    } else if (p.modo === "duerme") {
      brazoI.current.rotation.x = brazoD.current.rotation.x = -0.3;
      cabeza.current.rotation.z = 0.45 + Math.sin(t * 1.1) * 0.04;
    } else if (p.modo === "sentado") {
      // Con un café: de vez en cuando se lo lleva a la boca
      const sorbo = Math.max(0, Math.sin(t * 0.7) - 0.6) * 4;
      brazoI.current.rotation.x = -0.9; brazoD.current.rotation.x = -0.9 - sorbo * 0.9;
      cabeza.current.rotation.y = Math.sin(t * 0.4) * 0.3;
    } else if (p.modo === "espera") {
      brazoI.current.rotation.x = brazoD.current.rotation.x = 0;
      brazoI.current.rotation.z = 0.5; brazoD.current.rotation.z = -0.5;
      cabeza.current.rotation.z = Math.sin(t * 6) * 0.1;
      piernaD.current.rotation.x = Math.max(0, Math.sin(t * 8)) * -0.3;
    } else if (p.modo === "entrega") {
      brazoI.current.rotation.x = brazoD.current.rotation.x = -1.4;
    } else {
      brazoI.current.rotation.x = p.lleva ? -1.3 : -paso * 0.8; brazoD.current.rotation.x = p.lleva ? -1.3 : paso * 0.8;
    }
    if (p.modo !== "espera") { brazoI.current.rotation.z = 0; brazoD.current.rotation.z = 0; }
    if (carpeta.current) carpeta.current.visible = !!p.lleva;
    if (taza.current) taza.current.visible = p.modo === "sentado";
    if (humo.current) {
      humo.current.visible = p.modo === "espera";
      if (humo.current.visible) humo.current.children.forEach((b, i) => {
        const f = (t * 0.6 + i / 3) % 1;
        b.position.set(Math.sin(f * 6 + i) * 0.15, 1.9 + f * 0.9, 0);
        b.scale.setScalar(0.1 + f * 0.22);
        b.material.opacity = 0.5 * (1 - f);
      });
    }
  });
  const traje = jefe ? "#0f172a" : camisa;
  return (
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); if (ev.delta > 8) return; alTocar(); }}>
      <group ref={cuerpo}>
        {[[-0.11, piernaI], [0.11, piernaD]].map(([x, r]) => (
          <group key={x} ref={r} position={[x, 0.82, 0]}>
            <Caja p={[0, -0.38, 0]} s={[0.16, 0.76, 0.18]} c={jefe ? "#1e293b" : "#334155"} />
            <Caja p={[0, -0.76, 0.06]} s={[0.17, 0.08, 0.3]} c="#0f172a" />
          </group>
        ))}
        <Caja p={[0, 1.12, 0]} s={[0.48, 0.6, 0.28]} c={traje} />
        {jefe && <Caja p={[0, 1.2, 0.145]} s={[0.08, 0.36, 0.02]} c="#f43f5e" />}
        {[[-0.31, brazoI], [0.31, brazoD]].map(([x, r]) => (
          <group key={x} ref={r} position={[x, 1.38, 0]}>
            <Caja p={[0, -0.24, 0]} s={[0.13, 0.5, 0.14]} c={traje} />
            <mesh geometry={BOLA} material={mat(piel)} position={[0, -0.52, 0]} scale={0.07} />
          </group>
        ))}
        <group ref={carpeta} visible={false} position={[0, 1.05, 0.42]}>
          <Caja p={[0, 0, 0]} s={[0.36, 0.05, 0.28]} c="#facc15" />
        </group>
        <group ref={taza} visible={false} position={[0.31, 1.0, 0.35]}>
          <Cil p={[0, 0, 0]} r={0.05} h={0.1} c="#f8fafc" />
        </group>
        <group ref={cabeza} position={[0, 1.66, 0]}>
          <mesh geometry={BOLA} material={mat(piel)} scale={0.24} />
          <mesh geometry={BOLA} material={mat(jefe ? "#9ca3af" : pelo)} position={[0, 0.09, -0.03]} scale={[0.255, 0.18, 0.25]} />
          {[-0.08, 0.08].map((x) => <mesh key={x} geometry={BOLA} material={mat("#0f172a")} position={[x, 0.02, 0.215]} scale={0.03} />)}
        </group>
      </group>
      <group ref={humo} visible={false}>
        {humos.map((m, i) => <mesh key={i} geometry={BOLA} material={m} />)}
      </group>
      {rotulo && (
        <Etiqueta position={[0, rotulo.alto || 2.35, 0]} center>
          <span className={`select-none whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white shadow ${rotulo.color || "bg-slate-900/85"} ${rotulo.soloGrande ? "hidden sm:inline-block" : ""}`}>{rotulo.texto}</span>
        </Etiqueta>
      )}
    </group>
  );
}

// Las carpetas que vuelan del mostrador a su sitio (repetición)
function Carpetas({ rep, reloj }) {
  const refs = useRef([]);
  useFrame(() => {
    const vuelan = rep ? enVuelo(rep, reloj.get()) : [];
    refs.current.forEach((m, i) => {
      if (!m) return;
      const v = vuelan[i];
      m.visible = !!v;
      if (!v) return;
      const a = DESTINOS.mostrador, b = DESTINOS[v.destino];
      m.position.set(a[0] + (b[0] - a[0]) * v.t, a[1] + (b[1] - a[1]) * v.t + Math.sin(v.t * Math.PI) * 2.2, a[2] + (b[2] - a[2]) * v.t);
      m.rotation.y = v.t * 6;
    });
  });
  const colores = { archivo: "#22c55e", buzon: "#f59e0b", papelera: "#94a3b8" };
  return Array.from({ length: 6 }, (_, i) => (
    <group key={i} ref={(m) => { refs.current[i] = m; }} visible={false}>
      <Caja p={[0, 0, 0]} s={[0.42, 0.06, 0.32]} c="#facc15" />
      <Caja p={[0, 0.04, 0]} s={[0.3, 0.02, 0.2]} c={colores[["archivo", "buzon", "papelera"][i % 3]]} />
    </group>
  ));
}

// El director: en directo deja a cada uno en su sitio; en la repetición mueve a todos según el reloj
function Director({ rep, enDirecto, poses, reloj, repitiendo, pausa, alAcabar }) {
  const s = useRef(0);
  const acabado = useRef(false);
  useFrame((_, delta) => {
    if (repitiendo && rep && !rep.vacia) {
      if (!pausa) s.current = Math.min(rep.duracion, s.current + Math.min(delta, 0.1));
      reloj.set(s.current);
      for (const [id, viva] of Object.entries(enDirecto)) {
        poses.set(id, id === "jefe" ? viva : poseEn(rep, id, s.current) || rep.quietos?.[id] || viva);
      }
      if (s.current >= rep.duracion && !acabado.current) { acabado.current = true; alAcabar(); }
      return;
    }
    for (const [id, p] of Object.entries(enDirecto)) poses.set(id, p);
  });
  return null;
}

// ---------- Cámara isométrica: encuadra la sala elegida y no deja salirse del edificio ----------
const VISTAS = {
  todo: [EDIFICIO.x0 - 0.3, EDIFICIO.x1 + 0.3, EDIFICIO.z0 - 0.3, EDIFICIO.z1 + 1.2],
  ...Object.fromEntries(Object.entries(SALAS).map(([id, s]) => [id, [s.x0, s.x1, s.z0, s.z1]])),
};
// arriba / abajo: lo que tapan la hora y la barra de salas (en píxeles)
function encuadre(caja, w, h, arriba = 84, abajo = 62) {
  const [x0, x1, z0, z1] = caja;
  const centro = new THREE.Vector3((x0 + x1) / 2, 0.8, (z0 + z1) / 2);
  const f = OFFSET.clone().negate().normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  let [rmin, rmax, umin, umax] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, 2.6]) {
    const v = new THREE.Vector3(x, y, z).sub(centro);
    rmin = Math.min(rmin, v.dot(r)); rmax = Math.max(rmax, v.dot(r));
    umin = Math.min(umin, v.dot(u)); umax = Math.max(umax, v.dot(u));
  }
  const zoom = Math.min(w / (rmax - rmin), Math.max(120, h - arriba - abajo) / (umax - umin)) * 0.96;
  centro.addScaledVector(r, (rmin + rmax) / 2).addScaledVector(u, (umin + umax) / 2 + (arriba - abajo) / 2 / zoom);
  return { centro, zoom };
}

function Camara({ vista }) {
  const { size } = useThree();
  const controles = useRef(), tocando = useRef(false), llegado = useRef(false);
  const destino = useMemo(() => encuadre(VISTAS[vista.trim()] || VISTAS.todo, size.width, size.height), [vista, size.width, size.height]);
  const minimo = useMemo(() => encuadre(VISTAS.todo, size.width, size.height).zoom * 0.85, [size.width, size.height]);
  // Al elegir otra sala, la cámara vuelve a moverse sola (hasta que la arrastres tú)
  useEffect(() => { llegado.current = false; tocando.current = false; }, [destino]);
  useFrame(() => {
    const c = controles.current;
    if (!c) return;
    const cam = c.object;
    c.minZoom = minimo;
    if (!llegado.current && !tocando.current) {
      c.target.lerp(destino.centro, 0.14);
      cam.zoom += (destino.zoom - cam.zoom) * 0.14;
      cam.position.copy(c.target).add(OFFSET);
      cam.updateProjectionMatrix();
      if (c.target.distanceTo(destino.centro) < 0.02 && Math.abs(destino.zoom - cam.zoom) < 0.05) llegado.current = true;
    }
    // Que no se escape del edificio al arrastrar
    const t = c.target;
    const cx = Math.min(EDIFICIO.x1 + 2, Math.max(EDIFICIO.x0 - 2, t.x)), cz = Math.min(EDIFICIO.z1 + 4, Math.max(EDIFICIO.z0 - 2, t.z));
    if (cx !== t.x || cz !== t.z) {
      cam.position.x += cx - t.x; cam.position.z += cz - t.z;
      t.x = cx; t.z = cz;
    }
    c.update();
  });
  return (
    <MapControls ref={controles} makeDefault enableRotate={false} enableDamping dampingFactor={0.15} maxZoom={90} zoomToCursor
      onStart={() => { tocando.current = true; }} />
  );
}

// ---------- La oficina ----------
const nombreDe = (id, porId) => (id === "jefe" ? "👔 Jefe" : id === "tu" ? "📱 Tú" : porId[id] ? `${porId[id].emoji} ${porId[id].nombre}` : id);
const horaMadrid = (ms) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const SALAS_BOTONES = [["todo", "Todo"], ["busqueda", "🔎 Búsqueda"], ["control", "🧐 Control"], ["archivo", "🗄️ Archivo"], ["despacho", "👔 Jefe"], ["cafe", "☕ Cafetería"], ["despensa", "🧺 Despensa"], ["negocio", "📣 Negocio"], ["escaparate", "🪟 Escaparate"]];

// Rótulos de cada sala, y los contadores del archivo, tu buzón y la papelera
function Rotulos({ rep, reloj, repitiendo, flujo, bandeja }) {
  const s = useSegundo(reloj);
  const c = repitiendo && rep ? contadores(rep, s) : null;
  // En el móvil, solo la cifra
  const cifras = {
    archivo: [c ? `+${fmt(c.archivo)}` : fmt(flujo.agenda), c ? " nuevos" : " en la agenda"],
    buzon: [c ? `+${fmt(c.buzon)}` : fmt(bandeja), c ? " dudosos" : " en tu buzón"],
    papelera: [c ? `+${fmt(c.papelera)}` : fmt(flujo.sinFuente), " sin fuente"],
  };
  return (
    <>
      {/* Las de atrás, en lo alto de su pared del fondo; las de delante, en su borde de la calle */}
      {Object.entries(SALAS).map(([id, sala]) => (
        <Etiqueta key={id} position={[sala.rotulo[0], sala.rotulo[1] < 0 ? ALTO + 0.4 : 0.5, sala.rotulo[1]]} center>
          <span className="select-none whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[9px] sm:text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-900/5">{sala.emoji} <span className="sm:hidden">{sala.corto}</span><span className="hidden sm:inline">{sala.nombre}</span></span>
        </Etiqueta>
      ))}
      {[["archivo", "📅", "bg-emerald-500"], ["buzon", "📥", "bg-amber-500"], ["papelera", "🗑", "bg-slate-500"]].map(([id, icono, color]) => (
        <Etiqueta key={id} position={[DESTINOS[id][0], DESTINOS[id][1] + 0.9, DESTINOS[id][2]]} center>
          <span className={`select-none whitespace-nowrap rounded-full ${color} px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow tabular-nums`}>{icono} {cifras[id][0]}<span className="hidden sm:inline">{cifras[id][1]}</span></span>
        </Etiqueta>
      ))}
    </>
  );
}

// Los bocadillos de la charla durante la repetición
function Bocadillos({ rep, reloj, poses, porId }) {
  const s = useSegundo(reloj);
  return bocadillosEn(rep, s).map((b) => {
    const p = poses.get(b.quien);
    if (!p) return null;
    return (
      <Etiqueta key={`${b.s0}${b.quien}`} position={[p.x, 2.5, p.z]} center zIndexRange={[40, 20]}>
        <div className="cz-fade w-[150px] sm:w-[210px] -translate-y-1/2 rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[12px] leading-snug text-slate-800 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 select-none">
          <p className="text-[10px] font-bold text-rose-500">{nombreDe(b.de, porId)} → {nombreDe(b.a, porId)}</p>
          <p className="line-clamp-3">{b.texto}</p>
        </div>
      </Etiqueta>
    );
  });
}

// Lo que está pasando en la repetición, en una línea (y la barra de progreso)
function Narrador({ rep, reloj, porId, pausa, setPausa, alParar }) {
  const s = useSegundo(reloj);
  const g = [...rep.golpes].reverse().find((x) => x.s <= s + 0.2);
  const c = contadores(rep, s);
  const quien = g ? g.empleados.filter((id) => porId[id]).map((id) => `${porId[id].emoji} ${porId[id].nombre}`).join(", ") : "";
  const que = !g ? "Todos en la cafetería, esperando su turno" : g.sinMostrador ? `${quien}: ${g.texto || "turno hecho"}` : `${quien}: ${g.busquedas} búsquedas → ${g.nuevos} nuevos, ${g.descartados} sin fuente`;
  return (
    <div className="pointer-events-auto rounded-2xl bg-slate-900/90 text-white px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="font-bold tabular-nums text-[15px]">🌙 {horaMadrid(horaReal(rep, s))}</span>
        <span className="flex-1 truncate text-[12px] text-white/80">{que}</span>
        <button onClick={() => setPausa((x) => !x)} className={`${PRESS} h-8 w-8 shrink-0 rounded-full bg-white/15 text-[12px]`} aria-label={pausa ? "Seguir" : "Pausar"}>{pausa ? "▶" : "❚❚"}</button>
        <button onClick={alParar} className={`${PRESS} h-8 w-8 shrink-0 rounded-full bg-white/15 text-[12px]`} aria-label="Salir de la repetición">✕</button>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-400 to-amber-300" style={{ width: `${(s / rep.duracion) * 100}%` }} /></div>
      <p className="mt-1 text-[11px] text-white/70 tabular-nums">📅 +{fmt(c.archivo)} a la agenda · 📥 +{fmt(c.buzon)} a tu buzón · 🗑 +{fmt(c.papelera)} sin fuente</p>
    </div>
  );
}

export default function Oficina3D({ departamentos, charla = [], golpes = [], bandeja = [], flujo = {}, alElegir, vista = "todo", setVista, repeticion, alAcabarRepeticion }) {
  const sitios = useMemo(() => planta(departamentos), [departamentos]);
  const empleados = useMemo(() => departamentos.flatMap((d) => d.empleados.map((e, i) => ({ ...e, dep: d.id, i }))), [departamentos]);
  const porId = useMemo(() => Object.fromEntries(empleados.map((e) => [e.id, e])), [empleados]);
  const [poses] = useState(() => new Map());
  const [reloj] = useState(crearReloj);
  const capa = useRef(null);
  const [pausa, setPausa] = useState(false);

  // La hora de ahora, cada 30 segundos (para saber quién está en su turno)
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    const tic = () => setAhora(Date.now());
    const r = requestAnimationFrame(tic);
    const i = setInterval(tic, 30000);
    return () => { cancelAnimationFrame(r); clearInterval(i); };
  }, []);

  // En directo: cada uno en su sitio según su turno y su estado
  const { enDirecto, rotulos, trabajando, siguiente, resto } = useMemo(() => {
    if (ahora == null) return { enDirecto: {}, rotulos: {}, trabajando: [], siguiente: null, resto: {} };
    const donde = Object.fromEntries(empleados.map((e) => [e.id, dondeEsta(e, ahora)]));
    const sitio = colocar(donde, sitios);
    const enDirecto = { jefe: { x: sitios.jefe.silla[0], z: sitios.jefe.silla[1], giro: 0, modo: "jefe" } };
    const rotulos = {};
    for (const e of empleados) {
      const { sitio: s, modo } = sitio[e.id];
      enDirecto[e.id] = { x: s.pos[0], z: s.pos[1], giro: s.giro || 0, modo };
      if (modo === "teclea") rotulos[e.id] = { texto: `${e.emoji} ${e.nombre}` };
      // Los que esperan en la puerta están juntos: sus rótulos, a dos alturas para que no se pisen
      if (modo === "espera") rotulos[e.id] = { texto: `⚠️ ${e.nombre}`, color: "bg-rose-600/90", alto: Object.values(rotulos).filter((r) => r.espera).length % 2 ? 2.9 : 2.35, espera: true };
      if (modo === "duerme") rotulos[e.id] = { texto: "💤", color: "bg-amber-500/90" };
    }
    const trabajando = empleados.filter((e) => donde[e.id] === "mesa");
    const cuenta = (d) => Object.values(donde).filter((x) => x === d).length;
    const prox = empleados.map((e) => ({ e, t: proximoTurno(e.turnos, ahora) })).filter((x) => x.t).sort((a, b) => a.t - b.t)[0] || null;
    return { enDirecto, rotulos, trabajando, siguiente: prox, resto: { cafe: cuenta("cafe"), sofa: cuenta("sofa"), puerta: cuenta("puerta") } };
  }, [ahora, empleados, sitios]);

  // La repetición de las últimas 24 h (se monta al pulsar ▶)
  const repitiendo = !!repeticion;
  const rep = useMemo(() => {
    if (!repeticion || ahora == null) return null;
    const r = montarRepeticion({ golpes, departamentos, bandeja, charla }, sitios, ahora);
    // Quien no trabajó en ese rato se queda en la cafetería, en los sitios que sobran
    const usados = new Set(Object.values(r.cafe || {}).map((s) => s.id));
    const libres = CAFE_SITIOS.filter((s) => !usados.has(s.id));
    r.quietos = Object.fromEntries(empleados.filter((e) => !r.tramosDe?.[e.id]).map((e, i) => {
      const s = libres[i % Math.max(1, libres.length)] || CAFE_SITIOS[0];
      return [e.id, { x: s.pos[0], z: s.pos[1], giro: s.giro, modo: "sentado" }];
    }));
    return r;
  }, [repeticion, ahora, golpes, departamentos, bandeja, charla, sitios, empleados]);

  const camisa = (e) => (CAMISAS[e.dep] || CAMISAS.agenda)[e.i % 3];
  const luzDe = (e) => (e.estado === "ok" && !trabajando.includes(e) ? "#64748b" : LUZ[e.estado] || LUZ.nuevo);

  return (
    <div className="relative rounded-[2rem] overflow-hidden ring-1 ring-white/80 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.5)] bg-gradient-to-b from-slate-100 via-slate-50 to-stone-100">
      <div className="relative h-[min(62dvh,125vw)] min-h-[400px] sm:h-[640px] touch-none">
        <div ref={capa} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        <Capa.Provider value={capa}>
          <Canvas orthographic dpr={[1, 1.5]} camera={{ position: OFFSET.toArray(), zoom: 10, near: -200, far: 400 }}
            fallback={<p className="p-6 text-sm text-slate-600">Tu navegador no puede mostrar la oficina en 3D. Usa la vista de lista.</p>}>
            <hemisphereLight args={["#ffffff", "#c7ccd4", 1.35]} />
            <directionalLight position={[12, 30, 18]} intensity={1.5} />
            <directionalLight position={[-14, 10, 8]} intensity={0.35} color="#fde2e4" />
            <Edificio />
            <Busqueda />
            <Control sinFuente={flujo.sinFuente || 0} />
            <Archivadores agenda={flujo.agenda || 0} />
            <Despacho luz="#f43f5e" />
            <Cafeteria />
            <Despensa />
            <Negocio />
            <Escaparate planes={flujo.planesAyer || 0} />
            {empleados.map((e) => <Escritorio key={e.id} x={sitios[e.id].mesa[0]} z={sitios[e.id].mesa[1]} luz={luzDe(e)} />)}
            {empleados.map((e, i) => (
              <Persona key={e.id} e={e} poses={poses} semilla={i * 1.7} camisa={camisa(e)} piel={PIELES[(i * 7) % PIELES.length]} pelo={PELOS[(i * 5) % PELOS.length]}
                rotulo={repitiendo ? null : rotulos[e.id]} alTocar={() => alElegir(e)} />
            ))}
            <Persona e={{ id: "jefe" }} jefe poses={poses} semilla={3} piel={PIELES[0]} pelo={PELOS[3]} rotulo={repitiendo ? null : { texto: "👔 El jefe", color: "bg-rose-600/90", soloGrande: true }} alTocar={() => alElegir({ jefe: true })} />
            <Carpetas rep={rep} reloj={reloj} />
            <Rotulos rep={rep} reloj={reloj} repitiendo={repitiendo} flujo={flujo} bandeja={bandeja.length} />
            {rep && !rep.vacia && <Bocadillos rep={rep} reloj={reloj} poses={poses} porId={porId} />}
            <Director key={repeticion || 0} rep={rep} enDirecto={enDirecto} poses={poses} reloj={reloj} repitiendo={repitiendo} pausa={pausa} alAcabar={alAcabarRepeticion} />
            <Camara vista={vista} />
          </Canvas>
        </Capa.Provider>
      </div>

      {/* Arriba: la hora y quién trabaja (o la repetición) */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20">
        {repitiendo && rep && !rep.vacia ? (
          <Narrador rep={rep} reloj={reloj} porId={porId} pausa={pausa} setPausa={setPausa} alParar={alAcabarRepeticion} />
        ) : repitiendo && rep?.vacia ? (
          <p className="pointer-events-auto inline-flex rounded-2xl bg-white/90 px-3 py-2 text-xs text-slate-700 shadow ring-1 ring-slate-900/5">No hay turnos en las últimas 24 h que repetir. <button onClick={alAcabarRepeticion} className="ml-2 font-semibold text-rose-600">Cerrar</button></p>
        ) : ahora != null && (
          <div className="inline-flex max-w-full flex-col rounded-2xl bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
            <span className="font-bold text-slate-900 text-[13px]">🕒 Ahora {horaMadrid(ahora)} · trabajando: {trabajando.length}</span>
            <span className="truncate">{trabajando.length ? trabajando.map((e) => `${e.emoji} ${e.nombre}`).join(", ") : siguiente ? `Próximo turno: ${siguiente.e.emoji} ${siguiente.e.nombre} a las ${horaMadrid(siguiente.t)}` : "Nadie de turno"}</span>
            <span className="truncate text-slate-500">☕ {resto.cafe} en la cafetería{resto.sofa ? ` · 💤 ${resto.sofa} dormidos (se saltaron el turno)` : ""}{resto.puerta ? ` · ⚠️ ${resto.puerta} en la puerta del jefe (fallaron)` : ""}</span>
          </div>
        )}
      </div>

      {/* Abajo: las salas */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-2.5">
        <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-full bg-white/85 p-1 ring-1 ring-slate-900/5 backdrop-blur">
          {SALAS_BOTONES.map(([id, texto]) => (
            <button key={id} onClick={() => setVista(id === vista ? `${id} ` : id)} className={`${PRESS} shrink-0 h-9 px-3 rounded-full text-[12px] sm:text-[13px] font-semibold ${vista.trim() === id ? "bg-slate-900 text-white" : "text-slate-600"}`}>{texto}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
