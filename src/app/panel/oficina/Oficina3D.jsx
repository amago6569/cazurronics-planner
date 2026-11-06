"use client";
// La oficina en 3D (three.js con @react-three/fiber): un edificio visto en isométrico, con una sala por cada paso
// del trabajo (ver guion.js). Cada empleado está donde toca según su horario real (vercel.json) y su estado:
// en su mesa durante su turno, en la cafetería si ya lo ha hecho, dormido en el sofá si se lo ha saltado y
// en la cafetería con su fallo apuntado (📝) si ha fallado: se lo cuenta al jefe una vez y lo repasa al empezar su turno.
// «Anoche en 1 minuto» repite las últimas 24 h con sus cifras, y la cámara sigue a quien está trabajando.
// Entre turnos no están quietos: se levantan a hablar entre ellos (lo que se dijeron de verdad, ver vida.js), van a por
// un café y, al pulsar «Ver la reunión», los que tienen propuesta van a la mesa redonda y la dicen por turnos.
// Calidad: personas con articulaciones (personaje.js, posturas.js), suelos pintados (texturas.js), sombras y luz según
// la hora de León. Lo que no se mueve se junta en una sola malla (Horneado) para que vaya fluido en el móvil.
// Un dedo mueve la planta, dos dedos (o la rueda) acercan, y tocar a alguien abre su ficha. Ver esto no gasta IA.
import { createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, MapControls, PerformanceMonitor } from "@react-three/drei";
import { PRESS } from "../../../lib/estilos";
import { dondeEsta, proximoTurno } from "../../../lib/turnos";
import { CAMISAS, PELOS, PIELES, fmt } from "./monigotes";
import { BARRA, CAFE_MESAS, CAFE_SITIOS, CAFE_SOFAS, DESTINOS, EDIFICIO, MESA_REUNION, MOSTRADOR, SALAS, TABURETES, colocar, planta, sitioReunion } from "./guion";
import { bocadillosEn, contadores, enVuelo, horaReal, montarRepeticion, poseEn } from "./repeticion";
import { A_LA_VEZ, CADA, hablandoEn, montarReunionEscena, paseoLibre, poseDePaseo, poseDeReunion, siguientePaseo } from "./vida";
import { MATERIAL_PERSONA, aspectoDe, crearCuerpo, liberarCuerpo } from "./personaje";
import { faseDe, giroCorto, postura } from "./posturas";
import { texturas } from "./texturas";

// ---------- Materiales y piezas compartidas ----------
const MATS = new Map();
function mat(color, extra) {
  const k = extra ? `${color}|${JSON.stringify(extra)}` : color;
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra }));
  return MATS.get(k);
}
const MATS_TEX = new Map();
function matTex(nombre, extra = {}) {
  const k = `${nombre}|${JSON.stringify(extra)}`;
  if (!MATS_TEX.has(k)) MATS_TEX.set(k, new THREE.MeshStandardMaterial({ map: texturas()[nombre], roughness: 0.82, ...extra }));
  return MATS_TEX.get(k);
}
const METAL = new THREE.MeshStandardMaterial({ color: "#8d9096", roughness: 0.35, metalness: 0.75 });
const NEGRO_BRILLO = new THREE.MeshStandardMaterial({ color: "#191a1f", roughness: 0.35, metalness: 0.2 });
const CRISTAL = new THREE.MeshStandardMaterial({ color: "#c8dbe6", transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.1, depthWrite: false });
const CRISTAL_VENTANA = new THREE.MeshStandardMaterial({ color: "#b9d7ea", emissive: "#dbeafe", emissiveIntensity: 0.5, roughness: 0.15 });
const CAJA = new THREE.BoxGeometry(1, 1, 1);
const CIL = new THREE.CylinderGeometry(1, 1, 1, 18);
const BOLA = new THREE.SphereGeometry(1, 18, 14);
const DISCO = new THREE.CircleGeometry(1, 40);
const PLANO = new THREE.PlaneGeometry(1, 1);

const C = {
  pasillo: "#d9d3c6", pared: "#e9e3d6", marco: "#2a2c33", madera: "#a9794b", maderaOscura: "#6f4a2c",
  negro: "#23252b", verde: "#3f7a46", verdeClaro: "#5f9c57", maceta: "#c9765a", acera: "#8d8d8c", asfalto: "#3a3b40",
};
const LUZ = { ok: "#78d29a", tarde: "#e9b44c", error: "#f06a60", nuevo: "#7fa8f0", descanso: "#a78bfa" };
const OFFSET = new THREE.Vector3(30, 33, 30);
const ALTO = 2.8; // paredes exteriores

function Caja({ p, s, c, m, ...r }) {
  return <mesh geometry={CAJA} material={m || mat(c)} position={p} scale={s} {...r} />;
}
function Cil({ p, r = 0.5, h = 1, c, m, ...x }) {
  return <mesh geometry={CIL} material={m || mat(c)} position={p} scale={[r, h, r]} {...x} />;
}

// Lo que no se mueve se junta en una malla por material: de cientos de llamadas por fotograma a unas decenas.
// Las piezas originales se quedan ocultas; los que se mueven (personas, carpetas, pantallas) van fuera de aquí.
function Horneado({ children, sombras = true }) {
  const grupo = useRef();
  useLayoutEffect(() => {
    const g = grupo.current;
    g.updateWorldMatrix(true, true);
    const inversa = g.matrixWorld.clone().invert();
    const porMaterial = new Map();
    g.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
      for (const a of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(a)) geo.deleteAttribute(a);
      if (!porMaterial.has(o.material)) porMaterial.set(o.material, []);
      porMaterial.get(o.material).push(geo);
      o.visible = false;
    });
    const hechos = [];
    for (const [material, geos] of porMaterial) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), material);
      geos.forEach((x) => x.dispose());
      m.castShadow = sombras && !material.transparent && !material.emissiveMap;
      m.receiveShadow = !material.transparent;
      g.add(m);
      hechos.push(m);
    }
    return () => hechos.forEach((m) => { g.remove(m); m.geometry.dispose(); });
    // Se hornea una vez; si cambia algo de lo que hay dentro, el padre lo vuelve a montar con otra key
  }, [sombras]);
  return <group ref={grupo}>{children}</group>;
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

// Los bocadillos de la oficina en directo: el director los apunta aquí y solo se repintan cuando cambian
function crearTablon() {
  let lista = [], firma = "";
  const subs = new Set();
  return {
    get: () => lista,
    set(nueva) { const f = nueva.map((b) => `${b.quien}|${b.texto}`).join("~"); if (f !== firma) { firma = f; lista = nueva; subs.forEach((fn) => fn()); } },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
const VACIA = [];

// ---------- Luz según la hora de León ----------
function Ambiente({ dia, sombras }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const sala = new RoomEnvironment();
    const entorno = pm.fromScene(sala, 0.04).texture;
    sala.dispose();
    // three.js se maneja así: la escena es un objeto que se cambia directamente
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = entorno;
    scene.environmentIntensity = 0.42;
    return () => { scene.environment = null; entorno.dispose(); pm.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    CRISTAL_VENTANA.color.set(dia > 0.5 ? "#bcd9ee" : "#1b2740");
    CRISTAL_VENTANA.emissive.set(dia > 0.5 ? "#dcecf7" : "#22314f");
    CRISTAL_VENTANA.emissiveIntensity = dia > 0.5 ? 0.6 : 0.45;
    LUZ_SUELO.opacity = 0.09 + (1 - dia) * 0.24;
    VIDRIERA.emissiveIntensity = 0.55 + dia * 0.45;
  }, [dia]);
  const sol = useRef();
  useEffect(() => {
    const s = sol.current;
    if (!s) return;
    s.shadow.camera.left = -24; s.shadow.camera.right = 24; s.shadow.camera.top = 24; s.shadow.camera.bottom = -24;
    s.shadow.camera.near = 1; s.shadow.camera.far = 90;
    s.shadow.mapSize.set(2048, 2048);
    s.shadow.bias = -0.00035; s.shadow.normalBias = 0.03;
    s.shadow.camera.updateProjectionMatrix();
  }, []);
  // La pantalla de quien trabaja: las filas van subiendo
  useFrame((_, delta) => { const p = texturas().pantalla; p.offset.y = (p.offset.y + delta * 0.09) % 1; });
  return (
    <>
      <hemisphereLight args={[dia > 0.5 ? "#fff6e6" : "#c7cfe6", "#4a4038", 0.62 + dia * 0.36]} />
      <directionalLight ref={sol} castShadow={sombras} position={[18, 34, 16]} intensity={0.75 + dia * 1.75} color={dia > 0.5 ? "#fff1d8" : "#ffdcb0"} />
      <directionalLight position={[-16, 12, 10]} intensity={0.25} color="#cfd8ff" />
    </>
  );
}

const LUZ_SUELO = new THREE.MeshBasicMaterial({ map: texturas().luz, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, color: "#ffe2aa" });
const SOMBRA_PIES = new THREE.MeshBasicMaterial({ map: texturas().sombra, transparent: true, opacity: 0.5, depthWrite: false, color: "#ffffff" });
const VIDRIERA = new THREE.MeshStandardMaterial({ map: texturas().vidriera, emissiveMap: texturas().vidriera, emissive: "#ffffff", transparent: true, alphaTest: 0.05, color: "#ffffff", roughness: 0.4 });

function Charco({ x, z, r = 3.6 }) {
  return <mesh geometry={PLANO} material={LUZ_SUELO} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[r * 2, r * 2, 1]} />;
}

// ---------- El edificio ----------
function Suelo({ x0, x1, z0, z1, tex, rep = 1, rugoso = 0.82 }) {
  const ancho = x1 - x0, fondo = z1 - z0;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(ancho, fondo);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (ancho / rep), uv.getY(i) * (fondo / rep));
    return g;
  }, [ancho, fondo, rep]);
  return <mesh geometry={geo} material={matTex(tex, { roughness: rugoso })} position={[(x0 + x1) / 2, 0.012, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} />;
}

function Ventana({ x, z, ancho, giro = 0 }) {
  return (
    <group position={[x, 1.55, z]} rotation={[0, giro, 0]}>
      <Caja p={[0, 0, 0]} s={[ancho, 1.5, 0.04]} m={CRISTAL_VENTANA} />
      <Caja p={[0, 0.78, 0.03]} s={[ancho + 0.1, 0.08, 0.06]} c={C.marco} />
      <Caja p={[0, -0.78, 0.03]} s={[ancho + 0.1, 0.08, 0.06]} c={C.marco} />
      <Caja p={[0, -0.84, 0.07]} s={[ancho + 0.2, 0.04, 0.16]} c="#d6d0c2" />
      {[-0.5, 0, 0.5].map((f) => <Caja key={f} p={[f * ancho, 0, 0.03]} s={[0.05, 1.5, 0.06]} c={C.marco} />)}
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
        <Caja p={pos(0.05)} s={tam(0.1, 0.16)} c="#4a4038" />
        <Caja p={pos(bajo + 0.012)} s={tam(0.025, 0.18)} c="#57483a" />
        <Caja p={pos(bajo + (alto - bajo) / 2)} s={tam(alto - bajo, 0.03)} m={CRISTAL} />
        <Caja p={pos(alto)} s={tam(0.06, 0.07)} c={C.marco} />
        {postes.map((q) => <Caja key={q} p={eje === "x" ? [q, (alto + bajo) / 2, fijo] : [fijo, (alto + bajo) / 2, q]} s={[0.045, alto - bajo, 0.045]} c={C.marco} />)}
      </group>
    );
  });
}

const SUELOS = {
  busqueda: ["moquetaAzul", 2], control: ["parquet", 2.6], archivo: ["moquetaGris", 2], despacho: ["parquetOscuro", 2.6],
  cafe: ["hidraulica", 1.3], despensa: ["parquet", 2.6], negocio: ["moquetaGris", 2], escaparate: ["parquet", 2.6],
};

function Edificio() {
  const { x0, x1, z0, z1 } = EDIFICIO;
  const ancho = x1 - x0, fondo = z1 - z0;
  const puertasAtras = ["busqueda", "control", "archivo", "despacho"].map((s) => SALAS[s].puerta[0]);
  const puertasDelante = ["cafe", "despensa", "negocio", "escaparate"].map((s) => SALAS[s].puerta[0]);
  return (
    <group>
      {/* Losa, calle y acera */}
      <Caja p={[0, -0.22, 1]} s={[ancho + 0.6, 0.4, fondo + 0.6 + 2]} c="#4c4a48" />
      <Caja p={[0, -0.05, z1 + 1.2]} s={[ancho + 3, 0.1, 2.2]} c={C.acera} />
      <Caja p={[0, -0.12, z1 + 3.6]} s={[ancho + 3, 0.1, 2.6]} c={C.asfalto} />
      {[-12, -6, 0, 6, 12].map((x) => <Caja key={x} p={[x, -0.06, z1 + 3.6]} s={[2, 0.01, 0.14]} c="#d8d3c6" />)}
      {/* Suelos de cada sala y el pasillo */}
      {Object.entries(SALAS).map(([id, s]) => <Suelo key={id} x0={s.x0} x1={s.x1} z0={s.z0} z1={s.z1} tex={SUELOS[id][0]} rep={SUELOS[id][1]} rugoso={id === "cafe" ? 0.45 : 0.82} />)}
      <Suelo x0={x0} x1={x1} z0={-1.2} z1={1.2} tex="terrazo" rep={2.4} rugoso={0.42} />
      {/* Paredes exteriores de atrás y de la izquierda, altas y con ventanales */}
      <Caja p={[0, ALTO / 2, z0 - 0.12]} s={[ancho + 0.25, ALTO, 0.25]} c={C.pared} />
      <Caja p={[x0 - 0.12, ALTO / 2, 0]} s={[0.25, ALTO, fondo]} c={C.pared} />
      <Caja p={[0, 0.08, z0 + 0.03]} s={[ancho, 0.16, 0.05]} c="#4a4038" />
      <Caja p={[x0 + 0.03, 0.08, 0]} s={[0.05, 0.16, fondo]} c="#4a4038" />
      <Caja p={[0, ALTO + 0.04, z0 - 0.12]} s={[ancho + 0.3, 0.08, 0.3]} c={C.marco} />
      <Caja p={[x0 - 0.12, ALTO + 0.04, 0]} s={[0.3, 0.08, fondo]} c={C.marco} />
      {[-13.5, -3.6, 2.5, 14.5].map((x) => <Ventana key={x} x={x} z={z0 + 0.02} ancho={x === 14.5 ? 1.8 : 2.8} />)}
      {[-6, 6.5, 9.4].map((z) => <Ventana key={z} x={x0 + 0.02} z={z} ancho={z === -6 ? 3.6 : 2.2} giro={Math.PI / 2} />)}
      {/* Pasillo: tabiques bajos hacia la cámara, más altos al fondo; tabiques entre salas */}
      <Tabique eje="x" fijo={-1.2} desde={x0} hasta={x1} puertas={puertasAtras} bajo={0.45} alto={2} />
      <Tabique eje="x" fijo={1.2} desde={x0} hasta={x1} puertas={puertasDelante} bajo={0.6} alto={2.1} />
      {[-1, 6, 11].map((x) => <Tabique key={x} eje="z" fijo={x} desde={z0} hasta={-1.2} bajo={0.9} />)}
      {[-6, 0, 5].map((x) => <Tabique key={x} eje="z" fijo={x} desde={1.2} hasta={z1} bajo={0.6} alto={1.8} />)}
      {/* Delante y a la derecha, un bordillo (para ver dentro); el escaparate, de cristal hasta arriba */}
      <Caja p={[(x0 + 5) / 2, 0.15, z1]} s={[5 - x0, 0.3, 0.14]} c={C.pared} />
      <Caja p={[x1, 0.15, 0]} s={[0.14, 0.3, fondo]} c={C.pared} />
      <Tabique eje="x" fijo={z1} desde={5} hasta={x1} bajo={0.35} alto={2.5} />
      {/* Charcos de luz de cada sala */}
      {[[-12, -7], [-5, -7], [-12, -3], [-5, -3], [2.5, -6], [8.5, -6], [13.5, -6], [-11, 5], [-11, 9], [-3, 6], [2.5, 6], [8, 6], [12.6, 8.4], [-8, 0], [0, 0], [8, 0]].map(([x, z]) => <Charco key={`${x}${z}`} x={x} z={z} />)}
    </group>
  );
}

// ---------- Muebles ----------
function Silla({ giro = 0 }) {
  return (
    <group rotation={[0, giro, 0]}>
      <Cil p={[0, 0.46, 0]} r={0.25} h={0.08} c={C.negro} />
      <Caja p={[0, 0.84, -0.24]} s={[0.44, 0.58, 0.07]} c={C.negro} />
      <Caja p={[0, 0.58, -0.22]} s={[0.05, 0.16, 0.05]} m={METAL} />
      <Cil p={[0, 0.25, 0]} r={0.028} h={0.42} m={METAL} />
      {[0, 1.26, 2.51, 3.77, 5.03].map((a) => <Caja key={a} p={[Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14]} s={[0.05, 0.03, 0.3]} rotation={[0, a, 0]} m={METAL} />)}
    </group>
  );
}

// Lo fijo de una mesa: tablero, cajonera, monitor, teclado, ratón y lo que se deja cada uno encima
function Escritorio({ x, z, grande = false, semilla = 0 }) {
  const w = grande ? 2.2 : 1.45, d = grande ? 0.95 : 0.78;
  return (
    <group position={[x, 0, z]}>
      <Caja p={[0, 0.74, 0]} s={[w, 0.05, d]} m={matTex("madera", { roughness: 0.55 })} />
      <Caja p={[-w / 2 + 0.05, 0.36, 0]} s={[0.05, 0.72, d - 0.1]} m={METAL} />
      <Caja p={[w / 2 - 0.05, 0.36, 0]} s={[0.05, 0.72, d - 0.1]} m={METAL} />
      <Caja p={[w / 2 - 0.3, 0.3, 0.05]} s={[0.42, 0.56, 0.5]} c="#3b3d44" />
      {/* Teclado, ratón, y según quién: taza, papeles o una planta */}
      <Caja p={[0, 0.775, -0.17]} s={[0.46, 0.02, 0.15]} c="#d8d4cb" />
      <Caja p={[0.33, 0.775, -0.17]} s={[0.07, 0.022, 0.11]} c="#2c2e34" />
      {semilla % 3 === 0 && <Cil p={[-0.52, 0.81, -0.1]} r={0.045} h={0.1} c="#efe9db" />}
      {semilla % 3 === 1 && <Caja p={[-0.46, 0.775, -0.08]} s={[0.26, 0.02, 0.34]} c="#f4f0e6" rotation={[0, 0.2, 0]} />}
      {semilla % 3 === 2 && (
        <group position={[-0.54, 0.77, 0.14]}>
          <Cil p={[0, 0.05, 0]} r={0.05} h={0.1} c={C.maceta} />
          <mesh geometry={BOLA} material={mat(C.verde)} position={[0, 0.16, 0]} scale={[0.08, 0.11, 0.08]} />
        </group>
      )}
      <Caja p={[0, 0.77, 0.2]} s={[0.26, 0.02, 0.18]} m={METAL} />
      <Caja p={[0, 0.88, 0.22]} s={[0.05, 0.2, 0.05]} m={METAL} />
      <group position={[0, 0, -0.78]}><Silla /></group>
    </group>
  );
}

// Lo que cambia de una mesa: el monitor enciende cuando su dueño trabaja, y un piloto por detrás da su estado
const PANTALLA_APAGADA = new THREE.MeshStandardMaterial({ color: "#14151a", roughness: 0.3 });
const PILOTO = new Map();
const pilotoDe = (c) => { if (!PILOTO.has(c)) PILOTO.set(c, new THREE.MeshBasicMaterial({ color: c })); return PILOTO.get(c); };
let PANTALLA_ENCENDIDA = null;
const encendida = () => {
  if (!PANTALLA_ENCENDIDA) PANTALLA_ENCENDIDA = new THREE.MeshBasicMaterial({ map: texturas().pantalla, toneMapped: false });
  return PANTALLA_ENCENDIDA;
};
function Pantalla({ id, x, z, luz, poses, grande }) {
  const cara = useRef(), halo = useRef();
  useFrame(() => {
    const on = poses.get(id)?.modo === "teclea" || (id === "jefe" && poses.get(id)?.modo === "jefe");
    if (cara.current) cara.current.material = on ? encendida() : PANTALLA_APAGADA;
    if (halo.current) halo.current.visible = on;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={CAJA} material={NEGRO_BRILLO} position={[0, 1.08, 0.24]} scale={[grande ? 0.82 : 0.68, 0.42, 0.035]} />
      <mesh ref={cara} geometry={PLANO} material={PANTALLA_APAGADA} position={[0, 1.08, 0.221]} rotation={[0, Math.PI, 0]} scale={[grande ? 0.76 : 0.63, 0.37, 1]} />
      <mesh geometry={DISCO} material={pilotoDe(luz)} position={[0, 1.27, 0.259]} scale={0.022} />
      <mesh ref={halo} geometry={PLANO} material={LUZ_PANTALLA} position={[0, 0.93, -0.32]} rotation={[-Math.PI / 2.4, 0, 0]} scale={[1.2, 1.2, 1]} visible={false} />
    </group>
  );
}
const LUZ_PANTALLA = new THREE.MeshBasicMaterial({ map: texturas().luz, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, color: "#a9c8ff" });

function Planta({ x, z, alta = 1 }) {
  const hojas = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    const a = i * 2.39996, nivel = i / 11;
    return { a, y: 0.48 + nivel * 0.72 * alta, inc: 0.95 - nivel * 0.55, largo: (0.42 - nivel * 0.1) * alta, c: i % 3 === 0 ? C.verdeClaro : C.verde };
  }), [alta]);
  return (
    <group position={[x, 0, z]}>
      <Cil p={[0, 0.21, 0]} r={0.2} h={0.42} c={C.maceta} />
      <Cil p={[0, 0.43, 0]} r={0.205} h={0.03} c="#3a2a1e" />
      <Cil p={[0, 0.72, 0]} r={0.018} h={0.6 * alta} c="#5a4630" />
      {hojas.map((h) => (
        <group key={h.a} position={[0, h.y, 0]} rotation={[0, h.a, 0]}>
          <mesh geometry={BOLA} material={mat(h.c, { roughness: 0.55 })} position={[0, Math.cos(h.inc) * h.largo * 0.5, Math.sin(h.inc) * h.largo * 0.5]} rotation={[h.inc, 0, 0]} scale={[0.07, h.largo * 0.55, 0.02]} />
        </group>
      ))}
    </group>
  );
}

function Lampara({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Cil p={[0, 0.02, 0]} r={0.16} h={0.04} m={METAL} />
      <Cil p={[0, 0.8, 0]} r={0.018} h={1.6} m={METAL} />
      <Cil p={[0, 1.66, 0]} r={0.2} h={0.26} m={mat("#f3e6c8", { emissive: "#ffd98a", emissiveIntensity: 1.1 })} />
    </group>
  );
}

// Sofá mirando hacia +x (largo en z)
function Sofa({ x, z, largo = 2.2, color = "#5a6c84" }) {
  return (
    <group position={[x, 0, z]}>
      <Caja p={[0, 0.2, 0]} s={[0.85, 0.24, largo]} c={color} />
      <Caja p={[0.05, 0.38, 0]} s={[0.72, 0.14, largo - 0.34]} c={color} />
      <Caja p={[-0.33, 0.62, 0]} s={[0.2, 0.62, largo]} c={color} />
      {[-1, 1].map((k) => <Caja key={k} p={[0, 0.48, k * (largo / 2 - 0.08)]} s={[0.85, 0.28, 0.16]} c={color} />)}
      {[-0.35, 0.35].flatMap((dx) => [-1, 1].map((k) => <Caja key={`${dx}${k}`} p={[dx, 0.04, k * (largo / 2 - 0.1)]} s={[0.06, 0.08, 0.06]} m={METAL} />))}
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
const COLORES_ARCHIVO = ["#b4483f", "#3f6fa8", "#c8963c", "#4a8a63", "#6d559a", "#5e6470"].map((c) => new THREE.Color(c));
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
  return <instancedMesh ref={ref} args={[CAJA, mat("#ffffff"), huecos.length]} castShadow />;
}

// Tarros y quesos de la Despensa (instanciados)
function Productos() {
  const ref = useRef();
  const lista = useMemo(() => Array.from({ length: 3 }, (_, b) => Array.from({ length: 14 }, (_, i) => [-5.25 + i * 0.34, 0.12 + b * 0.42, 9.62])).flat(), []);
  useEffect(() => {
    const m = ref.current, o = new THREE.Object3D();
    const col = ["#b45309", "#a8322a", "#d8ae3c", "#65843a", "#6b3a1c", "#e6e0d2"].map((c) => new THREE.Color(c));
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
  return <instancedMesh ref={ref} args={[CIL, mat("#ffffff"), lista.length]} castShadow />;
}

function Cafeteria() {
  return (
    <group>
      {/* Barra con cafetera y taburetes */}
      <Caja p={[(BARRA.x0 + BARRA.x1) / 2, 0.52, BARRA.z]} s={[BARRA.x1 - BARRA.x0, 1.04, 0.6]} m={matTex("madera", { color: "#8a6a4a", roughness: 0.5 })} />
      <Caja p={[(BARRA.x0 + BARRA.x1) / 2, 1.07, BARRA.z]} s={[BARRA.x1 - BARRA.x0 + 0.1, 0.05, 0.7]} c="#d8d3c6" />
      <Caja p={[(BARRA.x0 + BARRA.x1) / 2, 0.14, BARRA.z + 0.33]} s={[BARRA.x1 - BARRA.x0, 0.03, 0.03]} m={METAL} />
      <group position={[-10.6, 1.1, BARRA.z]}>
        <Caja p={[0, 0.25, 0]} s={[0.5, 0.5, 0.4]} m={METAL} />
        <Caja p={[0, 0.55, 0]} s={[0.5, 0.1, 0.42]} c={C.negro} />
        <Cil p={[0, 0.3, 0.2]} r={0.04} h={0.03} m={mat("#e9b44c", { emissive: "#e9b44c", emissiveIntensity: 1.4 })} rotation={[Math.PI / 2, 0, 0]} />
        {[-0.1, 0.1].map((dx) => <Cil key={dx} p={[dx, 0.06, 0.26]} r={0.035} h={0.06} c="#efe9db" />)}
      </group>
      {[-14.8, -13.6, -12.4].map((x, i) => (
        <group key={x} position={[x, 1.12, BARRA.z - 0.12]}>
          <Cil p={[0, 0.11, 0]} r={0.04} h={0.22} m={mat(["#3f7a46", "#8a3a2c", "#b98a3a"][i], { roughness: 0.2 })} />
          <Cil p={[0, 0.27, 0]} r={0.015} h={0.1} c="#2a2c33" />
        </group>
      ))}
      {TABURETES.map((x) => (
        <group key={x} position={[x, 0, 2.6]}>
          <Cil p={[0, 0.36, 0]} r={0.025} h={0.72} m={METAL} />
          <Cil p={[0, 0.02, 0]} r={0.16} h={0.03} m={METAL} />
          <Cil p={[0, 0.74, 0]} r={0.19} h={0.06} c="#3a2a1e" />
        </group>
      ))}
      {/* Mesas redondas con tres sillas */}
      {CAFE_MESAS.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cil p={[x, 0.74, z]} r={0.55} h={0.04} m={matTex("madera", { roughness: 0.45 })} />
          <Cil p={[x, 0.37, z]} r={0.04} h={0.74} m={METAL} />
          <Cil p={[x, 0.02, z]} r={0.28} h={0.03} m={METAL} />
          {[[0, -0.8, 0], [-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]].map(([dx, dz, giro]) => (
            <group key={`${dx}${dz}`} position={[x + dx, 0, z + dz]} rotation={[0, giro, 0]}>
              <Caja p={[0, 0.46, 0]} s={[0.42, 0.05, 0.42]} c={C.maderaOscura} />
              <Caja p={[0, 0.76, -0.19]} s={[0.4, 0.5, 0.04]} c={C.maderaOscura} />
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Caja key={`${a}${b}`} p={[a * 0.17, 0.22, b * 0.17]} s={[0.035, 0.44, 0.035]} c={C.marco} />)}
            </group>
          ))}
          <Cil p={[x + 0.15, 0.81, z + 0.1]} r={0.045} h={0.08} c="#efe9db" />
        </group>
      ))}
      {/* Sofás para echarse, con lámparas de pie */}
      {CAFE_SOFAS.map(([x, z], i) => <Sofa key={z} x={x} z={z} color={i ? "#7c4a2a" : "#54657c"} />)}
      <Lampara x={-15.5} z={4.6} />
      <Lampara x={-15.5} z={10.5} />
      <Caja p={[-14.6, 0.2, 7.5]} s={[0.5, 0.4, 0.5]} c={C.madera} />
      <Planta x={-6.6} z={10.4} alta={1.4} />
      <Planta x={-6.6} z={6.2} />
      {/* Fuente de agua */}
      <group position={[-6.55, 0, 2.2]}>
        <Caja p={[0, 0.5, 0]} s={[0.36, 1, 0.36]} c="#d8d3c6" />
        <Cil p={[0, 1.2, 0]} r={0.15} h={0.4} m={mat("#8cc9e8", { transparent: true, opacity: 0.6, roughness: 0.1 })} />
      </group>
    </group>
  );
}

function Despacho() {
  return (
    <group>
      <mesh geometry={DISCO} material={mat("#6e2230", { roughness: 0.95 })} position={[13.5, 0.03, -5.8]} rotation={[-Math.PI / 2, 0, 0]} scale={1.9} />
      <Escritorio x={13.5} z={-6.2} grande semilla={3} />
      <Estanteria x={13.5} z={-10.55} ancho={3} alto={2.1} />
      {[0.35, 0.87, 1.39].map((y, i) => <Caja key={y} p={[13.5 - 0.3 * i, y + 0.12, -10.5]} s={[2.2, 0.28, 0.25]} c={["#8a3a2c", "#3f5f8a", "#b98a3a"][i]} />)}
      {/* Globo terráqueo encima */}
      <Cil p={[12.5, 2.2, -10.5]} r={0.1} h={0.08} c={C.marco} />
      <mesh geometry={BOLA} material={mat("#3a6ea8", { roughness: 0.35 })} position={[12.5, 2.48, -10.5]} scale={0.24} />
      {/* Telescopio junto a la ventana */}
      <group position={[15.1, 0, -9.6]}>
        {[0, 2.1, 4.2].map((a) => <Caja key={a} p={[Math.sin(a) * 0.2, 0.5, Math.cos(a) * 0.2]} s={[0.035, 1, 0.035]} c={C.marco} rotation={[Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2]} />)}
        <Cil p={[0, 1.15, 0.1]} r={0.07} h={0.9} m={METAL} rotation={[1.1, 0, 0]} />
      </group>
      <Sofa x={11.55} z={-8.4} largo={1.8} color="#2e3644" />
      <Lampara x={11.5} z={-10.4} />
      <Planta x={11.6} z={-2} alta={1.3} />
      {/* Tu buzón, junto a la puerta */}
      <group position={[DESTINOS.buzon[0], 0, DESTINOS.buzon[2]]}>
        <Caja p={[0, 0.45, 0]} s={[0.07, 0.9, 0.07]} c={C.marco} />
        <Caja p={[0, 1, 0]} s={[0.5, 0.35, 0.35]} c="#a8322a" />
      </group>
    </group>
  );
}

function Control({ sinFuente }) {
  const [mx, mz] = MOSTRADOR;
  const lleno = Math.min(1, sinFuente / 40);
  return (
    <group>
      <Caja p={[mx, 0.52, mz]} s={[3.4, 1.04, 0.8]} m={matTex("madera", { color: "#8a6a4a", roughness: 0.5 })} />
      <Caja p={[mx, 1.07, mz]} s={[3.5, 0.05, 0.9]} c="#d8d3c6" />
      <Caja p={[mx - 1.2, 0.52, mz - 0.9]} s={[0.8, 1.04, 1.2]} m={matTex("madera", { color: "#8a6a4a", roughness: 0.5 })} />
      {/* Flexo y lupa: aquí se comprueba que cada evento tiene fuente */}
      <group position={[mx + 1.1, 1.1, mz]}>
        <Cil p={[0, 0.02, 0]} r={0.11} h={0.03} m={METAL} />
        <Caja p={[0, 0.25, 0]} s={[0.025, 0.5, 0.025]} m={METAL} />
        <Cil p={[0.1, 0.5, 0]} r={0.11} h={0.1} m={mat("#ffe08a", { emissive: "#ffd070", emissiveIntensity: 1.4 })} />
      </group>
      <Cil p={[mx - 0.4, 1.12, mz + 0.05]} r={0.12} h={0.015} m={mat("#c9e6f5", { roughness: 0.1 })} rotation={[Math.PI / 2, 0, 0]} />
      {[0, 1, 2].map((i) => <Caja key={i} p={[mx - 0.9 + i * 0.05, 1.11 + i * 0.03, mz]} s={[0.32, 0.03, 0.24]} c={["#e9d58a", "#e8b4ae", "#b4dcbc"][i]} />)}
      {/* Papelera de lo que no tenía fuente (se llena) */}
      <group position={[DESTINOS.papelera[0], 0, DESTINOS.papelera[2]]}>
        <Cil p={[0, 0.4, 0]} r={0.4} h={0.8} c="#3f454e" />
        <Cil p={[0, 0.06 + 0.72 * lleno, 0]} r={0.36} h={0.12 + 1.44 * lleno * 0.5} c="#e6e0d2" />
      </group>
      {/* Mesa de entrada del archivo */}
      <Caja p={[DESTINOS.archivo[0], 0.42, DESTINOS.archivo[2]]} s={[1.4, 0.84, 0.6]} m={matTex("madera", { roughness: 0.55 })} />
      <Planta x={2.5} z={-10.45} alta={1.2} />
    </group>
  );
}

function Busqueda() {
  return (
    <group>
      {/* El rosetón de León en la pared del fondo */}
      <mesh geometry={DISCO} material={VIDRIERA} position={[-8.4, 1.62, -10.95]} scale={1.05} />
      <Cil p={[-8.4, 1.62, -10.98]} r={1.12} h={0.04} c="#3a3026" rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={PLANO} material={LUZ_SUELO} position={[-8.4, 0.031, -8.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[5, 5, 1]} />
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
      <Caja p={[8.5, 0.4, 7]} s={[2.6, 0.8, 1.2]} m={matTex("madera", { roughness: 0.5 })} />
      {Array.from({ length: tarjetas }, (_, i) => (
        <Caja key={i} p={[7.6 + (i % 4) * 0.6, 0.82, 6.75 + Math.floor(i / 4) * 0.5]} s={[0.42, 0.015, 0.3]} c={["#e8b4ae", "#e9c58e", "#e9d58a", "#b4cfe8"][i % 4]} rotation={[0, (i % 3) * 0.12 - 0.12, 0]} />
      ))}
      <group position={[12.5, 0, 5]}>
        <Caja p={[0, 0.6, 0]} s={[0.08, 1.2, 0.08]} m={METAL} />
        <Cil p={[0, 0.02, 0]} r={0.3} h={0.03} m={METAL} />
        <Caja p={[0, 1.55, 0]} s={[2, 1.1, 0.06]} m={NEGRO_BRILLO} />
        <Caja p={[0, 1.55, 0.035]} s={[1.85, 0.95, 0.01]} m={mat("#e9b44c", { emissive: "#e9b44c", emissiveIntensity: 0.65 })} />
      </group>
      <Sofa x={5.6} z={8.5} largo={2} color="#7a2c33" />
      {/* Sala de reuniones: mesa redonda con 8 sillas */}
      <Cil p={[MESA_REUNION[0], 0.74, MESA_REUNION[1]]} r={1.05} h={0.05} m={matTex("madera", { color: "#7a5a3a", roughness: 0.4 })} />
      <Cil p={[MESA_REUNION[0], 0.37, MESA_REUNION[1]]} r={0.07} h={0.74} m={METAL} />
      {Array.from({ length: 8 }, (_, i) => {
        const s = sitioReunion(i);
        return (
          <group key={i} position={[s.pos[0], 0, s.pos[1]]} rotation={[0, s.giro, 0]}>
            <Caja p={[0, 0.46, 0]} s={[0.44, 0.05, 0.42]} c="#d8d3c6" />
            <Caja p={[0, 0.75, -0.2]} s={[0.42, 0.5, 0.04]} c="#d8d3c6" />
            <Cil p={[0, 0.22, 0]} r={0.025} h={0.44} m={METAL} />
          </group>
        );
      })}
      <Planta x={15.4} z={2} alta={1.3} />
      <Planta x={15.4} z={10.3} />
      {/* En la calle: gente mirando el escaparate (más cuantos más planes) y árboles */}
      {Array.from({ length: Math.min(7, Math.ceil((planes || 0) / 6)) }, (_, i) => (
        <group key={i} position={[6.5 + i * 1.3, 0, 12.1 + (i % 2) * 0.4]} rotation={[0, Math.PI, 0]}>
          <Cil p={[-0.08, 0.42, 0]} r={0.07} h={0.84} c="#2c3650" />
          <Cil p={[0.08, 0.42, 0]} r={0.07} h={0.84} c="#2c3650" />
          <Cil p={[0, 1.14, 0]} r={0.17} h={0.62} c={["#3f6fa8", "#c8963c", "#4a8a63", "#6d559a"][i % 4]} />
          <mesh geometry={BOLA} material={mat(PIELES[i % PIELES.length])} position={[0, 1.58, 0]} scale={0.12} />
        </group>
      ))}
      {[-13, -3, 3.5, 15].map((x) => (
        <group key={x} position={[x, 0, 12.1]}>
          <Cil p={[0, 0.7, 0]} r={0.08} h={1.4} c={C.maderaOscura} />
          <mesh geometry={BOLA} material={mat(C.verde)} position={[0, 1.9, 0]} scale={[0.8, 0.95, 0.8]} />
          <mesh geometry={BOLA} material={mat(C.verdeClaro)} position={[0.32, 2.2, 0.2]} scale={[0.5, 0.55, 0.5]} />
        </group>
      ))}
    </group>
  );
}

function Despensa() {
  return (
    <group>
      <Estanteria x={-3} z={9.7} ancho={5} alto={1.3} fondo={0.4} baldas={3} />
      {[[-5.4, 6.4], [-5.4, 7.1]].map(([x, z]) => <Caja key={z} p={[x, 0.25, z]} s={[0.6, 0.5, 0.5]} c="#a97a48" />)}
      <Planta x={-0.5} z={10.4} />
    </group>
  );
}

function Negocio() {
  return (
    <group>
      {/* Corcho con notas */}
      <group position={[2.5, 0, 9.7]}>
        {[-0.9, 0.9].map((x) => <Caja key={x} p={[x, 0.7, 0]} s={[0.05, 1.4, 0.05]} c={C.marco} />)}
        <Caja p={[0, 1.25, 0]} s={[2, 1, 0.05]} c="#a97f55" />
        {Array.from({ length: 7 }, (_, i) => <Caja key={i} p={[-0.7 + (i % 4) * 0.45, 1.05 + Math.floor(i / 4) * 0.4, 0.04]} s={[0.3, 0.25, 0.01]} c={["#e9d58a", "#e8b4ae", "#b4dcbc", "#b4cfe8"][i % 4]} />)}
      </group>
      <Planta x={4.5} z={10.4} alta={1.2} />
    </group>
  );
}

// ---------- Personas ----------
// La pose la escribe el director en cada fotograma: { x, z, giro, modo, lleva, asiento }
// modo: anda · teclea · sentado · duerme · espera · entrega · jefe · habla · reunion
// Cada persona calcula a qué ángulo va cada articulación (posturas.js) y llega suavemente, sin saltos.
const R_HOMBRO = 0.178, Y_HOMBRO = 0.385, CADERA = 0.082;
const META = { pelvisY: "", torsoX: "", torsoY: "", cabezaX: "", cabezaY: "", cabezaZ: "", hombroIX: "", hombroIZ: "", codoI: "", hombroDX: "", hombroDZ: "", codoD: "", caderaI: "", rodillaI: "", caderaD: "", rodillaD: "" };
const CLAVES = Object.keys(META);

function Persona({ e, poses, aspecto, camisa, alTocar, semilla, jefe, rotulo }) {
  const g = useRef(), pelvis = useRef(), torso = useRef(), cabeza = useRef(), ojos = useRef();
  const hI = useRef(), cI = useRef(), hD = useRef(), cD = useRef(), pI = useRef(), rI = useRef(), pD = useRef(), rD = useRef();
  const humo = useRef(), carpeta = useRef(), taza = useRef();
  const [humos] = useState(() => [0, 1, 2].map(() => new THREE.MeshLambertMaterial({ color: "#64748b", transparent: true, opacity: 0.4, depthWrite: false })));
  const cuerpo = useMemo(() => crearCuerpo({ ...aspecto, camisa, jefe, peinado: jefe ? "entradas" : aspecto.peinado, barba: jefe ? false : aspecto.barba, gafas: jefe ? true : aspecto.gafas }), [aspecto, camisa, jefe]);
  useEffect(() => () => liberarCuerpo(cuerpo), [cuerpo]);
  useEffect(() => () => humos.forEach((m) => m.dispose()), [humos]);
  // El estado de cada articulación vive aquí: cambia 60 veces por segundo y no debe pasar por React
  const movil = useRef({ a: null, x: null, z: null, giro: 0, fase: 0, veloz: 0, parpadeo: 2 });

  useFrame(({ clock }, delta) => {
    const p = poses.get(e.id);
    if (!g.current) return;
    g.current.visible = !!p;
    if (!p) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime + semilla;
    const m = movil.current;

    // Cuánto ha andado de verdad: de ahí sale el paso, y así los pies no patinan
    if (m.x == null) { m.x = p.x; m.z = p.z; m.giro = p.giro || 0; }
    const dist = Math.hypot(p.x - m.x, p.z - m.z);
    const salto = dist > 3; // salió de la repetición o cambió de sitio de golpe
    if (!salto && dist > 0) m.fase += faseDe(dist);
    m.veloz += ((salto ? 0 : dist / Math.max(dt, 0.001)) - m.veloz) * 0.2;
    m.x = p.x; m.z = p.z;
    g.current.position.set(p.x, 0, p.z);

    const giro = p.giro || 0;
    m.giro += giroCorto(m.giro, giro) * (1 - Math.exp(-dt * (p.modo === "anda" ? 12 : 8)));
    g.current.rotation.y = m.giro;

    const fin = postura(p.modo, t, { fase: m.fase, veloz: m.veloz, asiento: p.asiento, lleva: p.lleva });
    if (!m.a) m.a = { ...fin };
    const k = 1 - Math.exp(-dt * (p.modo === "anda" ? 18 : 9));
    for (const c of CLAVES) m.a[c] += (fin[c] - m.a[c]) * k;
    const a = m.a;

    pelvis.current.position.y = a.pelvisY;
    torso.current.rotation.set(a.torsoX, a.torsoY, 0);
    cabeza.current.rotation.set(a.cabezaX, a.cabezaY, a.cabezaZ);
    hI.current.rotation.set(a.hombroIX, 0, a.hombroIZ); cI.current.rotation.x = a.codoI;
    hD.current.rotation.set(a.hombroDX, 0, a.hombroDZ); cD.current.rotation.x = a.codoD;
    pI.current.rotation.x = a.caderaI; rI.current.rotation.x = a.rodillaI;
    pD.current.rotation.x = a.caderaD; rD.current.rotation.x = a.rodillaD;

    // Parpadea cada pocos segundos; dormido, ojos cerrados
    m.parpadeo -= dt;
    if (m.parpadeo < -0.12) m.parpadeo = 2.4 + ((semilla * 7.3 + t) % 3);
    ojos.current.scale.y = p.modo === "duerme" || m.parpadeo < 0 ? 0.08 : 1;

    if (carpeta.current) carpeta.current.visible = !!p.lleva;
    if (taza.current) taza.current.visible = fin.taza > 0;
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

  const parte = (geometry) => ({ geometry, material: MATERIAL_PERSONA, castShadow: true });
  const ancho = aspecto.ancho || 1;
  return (
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); if (ev.delta > 8) return; alTocar(); }}>
      <mesh geometry={PLANO} material={SOMBRA_PIES} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 1]} />
      <group scale={[aspecto.alto || 1, aspecto.alto || 1, aspecto.alto || 1]}>
        <group ref={pelvis} position={[0, 0.9, 0]}>
          <mesh {...parte(cuerpo.pelvis)} />
          <group ref={torso} position={[0, 0.05, 0]}>
            <mesh {...parte(cuerpo.torso)} />
            <group ref={cabeza} position={[0, 0.455, 0]}>
              <mesh {...parte(cuerpo.cabeza)} />
              <mesh ref={ojos} {...parte(cuerpo.ojos)} castShadow={false} position={[0, 0.125, 0.088]} />
            </group>
            <group ref={hI} position={[-R_HOMBRO * ancho, Y_HOMBRO, 0]}>
              <mesh {...parte(cuerpo.brazoSup)} />
              <group ref={cI} position={[0, -0.27, 0]}><mesh {...parte(cuerpo.antebrazo)} /></group>
            </group>
            <group ref={hD} position={[R_HOMBRO * ancho, Y_HOMBRO, 0]}>
              <mesh {...parte(cuerpo.brazoSup)} />
              <group ref={cD} position={[0, -0.27, 0]}>
                <mesh {...parte(cuerpo.antebrazo)} />
                <group ref={taza} visible={false} position={[0, -0.28, 0.045]}><Cil p={[0, 0, 0]} r={0.04} h={0.09} c="#efe9db" /></group>
              </group>
            </group>
            <group ref={carpeta} visible={false} position={[0, 0.16, 0.3]}>
              <Caja p={[0, 0, 0]} s={[0.34, 0.04, 0.26]} c="#e9b44c" castShadow />
            </group>
          </group>
          <group ref={pI} position={[-CADERA * ancho, -0.03, 0]}>
            <mesh {...parte(cuerpo.muslo)} />
            <group ref={rI} position={[0, -0.44, 0]}><mesh {...parte(cuerpo.espinilla)} /></group>
          </group>
          <group ref={pD} position={[CADERA * ancho, -0.03, 0]}>
            <mesh {...parte(cuerpo.muslo)} />
            <group ref={rD} position={[0, -0.44, 0]}><mesh {...parte(cuerpo.espinilla)} /></group>
          </group>
        </group>
      </group>
      <group ref={humo} visible={false}>
        {humos.map((m, i) => <mesh key={i} geometry={BOLA} material={m} />)}
      </group>
      {rotulo && (
        <Etiqueta position={[0, rotulo.alto || 2.25, 0]} center>
          <span className={`select-none whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold shadow ${rotulo.color || "pn-rotulo"} ${rotulo.soloGrande ? "hidden sm:inline-block" : ""}`}>{rotulo.texto}</span>
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
  const colores = { archivo: "#78d29a", buzon: "#e9b44c", papelera: "#8d8d8c" };
  return Array.from({ length: 6 }, (_, i) => (
    <group key={i} ref={(m) => { refs.current[i] = m; }} visible={false}>
      <Caja p={[0, 0, 0]} s={[0.42, 0.05, 0.32]} c="#e9b44c" castShadow />
      <Caja p={[0, 0.035, 0]} s={[0.3, 0.02, 0.2]} c={colores[["archivo", "buzon", "papelera"][i % 3]]} />
    </group>
  ));
}

const SITIOS_CAFE = CAFE_SITIOS.filter((s) => s.tipo === "barra");

// El director: en directo deja a cada uno en su sitio (y los saca a pasear o a la reunión); en la repetición
// mueve a todos según el reloj y le dice a la cámara a quién mirar
function Director({ rep, enDirecto, poses, reloj, repitiendo, pausa, alAcabar, vivos, jefe, charla, movimiento, reunion, alAcabarReunion, tablon, focoRef, sitios }) {
  const s = useRef(0);
  const acabado = useRef(false);
  const vida = useRef({ paseos: [], i: 0, siguiente: 1.5, escena: null, reunionHecha: 0, dichos: new Set() });
  useFrame(({ clock }, delta) => {
    if (repitiendo && rep && !rep.vacia) {
      if (!pausa) s.current = Math.min(rep.duracion, s.current + Math.min(delta, 0.1));
      reloj.set(s.current);
      for (const [id, viva] of Object.entries(enDirecto)) {
        poses.set(id, id === "jefe" ? viva : poseEn(rep, id, s.current) || rep.quietos?.[id] || viva);
      }
      // A quién mira la cámara: al que le toca ahora (si no, al último que trabajó)
      const g = [...rep.golpes].reverse().find((x) => x.s <= s.current + 1.2);
      const id = g?.empleados.find((x) => sitios[x]);
      focoRef.current = id ? { id, x: sitios[id].mesa[0], z: sitios[id].mesa[1] } : null;
      if (s.current >= rep.duracion && !acabado.current) { acabado.current = true; focoRef.current = null; alAcabar(); }
      return;
    }
    focoRef.current = null;
    const t = clock.elapsedTime, v = vida.current;
    // La reunión que has pedido: todos los que proponen, a la mesa redonda
    if (reunion?.n && reunion.n !== v.reunionHecha) {
      v.reunionHecha = reunion.n;
      v.paseos = [];
      v.escena = montarReunionEscena(reunion.participantes || [], vivos, jefe, t);
    }
    if (v.escena && t >= v.escena.fin) { v.escena = null; v.siguiente = t + CADA; alAcabarReunion?.(); }
    v.paseos = v.paseos.filter((p) => t < p.t3);
    if (movimiento && !v.escena && t >= v.siguiente && v.paseos.length < A_LA_VEZ) {
      const ocupados = v.paseos.flatMap((p) => [p.id, p.a].filter(Boolean));
      const r = siguientePaseo({ charla, vivos, ocupados, i: v.i, t0: t, jefe, dichos: v.dichos });
      v.i = r.i;
      const paseo = r.paseo || paseoLibre({ vivos, ocupados, t0: t, sitios: SITIOS_CAFE });
      if (paseo) v.paseos.push(paseo);
      v.siguiente = t + CADA;
    }
    for (const [id, p] of Object.entries(enDirecto)) {
      const enReunion = v.escena?.paseos.find((x) => x.id === id);
      poses.set(id, (enReunion && poseDeReunion(enReunion, t)) || poseDePaseo(v.paseos.find((x) => x.id === id), t) || p);
    }
    tablon.set([
      ...v.paseos.filter((p) => hablandoEn(p, t) && p.texto).map((p) => ({ quien: p.id, a: p.a, texto: p.texto })),
      ...(v.escena?.bocadillos || []).filter((b) => t >= b.s0 && t < b.s1).map((b) => ({ quien: b.quien, texto: b.texto, reunion: true })),
    ]);
  });
  return null;
}

// Los bocadillos en directo (paseos y reunión)
function BocadillosVivos({ tablon, poses, porId }) {
  const lista = useSyncExternalStore(tablon.subscribe, tablon.get, () => VACIA);
  return lista.map((b) => {
    const p = poses.get(b.quien);
    if (!p) return null;
    return (
      <Etiqueta key={`${b.quien}${b.texto}`} position={[p.x, b.reunion ? 2.2 : 2.5, p.z]} center zIndexRange={[40, 20]}>
        <div className={`cz-fade w-[150px] sm:w-[220px] -translate-y-1/2 rounded-2xl rounded-bl-md px-2.5 py-1.5 text-[12px] leading-snug shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] ring-1 select-none ${b.reunion ? "bg-amber-50 text-slate-900 ring-amber-200" : "bg-white text-slate-800 ring-slate-900/10"}`}>
          <p className="text-[10px] font-bold text-rose-500">{nombreDe(b.quien, porId)}{b.a ? ` → ${nombreDe(b.a, porId)}` : ""}</p>
          <p className="line-clamp-3">{b.texto}</p>
        </div>
      </Etiqueta>
    );
  });
}

// ---------- Cámara isométrica: encuadra la sala elegida y no deja salirse del edificio ----------
const VISTAS = {
  todo: [EDIFICIO.x0 - 0.3, EDIFICIO.x1 + 0.3, EDIFICIO.z0 - 0.3, EDIFICIO.z1 + 1.2],
  ...Object.fromEntries(Object.entries(SALAS).map(([id, s]) => [id, [s.x0, s.x1, s.z0, s.z1]])),
};
// arriba / abajo: lo que tapan la hora y la barra de salas (en píxeles)
function encuadre(caja, w, h, arriba = 96, abajo = 62) {
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

function Camara({ vista, focoRef, alSoltarFoco }) {
  const { size } = useThree();
  const controles = useRef(), tocando = useRef(false), llegado = useRef(false), ultimoFoco = useRef(null), destinoFoco = useRef(null);
  const destino = useMemo(() => {
    const todo = !VISTAS[vista.trim()] || vista.trim() === "todo";
    return todo ? encuadre(VISTAS.todo, size.width, size.height, 30, 54) : encuadre(VISTAS[vista.trim()], size.width, size.height);
  }, [vista, size.width, size.height]);
  const minimo = useMemo(() => encuadre(VISTAS.todo, size.width, size.height).zoom * 0.85, [size.width, size.height]);
  // Al elegir otra sala, la cámara vuelve a moverse sola (hasta que la arrastres tú)
  useEffect(() => { llegado.current = false; tocando.current = false; }, [destino]);
  useFrame(() => {
    const c = controles.current;
    if (!c) return;
    const cam = c.object;
    c.minZoom = minimo;
    // Repetición: la cámara se acerca a quien está trabajando, despacio
    const f = focoRef.current;
    if (f?.id !== ultimoFoco.current) {
      ultimoFoco.current = f?.id ?? null;
      destinoFoco.current = f ? encuadre([f.x - 4.6, f.x + 4.6, f.z - 3.4, f.z + 2.6], size.width, size.height) : null;
      llegado.current = false;
    }
    const meta = destinoFoco.current || destino;
    const suave = destinoFoco.current ? 0.035 : 0.09;
    if (!llegado.current && !tocando.current) {
      c.target.lerp(meta.centro, suave);
      cam.zoom += (meta.zoom - cam.zoom) * suave;
      cam.position.copy(c.target).add(OFFSET);
      cam.updateProjectionMatrix();
      if (c.target.distanceTo(meta.centro) < 0.02 && Math.abs(meta.zoom - cam.zoom) < 0.05) llegado.current = true;
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
      onStart={() => { tocando.current = true; alSoltarFoco?.(); }} />
  );
}

// ---------- La oficina ----------
const nombreDe = (id, porId) => (id === "jefe" ? "👔 Jefe" : id === "tu" ? "📱 Tú" : porId[id] ? `${porId[id].emoji} ${porId[id].nombre}` : id);
const horaMadrid = (ms) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const SALAS_BOTONES = [["todo", "Todo"], ["busqueda", "🔎 Búsqueda"], ["control", "🧐 Control"], ["archivo", "🗄️ Archivo"], ["despacho", "👔 Jefe"], ["cafe", "☕ Cafetería"], ["despensa", "🧺 Despensa"], ["negocio", "📣 Negocio"], ["escaparate", "🪟 Escaparate"]];

// Los nombres de las salas no cambian nunca: van aparte para no repintarlos durante la repetición
const NombresSalas = memo(function NombresSalas() {
  return Object.entries(SALAS).map(([id, sala]) => (
    <Etiqueta key={id} position={[sala.rotulo[0], sala.rotulo[1] < 0 ? ALTO + 0.4 : 0.5, sala.rotulo[1]]} center>
      <span className="select-none whitespace-nowrap pn-rotulo rounded-full px-2 py-0.5 text-[9px] sm:text-[11px] font-bold shadow-sm">{sala.emoji} <span className="sm:hidden">{sala.corto}</span><span className="hidden sm:inline">{sala.nombre}</span></span>
    </Etiqueta>
  ));
});

// Los contadores del archivo, tu buzón y la papelera
function Rotulos({ rep, reloj, repitiendo, flujo, bandeja }) {
  const s = useSegundo(reloj);
  const c = repitiendo && rep ? contadores(rep, s) : null;
  // En el móvil, solo la cifra
  const cifras = {
    archivo: [c ? `+${fmt(c.archivo)}` : fmt(flujo.agenda), c ? " nuevos" : " en la agenda"],
    buzon: [c ? `+${fmt(c.buzon)}` : fmt(bandeja), c ? " dudosos" : " en tu buzón"],
    papelera: [c ? `+${fmt(c.papelera)}` : fmt(flujo.sinFuente), " a revisar"],
  };
  return (
    <>
      {[["archivo", "📅", "bg-emerald-500"], ["buzon", "📥", "bg-amber-500"], ["papelera", "🗑", "bg-slate-500"]].map(([id, icono, color]) => (
        <Etiqueta key={id} position={[DESTINOS[id][0], DESTINOS[id][1] + 0.9, DESTINOS[id][2]]} center>
          <span className={`select-none whitespace-nowrap rounded-full ${color} px-2 py-0.5 text-[10px] sm:text-[11px] font-bold shadow tabular-nums`}>{icono} {cifras[id][0]}<span className="hidden sm:inline">{cifras[id][1]}</span></span>
        </Etiqueta>
      ))}
    </>
  );
}

// Los bocadillos de la charla durante la repetición, y el rótulo de quien está trabajando
function Bocadillos({ rep, reloj, poses, porId, sitios }) {
  const s = useSegundo(reloj);
  const g = [...rep.golpes].reverse().find((x) => x.s <= s + 0.2 && s < x.s + 3.6);
  return (
    <>
      {g && g.empleados.filter((id) => sitios[id] && porId[id]).slice(0, 3).map((id) => (
        <Etiqueta key={`t${g.s}${id}`} position={[sitios[id].silla[0], 2.2, sitios[id].silla[1]]} center>
          <span className="cz-fade select-none whitespace-nowrap rounded-full bg-[#e9b44c] px-2.5 py-1 text-[11px] font-bold text-[#17151c] shadow">{porId[id].emoji} {porId[id].nombre}</span>
        </Etiqueta>
      ))}
      {bocadillosEn(rep, s).map((b) => {
        const p = poses.get(b.quien);
        if (!p) return null;
        return (
          <Etiqueta key={`${b.s0}${b.quien}`} position={[p.x, 2.5, p.z]} center zIndexRange={[40, 20]}>
            <div className="cz-fade w-[150px] sm:w-[210px] -translate-y-1/2 rounded-2xl rounded-bl-md bg-white px-2.5 py-1.5 text-[12px] leading-snug text-slate-800 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] ring-1 ring-slate-900/10 select-none">
              <p className="text-[10px] font-bold text-rose-500">{nombreDe(b.de, porId)} → {nombreDe(b.a, porId)}</p>
              <p className="line-clamp-3">{b.texto}</p>
            </div>
          </Etiqueta>
        );
      })}
    </>
  );
}

// Lo que está pasando en la repetición, en una línea (y la barra de progreso)
function Narrador({ rep, reloj, porId, pausa, setPausa, alParar, seguir, setSeguir }) {
  const s = useSegundo(reloj);
  const g = [...rep.golpes].reverse().find((x) => x.s <= s + 0.2);
  const c = contadores(rep, s);
  const quien = g ? g.empleados.filter((id) => porId[id]).map((id) => `${porId[id].emoji} ${porId[id].nombre}`).join(", ") : "";
  const que = !g ? "Todos en la cafetería, esperando su turno" : g.sinMostrador ? `${quien}: ${g.texto || "turno hecho"}` : `${quien}: ${g.busquedas} búsquedas, ${g.nuevos} nuevos, ${g.descartados} a revisar`;
  return (
    <div className="pointer-events-auto rounded-2xl px-3 py-2 shadow-lg" style={{ background: "rgba(12,11,16,.84)", color: "#f3ead8", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid rgba(243,234,216,.14)" }}>
      <div className="flex items-center gap-2">
        <span className="font-bold tabular-nums text-[15px]">{horaMadrid(horaReal(rep, s))}</span>
        <span className="flex-1 min-w-0 text-[12.5px] leading-tight line-clamp-2" style={{ color: "#d3ccbe" }}>{que}</span>
        <button onClick={() => setSeguir((x) => !x)} aria-pressed={seguir} className="h-9 px-2.5 shrink-0 rounded-full text-[11px] font-semibold" style={{ background: seguir ? "#f3ead8" : "rgba(243,234,216,.14)", color: seguir ? "#17151c" : "#f3ead8" }}>Seguir</button>
        <button onClick={() => setPausa((x) => !x)} className="h-9 w-9 shrink-0 rounded-full text-[12px]" style={{ background: "rgba(243,234,216,.14)" }} aria-label={pausa ? "Seguir la repetición" : "Pausar"}>{pausa ? "▶" : "❚❚"}</button>
        <button onClick={alParar} className="h-9 w-9 shrink-0 rounded-full text-[12px]" style={{ background: "rgba(243,234,216,.14)" }} aria-label="Salir de la repetición">✕</button>
      </div>
      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(243,234,216,.15)" }}><div className="h-full" style={{ width: `${(s / rep.duracion) * 100}%`, background: "#e9b44c" }} /></div>
      <p className="mt-1 text-[11px] tabular-nums" style={{ color: "#aaa397" }}>+{fmt(c.archivo)} a la agenda · +{fmt(c.buzon)} a tu buzón · +{fmt(c.papelera)} a revisar</p>
    </div>
  );
}

// Con «Seguir» apagado, la cámara no persigue a nadie
const SIN_FOCO = { current: null };

const hayGpuBuena = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 768 && (navigator.hardwareConcurrency || 4) >= 4 && (navigator.deviceMemory || 8) >= 4;
};

export default function Oficina3D({ departamentos, charla = [], golpes = [], bandeja = [], flujo = {}, alElegir, vista = "todo", setVista, repeticion, alAcabarRepeticion, movimiento = true, reunion = null, alAcabarReunion }) {
  const sitios = useMemo(() => planta(departamentos), [departamentos]);
  const empleados = useMemo(() => departamentos.flatMap((d) => d.empleados.map((e, i) => ({ ...e, dep: d.id, i }))), [departamentos]);
  const porId = useMemo(() => Object.fromEntries(empleados.map((e) => [e.id, e])), [empleados]);
  // Cada refresco de datos trae objetos nuevos: el aspecto depende solo de quiénes son, para no rehacer los cuerpos
  const plantilla = empleados.map((e) => e.id).join();
  const aspectos = useMemo(() => Object.fromEntries([...plantilla.split(",").map((id, i) => [id, aspectoDe(i, { pieles: PIELES, pelos: PELOS })]), ["jefe", { ...aspectoDe(30, { pieles: PIELES, pelos: PELOS }), pelo: "#8d8d8c", pantalon: "#16181f", zapatos: "#1b1a20", ancho: 1.03, alto: 1 }]]), [plantilla]);
  const [poses] = useState(() => new Map());
  const [reloj] = useState(crearReloj);
  const [tablon] = useState(crearTablon);
  const capa = useRef(null);
  const foco = useRef(null);
  const [pausa, setPausa] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const [alta, setAlta] = useState(hayGpuBuena);
  const [dpr, setDpr] = useState(() => (hayGpuBuena() ? 1.75 : 1.5));
  // Fuera de la pantalla no se pinta nada: ahorra batería
  const marco = useRef(null);
  const [aLaVista, setALaVista] = useState(true);
  useEffect(() => {
    if (!marco.current || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([e]) => setALaVista(e.isIntersecting));
    o.observe(marco.current);
    return () => o.disconnect();
  }, []);

  // La hora de ahora, cada 30 segundos (para saber quién está en su turno)
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    const tic = () => setAhora(Date.now());
    const r = requestAnimationFrame(tic);
    const i = setInterval(tic, 30000);
    return () => { cancelAnimationFrame(r); clearInterval(i); };
  }, []);

  // De día entra luz por las ventanas; de noche mandan las lámparas
  const dia = useMemo(() => {
    if (ahora == null) return 1;
    const h = Number(new Date(ahora).toLocaleTimeString("es-ES", { hour: "2-digit", hour12: false, timeZone: "Europe/Madrid" }));
    return h >= 8 && h < 19 ? 1 : h >= 7 && h < 21 ? 0.55 : 0.12;
  }, [ahora]);

  // En directo: cada uno en su sitio según su turno y su estado
  const { enDirecto, rotulos, trabajando, siguiente, resto, vivos } = useMemo(() => {
    if (ahora == null) return { enDirecto: {}, rotulos: {}, trabajando: [], siguiente: null, resto: {}, vivos: {} };
    const donde = Object.fromEntries(empleados.map((e) => [e.id, dondeEsta(e, ahora)]));
    const sitio = colocar(donde, sitios);
    const enDirecto = { jefe: { x: sitios.jefe.silla[0], z: sitios.jefe.silla[1], giro: 0, modo: "jefe" } };
    const rotulos = {};
    for (const e of empleados) {
      if (!sitio[e.id]?.sitio) continue;
      const { sitio: s, modo, pendiente } = sitio[e.id];
      enDirecto[e.id] = { x: s.pos[0], z: s.pos[1], giro: s.giro || 0, modo, asiento: s.tipo === "barra" ? "alto" : "bajo" };
      if (modo === "teclea") rotulos[e.id] = e.enCurso ? { texto: `🔴 ${e.emoji} ${e.nombre}`, color: "bg-rose-600/90" } : { texto: `${e.emoji} ${e.nombre}` };
      if (e.descanso) rotulos[e.id] = { texto: "🏖️", color: "bg-violet-500/90" };
      // Ha fallado: toma algo en la cafetería con su fallo apuntado y lo repasa lo primero en su próximo turno
      if (pendiente) rotulos[e.id] = { texto: `📝 ${e.nombre}`, color: "bg-amber-500/90" };
      if (modo === "duerme") rotulos[e.id] = { texto: "💤", color: "bg-amber-500/90" };
    }
    const trabajando = empleados.filter((e) => donde[e.id] === "mesa");
    const cuenta = (d) => Object.values(donde).filter((x) => x === d).length;
    const prox = empleados.map((e) => ({ e, t: proximoTurno(e.turnos, ahora) })).filter((x) => x.t).sort((a, b) => a.t - b.t)[0] || null;
    return { enDirecto, rotulos, trabajando, siguiente: prox, resto: { cafe: cuenta("cafe") + cuenta("pendiente"), sofa: cuenta("sofa"), pendiente: cuenta("pendiente") }, vivos: sitio };
  }, [ahora, empleados, sitios]);

  // La repetición de las últimas 24 h
  const repitiendo = !!repeticion;
  const rep = useMemo(() => {
    if (!repeticion || ahora == null) return null;
    const r = montarRepeticion({ golpes, departamentos, bandeja, charla }, sitios, ahora);
    // Quien no trabajó en ese rato se queda en la cafetería, en los sitios que sobran
    const usados = new Set(Object.values(r.cafe || {}).map((s) => s.id));
    const libres = CAFE_SITIOS.filter((s) => !usados.has(s.id));
    r.quietos = Object.fromEntries(empleados.filter((e) => !r.tramosDe?.[e.id]).map((e, i) => {
      const s = libres[i % Math.max(1, libres.length)] || CAFE_SITIOS[0];
      return [e.id, { x: s.pos[0], z: s.pos[1], giro: s.giro, modo: "sentado", asiento: s.tipo === "barra" ? "alto" : "bajo" }];
    }));
    return r;
  }, [repeticion, ahora, golpes, departamentos, bandeja, charla, sitios, empleados]);

  const camisa = (e) => (CAMISAS[e.dep] || CAMISAS.agenda)[e.i % 3];
  const luzDe = (e) => (e.estado === "ok" && !trabajando.includes(e) ? "#55585f" : LUZ[e.estado] || LUZ.nuevo);
  const fotograma = aLaVista ? "always" : "never";

  return (
    <div ref={marco} className="pn-escena">
      <div className="relative h-[min(66dvh,128vw)] min-h-[420px] sm:h-[680px] touch-none">
        <div ref={capa} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        <Capa.Provider value={capa}>
          <Canvas orthographic shadows={alta ? "soft" : false} dpr={dpr} frameloop={fotograma} camera={{ position: OFFSET.toArray(), zoom: 10, near: -200, far: 400 }}
            fallback={<p className="p-6 text-sm" style={{ color: "#d3ccbe" }}>Tu navegador no puede mostrar la oficina en 3D. Usa la vista de lista.</p>}>
            <PerformanceMonitor onDecline={() => { setDpr(1); setAlta(false); }} />
            <Ambiente dia={dia} sombras={alta} />
            <Horneado key={`${flujo.sinFuente || 0}-${flujo.planesAyer || 0}`} sombras={alta}>
              <Edificio />
              <Busqueda />
              <Control sinFuente={flujo.sinFuente || 0} />
              <Despacho />
              <Cafeteria />
              <Despensa />
              <Negocio />
              <Escaparate planes={flujo.planesAyer || 0} />
              {ESTANTES_ARCHIVO.map((e) => <Estanteria key={e.z} {...e} />)}
              {empleados.filter((e) => sitios[e.id]).map((e, i) => <Escritorio key={e.id} x={sitios[e.id].mesa[0]} z={sitios[e.id].mesa[1]} semilla={i} />)}
            </Horneado>
            <Archivadores agenda={flujo.agenda || 0} />
            <Productos />
            {empleados.filter((e) => sitios[e.id]).map((e) => <Pantalla key={e.id} id={e.id} x={sitios[e.id].mesa[0]} z={sitios[e.id].mesa[1]} luz={luzDe(e)} poses={poses} />)}
            <Pantalla id="jefe" x={13.5} z={-6.2} luz="#e9b44c" poses={poses} grande />
            {empleados.map((e, i) => (
              <Persona key={e.id} e={e} poses={poses} semilla={i * 1.7} camisa={camisa(e)} aspecto={aspectos[e.id]}
                rotulo={repitiendo ? null : rotulos[e.id]} alTocar={() => alElegir(e)} />
            ))}
            <Persona e={{ id: "jefe" }} jefe poses={poses} semilla={3} camisa="#1b1e27" aspecto={aspectos.jefe} rotulo={repitiendo ? null : { texto: "👔 El jefe", color: "bg-rose-600/90", soloGrande: true }} alTocar={() => alElegir({ jefe: true })} />
            <Carpetas rep={rep} reloj={reloj} />
            <NombresSalas />
            <Rotulos rep={rep} reloj={reloj} repitiendo={repitiendo} flujo={flujo} bandeja={bandeja.length} />
            {rep && !rep.vacia && <Bocadillos rep={rep} reloj={reloj} poses={poses} porId={porId} sitios={sitios} />}
            {!repitiendo && <BocadillosVivos tablon={tablon} poses={poses} porId={porId} />}
            <Director key={repeticion || 0} rep={rep} enDirecto={enDirecto} poses={poses} reloj={reloj} repitiendo={repitiendo} pausa={pausa} alAcabar={alAcabarRepeticion}
              vivos={vivos} jefe={sitios.jefe} charla={charla.slice(-40)} movimiento={movimiento} reunion={reunion} alAcabarReunion={alAcabarReunion} tablon={tablon} focoRef={foco} sitios={sitios} />
            <Camara vista={vista} focoRef={seguir ? foco : SIN_FOCO} alSoltarFoco={() => setSeguir(false)} />
          </Canvas>
        </Capa.Provider>
      </div>

      {/* Arriba: la hora y quién trabaja (o la repetición) */}
      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-20">
        {repitiendo && rep && !rep.vacia ? (
          <Narrador rep={rep} reloj={reloj} porId={porId} pausa={pausa} setPausa={setPausa} alParar={alAcabarRepeticion} seguir={seguir} setSeguir={setSeguir} />
        ) : repitiendo && rep?.vacia ? (
          <p className="pointer-events-auto inline-flex rounded-2xl px-3 py-2 text-xs shadow" style={{ background: "rgba(12,11,16,.84)", color: "#f3ead8" }}>No hay turnos en las últimas 24 h que repetir. <button onClick={alAcabarRepeticion} className="ml-2 font-semibold" style={{ color: "#e9b44c" }}>Cerrar</button></p>
        ) : ahora != null && (
          <div className="inline-flex max-w-full flex-col rounded-2xl px-3 py-2 text-xs shadow-sm" style={{ background: "rgba(12,11,16,.78)", color: "#d3ccbe", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid rgba(243,234,216,.14)" }}>
            <span className="font-bold text-[13px]" style={{ color: "#f3ead8" }}>Ahora {horaMadrid(ahora)} · trabajando: {trabajando.length}</span>
            <span className="truncate">{trabajando.length ? trabajando.map((e) => `${e.emoji} ${e.nombre}`).join(", ") : siguiente ? `Próximo turno: ${siguiente.e.emoji} ${siguiente.e.nombre} a las ${horaMadrid(siguiente.t)}` : "Nadie de turno"}</span>
            <span className="truncate" style={{ color: "#aaa397" }}>☕ {resto.cafe} en la cafetería{resto.sofa ? ` · 💤 ${resto.sofa} dormidos` : ""}{resto.pendiente ? ` · 📝 ${resto.pendiente} con un fallo apuntado` : ""}</span>
          </div>
        )}
      </div>

      {/* Abajo: las salas */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-2.5">
        <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-full p-1" style={{ background: "rgba(12,11,16,.78)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid rgba(243,234,216,.14)" }}>
          {SALAS_BOTONES.map(([id, texto]) => (
            <button key={id} onClick={() => setVista(id === vista ? `${id} ` : id)} className={`${PRESS} shrink-0 h-9 px-3 rounded-full text-[12px] sm:text-[13px] font-semibold`} style={vista.trim() === id ? { background: "#f3ead8", color: "#17151c" } : { color: "#bdb6a9" }}>{texto}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
