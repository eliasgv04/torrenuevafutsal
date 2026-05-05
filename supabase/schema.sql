-- Supabase schema for Torrenueva Futsal

-- Teams table
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Exercises table
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  objective text,
  photo_url text,
    category text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Exercise records (registrations)
create table if not exists exercise_records (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references exercises(id) on delete cascade,
  occurred_at date not null,
  count integer default 1,
  effectiveness integer,
  dimensions text,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Trainings table
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  training_date date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Exercises planned for each training (stores snapshots of exercise data)
create table if not exists training_exercises (
  id uuid primary key default gen_random_uuid(),
  training_id uuid references trainings(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name text not null,
  objective text,
  category text,
  planned_count integer default 1,
  dimensions text,
  notes text,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Indexes for faster lookups
create index if not exists idx_exercises_team on exercises(team_id);
create index if not exists idx_records_exercise on exercise_records(exercise_id);
create index if not exists idx_trainings_team on trainings(team_id);
create index if not exists idx_training_exercises_training on training_exercises(training_id);

-- ========== NEW: FUTSAL MATCH MANAGEMENT ==========

-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  surname text not null,
  dorsal integer not null,
  position text not null check (position in ('Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot')),
  created_at timestamp with time zone default timezone('utc', now())
);

-- Historical player career stats (manual club totals)
create table if not exists player_career_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade unique,
  matches_played integer default 0,
  goals integer default 0,
  shots_on_goal integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  saves integer default 0,
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Matches table
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

-- Match player statistics (individual stats per player per match)
create table if not exists match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  goals integer default 0,
  shots_on_goal integer default 0,
  fouls integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  saves integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Rival team statistics
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

-- On-field players tracking (who is on the court at each moment)
create table if not exists on_field_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  entry_minute integer not null,
  exit_minute integer,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Indexes for new tables
create index if not exists idx_players_team on players(team_id);
create index if not exists idx_player_career_team on player_career_stats(team_id);
create index if not exists idx_matches_team on matches(team_id);
create index if not exists idx_match_player_stats_match on match_player_stats(match_id);
create index if not exists idx_match_player_stats_player on match_player_stats(player_id);
create index if not exists idx_rival_stats_match on rival_team_stats(match_id);
create index if not exists idx_on_field_match on on_field_players(match_id);
create index if not exists idx_on_field_player on on_field_players(player_id);
