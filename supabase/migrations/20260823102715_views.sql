-- Effective kilograms are never stored — computed here from pin/station, or
-- taken straight from external_kg. Warmups are excluded: CLAUDE.md §4.2 says
-- warmup sets never enter a progression calculation, volume chart or PR.
--
-- security_invoker so the view is subject to the querying user's own RLS
-- policies on set_entry, not the view owner's.
create view v_working_set
  with (security_invoker = true)
  as
  select
    se.id,
    se.user_id,
    se.workout_id,
    se.exercise_id,
    se.station_id,
    se.set_index,
    se.pin,
    se.external_kg,
    se.reps,
    se.rir,
    se.side,
    case
      when se.pin is not null and st.id is not null
        then (m.top_plate_kg + m.plate_kg * se.pin) * st.factor
      when se.external_kg is not null
        then se.external_kg
      else null
    end as effective_kg,
    se.created_at
  from set_entry se
  left join station st on st.id = se.station_id
  left join machine m on m.id = st.machine_id
  where se.is_warmup = false;
