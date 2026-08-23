-- Exercise catalog. Public reference data, same as machine/station.
create table exercise (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_nb text not null,
  muscle_group text not null,
  is_unilateral boolean not null default false,
  default_station_id uuid references station(id) on delete set null,
  load_source text not null check (load_source in ('stack', 'bodyweight', 'external')),
  created_at timestamptz not null default now()
);

alter table exercise enable row level security;

create policy "exercise is publicly readable" on exercise
  for select using (true);
