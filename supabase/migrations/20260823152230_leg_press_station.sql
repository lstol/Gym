-- Manufacturer resistance ratios for the Inspire M2, as supplied by the owner:
--
--   Mid & Lower pulleys 2:1 · Lat/Upper pulley 1:1 · Leg Ext 1:1
--   Seated Leg Curl 4:3 · Leg Press 1:2 · Press Arm 2:1.2
--
-- The notation is stack:resistance, so factor = right ÷ left. Every existing
-- station already matches: 2:1 → 0.5, 1:1 → 1.0, 4:3 → 0.75, 2:1.2 → 0.6.
-- Only the leg press was missing — 1:2 → 2.0, i.e. it delivers twice the stack.
insert into station (machine_id, code, factor, max_effective_kg, calibration_status, note)
select m.id, 'leg_press', 2.000, 149.68, 'spec',
  'Tilleggsutstyr. Oppgitt 1:2 — gir dobbel stackvekt, maks 149,7 kg effektivt.'
from machine m
where m.name = 'Inspire M2'
on conflict (machine_id, code) do nothing;

-- Record the source of each ratio, and the one genuine disagreement between
-- sources, so a later calibration knows where to look first.
update station s
set note = x.note
from (values
  ('upper_pulley',  'Lat/øvre pulley 1:1. Bekreftet av både M2-spec og Inspires øvelsesplakat.'),
  ('mid_pulley',    'Midtpulley 2:1. Bekreftet av både M2-spec og Inspires øvelsesplakat.'),
  ('low_pulley',    'Lavpulley 2:1. Bekreftet av både M2-spec og Inspires øvelsesplakat.'),
  ('leg_extension', 'Leg extension 1:1. Bekreftet av begge kilder.'),
  ('leg_curl',      'Sittende leg curl 4:3. Bekreftet av begge kilder.'),
  ('press_arm',     'Pressarm 2:1.2 fra M2-spec = 0,6. MERK: Inspires egen plakat oppgir pressarmen som «1 to 1.2» = 1,2 — dobbelt så mye. Alle andre stasjoner stemmer mellom kildene; kun denne spriker. Mål den før du stoler på tallet.')
) as x(code, note)
where s.code = x.code;

-- Leg press exercises, for if/when the attachment is in use.
insert into exercise (slug, name_nb, muscle_group, is_unilateral, default_station_id, load_source)
select x.slug, x.name_nb, x.muscle_group, false, s.id, 'stack'
from (values
  ('beinpress',        'Beinpress',        'ben'),
  ('tahev-beinpress',  'Tåhev i beinpress', 'legg')
) as x(slug, name_nb, muscle_group)
join station s on s.code = 'leg_press'
join machine m on m.id = s.machine_id and m.name = 'Inspire M2'
on conflict do nothing;
