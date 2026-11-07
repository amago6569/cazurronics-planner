-- Pruebas de supabase/liga.sql. Cada comprobación lanza un error si falla.
\set ON_ERROR_STOP on
begin;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@x.es'), ('00000000-0000-0000-0000-00000000000b', 'b@x.es'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.es');
insert into liga_jugadores (id, apodo, apodo_clave, pueblo, acepta_bases) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana', 'ana', 'León', now()),
  ('00000000-0000-0000-0000-00000000000b', 'Beto', 'beto', 'Boñar', now());

-- desde fuera no se ve nada
set local role anon;
do $$ begin
  begin perform * from liga_jugadores; raise exception 'anon no debería leer jugadores'; exception when insufficient_privilege then null; end;
  begin perform * from liga_ranking('2026-11-01', '2026-11-30', 10); raise exception 'anon no debería ver el ranking directo'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare r record; n int; a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  -- sin perfil
  select * into r from liga_empezar('00000000-0000-0000-0000-00000000000c', 'canasta', '2026-11-09', 5, 2::smallint);
  if r.error is distinct from 'sin_perfil' then raise exception 'esperaba sin_perfil, %', r.error; end if;

  -- tres intentos y ni uno más
  select * into r from liga_empezar(a, 'canasta', '2026-11-09', 11, 2::smallint);
  if r.intento <> 1 or r.quedan <> 2 or r.error is not null then raise exception 'intento 1 mal: %', r; end if;
  if not liga_terminar(r.partida, a, 'valida', 30, null, '{"tiros":[]}') then raise exception 'no cerró el 1'; end if;
  if liga_terminar(r.partida, a, 'valida', 99, null, null) then raise exception 'cerró dos veces el 1'; end if;
  if liga_terminar(r.partida, b, 'valida', 99, null, null) then raise exception 'otro jugador cerró mi partida'; end if;

  select * into r from liga_empezar(a, 'canasta', '2026-11-09', 12, 2::smallint);
  if r.intento <> 2 then raise exception 'intento 2 mal: %', r; end if;
  -- empezar otro sin acabar: el 2 queda abandonado y gastado
  select * into r from liga_empezar(a, 'canasta', '2026-11-09', 13, 2::smallint);
  if r.intento <> 3 or r.quedan <> 0 then raise exception 'intento 3 mal: %', r; end if;
  select count(*) into n from liga_partidas where jugador = a and estado = 'abandonada';
  if n <> 1 then raise exception 'esperaba 1 abandonada, %', n; end if;
  perform liga_terminar(r.partida, a, 'valida', 41, null, null);
  select * into r from liga_empezar(a, 'canasta', '2026-11-09', 14, 2::smallint);
  if r.error is distinct from 'sin_intentos' then raise exception 'dejó un 4.º intento: %', r; end if;
  -- otro juego y otro día tienen sus propios intentos
  select * into r from liga_empezar(a, 'tapas', '2026-11-09', 15, 1::smallint);
  if r.intento <> 1 then raise exception 'otro juego: %', r; end if;
  perform liga_terminar(r.partida, a, 'rechazada', 500, 'imposible', null);
  select * into r from liga_empezar(a, 'canasta', '2026-11-10', 16, 2::smallint);
  if r.intento <> 1 then raise exception 'otro día: %', r; end if;
  perform liga_terminar(r.partida, a, 'valida', 10, null, null);

  -- Beto: 41 el lunes (empata a Ana en el día pero lo hace después) y nada más
  select * into r from liga_empezar(b, 'canasta', '2026-11-09', 21, 2::smallint);
  perform pg_sleep(0.01);
  perform liga_terminar(r.partida, b, 'valida', 41, null, null);

  -- ranking del día: Ana 41 (mejor de 30 y 41; lo rechazado no cuenta), Beto 41 después
  select * into r from liga_ranking('2026-11-09', '2026-11-09', 10) where posicion = 1;
  if r.apodo <> 'Ana' or r.puntos <> 41 then raise exception 'ranking día: %', r; end if;
  select * into r from liga_ranking('2026-11-09', '2026-11-09', 10) where posicion = 2;
  if r.apodo <> 'Beto' or r.puntos <> 41 then raise exception 'ranking día 2.º: %', r; end if;
  -- semana: Ana 41 + 10 = 51
  select * into r from liga_ranking('2026-11-09', '2026-11-15', 10) where posicion = 1;
  if r.puntos <> 51 then raise exception 'ranking semana: %', r; end if;
  -- límite 1: sale el 1.º y también yo (Beto) aunque esté fuera
  select count(*) into n from liga_ranking('2026-11-09', '2026-11-15', 1, b);
  if n <> 2 then raise exception 'debería salir yo aunque no entre: %', n; end if;
  select count(*) into n from liga_ranking('2026-11-09', '2026-11-15', 1, b) where yo;
  if n <> 1 then raise exception 'falta la marca de yo'; end if;

  -- bloqueado: fuera del ranking y sin jugar
  update liga_jugadores set bloqueado = true where id = b;
  select count(*) into n from liga_ranking('2026-11-09', '2026-11-15', 10);
  if n <> 1 then raise exception 'el bloqueado sigue en el ranking'; end if;
  select * into r from liga_empezar(b, 'canasta', '2026-11-11', 22, 2::smallint);
  if r.error is distinct from 'bloqueado' then raise exception 'el bloqueado puede jugar'; end if;

  -- hoy
  select * into r from liga_hoy(a, '2026-11-09') where juego = 'canasta';
  if r.usados <> 3 or r.mejor <> 41 or r.jugando is not null then raise exception 'hoy: %', r; end if;

  -- apodos repetidos (sin mirar mayúsculas ni tildes, eso lo hace la web) chocan
  begin
    insert into liga_jugadores (id, apodo, apodo_clave, pueblo, acepta_bases) values ('00000000-0000-0000-0000-00000000000c', 'ANA', 'ana', 'León', now());
    raise exception 'dejó repetir apodo';
  exception when unique_violation then null; end;
  raise notice 'TODO BIEN';
end $$;
rollback;
