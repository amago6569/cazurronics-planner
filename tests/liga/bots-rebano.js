// Jugadores simulados para la Trashumancia: hacen lo que un perro pastor de verdad. Si el rebaño está junto, se ponen
// detrás (al lado contrario de la portilla) y empujan; si alguna oveja se ha quedado descolgada, van primero a por ella.
// Ven el prado con retraso, les tiembla el dedo y los peores se acercan demasiado deprisa.
// Aquí sí hay Math.random y logaritmos: no es el motor.
import { crearPartida, mover, avanzar, resumen, tiempoHecho, DURACION_MS, PERRO, PARED, MIEDO } from "../../public/liga/motor-rebano.js";
import { suerteJs } from "./bots.js";

// reaccion: ms de retraso al ver · pulso: temblor del dedo · cada: ms entre gesto y gesto · detras: a qué distancia
// se coloca del rebaño (más lejos = más suave) · prisa: lo brusco que mueve el dedo · tiento: con ovejas cerca, cuánto adelanta el dedo al
// perro (poco = el perro va despacio y no las espanta) · lia: despistes por segundo
export const NIVELES = {
  novato: { reaccion: 420, pulso: 0.06, cada: 45, detras: 0.2, prisa: 1.8, lia: 0.3, tiento: 0.6 },
  normal: { reaccion: 300, pulso: 0.035, cada: 40, detras: 0.4, prisa: 1.2, lia: 0.15, tiento: 0.12 },
  bueno: { reaccion: 220, pulso: 0.02, cada: 35, detras: 0.33, prisa: 1, lia: 0.05, tiento: 0.09 },
  experto: { reaccion: 170, pulso: 0.012, cada: 33, detras: 0.27, prisa: 1, lia: 0, tiento: 0.075 },
  maquina: { reaccion: 0, pulso: 0, cada: 33, detras: 0.22, prisa: 1, lia: 0, tiento: 0.075 },
};
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function jugarRebano(semilla, nivel, semillaJugador = semilla ^ 0x51ab) {
  const n = typeof nivel === "string" ? NIVELES[nivel] : nivel;
  const r = suerteJs(semillaJugador);
  const p = crearPartida(semilla);
  const visto = [];
  let dx = 0, dy = 0.25, ultimoT = -1000, ux = null, uy = null, despiste = 0;
  for (let t = 0; t <= DURACION_MS; t += n.cada) {
    avanzar(p, t);
    visto.push({ t, ovejas: p.ovejas.filter((o) => o.estado === "libre").map((o) => ({ x: o.x, y: o.y })), px: p.perro.x, py: p.perro.y });
    while (visto.length > 1 && visto[1].t <= t - n.reaccion) visto.shift();
    const v = visto[0];
    let qx = dx, qy = dy;
    if (t < despiste) { /* se queda mirando */ }
    else if (r() < n.lia * (n.cada / 1000)) despiste = t + 500 + r() * 700;
    else if (v.ovejas.length) {
      const N = v.ovejas.length;
      let cx = 0, cy = 0;
      for (const o of v.ovejas) { cx += o.x; cy += o.y; }
      cx /= N; cy /= N;
      // la más descolgada
      let lejos = null, dl = 0;
      for (const o of v.ovejas) { const d = Math.hypot(o.x - cx, o.y - cy); if (d > dl) { dl = d; lejos = o; } }
      const junto = 0.16 + 0.05 * Math.sqrt(N);
      const meta = { x: 0, y: PARED + 0.15 };
      let ox, oy, hx, hy;
      if (dl > junto && N > 1) { ox = lejos.x; oy = lejos.y; hx = cx; hy = cy; } // recoger: empujarla hacia el grupo
      else { ox = cx; oy = cy; hx = meta.x; hy = meta.y; // llevar: empujar el grupo hacia la portilla
        // cerca de la pared hay que apuntar al hueco: se corrige de lado
        if (cy > PARED - 0.5) { hx = 0; hy = PARED + 0.3; }
      }
      const ax = ox - hx, ay = oy - hy, l = Math.hypot(ax, ay) || 1;
      const fondo = n.detras + (dl > junto ? 0 : 0.04 * Math.sqrt(N));
      qx = ox + (ax / l) * fondo; qy = oy + (ay / l) * fondo;
      // para no cruzar por medio del rebaño, se rodea: el perro va por un círculo alrededor hasta quedar detrás
      const ex = p.perro.x - ox, ey = p.perro.y - oy;
      const aPerro = Math.atan2(ey, ex), aSitio = Math.atan2(ay, ax);
      let falta = aSitio - aPerro;
      while (falta > Math.PI) falta -= 2 * Math.PI;
      while (falta < -Math.PI) falta += 2 * Math.PI;
      if (Math.abs(falta) > 0.7) {
        const radio = Math.max(fondo, MIEDO * 0.8 + (dl > junto ? 0 : dl));
        const a = aPerro + Math.sign(falta) * 0.6;
        qx = ox + Math.cos(a) * radio; qy = oy + Math.sin(a) * radio;
      }
      // si el sitio cae fuera del prado, se pone pegado al borde a la altura de la oveja: así la saca hacia dentro
      if (qx > PERRO.xMax || qx < -PERRO.xMax) qy = oy;
      if (qy < 0) qx = ox;
      // con ovejas cerca, despacio: el dedo solo va un poco por delante del perro
      // (dónde tiene el perro lo sabe sin retraso: es su dedo)
      const mx = p.perro.x, my = p.perro.y;
      const cerca = v.ovejas.some((o) => Math.hypot(o.x - mx, o.y - my) < 0.42);
      if (cerca) { const ex2 = qx - mx, ey2 = qy - my, d = Math.hypot(ex2, ey2); if (d > n.tiento) { qx = mx + (ex2 / d) * n.tiento; qy = my + (ey2 / d) * n.tiento; } }
    }
    // el dedo va hacia donde quiere, con su prisa y su temblor
    const k = Math.min(1, (n.cada / 1000) * 6 * n.prisa);
    dx += (qx - dx) * k + gauss(r) * n.pulso * 0.3;
    dy += (qy - dy) * k + gauss(r) * n.pulso * 0.3;
    dx = Math.max(-PERRO.xMax, Math.min(PERRO.xMax, dx)); dy = Math.max(0, Math.min(PERRO.yMax, dy));
    const xm = Math.round(dx * 10000), ym = Math.round(dy * 10000);
    const tm = Math.max(t, tiempoHecho(p), ultimoT + 8);
    if ((xm !== ux || ym !== uy) && tm <= DURACION_MS) { mover(p, tm, xm, ym); ux = xm; uy = ym; ultimoT = tm; }
  }
  avanzar(p, DURACION_MS);
  return { ...resumen(p), movimientos: p.movimientos.slice(), semilla };
}
