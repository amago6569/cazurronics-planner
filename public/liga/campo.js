// Para los juegos que se ven desde atrás y arriba (Justa, Bolos). Sin 3D: lo usan también el dibujo plano y el dedo.
// El suelo visto desde atrás y arriba (como en la Trashumancia): del campo (x de lado, y hacia el fondo, alto) a la
// pantalla, y al revés. «m» es el marco; lejos = la distancia que cae en la altura yLejos de la pantalla.
// corre = cuánto se desplaza el centro del campo hacia la derecha de la pantalla (en metros del campo)
export function crearCampo({ D, lejos, anchoMax = 1.07, altoHw = 0.3, yCerca = 0.93, yLejos = 0.44, corre = 0 }) {
  const c = { cx: 0, hw: 1, yCerca: 0, ojo: 0, yc: 1 };
  return {
    c, D,
    medir(m) {
      c.hw = Math.min(m.ancho / 2 / anchoMax, m.H * altoHw);
      c.cx = m.ancho / 2 + corre * c.hw; c.yCerca = m.arriba + m.H * yCerca;
      const yL = m.arriba + m.H * yLejos, r = D / (D + lejos);
      c.ojo = (yL - r * c.yCerca) / (1 - r);
      c.yc = (c.yCerca - c.ojo) / c.hw;
      m.campo = c;
    },
    aPantalla(x, y, alto = 0) { const f = D / (D + y); return { x: c.cx + c.hw * x * f, y: c.ojo + (c.yCerca - c.ojo) * f - c.hw * alto * f, f }; },
    aCampo(px, py) { const f = Math.max(0.2, (py - c.ojo) / (c.yCerca - c.ojo)); return { x: (px - c.cx) / (c.hw * f), y: D / f - D }; },
    vista3d: () => ({ cx: c.cx, yPlano: c.yCerca, k: c.hw, D, yc: c.yc }),
  };
}
