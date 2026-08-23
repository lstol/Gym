-- Every progression suggestion the engine makes, and what the user actually did
-- with it. This is what lets PCT_PER_REP (CLAUDE.md §4.4) be recalibrated after
-- a block instead of staying a guess forever.
create table suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercise(id) on delete restrict,
  workout_id uuid references workout(id) on delete set null,
  suggested_pin integer,
  actual_pin integer,
  predicted_reps integer,
  actual_reps integer,
  accepted boolean,
  reason text,
  created_at timestamptz not null default now()
);

alter table suggestion_feedback enable row level security;

create policy "own suggestion feedback" on suggestion_feedback
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
