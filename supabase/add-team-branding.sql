-- Torrenueva Futsal / TFG: per-team branding (custom gradient background + crest logo)
-- Run this in the Supabase SQL editor if you're not applying it via the CLI.

alter table if exists teams
  add column if not exists gradient_start text default '#ffd400';

alter table if exists teams
  add column if not exists gradient_end text default '#1f6f23';

alter table if exists teams
  add column if not exists crest_url text;
