-- Machine and station: the load model. See CLAUDE.md §4.1.
-- stackKg(pin) = top_plate_kg + plate_kg * pin. Effective kg is never stored —
-- it is computed in v_working_set (see the views migration) from pin/station.

create table machine (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate_kg numeric(6,3) not null,
  top_plate_kg numeric(6,3) not null,
  plate_count integer not null,
  created_at timestamptz not null default now()
);

create table station (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machine(id) on delete restrict,
  code text not null,
  factor numeric(4,3) not null,
  max_effective_kg numeric(6,2) not null,
  calibration_status text not null default 'spec' check (calibration_status in ('spec', 'measured')),
  note text,
  created_at timestamptz not null default now(),
  unique (machine_id, code)
);

-- Public reference data: readable by anyone, writable only via migrations/service role.
alter table machine enable row level security;
alter table station enable row level security;

create policy "machine is publicly readable" on machine
  for select using (true);

create policy "station is publicly readable" on station
  for select using (true);
