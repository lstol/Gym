create table bodyweight_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- The client never writes run rows — they arrive only via strava-sync (phase 4).
-- perceived_effort and heavy_legs are the user's own columns and must survive a
-- re-sync: the sync upsert only ever touches Strava-owned columns. See CLAUDE.md §4.8.
create table run_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strava_activity_id bigint not null unique,
  start_date timestamptz not null,
  distance_m numeric(10,2) not null,
  moving_time_s integer not null,
  elevation_gain_m numeric(8,2),
  avg_hr numeric(5,1),
  perceived_effort smallint check (perceived_effort between 1 and 10),
  heavy_legs boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table bodyweight_entry enable row level security;
alter table run_activity enable row level security;

create policy "own bodyweight entries" on bodyweight_entry
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own run activity" on run_activity
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
