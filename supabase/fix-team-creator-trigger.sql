-- Second fix. The BEFORE INSERT trigger from the first attempt fails with a
-- foreign key violation: at BEFORE INSERT time the teams row doesn't exist
-- yet, so team_users.team_id (which references teams.id) can't point to it.
--
-- Real fix: keep the trigger AFTER INSERT (the team row exists, so the FK is
-- satisfiable), and stop relying on INSERT ... RETURNING for team creation
-- altogether. The app now generates the team's id client-side and inserts
-- without requesting the row back, so Postgres never needs to run the
-- RETURNING-implies-SELECT-policy check that caused the original failure.
drop trigger if exists trg_grant_team_creator_access on teams;

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

create trigger trg_grant_team_creator_access
  after insert on teams
  for each row execute function public.grant_team_creator_access();
