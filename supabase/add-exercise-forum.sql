-- Exercise forum: an exercise is private by default (same team-scoped RLS
-- as always). A coach can flag one as public, and it becomes read-only
-- visible to every other logged-in coach in a shared "Foro" gallery —
-- browsing only, no editing/importing.
alter table exercises add column if not exists is_public boolean not null default false;

-- Bypasses the normal team_access RLS on purpose, but only returns the
-- narrow set of fields the forum actually shows, and only for rows already
-- explicitly marked public by their own team. Regular per-team RLS on
-- exercises/teams is untouched — this doesn't grant broader access to
-- either table, just this one read-only view.
create or replace function public.get_public_exercises()
returns table (
  id uuid,
  name text,
  objective text,
  photo_url text,
  category text,
  dimensions text,
  created_at timestamp with time zone,
  team_id uuid,
  team_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.name, e.objective, e.photo_url, e.category, e.dimensions, e.created_at, e.team_id, t.name as team_name
  from exercises e
  join teams t on t.id = e.team_id
  where e.is_public = true
  order by e.created_at desc;
$$;

grant execute on function public.get_public_exercises() to authenticated;
