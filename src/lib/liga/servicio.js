// ============ LIGA CAZURRA: cuentas y datos ============
// En producción: Supabase (Fráncfort). Cuentas con su Auth (código de 6 cifras por correo) y datos en su Postgres,
// siempre a través de las funciones de supabase/liga.sql con la clave secreta, que solo vive en Vercel.
//
// Variables en Vercel:
//   SUPABASE_URL                  https://xxxx.supabase.co
//   SUPABASE_PUBLISHABLE_KEY      la clave pública (sb_publishable_… o la «anon» antigua)
//   SUPABASE_SECRET_KEY           la clave secreta (sb_secret_… o la «service_role» antigua). Nunca en el navegador.
//
// En local, sin esas variables, todo va en memoria (se borra al reiniciar) y el código del correo se devuelve
// en la respuesta para poder probar. En producción sin variables, la liga responde «no disponible».

export class ErrorLiga extends Error {
  constructor(status, mensaje, codigo) { super(mensaje); this.status = status; this.codigo = codigo; }
}

const URL_SB = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLICA = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const SECRETA = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MS_SB = 8000;

export function modoLiga() {
  if (URL_SB && PUBLICA && SECRETA) return "supabase";
  if (process.env.NODE_ENV !== "production" || process.env.LIGA_MEMORIA === "1") return "memoria";
  return null;
}

// ─────────────────────────── Supabase ───────────────────────────
function cabeceras(clave, token) {
  const h = { apikey: clave, "Content-Type": "application/json" };
  // Las claves antiguas son JWT y van también en Authorization; las nuevas (sb_…) solo en apikey.
  if (token) h.Authorization = `Bearer ${token}`;
  else if (clave.startsWith("eyJ")) h.Authorization = `Bearer ${clave}`;
  return h;
}

async function pedir(ruta, { metodo = "POST", clave = SECRETA, token, cuerpo, prefer } = {}) {
  const headers = cabeceras(clave, token);
  if (prefer) headers.Prefer = prefer;
  let res;
  try {
    res = await fetch(`${URL_SB}${ruta}`, {
      method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), signal: AbortSignal.timeout(MS_SB), cache: "no-store",
    });
  } catch (e) {
    throw new ErrorLiga(503, "La liga no responde ahora mismo. Prueba en un momento.", `red: ${e?.message || e}`);
  }
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* respuesta sin JSON */ }
  return { ok: res.ok, status: res.status, json };
}

function sesionDe(j) {
  if (!j?.access_token || !j?.refresh_token) throw new ErrorLiga(502, "No se pudo abrir la sesión. Prueba otra vez.", "sin tokens");
  return {
    access: j.access_token, refresh: j.refresh_token,
    expira: Number(j.expires_at) || Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
    usuario: { id: j.user?.id, email: j.user?.email },
  };
}

async function rpc(nombre, params) {
  const r = await pedir(`/rest/v1/rpc/${nombre}`, { cuerpo: params });
  if (!r.ok) throw new ErrorLiga(502, "Fallo guardando en la liga. Prueba otra vez.", `rpc ${nombre} ${r.status}: ${JSON.stringify(r.json)}`);
  return r.json;
}

const supabase = {
  async pedirCodigo(email) {
    const r = await pedir("/auth/v1/otp", { clave: PUBLICA, cuerpo: { email, create_user: true } });
    if (r.status === 429) throw new ErrorLiga(429, "Ya te mandamos un código hace menos de un minuto: míralo en tu correo (y en spam). Si no está, pide otro en un minuto.");
    if (!r.ok) throw new ErrorLiga(502, "No se pudo mandar el correo. Revisa la dirección o prueba en un rato.", `otp ${r.status}: ${JSON.stringify(r.json)}`);
    return {};
  },
  async verificar(email, codigo) {
    const r = await pedir("/auth/v1/verify", { clave: PUBLICA, cuerpo: { type: "email", email, token: codigo } });
    if (r.status === 429) throw new ErrorLiga(429, "Demasiados intentos. Espera un poco.");
    if (!r.ok) throw new ErrorLiga(400, "Ese código no vale o ha caducado. Pide otro.", `verify ${r.status}`);
    return sesionDe(r.json);
  },
  async renovar(refresh) {
    const r = await pedir("/auth/v1/token?grant_type=refresh_token", { clave: PUBLICA, cuerpo: { refresh_token: refresh } });
    // Solo si Supabase dice que la clave no vale se cierra la sesión; un fallo suyo no te echa
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new ErrorLiga(401, "Tu sesión ha caducado. Vuelve a entrar con tu correo.", `refresh ${r.status}`);
    if (!r.ok) throw new ErrorLiga(503, "La liga no responde ahora mismo. Prueba en un momento.", `refresh ${r.status}`);
    return sesionDe(r.json);
  },
  async usuario(access) {
    const r = await pedir("/auth/v1/user", { metodo: "GET", clave: PUBLICA, token: access });
    if (r.status === 401 || r.status === 403) return null;
    if (!r.ok || !r.json?.id) throw new ErrorLiga(503, "La liga no responde ahora mismo. Prueba en un momento.", `user ${r.status}`);
    return { id: r.json.id, email: r.json.email };
  },
  async correoDe(id) { // solo para avisar a los ganadores (con la clave secreta, desde el servidor)
    const r = await pedir(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { metodo: "GET" });
    if (r.status === 404) return null;
    if (!r.ok) throw new ErrorLiga(502, "No se pudo leer el correo del ganador.", `correo ${r.status}`);
    return r.json?.email || null;
  },
  async borrarUsuario(id) {
    const r = await pedir(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { metodo: "DELETE" });
    if (!r.ok && r.status !== 404) throw new ErrorLiga(502, "No se pudo borrar la cuenta. Prueba otra vez.", `borrar ${r.status}`);
  },

  async perfil(id) {
    const r = await pedir(`/rest/v1/liga_jugadores?id=eq.${encodeURIComponent(id)}&select=apodo,pueblo,novedades,bloqueado`, { metodo: "GET" });
    if (!r.ok) throw new ErrorLiga(502, "Fallo leyendo tu perfil.", `perfil ${r.status}`);
    return r.json?.[0] || null;
  },
  async guardarPerfil(id, { apodo, clave, pueblo, novedades }, nuevo) {
    const fila = { apodo, apodo_clave: clave, pueblo, novedades: Boolean(novedades) };
    const r = nuevo
      ? await pedir("/rest/v1/liga_jugadores", { cuerpo: { id, ...fila, acepta_bases: new Date().toISOString() }, prefer: "return=minimal" })
      : await pedir(`/rest/v1/liga_jugadores?id=eq.${encodeURIComponent(id)}`, { metodo: "PATCH", cuerpo: fila, prefer: "return=minimal" });
    if (r.status === 409 || r.json?.code === "23505") {
      if (String(r.json?.message || r.json?.details || "").includes("apodo")) throw new ErrorLiga(409, "Ese apodo ya lo tiene otra persona. Prueba con otro.");
      throw new ErrorLiga(409, "Ya tienes perfil.");
    }
    if (!r.ok) throw new ErrorLiga(502, "No se pudo guardar tu perfil. Prueba otra vez.", `guardar perfil ${r.status}: ${JSON.stringify(r.json)}`);
  },
  async borrarDatos(id) {
    const r = await pedir(`/rest/v1/liga_jugadores?id=eq.${encodeURIComponent(id)}`, { metodo: "DELETE" });
    if (!r.ok) throw new ErrorLiga(502, "No se pudo borrar la cuenta. Prueba otra vez.", `borrar datos ${r.status}`);
  },
  async empezar(jugador, juego, dia, semilla, version) {
    const filas = await rpc("liga_empezar", { p_jugador: jugador, p_juego: juego, p_dia: dia, p_semilla: semilla, p_version: version });
    return filas?.[0] || { error: "sin_respuesta" };
  },
  async partida(id, jugador) {
    const filas = await rpc("liga_partida", { p_partida: id, p_jugador: jugador });
    return filas?.[0] || null;
  },
  async terminar(id, jugador, estado, puntos, motivo, datos) {
    return Boolean(await rpc("liga_terminar", { p_partida: id, p_jugador: jugador, p_estado: estado, p_puntos: puntos, p_motivo: motivo, p_datos: datos }));
  },
  async ranking(desde, hasta, limite, jugador) {
    return (await rpc("liga_ranking", { p_desde: desde, p_hasta: hasta, p_limite: limite, p_jugador: jugador || null })) || [];
  },
  async hoy(jugador, dia) {
    return (await rpc("liga_hoy", { p_jugador: jugador, p_dia: dia })) || [];
  },
};

// ─────────────────────────── Memoria (solo para probar en local) ───────────────────────────
// Imita lo que hacen las funciones de supabase/liga.sql (tests/liga/sql/pruebas.sql comprueba las de verdad).
const M = globalThis.__ligaMemoria || (globalThis.__ligaMemoria = {
  codigos: new Map(), usuarios: new Map(), sesiones: new Map(), refrescos: new Map(), jugadores: new Map(), partidas: new Map(),
});
const id = () => crypto.randomUUID();

const memoria = {
  async pedirCodigo(email) {
    const previo = M.codigos.get(email);
    if (previo && Date.now() - previo.creado < 20000) throw new ErrorLiga(429, "Has pedido muchos códigos. Espera un minuto y vuelve a probar.");
    const codigo = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    M.codigos.set(email, { codigo, creado: Date.now(), fallos: 0 });
    console.log(`[liga] código para ${email}: ${codigo}`);
    return { codigoDePrueba: codigo };
  },
  async verificar(email, codigo) {
    const c = M.codigos.get(email);
    if (!c || c.codigo !== codigo || Date.now() - c.creado > 10 * 60000) {
      if (c && ++c.fallos >= 5) M.codigos.delete(email);
      throw new ErrorLiga(400, "Ese código no vale o ha caducado. Pide otro.");
    }
    M.codigos.delete(email);
    let u = [...M.usuarios.values()].find((x) => x.email === email);
    if (!u) { u = { id: id(), email }; M.usuarios.set(u.id, u); }
    return memoria._sesion(u);
  },
  _sesion(u) {
    const access = `prueba-${id()}`, refresh = `refresco-${id()}`;
    const expira = Math.floor(Date.now() / 1000) + 3600;
    M.sesiones.set(access, { usuario: u.id, expira });
    M.refrescos.set(refresh, u.id);
    return { access, refresh, expira, usuario: { id: u.id, email: u.email } };
  },
  async renovar(refresh) {
    const uid = M.refrescos.get(refresh);
    if (!uid || !M.usuarios.has(uid)) throw new ErrorLiga(401, "Tu sesión ha caducado. Vuelve a entrar con tu correo.");
    M.refrescos.delete(refresh);
    return memoria._sesion(M.usuarios.get(uid));
  },
  async usuario(access) {
    const s = M.sesiones.get(access);
    if (!s || s.expira * 1000 < Date.now() || !M.usuarios.has(s.usuario)) return null;
    const u = M.usuarios.get(s.usuario);
    return { id: u.id, email: u.email };
  },
  async correoDe(uid) { return M.usuarios.get(uid)?.email || null; },
  async borrarUsuario(uid) {
    M.usuarios.delete(uid);
    for (const [k, v] of M.sesiones) if (v.usuario === uid) M.sesiones.delete(k);
    for (const [k, v] of M.refrescos) if (v === uid) M.refrescos.delete(k);
  },
  async perfil(uid) {
    const j = M.jugadores.get(uid);
    return j ? { apodo: j.apodo, pueblo: j.pueblo, novedades: j.novedades, bloqueado: j.bloqueado } : null;
  },
  async guardarPerfil(uid, { apodo, clave, pueblo, novedades }, nuevo) {
    if ([...M.jugadores.values()].some((j) => j.clave === clave && j.id !== uid)) throw new ErrorLiga(409, "Ese apodo ya lo tiene otra persona. Prueba con otro.");
    const previo = M.jugadores.get(uid);
    if (nuevo && previo) throw new ErrorLiga(409, "Ya tienes perfil.");
    if (!nuevo && !previo) throw new ErrorLiga(404, "Aún no tienes perfil.");
    M.jugadores.set(uid, { ...(previo || { id: uid, bloqueado: false, acepta: new Date().toISOString() }), apodo, clave, pueblo, novedades: Boolean(novedades) });
  },
  async borrarDatos(uid) {
    M.jugadores.delete(uid);
    for (const [k, p] of M.partidas) if (p.jugador === uid) M.partidas.delete(k);
  },
  async empezar(jugador, juego, dia, semilla, version) {
    const j = M.jugadores.get(jugador);
    if (!j) return { error: "sin_perfil" };
    if (j.bloqueado) return { error: "bloqueado" };
    const mias = [...M.partidas.values()].filter((p) => p.jugador === jugador && p.juego === juego && p.dia === dia);
    for (const p of mias) if (p.estado === "jugando") Object.assign(p, { estado: "abandonada", terminada: new Date(), motivo: "se empezó otro intento" });
    if (mias.length >= 3) return { partida: null, intento: null, quedan: 0, error: "sin_intentos" };
    const p = { id: id(), jugador, juego, dia, intento: mias.length + 1, semilla, version, empezada: new Date(), estado: "jugando", puntos: null };
    M.partidas.set(p.id, p);
    return { partida: p.id, intento: p.intento, quedan: 2 - mias.length, error: null };
  },
  async partida(pid, jugador) {
    const p = M.partidas.get(pid);
    if (!p || p.jugador !== jugador) return null;
    return { juego: p.juego, dia: p.dia, semilla: p.semilla, version: p.version, empezada: p.empezada.toISOString(), estado: p.estado, ahora: new Date().toISOString() };
  },
  async terminar(pid, jugador, estado, puntos, motivo, datos) {
    const p = M.partidas.get(pid);
    if (!p || p.jugador !== jugador || p.estado !== "jugando") return false;
    Object.assign(p, { estado, puntos: estado === "valida" ? puntos : null, motivo, datos, terminada: new Date() });
    return true;
  },
  async ranking(desde, hasta, limite, jugador) {
    const mejores = new Map(); // jugador|juego|dia → { puntos, hecho }
    for (const p of M.partidas.values()) {
      if (p.estado !== "valida" || p.dia < desde || p.dia > hasta) continue;
      const k = `${p.jugador}|${p.juego}|${p.dia}`, m = mejores.get(k);
      if (!m || p.puntos > m.puntos || (p.puntos === m.puntos && p.terminada < m.hecho)) mejores.set(k, { jugador: p.jugador, puntos: p.puntos, hecho: p.terminada });
    }
    const total = new Map();
    for (const m of mejores.values()) {
      const t = total.get(m.jugador) || { jugador: m.jugador, puntos: 0, hecho: 0 };
      t.puntos += m.puntos; t.hecho = Math.max(t.hecho, m.hecho.getTime());
      total.set(m.jugador, t);
    }
    const orden = [...total.values()].filter((t) => M.jugadores.has(t.jugador) && !M.jugadores.get(t.jugador).bloqueado)
      .sort((a, b) => b.puntos - a.puntos || a.hecho - b.hecho || (a.jugador < b.jugador ? -1 : 1));
    return orden.map((t, i) => ({ posicion: i + 1, jugador: t.jugador, apodo: M.jugadores.get(t.jugador).apodo, pueblo: M.jugadores.get(t.jugador).pueblo, puntos: t.puntos, yo: t.jugador === jugador }))
      .filter((f) => f.posicion <= limite || f.yo);
  },
  async hoy(jugador, dia) {
    const por = new Map();
    for (const p of M.partidas.values()) {
      if (p.jugador !== jugador || p.dia !== dia) continue;
      const f = por.get(p.juego) || { juego: p.juego, usados: 0, mejor: null, jugando: null };
      f.usados++;
      if (p.estado === "valida") f.mejor = Math.max(f.mejor ?? 0, p.puntos);
      if (p.estado === "jugando") f.jugando = p.id;
      por.set(p.juego, f);
    }
    return [...por.values()];
  },
  // solo para las pruebas
  _reiniciar() { for (const m of Object.values(M)) m.clear(); },
  _bloquear(uid) { const j = M.jugadores.get(uid); if (j) j.bloqueado = true; },
  _retrasar(pid, ms) { const p = M.partidas.get(pid); if (p) p.empezada = new Date(p.empezada.getTime() - ms); },
};

export function servicio() {
  const modo = modoLiga();
  if (modo === "supabase") return supabase;
  if (modo === "memoria") return memoria;
  throw new ErrorLiga(503, "La liga aún no está abierta.", "sin configurar");
}
