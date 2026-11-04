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
  // Las fotos de los sitios llegan de dos formas: de Google por nuestra ruta (/api/foto?ref=...) o de una web (Wikimedia)
  C.fotoSegura = (u) => { const s = String(u || "").trim(); return /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) ? s : ""; };
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

  // Horas y franjas de la agenda: las mismas de src/lib/agenda.js (un test comprueba que no se separan)
  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const franjaDe = (min) => (min < 14 * 60 ? "manana" : min < 20 * 60 ? "tarde" : "noche");
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const formatoHora = (min, fin) => (fin != null && fin > min ? `${hhmm(min)}–${hhmm(fin)}` : hhmm(min));
  C.leerHora = (hora) => {
    const t = normalizar(hora).trim();
    if (!t || /todo el dia|permanente|horario de apertura|consultar/.test(t)) return { min: null, fin: null, franja: "todo", texto: null };
    const horas = [...t.matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(h|horas|:|$|\s|-|–|a)/g)].map((m) => Number(m[1]) * 60 + Number(m[2] || 0)).filter((m) => m <= 24 * 60);
    if (horas.length) { const [min, fin = null] = horas, largo = fin != null && fin - min >= 6 * 60; return { min, fin, franja: largo ? "todo" : franjaDe(min), texto: formatoHora(min, fin) }; }
    if (/manana/.test(t)) return { min: 10 * 60, fin: null, franja: "manana", texto: "Por la mañana" };
    if (/mediodia/.test(t)) return { min: 13 * 60 + 30, fin: null, franja: "manana", texto: "Mediodía" };
    if (/tarde/.test(t)) return { min: 17 * 60, fin: null, franja: "tarde", texto: "Por la tarde" };
    if (/noche/.test(t)) return { min: 21 * 60, fin: null, franja: "noche", texto: "Por la noche" };
    return { min: null, fin: null, franja: "todo", texto: null };
  };
  C.FRANJAS = [{ id: "todo", titulo: "Todo el día" }, { id: "manana", titulo: "Mañana y mediodía" }, { id: "tarde", titulo: "Por la tarde" }, { id: "noche", titulo: "Por la noche" }];
  C.esDeVariosDias = (e) => Boolean(e && (e.permanente || (e.diasSemana && e.diasSemana.length) || (e.fechaFin && e.fechaFin > e.fecha)));
  const DIAS_SEMANA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  C.cuandoEs = (e) => {
    if (e && e.diasSemana && e.diasSemana.length) { const d = [...e.diasSemana].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((n) => DIAS_SEMANA[n]); return `Todos los ${d.length > 1 ? `${d.slice(0, -1).join(", ")} y ${d[d.length - 1]}` : d[0]}`; }
    if (e && e.permanente && !e.fechaFin) return "Abierto estos días";
    if (e && e.fechaFin) return `Hasta el ${new Date(`${e.fechaFin}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
    return null;
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
