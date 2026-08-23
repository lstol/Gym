-- A program is a training block. Session templates and their items belong to it.
-- Never a "current plan" as a global setting — everything hangs off a block so
-- block N can be compared to block 1 without overwriting history. See CLAUDE.md §4.9.

create table program (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

create table session_template (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references program(id) on delete cascade,
  code text not null,
  name_nb text not null,
  weekday smallint not null check (weekday between 1 and 7),
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table session_template_item (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references session_template(id) on delete cascade,
  exercise_id uuid not null references exercise(id) on delete restrict,
  "order" integer not null,
  target_sets integer not null,
  rep_min integer not null,
  rep_max integer not null check (rep_max >= rep_min),
  rest_sec integer not null,
  rir_min smallint not null,
  rir_max smallint not null check (rir_max >= rir_min),
  is_optional boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (template_id, "order")
);

alter table program enable row level security;
alter table session_template enable row level security;
alter table session_template_item enable row level security;

create policy "own programs" on program
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own session templates" on session_template
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own session template items" on session_template_item
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
