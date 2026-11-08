-- ============ LIGA CAZURRA: base de datos (Supabase, Fráncfort) ============
-- Se pega entero en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin romper nada.
--
-- Reglas que viven aquí y no en el móvil:
-- · 3 intentos por juego y día (día de Madrid). Empezar uno lo gasta, aunque no se acabe.
-- · Los puntos los pone el servidor tras repetir la partida con el mismo motor del juego.
-- · El ranking SIEMPRE se calcula sumando las mejores marcas: nunca se guardan contadores que sumar.
-- · Nadie de fuera lee ni escribe las tablas: todo pasa por la web (clave secreta) y estas funciones.

create table if not exists public.liga_jugadores (
  id uuid primary key references auth.users (id) on delete cascade,
  apodo text not null check (char_length(apodo) between 3 and 16),
  apodo_clave text not null unique,               -- el apodo en minúsculas y sin tildes: «Pepé» y «pepe» son el mismo
  pueblo text not null check (char_length(pueblo) between 2 and 40),
  acepta_bases timestamptz not null,              -- cuándo marcó «tengo 14 años o más y acepto las bases»
  novedades boolean not null default false,       -- casilla aparte y sin marcar
  bloqueado boolean not null default false,       -- Alejandro puede quitar a quien haga trampas
  creado timestamptz not null default now()
);

create table if not exists public.liga_partidas (
  id uuid primary key default gen_random_uuid(),
  jugador uuid not null references public.liga_jugadores (id) on delete cascade,
  juego text not null,
  dia date not null,                              -- día de Madrid en que se empezó
  intento smallint not null check (intento between 1 and 3),
  semilla bigint not null check (semilla between 1 and 4294967295),
  version smallint not null,                      -- versión del motor con la que se juega
  empezada timestamptz not null default now(),
  terminada timestamptz,
  estado text not null default 'jugando' check (estado in ('jugando', 'valida', 'rechazada', 'abandonada')),
  puntos integer check (puntos is null or puntos >= 0),
  motivo text,                                    -- por qué se rechazó, en cristiano
  datos jsonb,                                    -- lo que hizo el jugador (tiros…): sirve para repetir la partida
  unique (jugador, juego, dia, intento)
);

create index if not exists liga_partidas_dia on public.liga_partidas (dia, juego) where estado = 'valida';
create index if not exists liga_partidas_jugador on public.liga_partidas (jugador, dia);

-- Las tablas no se tocan desde fuera: sin políticas, con RLS, nadie con la clave pública ve nada.
alter table public.liga_jugadores enable row level security;
alter table public.liga_partidas enable row level security;
revoke all on public.liga_jugadores, public.liga_partidas from anon, authenticated;

-- ── Empezar un intento ──
-- Devuelve el intento creado o, si no quedan, una fila con error. El bloqueo evita que dos pestañas a la vez
-- saquen un 4.º intento. Un intento que estaba a medias se da por abandonado (cuenta como gastado).
create or replace function public.liga_empezar(p_jugador uuid, p_juego text, p_dia date, p_semilla bigint, p_version smallint)
returns table (partida uuid, intento smallint, quedan smallint, error text)
language plpgsql security definer set search_path = public as $$
declare
  v_usados smallint;
  v_bloqueado boolean;
begin
  select j.bloqueado into v_bloqueado from liga_jugadores j where j.id = p_jugador;
  if not found then return query select null::uuid, null::smallint, null::smallint, 'sin_perfil'::text; return; end if;
  if v_bloqueado then return query select null::uuid, null::smallint, null::smallint, 'bloqueado'::text; return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_jugador::text || '|' || p_juego || '|' || p_dia::text, 0));

  update liga_partidas p set estado = 'abandonada', terminada = now(), motivo = 'se empezó otro intento'
    where p.jugador = p_jugador and p.juego = p_juego and p.dia = p_dia and p.estado = 'jugando';

  select count(*) into v_usados from liga_partidas p where p.jugador = p_jugador and p.juego = p_juego and p.dia = p_dia;
  if v_usados >= 3 then return query select null::uuid, null::smallint, 0::smallint, 'sin_intentos'::text; return; end if;

  return query
    insert into liga_partidas as p (jugador, juego, dia, intento, semilla, version)
    values (p_jugador, p_juego, p_dia, v_usados + 1, p_semilla, p_version)
    returning p.id, p.intento, (2 - v_usados)::smallint, null::text;
end $$;

-- ── Leer una partida en juego (para repetirla en el servidor) ──
create or replace function public.liga_partida(p_partida uuid, p_jugador uuid)
returns table (juego text, dia date, semilla bigint, version smallint, empezada timestamptz, estado text, ahora timestamptz)
language sql stable security definer set search_path = public as $$
  select p.juego, p.dia, p.semilla, p.version, p.empezada, p.estado, now() from liga_partidas p
  where p.id = p_partida and p.jugador = p_jugador;
$$;

-- ── Cerrar un intento con los puntos que ha calculado el servidor ──
-- Solo cierra si seguía «jugando»: mandar dos veces el final no suma dos veces.
create or replace function public.liga_terminar(p_partida uuid, p_jugador uuid, p_estado text, p_puntos integer, p_motivo text, p_datos jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_estado not in ('valida', 'rechazada') then raise exception 'estado no permitido: %', p_estado; end if;
  update liga_partidas p set estado = p_estado, puntos = case when p_estado = 'valida' then p_puntos else null end,
    motivo = p_motivo, datos = p_datos, terminada = now()
    where p.id = p_partida and p.jugador = p_jugador and p.estado = 'jugando';
  return found;
end $$;

-- ── Ranking entre dos días (los dos incluidos) ──
-- Cada jugador suma su mejor marca de cada juego de cada día. A igualdad de puntos, va delante
-- quien la consiguió antes. Devuelve los «p_limite» primeros y, si no está entre ellos, también al jugador que pregunta.
create or replace function public.liga_ranking(p_desde date, p_hasta date, p_limite integer, p_jugador uuid default null)
returns table (posicion bigint, jugador uuid, apodo text, pueblo text, puntos bigint, yo boolean)
language sql stable security definer set search_path = public as $$
  with mejores as (
    select p.jugador, p.juego, p.dia, max(p.puntos) as puntos
    from liga_partidas p
    where p.estado = 'valida' and p.dia between p_desde and p_hasta
    group by p.jugador, p.juego, p.dia
  ),
  cuando as ( -- cuándo consiguió cada mejor marca (para desempatar)
    select m.jugador, max(t.terminada) as hecho
    from mejores m
    join lateral (
      select min(p.terminada) as terminada from liga_partidas p
      where p.jugador = m.jugador and p.juego = m.juego and p.dia = m.dia and p.estado = 'valida' and p.puntos = m.puntos
    ) t on true
    group by m.jugador
  ),
  total as (
    select m.jugador, sum(m.puntos) as puntos from mejores m group by m.jugador
  ),
  orden as (
    select row_number() over (order by t.puntos desc, c.hecho asc, t.jugador) as posicion, t.jugador, j.apodo, j.pueblo, t.puntos
    from total t join cuando c using (jugador) join liga_jugadores j on j.id = t.jugador
    where not j.bloqueado
  )
  select o.posicion, o.jugador, o.apodo, o.pueblo, o.puntos, (o.jugador = p_jugador) as yo
  from orden o
  where o.posicion <= p_limite or o.jugador = p_jugador
  order by o.posicion;
$$;

-- ── Lo de hoy de un jugador: intentos gastados y mejor marca de cada juego ──
create or replace function public.liga_hoy(p_jugador uuid, p_dia date)
returns table (juego text, usados bigint, mejor integer, jugando uuid)
language sql stable security definer set search_path = public as $$
  select p.juego, count(*) as usados, max(p.puntos) filter (where p.estado = 'valida') as mejor,
         (array_agg(p.id) filter (where p.estado = 'jugando'))[1] as jugando
  from liga_partidas p where p.jugador = p_jugador and p.dia = p_dia
  group by p.juego;
$$;

-- Solo la web (clave secreta) puede llamar a estas funciones.
revoke all on function public.liga_empezar(uuid, text, date, bigint, smallint) from public, anon, authenticated;
revoke all on function public.liga_partida(uuid, uuid) from public, anon, authenticated;
revoke all on function public.liga_terminar(uuid, uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.liga_ranking(date, date, integer, uuid) from public, anon, authenticated;
revoke all on function public.liga_hoy(uuid, date) from public, anon, authenticated;
grant execute on function public.liga_empezar(uuid, text, date, bigint, smallint) to service_role;
grant execute on function public.liga_partida(uuid, uuid) to service_role;
grant execute on function public.liga_terminar(uuid, uuid, text, integer, text, jsonb) to service_role;
grant execute on function public.liga_ranking(date, date, integer, uuid) to service_role;
grant execute on function public.liga_hoy(uuid, date) to service_role;
grant select, insert, update, delete on public.liga_jugadores, public.liga_partidas to service_role;
