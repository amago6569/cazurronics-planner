// Utilidades del navegador para la portada, el Planner y la Despensa nuevos. Son las mismas que src/lib/cliente.js
// (identificador anónimo, analítica, planes recientes, compartir y enlaces seguros), escritas sin módulos para que
// estas páginas estáticas no dependan de React. Si cambias algo allí, cámbialo aquí también.
(function () {
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const C = {};

  // Todo lo que llega de la API se escapa antes de meterlo en el HTML
  C.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  C.webSegura = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
  C.telSeguro = (t) => `tel:${String(t || "").replace(/[^\d+]/g, "")}`;
  C.hay = (v) => v != null && String(v).trim() !== "" && !/^no disponible$/i.test(String(v).trim());

  C.hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  C.idVotante = () => {
    let id = leer("cz-votante", null);
    if (!id) { try { id = `v-${crypto.randomUUID()}`; } catch { id = `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; } escribir("cz-votante", id); }
    return id;
  };
  C.baliza = (tipo, extra = {}) => {
    try { const cuerpo = JSON.stringify({ tipo, ...extra }); if (navigator.sendBeacon) navigator.sendBeacon("/api/evento", cuerpo); else fetch("/api/evento", { method: "POST", body: cuerpo, keepalive: true }); } catch {}
  };
  C.registrarVisita = () => {
    try { if (sessionStorage.getItem("cz-visita")) return; sessionStorage.setItem("cz-visita", "1"); } catch {}
    const params = new URLSearchParams(location.search);
    let deDonde = "directo";
    try { if (document.referrer) deDonde = new URL(document.referrer).hostname.replace(/^www\./, "") || "directo"; } catch {}
    C.baliza("visita", { fuente: params.get("utm_source") || params.get("ref") || deDonde });
    const hoy = C.hoyLocal(), ultima = leer("cz-ultima-visita", null);
    if (ultima && ultima !== hoy) C.baliza("vuelve");
    escribir("cz-ultima-visita", hoy);
  };

  // Planes recientes, para el "¿Qué tal el plan?"
  C.recordarPlan = (planId, fecha, itinerario) => {
    if (!planId) return;
    const lista = leer("cz-planes", []).filter((p) => p.id !== planId);
    lista.unshift({ id: planId, fecha, paradas: itinerario.map((p) => ({ titulo: p.titulo, hora: p.hora, foto: p.fotoOficial })), valorado: false });
    escribir("cz-planes", lista.slice(0, 10));
  };
  C.actualizarParadaRecordada = (planId, indice, parada) => {
    const lista = leer("cz-planes", []), p = lista.find((x) => x.id === planId);
    if (!p || !p.paradas[indice]) return;
    p.paradas[indice] = { titulo: parada.titulo, hora: parada.hora, foto: parada.fotoOficial };
    escribir("cz-planes", lista);
  };
  C.planPendienteDeValorar = () => { const hoy = C.hoyLocal(); return leer("cz-planes", []).find((p) => !p.valorado && p.fecha && p.fecha < hoy) || null; };
  C.marcarValorado = (planId) => { const lista = leer("cz-planes", []), p = lista.find((x) => x.id === planId); if (p) { p.valorado = true; escribir("cz-planes", lista); } };

  C.compartirPlan = async (planId, texto = "Mira el plan que me ha montado Cazurronics 🦁") => {
    const url = `${location.origin}/plan/${planId}`;
    C.baliza("compartir");
    try { if (navigator.share) { await navigator.share({ title: "Mi plan en León", text: texto, url }); return "compartido"; } }
    catch (e) { if (e && e.name === "AbortError") return "cancelado"; }
    try { await navigator.clipboard.writeText(url); return "copiado"; } catch { return "error"; }
  };

  C.distanciaKm = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  C.km = (k) => (k < 1 ? `${Math.round(k * 1000)} m` : `${(Math.round(k * 10) / 10).toString().replace(".", ",")} km`);

  // Aviso flotante (en vez de los alert() de antes)
  let tAviso = 0;
  C.avisar = (msg) => {
    let el = document.getElementById("cz-aviso");
    if (!el) { el = document.createElement("div"); el.id = "cz-aviso"; el.className = "aviso-flot"; el.setAttribute("role", "alert"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on"); clearTimeout(tAviso); tAviso = setTimeout(() => el.classList.remove("on"), 4200);
  };

  window.CZ = C;
})();
