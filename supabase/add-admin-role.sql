-- Admin role: a small set of accounts (currently just one dedicated login)
-- that can see every team and manage access requests, on top of the normal
-- per-team restriction everyone else has.

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

-- Admins can read and resolve access requests (nobody else can, per
-- add-access-requests.sql — a pending row otherwise grants no visibility).
drop policy if exists "admin_select_access_requests" on access_requests;
create policy "admin_select_access_requests" on access_requests
  for select using (public.is_admin());
drop policy if exists "admin_update_access_requests" on access_requests;
create policy "admin_update_access_requests" on access_requests
  for update using (public.is_admin());
