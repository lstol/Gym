-- Exercises become part public catalog, part user-owned. A row with
-- user_id = null is the shared Inspire M2 catalog, readable by everyone; a row
-- with a user_id is that user's own "other" exercise and is private to them.
alter table exercise add column user_id uuid references auth.users(id) on delete cascade;

drop policy "exercise is publicly readable" on exercise;

create policy "read catalog and own exercises" on exercise
  for select using (user_id is null or user_id = auth.uid());

create policy "insert own exercises" on exercise
  for insert with check (user_id = auth.uid());

create policy "update own exercises" on exercise
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own exercises" on exercise
  for delete using (user_id = auth.uid());

-- Slugs are unique within the shared catalog, and per user for custom ones —
-- two people may both add "Sykkel" without colliding.
alter table exercise drop constraint exercise_slug_key;
create unique index exercise_slug_catalog_unique on exercise (slug) where user_id is null;
create unique index exercise_slug_user_unique on exercise (user_id, slug) where user_id is not null;

-- The rest of the Inspire M2 range, from the manufacturer's own exercise chart.
-- Station assignment follows that chart; every factor stays calibration_status
-- 'spec' (CLAUDE.md §4.1) — none of these are measured.
insert into exercise (slug, name_nb, muscle_group, is_unilateral, default_station_id, load_source)
select x.slug, x.name_nb, x.muscle_group, false, s.id, x.load_source
from (values
  -- Press arm
  ('innovervendt-brystpress', 'Innovervendt brystpress', 'press', 'press_arm', 'stack'),
  ('skra-brystpress',         'Skrå brystpress',         'press', 'press_arm', 'stack'),
  -- Upper pulley
  ('rett-arm-nedtrekk',       'Rett-arm nedtrekk',       'trekk', 'upper_pulley', 'stack'),
  ('ansiktstrekk',            'Ansiktstrekk',            'trekk', 'upper_pulley', 'stack'),
  ('triceps-ekstensjon',      'Triceps ekstensjon',      'arm',   'upper_pulley', 'stack'),
  -- Mid pulley
  ('brystfly',                'Brystfly (kabel)',        'press', 'mid_pulley', 'stack'),
  ('sidehev',                 'Sidehev',                 'press', 'mid_pulley', 'stack'),
  ('kabelroing',              'Kabelroing',              'trekk', 'mid_pulley', 'stack'),
  -- Low pulley
  ('oppreist-roing',          'Oppreist roing',          'trekk', 'low_pulley', 'stack'),
  ('innside-lar',             'Innside lår',             'ben',   'low_pulley', 'stack'),
  ('utside-lar',              'Utside lår',              'ben',   'low_pulley', 'stack'),
  ('hoftespark',              'Hoftespark',              'ben',   'low_pulley', 'stack'),
  ('skuldertrekk',            'Skuldertrekk',            'trekk', 'low_pulley', 'stack'),
  ('enarms-bicepscurl',       'Enarms bicepscurl',       'arm',   'low_pulley', 'stack'),
  -- Dedicated leg stations
  ('beinstrekk',              'Beinstrekk',              'ben',   'leg_extension', 'stack'),
  ('leggcurl',                'Leggcurl',                'ben',   'leg_curl', 'stack')
) as x(slug, name_nb, muscle_group, station_code, load_source)
join station s on s.code = x.station_code
join machine m on m.id = s.machine_id and m.name = 'Inspire M2'
on conflict do nothing;

-- Bodyweight and dumbbell work that needs no station.
insert into exercise (slug, name_nb, muscle_group, is_unilateral, default_station_id, load_source)
values
  ('armhevinger',       'Armhevinger',          'press',  false, null, 'bodyweight'),
  ('planke',            'Planke',               'kjerne', false, null, 'bodyweight'),
  ('sideplanke',        'Sideplanke',           'kjerne', false, null, 'bodyweight'),
  ('hoftehev',          'Hoftehev',             'ben',    false, null, 'bodyweight'),
  ('kneboy-kroppsvekt', 'Knebøy (kroppsvekt)',  'ben',    false, null, 'bodyweight'),
  ('utfall',            'Utfall',               'ben',    false, null, 'external'),
  ('goblet-kneboy',     'Goblet knebøy',        'ben',    false, null, 'external')
on conflict do nothing;
