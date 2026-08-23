-- Progression rules v2 — see docs/PROGRESSION_V2.md.

-- §3a. An AMRAP is a measuring instrument, not a working set. It has no reps in
-- reserve by definition, so the RIR is forced to 0 and the control is hidden.
alter table set_entry add column is_amrap boolean not null default false;
alter table set_entry add constraint amrap_implies_rir_zero
  check (not is_amrap or rir = 0);

-- Not every exercise may be taken to failure: shoulder/chest press (injury
-- history), split squat (balance, and leg fatigue costs the running), hip hinge
-- (spinal loading at failure with a novice pattern). Those calibrate from RIR.
alter table exercise add column amrap_allowed boolean not null default true;
update exercise set amrap_allowed = false
where slug in ('skulderpress', 'brystpress', 'bulgarsk-splittkneboy', 'hoftehengsel-rdl');

-- §4a. Each observed pin change yields one estimate of the exercise's Epley k.
create table rep_cost_observation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercise(id) on delete cascade,
  session_template_id uuid not null references session_template(id) on delete cascade,
  observed_at date not null,
  from_kg numeric(7,3) not null,
  to_kg numeric(7,3) not null,
  from_reps integer not null,
  to_reps integer not null,
  epley_k numeric(7,3) not null,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, session_template_id, observed_at)
);

alter table rep_cost_observation enable row level security;

create policy "own rep cost observations" on rep_cost_observation
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- §6 asks for suggestion_feedback.reason; the column already exists from the
-- phase-1 schema, so nothing to add here. It now carries the rule code.

-- §5. Rep ranges are a function of the station's step size and joint tolerance.
-- rep_min/rep_max are identical wherever an exercise appears; only RIR differs
-- by session, and session C is the light one (rir_min = 3).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('brystpress',            10, 15, 2, 2),
      ('skulderpress',          10, 15, 2, 2),
      ('nedtrekk',               8, 13, 1, 2),
      ('sittende-roing',         8, 12, 1, 2),
      ('hoftehengsel-rdl',       8, 12, 2, 3),
      ('bulgarsk-splittkneboy',  8, 12, 2, 3),
      ('tahev',                 12, 20, 1, 2),
      ('bicepscurl',            10, 16, 1, 2),
      ('triceps-pushdown',      10, 20, 1, 2),
      ('kabelcrunch',           10, 20, 1, 2),
      ('pallof-press',          10, 12, 2, 3)
    ) as t(slug, rep_min, rep_max, rir_min, rir_max)
  loop
    -- Sessions A and B: the working ranges above.
    update session_template_item i
    set rep_min = r.rep_min, rep_max = r.rep_max, rir_min = r.rir_min, rir_max = r.rir_max
    from exercise e, session_template st
    where e.id = i.exercise_id and st.id = i.template_id
      and e.slug = r.slug and st.code in ('A', 'B');

    -- Session C: same rep structure, higher RIR so the loads stay light.
    update session_template_item i
    set rep_min = r.rep_min, rep_max = r.rep_max, rir_min = 3, rir_max = 4
    from exercise e, session_template st
    where e.id = i.exercise_id and st.id = i.template_id
      and e.slug = r.slug and st.code = 'C';
  end loop;
end $$;
