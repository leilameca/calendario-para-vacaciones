-- Esquema aplicado al proyecto Supabase ya-casi-calendario.
-- Solo el servidor con service_role tiene acceso; no hay acceso directo desde el navegador.
create table public.calendar_app (
  id integer primary key check(id=1),
  body text not null,
  revision bigint not null default 1 check(revision>0)
);
create table public.calendar_sessions (
  hash text primary key,
  generation integer not null,
  expires bigint not null
);
create index calendar_sessions_expires_idx on public.calendar_sessions(expires);
create table public.calendar_rate_limits (
  key text primary key,
  minute bigint not null,
  hits integer not null default 1
);
create index calendar_rate_limits_minute_idx on public.calendar_rate_limits(minute);
alter table public.calendar_app enable row level security;
alter table public.calendar_sessions enable row level security;
alter table public.calendar_rate_limits enable row level security;
revoke all on public.calendar_app,public.calendar_sessions,public.calendar_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.calendar_app,public.calendar_sessions,public.calendar_rate_limits to service_role;
create function public.calendar_rate_limit(p_key text,p_minute bigint)
returns integer language sql security invoker set search_path = '' as $$
  insert into public.calendar_rate_limits as limits(key,minute,hits)
  values(p_key,p_minute,1)
  on conflict(key) do update set hits=limits.hits+1 returning hits;
$$;
revoke all on function public.calendar_rate_limit(text,bigint) from public,anon,authenticated;
grant execute on function public.calendar_rate_limit(text,bigint) to service_role;
