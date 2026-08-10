-- Public "solicitar acceso" form writes here. Anyone can INSERT (that's the
-- point — it's the public entry point), but nobody except an admin working
-- from the Supabase dashboard (which bypasses RLS) can read, approve or
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
