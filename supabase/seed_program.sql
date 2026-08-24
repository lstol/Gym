-- Blokk 1 – 5 uker, from Inspire_M2_program_og_logg_v2.pdf. User-owned data,
-- so this cannot run until the real account exists (RLS requires user_id, and
-- there's no user until the first magic-link sign-in). Run this once, after
-- that first sign-in:
--
--   supabase db execute -f supabase/seed_program.sql            (hosted project)
--   psql "$DATABASE_URL" -f supabase/seed_program.sql           (equivalent)
--
-- Rep buckets follow the PDF's own rule: hovedøvelser (8–12 reps) get 1–3 RIR,
-- småøvelser (10–15 / 12–15 reps) get 2–3 RIR. Sett rows use target_sets = the
-- top of any printed range (e.g. splittknebøy's "2–3" → 3); a lighter day is
-- just fewer logged set_entry rows against that target, not a schema concept.
--
-- HISTORICAL RECORD — do not edit the weekday values below. This script has
-- already run; the inserts here are a faithful record of what was actually
-- executed (A on Monday, B on Wednesday, C on Sunday), not the current spec.
--
-- 2026-08-23: the live schedule was corrected afterward via a direct UPDATE —
-- A moved Monday(1) → Tuesday(2), B moved Wednesday(3) → Thursday(4), C
-- unchanged on Sunday(7). Reason: Sunday(C) was immediately followed by
-- Monday(A), two strength sessions back to back with no rest/run day between.
-- The corrected pattern is C(Sun) → A(Tue) → B(Thu), each separated by at
-- least one non-strength day. If you ever seed a fresh program from this file
-- as a template, use weekday 2/4/7, not the 1/3/7 written below.

do $$
declare
  v_user_id uuid;
  v_program_id uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
begin

  select id into v_user_id from auth.users where email = 'lasse.stoltenberg@gmail.com' limit 1;

  if v_user_id is null then
    raise notice 'No auth.users row for lasse.stoltenberg@gmail.com yet — sign in once via magic link, then re-run this script.';
    return;
  end if;

  insert into program (user_id, name, start_date, end_date, status, notes)
  values (v_user_id, 'Blokk 1 – 5 uker', date '2026-08-23', date '2026-09-26', 'active',
    '3 styrkeøkter + 3 løpeøkter + 1 hviledag. Ingen deload i blokken — to ukers ferie etterpå fungerer som deload.')
  returning id into v_program_id;

  insert into session_template (user_id, program_id, code, name_nb, weekday)
  values (v_user_id, v_program_id, 'A', 'Bein + overkropp · hovedøkt', 1) returning id into v_a;
  insert into session_template (user_id, program_id, code, name_nb, weekday)
  values (v_user_id, v_program_id, 'B', 'Overkropp + kjerne', 3) returning id into v_b;
  insert into session_template (user_id, program_id, code, name_nb, weekday)
  values (v_user_id, v_program_id, 'C', 'Lett overkropp', 7) returning id into v_c;

  -- Styrke A – mandag
  insert into session_template_item
    (user_id, template_id, exercise_id, "order", target_sets, rep_min, rep_max, rest_sec, rir_min, rir_max, is_optional, note)
  values
    (v_user_id, v_a, (select id from exercise where slug = 'bulgarsk-splittkneboy'), 1, 3, 8, 8, 90, 1, 3, false, 'Start uten ekstra vekt. Reps er per bein.'),
    (v_user_id, v_a, (select id from exercise where slug = 'hoftehengsel-rdl'), 2, 3, 8, 12, 90, 1, 3, false, 'Nøkkeløvelse — sete og hamstrings. Nedre kabel.'),
    (v_user_id, v_a, (select id from exercise where slug = 'brystpress'), 3, 3, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_a, (select id from exercise where slug = 'nedtrekk'), 4, 3, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_a, (select id from exercise where slug = 'sittende-roing'), 5, 2, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_a, (select id from exercise where slug = 'tahev'), 6, 3, 12, 15, 60, 2, 3, false, 'Akilles/legg — billig forsikring.'),
    (v_user_id, v_a, (select id from exercise where slug = 'kabelcrunch'), 7, 2, 12, 15, 60, 2, 3, false, null);

  -- Styrke B – onsdag
  insert into session_template_item
    (user_id, template_id, exercise_id, "order", target_sets, rep_min, rep_max, rest_sec, rir_min, rir_max, is_optional, note)
  values
    (v_user_id, v_b, (select id from exercise where slug = 'sittende-roing'), 1, 3, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_b, (select id from exercise where slug = 'nedtrekk'), 2, 3, 8, 12, 90, 1, 3, false, 'Alternativt grep.'),
    (v_user_id, v_b, (select id from exercise where slug = 'brystpress'), 3, 3, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_b, (select id from exercise where slug = 'skulderpress'), 4, 2, 8, 12, 90, 1, 3, false, null),
    (v_user_id, v_b, (select id from exercise where slug = 'tahev'), 5, 2, 15, 15, 60, 2, 3, true, 'Droppes hvis beina er tunge.'),
    (v_user_id, v_b, (select id from exercise where slug = 'pallof-press'), 6, 2, 10, 12, 60, 2, 3, false, 'Reps er per side.'),
    (v_user_id, v_b, (select id from exercise where slug = 'bicepscurl'), 7, 2, 10, 15, 60, 2, 3, false, null),
    (v_user_id, v_b, (select id from exercise where slug = 'triceps-pushdown'), 8, 2, 10, 15, 60, 2, 3, false, null);

  -- Styrke C – søndag (lett, ingen beinøvelser)
  insert into session_template_item
    (user_id, template_id, exercise_id, "order", target_sets, rep_min, rep_max, rest_sec, rir_min, rir_max, is_optional, note)
  values
    (v_user_id, v_c, (select id from exercise where slug = 'brystpress'), 1, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'nedtrekk'), 2, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'sittende-roing'), 3, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'skulderpress'), 4, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'bicepscurl'), 5, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'triceps-pushdown'), 6, 2, 12, 15, 60, 2, 3, false, null),
    (v_user_id, v_c, (select id from exercise where slug = 'pallof-press'), 7, 2, 12, 15, 60, 2, 3, true, 'Velg pallof press eller kabelcrunch.'),
    (v_user_id, v_c, (select id from exercise where slug = 'kabelcrunch'), 8, 2, 12, 15, 60, 2, 3, true, 'Velg pallof press eller kabelcrunch.');

  raise notice 'Seeded Blokk 1 for %', v_user_id;

end $$;
