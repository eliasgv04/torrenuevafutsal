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
