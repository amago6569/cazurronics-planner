// La foto de la rosa está un poco girada y en perspectiva. Para que quede recta y simétrica se coge un solo gajo
// (de un eje de simetría al siguiente: 15°, porque la rosa de León tiene 12 radios) y se repite 24 veces,
// alternando espejo, como en un caleidoscopio. El medallón central se pinta encima, original pero enderezado.
window.rosaSimetrica = function (img, px = 1000) {
  const CX = 502, CY = 508;            // centro de la rosa en rosa.jpg (1000 × 1000)
  const EJE = -90.85 * Math.PI / 180;  // eje vertical real de la foto (está girada casi un grado)
  const GAJO = Math.PI / 12;           // 15°
  const R_MEDALLON = 60;
  const c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d"), k = px / 1000;
  g.fillStyle = "#050409"; g.fillRect(0, 0, px, px);
  g.translate(px / 2, px / 2); g.scale(k, k);
  const gajo = () => {
    g.save();
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 520, -Math.PI / 2 - .002, -Math.PI / 2 + GAJO + .002); g.closePath(); g.clip();
    g.rotate(-Math.PI / 2 - EJE);      // lleva el eje de la foto a la vertical exacta
    g.drawImage(img, -CX, -CY);
    g.restore();
  };
  for (let j = 0; j < 12; j++) {
    g.save(); g.rotate(j * 2 * GAJO); gajo();
    // espejo respecto al borde del gajo: rellena el gajo vecino con la imagen reflejada
    g.rotate(-Math.PI / 2 + GAJO); g.scale(1, -1); g.rotate(Math.PI / 2 - GAJO); gajo();
    g.restore();
  }
  // medallón central, sin espejo, enderezado
  g.save(); g.beginPath(); g.arc(0, 0, R_MEDALLON, 0, Math.PI * 2); g.clip(); g.rotate(-Math.PI / 2 - EJE); g.drawImage(img, -CX, -CY); g.restore();
  // recorte circular limpio
  g.globalCompositeOperation = "destination-in"; g.beginPath(); g.arc(0, 0, 498, 0, Math.PI * 2); g.fill();
  return c.toDataURL("image/jpeg", .92);
};
// Sustituye la foto por la versión simétrica en cuanto carga
window.ponerRosaSimetrica = function (el) {
  const usar = () => { try { el.src = window.rosaSimetrica(el); } catch (e) { /* si falla se queda la foto original */ } };
  if (el.complete && el.naturalWidth) usar(); else el.addEventListener("load", usar, { once: true });
};
