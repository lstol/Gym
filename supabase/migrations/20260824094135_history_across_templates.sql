-- Progression history (and rep-cost observations) used to be scoped to a
-- single session_template — but rep_min/rep_max are the same wherever an
-- exercise appears (PROGRESSION_V2.md §5), and most exercises in this
-- programme are shared across A/B/C. Siloing by template meant calibration
-- effectively never converged: each template only recurs weekly, so an
-- exercise trained under all three needed three separate weekly histories
-- to build up instead of one. Discovered 2026-08-24 when a first-ever A
-- session showed no suggestions at all, despite the same exercises having
-- been logged the day before under C.
--
-- The read side (queries/suggestions.ts, queries/repCostObservation.ts) now
-- pulls history across every template. rep_cost_observation still records
-- which template was active when an observation was captured (useful
-- provenance), but that can no longer be part of the uniqueness key: the
-- same underlying pin-change observation must stay a single row no matter
-- which template's "Avslutt økt" happens to trigger the recompute that
-- finds it, or every subsequent finish under a different template would
-- insert a duplicate.

alter table rep_cost_observation
  drop constraint rep_cost_observation_user_id_exercise_id_session_template_i_key;

alter table rep_cost_observation
  add constraint rep_cost_observation_user_id_exercise_id_observed_at_key
  unique (user_id, exercise_id, observed_at);
