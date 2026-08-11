-- Lets an admin revoke a team link directly from the client (adding one
-- already worked via admin_insert_team_users from add-admin-role.sql).
drop policy if exists "admin_delete_team_users" on team_users;
create policy "admin_delete_team_users" on team_users
  for delete using (public.is_admin());
