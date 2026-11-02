// Selector de zona con la misma funcionalidad que el MapSelector de la web: buscar un sitio de la provincia,
// "Usar mi ubicación", tocar el mapa (nunca fuera de León) y la distancia máxima en caja y en barra.
// Al escribir salen pueblos de la provincia al momento; si no está en la lista, se busca en OpenStreetMap
// (Nominatim) con ", provincia de León, España", como hoy. fino (Despensa): desde 200 m y barra logarítmica.
window.crearSelectorZona = function (raiz, { fino = false, km = 15, alCambiar = () => {} } = {}) {
  const MIN = fino ? .2 : 1, MAX = 150;
  const deBarra = (p) => { const k = MIN * (MAX / MIN) ** (p / 1000); return k < 10 ? Math.round(k * 10) / 10 : Math.round(k); };
  const aBarra = (k) => Math.round((1000 * Math.log(Math.max(k, MIN) / MIN)) / Math.log(MAX / MIN));
  const id = "z" + Math.random().toString(36).slice(2, 7);
  raiz.innerHTML = `
    <form class="donde" autocomplete="off">
      <input class="campo" id="${id}b" type="search" placeholder="Ej: Ponferrada, Astorga…" aria-label="Buscar un pueblo o lugar" enterkeyhint="search" role="combobox" aria-expanded="false" aria-controls="${id}s" aria-autocomplete="list">
      <button class="boton" type="submit">Buscar</button>
      <ul class="sugerencias" id="${id}s" role="listbox" hidden></ul>
    </form>
    <button class="ubicacion" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>Usar mi ubicación</button>
    <p class="estado-zona" role="status"></p>
    <div class="mapa-zona" style="flex:1;min-height:220px"></div>
    <div class="distancia"><label for="${id}k">Distancia máxima</label><div class="km-caja"><input id="${id}k" type="number" inputmode="decimal" min="${MIN}" max="${MAX}" step="${fino ? .1 : 1}"><span>km</span></div></div>
    <input class="rango" type="range" min="${fino ? 0 : 1}" max="${fino ? 1000 : MAX}" step="1" aria-label="Distancia máxima">`;
  const $ = (s) => raiz.querySelector(s);
  const form = $(".donde"), busca = $(".campo"), sug = $(".sugerencias"), estado = $(".estado-zona"), caja = $(`#${id}k`), barra = $(".rango"), mapaEl = $(".mapa-zona");
  const mapa = crearMapa(mapaEl, { contorno: true, alTocar: (lat, lon, dentro) => (dentro ? poner(lat, lon, null) : negar()) });
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const PUEBLOS = (window.PROVINCIA ? window.PROVINCIA.pueblos : []).map(([n, x, y]) => { const [lat, lon] = window.pxALatLon(x, y); return { n, lat, lon, k: norm(n) }; });
  const z = { lat: 42.5987, lon: -5.5671, nombre: "León", km };
  function nombreCerca(lat, lon) {
    const c = PUEBLOS.map((p) => ({ p, d: CZ.distanciaKm([lat, lon], [p.lat, p.lon]) })).sort((a, b) => a.d - b.d)[0];
    return !c ? "tu punto" : c.d < 3 ? c.p.n : `cerca de ${c.p.n}`;
  }
  function pintar() { caja.value = z.km; barra.value = fino ? aBarra(z.km) : z.km; mapa.zona(z.lat, z.lon, z.km); alCambiar({ ...z }); }
  function poner(lat, lon, nombre) { z.lat = +lat.toFixed(5); z.lon = +lon.toFixed(5); z.nombre = nombre || nombreCerca(lat, lon); estado.textContent = ""; pintar(); }
  function negar() { mapaEl.classList.remove("niega"); void mapaEl.offsetWidth; mapaEl.classList.add("niega"); estado.textContent = "¡Ay guaje, eso ya no es León! Elige un sitio dentro de la provincia."; }

  // Sugerencias al escribir
  let marcada = -1;
  function cerrarSug() { sug.hidden = true; busca.setAttribute("aria-expanded", "false"); busca.removeAttribute("aria-activedescendant"); }
  function sugerir() {
    const q = norm(busca.value); if (!q) { cerrarSug(); return; }
    const r = PUEBLOS.filter((p) => p.k.includes(q)).sort((a, b) => a.k.indexOf(q) - b.k.indexOf(q)).slice(0, 6);
    if (!r.length) { cerrarSug(); return; } // lo busca OpenStreetMap al pulsar Buscar
    sug.innerHTML = r.map((p, i) => `<li role="option" id="${id}o${i}"><button type="button" data-n="${CZ.esc(p.n)}">${CZ.esc(p.n)}</button></li>`).join("");
    sug.hidden = false; busca.setAttribute("aria-expanded", "true"); marcada = -1;
    sug.querySelectorAll("button").forEach((b) => (b.onclick = () => elegir(b.dataset.n)));
  }
  function elegir(n) { const p = PUEBLOS.find((x) => x.n === n); if (!p) return; busca.value = ""; cerrarSug(); busca.blur(); poner(p.lat, p.lon, p.n); }
  busca.addEventListener("input", sugerir);
  busca.addEventListener("blur", () => setTimeout(cerrarSug, 150));
  busca.addEventListener("keydown", (e) => {
    const bs = [...sug.querySelectorAll("button")];
    if (sug.hidden) return;
    if (e.key === "ArrowDown" && bs.length) { e.preventDefault(); marcada = (marcada + 1) % bs.length; }
    else if (e.key === "ArrowUp" && bs.length) { e.preventDefault(); marcada = (marcada - 1 + bs.length) % bs.length; }
    else if (e.key === "Escape") { cerrarSug(); return; } else return;
    bs.forEach((b, i) => b.classList.toggle("marcada", i === marcada)); busca.setAttribute("aria-activedescendant", `${id}o${marcada}`);
  });
  let buscando = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const bs = sug.hidden ? [] : [...sug.querySelectorAll("button")];
    if (bs.length) { bs[Math.max(0, marcada)].click(); return; }
    const q = busca.value.trim(); if (!q || buscando) return;
    buscando = true; estado.textContent = "Buscando…";
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q + ", provincia de León, España")}`);
      const data = await res.json();
      const sitio = (data || []).map((d) => ({ lat: parseFloat(d.lat), lon: parseFloat(d.lon), n: String(d.display_name || q).split(",")[0] })).find((d) => window.dentroDeLeon(d.lat, d.lon));
      if (sitio) { busca.value = ""; busca.blur(); poner(sitio.lat, sitio.lon, sitio.n); }
      else estado.textContent = "¡Ay guaje, no encuentro ese sitio en León!";
    } catch { estado.textContent = "No hemos podido buscar ahora. Toca el mapa o prueba otra vez."; }
    finally { buscando = false; }
  };
  // Usar mi ubicación: mismos mensajes que la web
  $(".ubicacion").onclick = () => {
    if (!navigator.geolocation) { estado.textContent = "Tu navegador no deja usar la ubicación. Busca el pueblo o toca el mapa."; return; }
    estado.textContent = "Buscando dónde estás…";
    navigator.geolocation.getCurrentPosition(
      (p) => (window.dentroDeLeon(p.coords.latitude, p.coords.longitude) ? poner(p.coords.latitude, p.coords.longitude, "tu ubicación") : (estado.textContent = "Estás fuera de la provincia de León. Busca un pueblo o toca el mapa.")),
      (e) => { estado.textContent = e && e.code === 1 ? "Sin permiso para la ubicación. Busca el pueblo o toca el mapa." : "No hemos podido saber dónde estás. Busca el pueblo o toca el mapa."; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };
  // Distancia: caja y barra, como hoy. El mapa se reencuadra al soltar para no marear mientras arrastras
  let tRe = 0;
  const cambiaKm = (k) => { z.km = k; clearTimeout(tRe); tRe = setTimeout(() => mapa.zona(z.lat, z.lon, z.km), 120); alCambiar({ ...z }); };
  caja.addEventListener("input", () => { if (caja.value === "") return; const k = Math.min(MAX, Math.max(MIN, +caja.value)); barra.value = fino ? aBarra(k) : k; cambiaKm(k); });
  caja.addEventListener("blur", () => { caja.value = z.km; });
  barra.addEventListener("input", () => { const k = fino ? deBarra(+barra.value) : +barra.value; caja.value = k; cambiaKm(k); });
  pintar();
  return { valor: () => ({ ...z }), repintar: () => mapa.reencuadrar() };
};
