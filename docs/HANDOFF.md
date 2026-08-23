# Handoff

Phases 0–3 complete (docs/SESSION_PLAN.md). Assume the next session starts with
no memory of this one.

## Live and confirmed working

- **App**: https://gym.syndikatet.eu — Netlify site `treningslogg-794`, id
  `df0356d5-8db0-4957-9778-53450cc2b64b`, team "Holdet". DNS, custom domain and
  TLS all resolved.
- **Auto-deploy works**: push to `main` → GitHub App webhook → build → live. Do
  not run `netlify deploy --prod` by hand.
- **`netlify.toml`**: `base = "web"`, `command = "pnpm build"`,
  `publish = "dist"`. `publish` is relative to `base` — `web/dist` there resolves
  to `web/web/dist` and silently breaks every cloud build.
- **Database**: Supabase project "Gym", ref `kwrbykzqukaimvhlieae`, eu-west-1.
  Security advisor clean (the single INFO finding — `integration_token` with RLS
  and no policies — is intentional).
- **Auth**: email + password, self-service signup at `/signup`. Multi-user by
  design (the user's wife will have her own account); every user table is
  `user_id = auth.uid()`. Email confirmation is turned off, otherwise signups hit
  Supabase's shared-SMTP rate limit.

## What the app does now

**One scrolling home page**: calendar → editable programme → progress charts.

- **Calendar** shows A/B/C per day in distinct colours; green = completed.
  Planned sessions are materialised month by month as you browse, watermarked by
  `program.scheduled_through` so generation only fills *forward* — a session
  deleted for travel never reappears. Move/delete is drag and drop, built on
  pointer events (HTML5 DnD does not work on phones). Tapping anywhere in a day
  cell selects it; a click following a real drag is suppressed.
- **Programme editor** — add/remove exercises per session, searchable catalog of
  34 exercises from Inspire's own chart, plus user-defined "other" exercises
  (`exercise.user_id` non-null = private to that user).
- **Logger** (`/logger/:workoutId`) — every exercise on one scrolling page with
  column headers, the pin stepper showing live effective kg, autosave, and a
  recommendation banner. No warmup column: the paper programme says warmup sets
  are not logged. `is_warmup` remains in the schema and `v_working_set` still
  excludes it.
- **Carry-forward**: each exercise opens on last session's pin and reps. Carried
  values render greyed/italic and are **not** saved until edited or confirmed
  with the row tick — autosaving them would log sets that were never performed.
- **Progress charts**: reps as bars (right axis), effective kg as a stepped line
  (left axis), so double progression is visible as a sawtooth.

## Domain layer — pure, test-first, 68 tests

`web/src/domain/`, no imports from `data/` or `features/` (ESLint-enforced).

- `load.ts` — `stackKg`, `effectiveKg`, `isNearStationCeiling`. Pin 15 = 74.84 kg
  is asserted.
- `schedule.ts` — calendar-date arithmetic that never routes through a UTC
  instant, tested across month, year and the late-October CET/CEST change.
- `progression.ts` — the engine, rules v2. Ordered predicate list returning a
  tagged `reason`; Epley model (`e1rm`, `predictedRepsAt`, `fitEpleyK`,
  `epleyKFrom`, `observationsFrom`). Covers every case in PROGRESSION_V2 §7,
  including the three worked examples, AMRAP exclusion, calibration jumps and
  their caps, RIR 0/null never counting as readiness, and stalling.

Suggestions are proposals only — "Bruk" pre-sets the pin control and writes
nothing.

## Progression rules v2 — implemented

The three questions that used to sit here are answered, and the answers are implemented.
`docs/PROGRESSION_V2.md` is the authoritative spec; CLAUDE.md §4.3–4.4 summarises it.

- Progression targets the **lowest** working set, not the top one, and ragged sets
  (spread >= 3) or failure below the rep target hold the load instead of adding a rep.
- Loads that are far too light are fixed by **calibration**, driven by a counted AMRAP
  rather than by RIR — RIR is the instrument that is broken in a novice. `amrap_allowed`
  is false for shoulder/chest press, split squat and hip hinge; those use a capped RIR
  estimate labelled as such.
- `PCT_PER_REP` is **gone**. One Epley model does the forecast and the calibration jump;
  `k` defaults to 30 and calibrates per exercise from observed pin changes
  (`rep_cost_observation`, median once three land in [15, 60]). Settings shows it.
- Rep ranges are per exercise, by station step size and joint tolerance. Session C differs
  only by RIR (`rir_min = 3`), not by rep structure.

The press arm factor is **settled at 0.6** (owner-confirmed 2026-08-23; the conflicting
1.2 comes from Inspire's M3 chart, which does not apply to this machine).

## State of the user's data

One logged session: **session C, 2026-08-23**, 21 sets across 7 exercises.
Planned sessions run through 2026-09-30. Rep ranges were reseeded by the
progression-v2 migration, so the ranges on that session's template now differ
from what was in force when it was logged.

This matters for expectations: **recommendations and progress charts are
invisible with a single session.** A recommendation needs a previous session of
the *same template* (so the next session C, 30 August, is the first that shows
one), and a chart needs at least two sessions for that exercise. Both were
verified by cloning the user's real session onto a throwaway account and adding
a second — not by assuming.

## Not built

- **Phase 4 — Strava.** `supabase/functions/` does not exist. The user has
  explicitly said not to bother: they track running elsewhere. `run_activity`
  and `integration_token` tables exist but are unused.
- **Phase 6 — block review, calibration tool, CSV export.**
- `v_exercise_progress` / `v_week_summary` views — progress is currently computed
  client-side from `v_working_set` plus workout dates, because the view carries no
  foreign keys for PostgREST to embed through.
- Bodyweight tracking UI (`bodyweight_entry` exists, nothing writes to it).

## Working notes

- Verify against the live database with a throwaway account, then delete it —
  `delete from auth.users where email like 'claude-...'` cascades cleanly. Two
  real bugs (missing `user_id` on insert failing RLS, and a PostgREST
  `referencedTable` that must use the *select alias*, not the table name) were
  invisible to typecheck and only surfaced by driving the running app.
- `pnpm` is at the repo root via workspace; run `pnpm typecheck && pnpm lint &&
  pnpm test:run && pnpm build` before every commit.
- The service worker can serve a stale bundle. Settings shows the build hash —
  check it against the deployed commit before believing a change didn't ship.
