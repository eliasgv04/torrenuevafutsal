-- Supabase schema for Torrenueva Futsal

-- Teams table
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gradient_start text default '#1E3A8A',
  gradient_end text default '#2563EB',
  crest_url text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Exercises table
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  objective text,
  photo_url text,
  category text,
  created_at timestamp with time zone default timezone('utc', now())
);

create unique index if not exists idx_exercises_team_name_unique
  on exercises (team_id, lower(trim(name)));

-- Trainings table
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  training_date date not null,
  notes text,
  attending_players jsonb,
  objectives jsonb,
  warmup text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Exercises planned for each training (stores snapshots of exercise data)
create table if not exists training_exercises (
  id uuid primary key default gen_random_uuid(),
  training_id uuid references trainings(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name text not null,
  objective text,
  category text,
  planned_count integer default 1,
  dimensions text,
  notes text,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Indexes for faster lookups
create index if not exists idx_exercises_team on exercises(team_id);
create index if not exists idx_trainings_team on trainings(team_id);
create index if not exists idx_training_exercises_training on training_exercises(training_id);

-- ========== NEW: FUTSAL MATCH MANAGEMENT ==========

-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  surname text not null,
  dorsal integer not null,
  position text not null check (position in ('Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot')),
  created_at timestamp with time zone default timezone('utc', now())
);

-- Matches table
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  rival_team_name text not null,
  match_date timestamp with time zone not null,
  place text not null,
  jornada integer,
  notes text,
  is_home boolean default true,
  status text default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_goals integer,
  away_goals integer,
  ended_at timestamp with time zone,
  called_up_players jsonb,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Match player statistics (individual stats per player per match)
create table if not exists match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  goals integer default 0,
  assists integer default 0,
  shots_on_goal integer default 0,
  shots_out integer default 0,
  fouls integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  saves integer default 0,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (match_id, player_id)
);

-- Rival team statistics
create table if not exists rival_team_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  goals integer default 0,
  shots_on_goal integer default 0,
  fouls integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (match_id)
);

-- On-field players tracking (who is on the court at each moment)
create table if not exists on_field_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  entry_minute integer not null,
  exit_minute integer,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Indexes for new tables
create index if not exists idx_players_team on players(team_id);
create index if not exists idx_matches_team on matches(team_id);
create index if not exists idx_match_player_stats_match on match_player_stats(match_id);
create index if not exists idx_match_player_stats_player on match_player_stats(player_id);
create index if not exists idx_rival_stats_match on rival_team_stats(match_id);
create index if not exists idx_on_field_match on on_field_players(match_id);
create index if not exists idx_on_field_player on on_field_players(player_id);

-- ========== NEW: ACCESS CONTROL ==========
-- Per-team access control: each account only sees the teams it's linked to
-- via team_users, instead of every authenticated account seeing every team.
-- See supabase/add-team-access-control.sql for the migration that introduced
-- this (including the RLS policy changes on every table above).

create table if not exists team_users (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (team_id, user_id)
);
create index if not exists idx_team_users_user on team_users(user_id);
create index if not exists idx_team_users_team on team_users(team_id);

-- Helper functions used by every team-scoped table's RLS policy.
create or replace function public.user_has_team_access(check_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from team_users
    where team_id = check_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.user_has_training_access(check_training_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from trainings
    where id = check_training_id and public.user_has_team_access(team_id)
  );
$$;

create or replace function public.user_has_match_access(check_match_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from matches
    where id = check_match_id and public.user_has_team_access(team_id)
  );
$$;

grant execute on function public.user_has_team_access(uuid) to authenticated, anon;
grant execute on function public.user_has_training_access(uuid) to authenticated, anon;
grant execute on function public.user_has_match_access(uuid) to authenticated, anon;

-- Whoever creates a team automatically gets access to it (so the existing
-- "+ Nuevo equipo" self-service flow keeps working); every other team stays
-- invisible until an admin links the account via team_users. Must run AFTER
-- INSERT: a BEFORE trigger would try to reference teams.id before the row
-- exists, violating team_users_team_id_fkey. The app's createTeam() inserts
-- without requesting the row back via RETURNING, so it never needs to wait
-- on this trigger's effect being visible within the same statement.
create or replace function public.grant_team_creator_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into team_users (team_id, user_id) values (new.id, auth.uid())
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_grant_team_creator_access on teams;
create trigger trg_grant_team_creator_access
  after insert on teams
  for each row execute function public.grant_team_creator_access();

alter table team_users enable row level security;
drop policy if exists "select_own_memberships" on team_users;
create policy "select_own_memberships" on team_users
  for select using (user_id = auth.uid());
-- No insert/update/delete policy for authenticated/anon on purpose — only
-- service_role (admin scripts) or the creator-access trigger above can write
-- to this table. Regular users can never grant themselves access.

drop policy if exists "solo_autenticados" on teams;
create policy "select_own_teams" on teams for select using (public.user_has_team_access(id));
create policy "insert_teams" on teams for insert with check (auth.uid() is not null);
create policy "update_own_teams" on teams for update using (public.user_has_team_access(id));
create policy "delete_own_teams" on teams for delete using (public.user_has_team_access(id));

drop policy if exists "solo_autenticados" on exercises;
create policy "team_access" on exercises for all
  using (public.user_has_team_access(team_id))
  with check (public.user_has_team_access(team_id));

drop policy if exists "solo_autenticados" on trainings;
create policy "team_access" on trainings for all
  using (public.user_has_team_access(team_id))
  with check (public.user_has_team_access(team_id));

drop policy if exists "solo_autenticados" on players;
create policy "team_access" on players for all
  using (public.user_has_team_access(team_id))
  with check (public.user_has_team_access(team_id));

drop policy if exists "solo_autenticados" on matches;
create policy "team_access" on matches for all
  using (public.user_has_team_access(team_id))
  with check (public.user_has_team_access(team_id));

drop policy if exists "solo_autenticados" on training_exercises;
create policy "team_access" on training_exercises for all
  using (public.user_has_training_access(training_id))
  with check (public.user_has_training_access(training_id));

drop policy if exists "solo_autenticados" on match_player_stats;
create policy "team_access" on match_player_stats for all
  using (public.user_has_match_access(match_id))
  with check (public.user_has_match_access(match_id));

drop policy if exists "solo_autenticados" on on_field_players;
create policy "team_access" on on_field_players for all
  using (public.user_has_match_access(match_id))
  with check (public.user_has_match_access(match_id));

drop policy if exists "solo_autenticados" on rival_team_stats;
create policy "team_access" on rival_team_stats for all
  using (public.user_has_match_access(match_id))
  with check (public.user_has_match_access(match_id));

-- Public "solicitar acceso" form writes here. Anyone can INSERT (that's the
-- point — it's the public entry point), but nobody except an admin account
-- (see admin_users below, reviewed from AdminPanel.jsx) can read, approve or
-- reject a request. A pending row grants no access to anything by itself.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  contact_name text not null,
  contact_email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc', now())
);

alter table access_requests enable row level security;
drop policy if exists "public_can_request_access" on access_requests;
create policy "public_can_request_access" on access_requests
  for insert to anon, authenticated with check (true);
-- No select/update/delete policy for anon/authenticated on purpose.

-- Emails the admin (via the notify-access-request Edge Function) every time
-- a new access request comes in. See supabase/add-access-request-notify.sql
-- and supabase/functions/notify-access-request/index.ts.
create extension if not exists pg_net;

create or replace function public.notify_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://wfkjqllicsmqsmthklhz.supabase.co/functions/v1/notify-access-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', 'WVGUHSo853xqttC9wnyLiWCvOWqTlDHqne3Rji1WT5s'
    ),
    body := jsonb_build_object(
      'team_name', new.team_name,
      'contact_name', new.contact_name,
      'contact_email', new.contact_email,
      'message', new.message
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_access_request on access_requests;
create trigger trg_notify_access_request
  after insert on access_requests
  for each row execute function public.notify_access_request();

-- ========== NEW: ADMIN ROLE ==========
-- A small set of accounts (currently one dedicated login) that can see every
-- team and manage access requests, on top of the normal per-team
-- restriction everyone else has. See supabase/add-admin-role.sql,
-- supabase/functions/admin-create-account/index.ts and AdminPanel.jsx.

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc', now())
);

alter table admin_users enable row level security;
drop policy if exists "select_own_admin_row" on admin_users;
create policy "select_own_admin_row" on admin_users
  for select using (user_id = auth.uid());
-- No insert/update/delete policy for authenticated/anon — admin status can
-- only be granted via service_role (an admin script), never by the app.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- Admins see every team, alongside (not replacing) the normal per-team policy.
drop policy if exists "admin_select_all_teams" on teams;
create policy "admin_select_all_teams" on teams
  for select using (public.is_admin());

-- Admins can link any account to any team (used when approving a request).
drop policy if exists "admin_select_all_team_users" on team_users;
create policy "admin_select_all_team_users" on team_users
  for select using (public.is_admin());
drop policy if exists "admin_insert_team_users" on team_users;
create policy "admin_insert_team_users" on team_users
  for insert with check (public.is_admin());

-- Admins can read and resolve access requests.
drop policy if exists "admin_select_access_requests" on access_requests;
create policy "admin_select_access_requests" on access_requests
  for select using (public.is_admin());
drop policy if exists "admin_update_access_requests" on access_requests;
create policy "admin_update_access_requests" on access_requests
  for update using (public.is_admin());
