// ============ CÓMO SE MUEVE CADA MONIGOTE ============
// Funciones puras (sin three.js) para poder probarlas. Dado lo que está haciendo alguien, dicen a qué ángulo va cada
// articulación. El monigote mira hacia +z. En un brazo o una pierna, rotación x negativa = hacia delante; la rodilla
// se dobla con x positiva y el codo con x negativa. Ángulos en radianes, alturas en metros.

export const ALTURA = { pelvis: 0.9, asientoBajo: 0.58, asientoAlto: 0.84, sofa: 0.5 };

// El paso sale de los metros andados, no del reloj: así los pies no patinan aunque la repetición vaya deprisa
export const ZANCADA = 1.45;
export const faseDe = (metros) => (metros / ZANCADA) * Math.PI * 2;

const REPOSO = () => ({
  pelvisY: ALTURA.pelvis, torsoX: 0, torsoY: 0, cabezaX: 0, cabezaY: 0, cabezaZ: 0,
  hombroIX: 0.04, hombroIZ: 0.06, codoI: -0.12, hombroDX: 0.04, hombroDZ: -0.06, codoD: -0.12,
  caderaI: 0, rodillaI: 0, caderaD: 0, rodillaD: 0, taza: 0,
});

const SENTADOS = new Set(["teclea", "sentado", "duerme", "jefe", "reunion"]);
export const estaSentado = (modo) => SENTADOS.has(modo);

function altura(modo, asiento) {
  if (modo === "duerme") return ALTURA.sofa;
  return asiento === "alto" ? ALTURA.asientoAlto : ALTURA.asientoBajo;
}

function piernasSentado(a, asiento) {
  const alto = asiento === "alto";
  a.caderaI = a.caderaD = alto ? -1.2 : -1.35;
  a.rodillaI = a.rodillaD = alto ? 1 : 1.35;
}

// t = segundos (con la semilla de cada uno, para que no vayan sincronizados). fase = la del paso. veloz = m/s reales
export function postura(modo, t = 0, { fase = 0, veloz = 0, asiento = "bajo", lleva = false } = {}) {
  const a = REPOSO();
  const respira = Math.sin(t * 1.5) * 0.012;
  a.torsoX = respira;

  if (estaSentado(modo)) {
    a.pelvisY = altura(modo, asiento);
    piernasSentado(a, asiento);
  }

  switch (modo) {
    case "anda": {
      // Corre si va con prisa (la repetición resume 24 h en un minuto): más zancada y el cuerpo adelantado
      const prisa = Math.min(1, Math.max(0, (veloz - 2.2) / 3.5));
      const amp = 0.48 + prisa * 0.34;
      const s = Math.sin(fase), c = Math.cos(fase);
      a.caderaI = s * amp; a.caderaD = -s * amp;
      // La rodilla se dobla al llevar la pierna hacia delante; casi recta al apoyar
      a.rodillaI = 0.12 + Math.max(0, c) * (0.75 + prisa * 0.55);
      a.rodillaD = 0.12 + Math.max(0, -c) * (0.75 + prisa * 0.55);
      a.pelvisY = ALTURA.pelvis - 0.018 + Math.abs(c) * 0.026 - prisa * 0.03;
      a.torsoX = 0.03 + prisa * 0.2;
      a.torsoY = s * 0.09;
      a.cabezaX = -prisa * 0.1;
      a.cabezaY = -s * 0.05;
      if (lleva) {
        a.hombroIX = a.hombroDX = -0.75; a.codoI = a.codoD = -1.05;
      } else {
        a.hombroIX = -s * (amp * 0.82); a.hombroDX = s * (amp * 0.82);
        a.codoI = -0.32 - prisa * 0.7; a.codoD = -0.32 - prisa * 0.7;
      }
      break;
    }
    case "teclea": {
      a.torsoX = 0.11 + respira;
      a.hombroIX = -1.02 + Math.sin(t * 11) * 0.025; a.hombroDX = -1.02 + Math.cos(t * 13) * 0.025;
      a.hombroIZ = 0.14; a.hombroDZ = -0.14;
      a.codoI = -0.66 + Math.sin(t * 17) * 0.08; a.codoD = -0.66 + Math.cos(t * 19) * 0.08;
      // Mira la pantalla y de vez en cuando levanta la vista
      a.cabezaX = 0.14 + Math.max(0, Math.sin(t * 0.37) - 0.85) * -1.3;
      a.cabezaY = Math.sin(t * 0.61) * 0.1;
      break;
    }
    case "jefe": {
      a.torsoX = 0.05 + respira;
      a.hombroIX = -0.95; a.codoI = -0.75;
      // Al teléfono de vez en cuando
      const llama = Math.sin(t * 0.13) > 0.35 ? 1 : 0;
      a.hombroDX = llama ? -0.7 : -0.95; a.hombroDZ = llama ? -0.55 : -0.12; a.codoD = llama ? -2.35 : -0.75;
      a.cabezaY = Math.sin(t * 0.5) * 0.35;
      a.cabezaZ = llama ? -0.12 : 0;
      break;
    }
    case "duerme": {
      a.torsoX = -0.3 + Math.sin(t * 1.05) * 0.018;
      a.hombroIX = a.hombroDX = -0.28; a.codoI = a.codoD = -0.85;
      a.cabezaZ = 0.42 + Math.sin(t * 1.05) * 0.03;
      a.cabezaX = 0.22;
      break;
    }
    case "sentado": {
      // Con un café: de vez en cuando se lo lleva a la boca y mira a los demás
      const sorbo = Math.max(0, Math.sin(t * 0.7) - 0.62) * 2.63;
      a.taza = 1;
      a.hombroIX = -0.55; a.codoI = -0.85;
      a.hombroDX = -0.65 - sorbo * 0.6; a.hombroDZ = -0.1; a.codoD = -0.9 - sorbo * 1.2;
      a.cabezaX = -sorbo * 0.28;
      a.cabezaY = Math.sin(t * 0.4) * 0.45;
      break;
    }
    case "reunion": {
      a.torsoX = 0.08 + respira;
      a.hombroIX = a.hombroDX = -0.85; a.codoI = a.codoD = -0.85;
      a.cabezaY = Math.sin(t * 0.6) * 0.32;
      break;
    }
    case "habla": {
      a.hombroIX = -0.3 + Math.sin(t * 3.4) * 0.22; a.codoI = -0.9 + Math.sin(t * 2.7) * 0.3;
      a.hombroDX = -0.65 + Math.sin(t * 4.1 + 1) * 0.35; a.codoD = -1.15 + Math.sin(t * 3.1) * 0.4;
      a.cabezaX = Math.sin(t * 5) * 0.05;
      a.cabezaY = Math.sin(t * 1.3) * 0.12;
      break;
    }
    case "entrega": {
      a.hombroIX = a.hombroDX = -1.15; a.codoI = a.codoD = -0.55;
      a.torsoX = 0.14;
      a.cabezaX = 0.2;
      break;
    }
    case "espera": {
      a.hombroIZ = 0.55; a.hombroDZ = -0.55; a.codoI = a.codoD = -1.4;
      a.cabezaZ = Math.sin(t * 6) * 0.1;
      a.caderaD = Math.max(0, Math.sin(t * 8)) * -0.22;
      a.rodillaD = Math.max(0, Math.sin(t * 8)) * 0.3;
      break;
    }
    default: {
      a.cabezaY = Math.sin(t * 0.5) * 0.2;
    }
  }
  return a;
}

// El camino más corto entre dos giros (para que no den la vuelta entera al cambiar de dirección)
export function giroCorto(desde, hasta) {
  const d = (hasta - desde) % (Math.PI * 2);
  return ((2 * d) % (Math.PI * 2)) - d;
}
