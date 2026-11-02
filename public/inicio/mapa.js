// Mapa oscuro de verdad (Leaflet + OpenStreetMap, como el MapSelector de la web), con la misma forma de uso que el
// de la maqueta: zona(lat, lon, km) pinta el punto y el radio; paradas(lista) pone chinchetas numeradas y la ruta.
// La provincia de León va recortada con su contorno real: lo de fuera se oscurece y no se puede elegir.
(function () {
  const LIMITES_LEON = [[41.8, -7.35], [43.45, -4.45]];
  // El contorno viene en píxeles del mosaico de la provincia (zoom 10); se pasa a latitud y longitud
  const tx = (lon, n) => ((lon + 180) / 360) * n;
  const ty = (lat, n) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const N10 = 1024, X0 = Math.floor(tx(-7.2, N10)), Y0 = Math.floor(ty(43.32, N10));
  window.pxALatLon = (x, y) => { const X = X0 + x / 256, Y = Y0 + y / 256; return [(Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / N10))) * 180) / Math.PI, (X / N10) * 360 - 180]; };
  const P = window.PROVINCIA;
  const CONTORNO = P ? P.contorno.map(([x, y]) => window.pxALatLon(x, y)) : null;
  window.dentroDeLeon = (lat, lon) => {
    if (!CONTORNO) return lat >= LIMITES_LEON[0][0] && lat <= LIMITES_LEON[1][0] && lon >= LIMITES_LEON[0][1] && lon <= LIMITES_LEON[1][1];
    let c = false;
    for (let i = 0, j = CONTORNO.length - 1; i < CONTORNO.length; j = i++) {
      const [yi, xi] = CONTORNO[i], [yj, xj] = CONTORNO[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  const pin = (n) => L.divIcon({ className: "pin-num", html: `<span>${n}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
  const punto = () => L.divIcon({ className: "pin-punto", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

  window.crearMapa = function (el, { contorno = false, alTocar = null } = {}) {
    el.classList.add("mapa-osc");
    const mapa = L.map(el, { zoomControl: false, attributionControl: true, maxBounds: [[41.2, -8.2], [44.0, -3.6]], maxBoundsViscosity: 1, minZoom: 7, zoomSnap: .25 })
      .setView([42.5987, -5.5671], 12);
    mapa.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
    if (contorno && CONTORNO) {
      const mundo = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
      L.polygon([mundo, CONTORNO], { stroke: false, fillColor: "#050409", fillOpacity: .62, interactive: false }).addTo(mapa);
      L.polygon(CONTORNO, { color: "#e9b44c", weight: 2, opacity: .85, fill: false, interactive: false }).addTo(mapa);
    }
    if (alTocar) mapa.on("click", (e) => alTocar(e.latlng.lat, e.latlng.lng, window.dentroDeLeon(e.latlng.lat, e.latlng.lng)));
    const capas = L.layerGroup().addTo(mapa);
    let encuadre = null;
    const api = {
      dentro: window.dentroDeLeon,
      zona(lat, lon, km) {
        capas.clearLayers();
        const c = L.circle([lat, lon], { radius: km * 1000, color: "#e9b44c", weight: 2, fillColor: "#e9b44c", fillOpacity: .12, interactive: false }).addTo(capas);
        L.marker([lat, lon], { icon: punto(), interactive: false, keyboard: false }).addTo(capas);
        encuadre = () => { mapa.invalidateSize(); mapa.fitBounds(c.getBounds(), { padding: [24, 24], maxZoom: 15, animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }); };
        encuadre();
      },
      paradas(lista, { ruta = true } = {}) {
        capas.clearLayers();
        const puntos = lista.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
        if (ruta && puntos.length > 1) L.polyline(puntos.map((p) => [p.lat, p.lon]), { color: "#e9b44c", weight: 3, dashArray: "2 9", lineCap: "round", interactive: false }).addTo(capas);
        puntos.forEach((p, i) => {
          const m = L.marker([p.lat, p.lon], { icon: pin(p.n || i + 1), title: p.titulo || "", keyboard: false }).addTo(capas);
          if (p.alTocar) m.on("click", p.alTocar);
        });
        encuadre = () => {
          mapa.invalidateSize();
          if (!puntos.length) return;
          if (puntos.length === 1) mapa.setView([puntos[0].lat, puntos[0].lon], 15);
          else mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon])), { padding: [40, 40], maxZoom: 16 });
        };
        encuadre();
      },
      reencuadrar() { if (encuadre) encuadre(); else mapa.invalidateSize(); },
      mapa,
    };
    addEventListener("resize", () => api.reencuadrar());
    return api;
  };
})();
