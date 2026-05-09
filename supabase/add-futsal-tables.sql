-- Torrenueva Futsal: missing tables for players and matches
-- Run this in the Supabase SQL editor if your database only has teams/exercises/exercise_records.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  surname text not null,
  dorsal integer not null,
  position text not null check (position in ('Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot')),
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists player_career_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade unique,
  matches_played integer default 0,
  goals integer default 0,
  shots_on_goal integer default 0,
  assists integer default 0,
  shots_out integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  saves integer default 0,
  updated_at timestamp with time zone default timezone('utc', now())
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  rival_team_name text not null,
  match_date timestamp with time zone not null,
  place text not null,
  jornada integer,
  notes text,
  is_home boolean default true,
  status text default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_goals integer,
  away_goals integer,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  goals integer default 0,
  assists integer default 0,
  shots_on_goal integer default 0,
  shots_out integer default 0,
  fouls integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  saves integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists rival_team_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  goals integer default 0,
  shots_on_goal integer default 0,
  fouls integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists on_field_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  entry_minute integer not null,
  exit_minute integer,
  created_at timestamp with time zone default timezone('utc', now())
);

create index if not exists idx_players_team on players(team_id);
create index if not exists idx_player_career_team on player_career_stats(team_id);
create index if not exists idx_matches_team on matches(team_id);
create index if not exists idx_match_player_stats_match on match_player_stats(match_id);
create index if not exists idx_match_player_stats_player on match_player_stats(player_id);
create index if not exists idx_rival_stats_match on rival_team_stats(match_id);
create index if not exists idx_on_field_match on on_field_players(match_id);
create index if not exists idx_on_field_player on on_field_players(player_id);

-- Exercise schema upgrades
alter table if exists exercises
  add column if not exists category text;

create unique index if not exists idx_exercises_team_name_unique
  on exercises (team_id, lower(trim(name)));

alter table if exists player_career_stats
  add column if not exists assists integer default 0;

alter table if exists player_career_stats
  add column if not exists shots_out integer default 0;

alter table if exists match_player_stats
  add column if not exists assists integer default 0;

alter table if exists match_player_stats
  add column if not exists shots_out integer default 0;

-- If your exercises table already existed, this keeps names unique per team going forward.
-- If duplicate rows already exist, clean them manually before creating the index.

-- Seed players for Torrenueva Futsal
insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Jose Antonio', 'Tamayo', 1, 'Portero'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 1
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Ruben', 'Carrasco', 13, 'Portero'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 13
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Hector', 'Castro', 12, 'Portero'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 12
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Alvaro', 'Leon', 8, 'Ala Zurdo'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 8
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Carlos Jesus', 'Ortiz', 14, 'Cierre'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 14
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Angel', 'Martinez', 10, 'Ala Zurdo'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 10
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Josevi', 'Tercero', 3, 'Cierre'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 3
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Salva', 'Vivar', 4, 'Cierre'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 4
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Alberto', 'Rubio', 23, 'Ala Zurdo'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 23
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Marc', 'Ros', 18, 'Ala Diestro'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 18
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Ruben', 'Arce', 6, 'Ala Diestro'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 6
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Jesus', 'Garcia', 77, 'Ala Diestro'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 77
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Antonio', 'Gonzalez', 9, 'Pivot'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 9
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Alberto', 'Velasco', 17, 'Pivot'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 17
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Victor Manuel', 'Simon', 7, 'Pivot'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 7
  );

insert into players (team_id, name, surname, dorsal, position)
select t.id, 'Ruben', 'Gallego', 2, 'Ala Diestro'
from teams t
where t.name = 'Torrenueva Futsal'
  and not exists (
    select 1 from players p
    where p.team_id = t.id and p.dorsal = 2
  );
