-- Confirmed mapping for existing accounts (2026-08-10):
--   torrenuevafutsal -> Torrenueva Futsal 25/26 + Torrenueva Futsal
--   davidmanzanares  -> MFS JUVENIL DH
--   rodrijimbee      -> (none yet)
-- CADETES and JPI stay unassigned until an account is linked to them.
insert into team_users (team_id, user_id) values
  ('59347b48-e16e-4f96-9201-399dbaffc2d9', 'f638e104-c224-4680-a079-16ae67ce5929'), -- Torrenueva Futsal 25/26 -> torrenuevafutsal
  ('1c897e38-b375-4eb0-84e7-364ea301c28c', 'f638e104-c224-4680-a079-16ae67ce5929'), -- Torrenueva Futsal       -> torrenuevafutsal
  ('50552d18-9bac-4bf3-8a4b-43c5e4d268a7', 'e0cbae66-a9ec-49ed-9c19-2520bdd2c892')  -- MFS JUVENIL DH          -> davidmanzanares
on conflict do nothing;
