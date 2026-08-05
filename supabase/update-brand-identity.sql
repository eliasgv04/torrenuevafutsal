-- Torrenueva Futsal / TFG: rebrand the app's default identity from
-- yellow/green (#ffd400 / #1f6f23) to navy/electric blue (#1E3A8A / #2563EB).
-- Only touches teams still sitting on the untouched original default —
-- teams that already customized their own colors are left alone.
-- Run this in the Supabase SQL editor if you're not applying it via the CLI.

alter table if exists teams
  alter column gradient_start set default '#1E3A8A';

alter table if exists teams
  alter column gradient_end set default '#2563EB';

update teams
set gradient_start = '#1E3A8A',
    gradient_end = '#2563EB'
where gradient_start = '#ffd400'
  and gradient_end = '#1f6f23';
