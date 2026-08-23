-- Public reference data only: machine, station, exercise catalog. Safe to run
-- any time (local `supabase db reset`, or once against the hosted project) —
-- none of it is user-scoped. Program/session-template data is user-owned and
-- seeded separately in seed_program.sql, after the real account exists.

do $$
declare
  v_machine_id uuid;
  v_upper_pulley uuid;
  v_mid_pulley uuid;
  v_low_pulley uuid;
  v_press_arm uuid;
  v_leg_extension uuid;
  v_leg_curl uuid;
begin

  insert into machine (name, plate_kg, top_plate_kg, plate_count)
  values ('Inspire M2', 4.536, 6.804, 15)
  returning id into v_machine_id;

  -- Factors are dealer/manufacturer spec, not measurement — notation is
  -- inconsistent across sources. calibration_status stays 'spec' until someone
  -- hangs a scale on the cable and measures it. See CLAUDE.md §4.1.
  insert into station (machine_id, code, factor, max_effective_kg, calibration_status, note)
  values
    (v_machine_id, 'upper_pulley', 1.000, 74.84, 'spec', 'Lat/øvre pulley, 1:1.'),
    (v_machine_id, 'mid_pulley', 0.500, 37.42, 'spec', 'Midtpulley, 2:1. Notasjon inkonsistent på tvers av forhandlere.'),
    (v_machine_id, 'low_pulley', 0.500, 37.42, 'spec', 'Lavpulley, 2:1. Notasjon inkonsistent på tvers av forhandlere.'),
    (v_machine_id, 'press_arm', 0.600, 44.90, 'spec', 'Pressarm, oppgitt 2:1.2 — tvetydig uansett lesemåte.'),
    (v_machine_id, 'leg_extension', 1.000, 74.84, 'spec', 'Leg extension, 1:1.'),
    (v_machine_id, 'leg_curl', 0.750, 56.13, 'spec', 'Sittende leg curl, 4:3.')
  on conflict (machine_id, code) do nothing;

  select id into v_upper_pulley from station where machine_id = v_machine_id and code = 'upper_pulley';
  select id into v_mid_pulley from station where machine_id = v_machine_id and code = 'mid_pulley';
  select id into v_low_pulley from station where machine_id = v_machine_id and code = 'low_pulley';
  select id into v_press_arm from station where machine_id = v_machine_id and code = 'press_arm';
  select id into v_leg_extension from station where machine_id = v_machine_id and code = 'leg_extension';
  select id into v_leg_curl from station where machine_id = v_machine_id and code = 'leg_curl';

  insert into exercise (slug, name_nb, muscle_group, is_unilateral, default_station_id, load_source)
  values
    ('bulgarsk-splittkneboy', 'Bulgarsk splittknebøy', 'ben', true, null, 'external'),
    ('hoftehengsel-rdl', 'Hoftehengsel / RDL', 'ben', false, v_low_pulley, 'stack'),
    ('brystpress', 'Brystpress', 'press', false, v_press_arm, 'stack'),
    ('nedtrekk', 'Nedtrekk', 'trekk', false, v_upper_pulley, 'stack'),
    ('sittende-roing', 'Sittende roing', 'trekk', false, v_low_pulley, 'stack'),
    ('skulderpress', 'Skulderpress', 'press', false, v_press_arm, 'stack'),
    ('tahev', 'Tåhev', 'legg', false, null, 'bodyweight'),
    ('kabelcrunch', 'Kabelcrunch', 'kjerne', false, v_upper_pulley, 'stack'),
    ('pallof-press', 'Pallof press', 'kjerne', true, v_mid_pulley, 'stack'),
    ('bicepscurl', 'Bicepscurl', 'arm', false, v_low_pulley, 'stack'),
    ('triceps-pushdown', 'Triceps pushdown', 'arm', false, v_upper_pulley, 'stack')
  on conflict (slug) do nothing;

  -- leg_extension and leg_curl have no exercise pointing at them yet — the
  -- paper program doesn't use them. Kept in the station table because they're
  -- physically real stations on the M2.

end $$;
