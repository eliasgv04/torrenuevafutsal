-- Technical error log: every time a Supabase call fails in the app (or an
-- uncaught JS error happens), a row lands here — visible to the admin from
-- AdminPanel instead of relying on a user reporting the error by hand.
create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc', now()),
  message text not null,
  code text,
  details text,
  user_email text
);

alter table app_logs enable row level security;

-- Errors can happen before anyone is logged in (landing page, login form,
-- solicitar acceso), so anyone can write a log row — but only the admin can
-- read or clear them.
drop policy if exists "anyone_can_insert_logs" on app_logs;
create policy "anyone_can_insert_logs" on app_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "admin_select_logs" on app_logs;
create policy "admin_select_logs" on app_logs
  for select using (public.is_admin());

drop policy if exists "admin_delete_logs" on app_logs;
create policy "admin_delete_logs" on app_logs
  for delete using (public.is_admin());
