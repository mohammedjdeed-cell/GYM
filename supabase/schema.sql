-- Gym tracker schema. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
--
-- Security model: there are no user accounts. Row Level Security is ON with NO policies, so the
-- public (anon) key cannot read or write the tables directly. The app talks only to the two
-- functions below, and both require the shared household code. Treat that code like a password.

create table if not exists public.profiles (
  id text primary key,                      -- '<household>:<key>'
  household text not null,
  key text not null,                        -- 'mohammed' | 'mai'
  name text not null,
  weight_logging boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  household text not null,
  profile_id text not null references public.profiles (id) on delete cascade,
  day_id text not null,                     -- 'd1' | 'd2' | 'd3'
  date date not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  sets_done int not null,
  sets_total int not null,
  deleted boolean not null default false,
  updated_at timestamptz not null
);
create index if not exists sessions_household_idx on public.sessions (household);

create table if not exists public.set_logs (
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id text not null,
  set_no int not null,
  done boolean not null,
  weight_kg numeric,
  primary key (session_id, exercise_id, set_no)
);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.set_logs enable row level security;

create or replace function public.gym_push(
  p_household text,
  p_profiles jsonb,
  p_sessions jsonb,
  p_set_logs jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_household, '')) < 6 then
    raise exception 'household code must be at least 6 characters';
  end if;

  insert into profiles (id, household, key, name, weight_logging, updated_at)
  select p_household || ':' || x.key, p_household, x.key, x.name, x.weight_logging, x.updated_at
  from jsonb_to_recordset(coalesce(p_profiles, '[]'::jsonb))
    as x(key text, name text, weight_logging boolean, updated_at timestamptz)
  on conflict (id) do update
    set name = excluded.name,
        weight_logging = excluded.weight_logging,
        updated_at = excluded.updated_at
    where profiles.updated_at < excluded.updated_at;

  insert into sessions (id, household, profile_id, day_id, date, started_at, finished_at,
                        sets_done, sets_total, deleted, updated_at)
  select x.id, p_household, p_household || ':' || x.profile, x.day_id, x.date, x.started_at,
         x.finished_at, x.sets_done, x.sets_total, x.deleted, x.updated_at
  from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb))
    as x(id uuid, profile text, day_id text, date date, started_at timestamptz,
         finished_at timestamptz, sets_done int, sets_total int, deleted boolean,
         updated_at timestamptz)
  on conflict (id) do update
    set deleted = excluded.deleted,
        sets_done = excluded.sets_done,
        sets_total = excluded.sets_total,
        updated_at = excluded.updated_at
    where sessions.household = p_household
      and sessions.updated_at < excluded.updated_at;

  insert into set_logs (session_id, exercise_id, set_no, done, weight_kg)
  select x.session_id, x.exercise_id, x.set_no, x.done, x.weight_kg
  from jsonb_to_recordset(coalesce(p_set_logs, '[]'::jsonb))
    as x(session_id uuid, exercise_id text, set_no int, done boolean, weight_kg numeric)
  join sessions s on s.id = x.session_id and s.household = p_household
  on conflict (session_id, exercise_id, set_no) do update
    set done = excluded.done,
        weight_kg = excluded.weight_kg;
end;
$$;

create or replace function public.gym_pull(p_household text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(p)) from profiles p where p.household = p_household
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(
        to_jsonb(s) || jsonb_build_object('set_logs', coalesce((
          select jsonb_agg(to_jsonb(l)) from set_logs l where l.session_id = s.id
        ), '[]'::jsonb))
      )
      from sessions s where s.household = p_household
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.gym_push(text, jsonb, jsonb, jsonb) from public;
revoke all on function public.gym_pull(text) from public;
grant execute on function public.gym_push(text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.gym_pull(text) to anon, authenticated;
