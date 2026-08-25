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

### History now spans every session template, 2026-08-24

Suggestion history and `rep_cost_observation` used to be scoped to one specific
`session_template` row. The user's first-ever session under template A showed
**no suggestion banner for any exercise**, despite five of A's six exercises
having been logged the day before under C — because rule 0 (`no_history`)
matched for every one of them. Fixed by dropping the template filter from both
`queries/suggestions.ts` and `queries/repCostObservation.ts`: history is now
every logged session containing the exercise, any template, since
`rep_min`/`rep_max` are the same wherever an exercise appears
(`PROGRESSION_V2.md` §5) — a template only changes the RIR target. Migration
`20260824094135_history_across_templates.sql` moved `rep_cost_observation`'s
unique key from `(user, exercise, template, observed_at)` to `(user, exercise,
observed_at)`, since the same pin-change observation must stay one row
regardless of which template's "Avslutt økt" triggers the recompute that finds
it. `PROGRESSION_V2.md` §1–§3 and CLAUDE.md §4.3 updated to match.

### Station corrections, 2026-08-24

Two exercises were mapped to the wrong station when the catalog was built from
a generic web search rather than the physical unit — the owner corrected both
by hand:

- **Sittende roing** (seated row): was `low_pulley`, is actually `press_arm`.
- **Kabelcrunch** (cable crunch): was `upper_pulley`, is actually `mid_pulley`.

`exercise.default_station_id` and the `set_entry.station_id` on the one
already-logged session (2026-08-23) were both corrected directly in the
database — kg is computed, never stored, so history recomputes correctly.
`PROGRESSION_V2.md` §5 and its §7 worked examples carry a note explaining the
correction. **The rest of the 34-exercise catalog has not been independently
verified against the physical machine** — only these two were caught, because
the owner happened to log them. Worth a full pass with the owner at some point
rather than assuming the rest are right.

### AMRAP sets were being logged as ordinary sets, 2026-08-25

Follow-on bug from the two above: three real calibration AMRAP sets (nedtrekk
22, sittende roing 24, kabelcrunch 25 reps, all RIR 0) landed in the database
with `is_amrap = false`. Cause confirmed with the owner directly: the old flow
required noticing and tapping a small "MAX" button *before* typing the count;
typing a high rep number with RIR 0 already reads as "went to failure" on its
own, so the separate toggle was easy to skip entirely. Backfilled the three
real rows to `is_amrap = true` (recomputes correctly, kg/reasons are derived).

Fixed the flow so this can't recur the same way: when the engine specifically
requests an AMRAP on a set (`SuggestionBanner`'s `requestAmrap`), `SetRow` now
defaults that set **into** AMRAP mode on mount — reps field empty with a "Maks
reps" placeholder, RIR replaced by an "AMRAP" badge — rather than waiting for
an opt-in tap. The badge is now the *opt-out*: tap it to log an ordinary set
instead, with a title/aria-label explaining that. `ExerciseBlock` also stops
passing a carried-forward `suggested` value into that specific set, since a
stale last-session rep count doesn't mean anything for an open-ended AMRAP.

Fixing this exposed a second, pre-existing bug it depended on: `LoggerPage`
already had a documented rule that `ExerciseBlock`/`SetRow` seed local state
from props on mount, so mounting before `lastSets` resolves loses the
carried-forward pin/reps — but the same gate was never extended to
`suggestions`, so `SetRow` could mount before `offerAmrap` was known and latch
onto `false` forever. `LoggerPage` now also waits on a `suggestionsReady`
flag, same pattern as `lastSetsReady`. Verified end-to-end (calibration banner
→ AMRAP-mode-by-default on the last set → typing only a rep count saves
`is_amrap = true, rir = 0`) on a throwaway account.

## State of the user's data

One logged session: **session C, 2026-08-23**, 21 sets across 7 exercises.
Planned sessions run through 2026-10-01. The weekday schedule was corrected
2026-08-24 — A now runs Tuesday, B Thursday, C unchanged on Sunday (was
Monday/Wednesday/Sunday, which put two strength sessions back to back) — and a
per-template weekday editor now exists in the program section so this doesn't
need a direct SQL fix next time. Rep ranges were reseeded by the
progression-v2 migration, so the ranges on that session's template now differ
from what was in force when it was logged.

This matters for expectations: **recommendations need at least one previous
logged session of the exercise (any template)**, and a chart needs at least
two. Verified against the real production data (nedtrekk pin 7, 12 reps, RIR 6
under C on 2026-08-23) by cloning an equivalent setup onto a throwaway account
and confirming the next session under a *different* template now shows a
calibration banner instead of nothing — not by assuming.

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
