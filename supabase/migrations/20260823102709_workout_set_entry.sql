-- Workouts and the sets logged within them. `date` is a plain DATE decided in
-- local time, never derived from a UTC timestamp — a 21:30 session in Norway
-- must not land on tomorrow. See CLAUDE.md §9.

create table workout (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references program(id) on delete restrict,
  template_id uuid not null references session_template(id) on delete restrict,
  date date not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  duration_min integer,
  sleep_1_5 smallint check (sleep_1_5 between 1 and 5),
  energy_1_5 smallint check (energy_1_5 between 1 and 5),
  post_1_5 smallint check (post_1_5 between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- Store the pin, not the kilos. Effective kg is computed in v_working_set, never
-- stored — see CLAUDE.md §4.1, the single most important rule in that file.
create table set_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workout(id) on delete cascade,
  exercise_id uuid not null references exercise(id) on delete restrict,
  station_id uuid references station(id) on delete restrict,
  set_index integer not null,
  pin integer check (pin between 1 and 15),
  external_kg numeric(6,2),
  reps integer not null check (reps >= 0),
  rir smallint check (rir between 0 and 10),
  side text check (side in ('L', 'R')),
  is_warmup boolean not null default false,
  created_at timestamptz not null default now(),
  -- pin and external_kg are mutually exclusive; a bodyweight exercise has neither.
  constraint pin_xor_external_kg check (not (pin is not null and external_kg is not null))
);

create index set_entry_workout_id_idx on set_entry (workout_id);
create index workout_program_id_idx on workout (program_id);

alter table workout enable row level security;
alter table set_entry enable row level security;

create policy "own workouts" on workout
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own set entries" on set_entry
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
