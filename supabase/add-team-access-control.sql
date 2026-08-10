-- Per-team access control: each account only sees the teams it's linked to
-- via team_users, instead of every authenticated account seeing every team.

create table if not exists team_users (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (team_id, user_id)
);
create index if not exists idx_team_users_user on team_users(user_id);
create index if not exists idx_team_users_team on team_users(team_id);

alter table team_users enable row level security;
drop policy if exists "select_own_memberships" on team_users;
create policy "select_own_memberships" on team_users
  for select using (user_id = auth.uid());
-- No insert/update/delete policy for authenticated/anon on purpose — only
-- service_role (admin scripts) or the creator-access trigger below can write
-- to this table. Regular users can never grant themselves access.

-- Helper functions used by every team-scoped table's RLS policy below.
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
-- invisible until an admin links the account via team_users.
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

-- ── Replace the old "any authenticated user, any team" policies ──────────

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
