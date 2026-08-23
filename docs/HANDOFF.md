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

## Domain layer — pure, test-first, 40 tests

`web/src/domain/`, no imports from `data/` or `features/` (ESLint-enforced).

- `load.ts` — `stackKg`, `effectiveKg`, `isNearStationCeiling`. Pin 15 = 74.84 kg
  is asserted.
- `schedule.ts` — calendar-date arithmetic that never routes through a UTC
  instant, tested across month, year and the late-October CET/CEST change.
- `progression.ts` — the engine. `PCT_PER_REP = 2.5` in one named place. All
  three worked examples from CLAUDE.md §4.4 are covered, plus: RIR 0 or unknown
  is not readiness, warmups ignored, load and sets never both move, stalling
  after 3 flat sessions proposes ~90 %, unilateral follows the weaker side, the
  stack top is not exceeded, station ceilings flag at 90 %.

Suggestions are proposals only — "Bruk" pre-sets the pin control and writes
nothing.

## Open questions for the user — do not resolve these unilaterally

1. **RIR 0 below the rep target.** The user's shoulder press was 12/9/7 at RIR 0
   throughout. Rule 2 says "top set + 1", so the engine recommends 13 reps, which
   is too aggressive. CLAUDE.md has no clause for "below rep_max but already at
   failure". The user is discussing this with Claude separately —
   see `docs/CONTEXT_PROMPT.md`. Wait for their decision.
2. **Press arm factor.** The M2 spec says 2:1.2 → **0.6** (what's seeded).
   Inspire's own exercise chart prints "1 to 1.2" → **1.2**. Every other station
   agrees between the two sources; only this one differs, by a factor of two. It
   is recorded in the station's `note` and in both spec docs. Recommend measuring
   with a scale and setting `calibration_status = 'measured'`. Because kg is
   computed, correcting it later recomputes all history.
3. **First-session loads look far too light** — several exercises logged at
   RIR 5–10. "Add one rep" may be the wrong response to a badly calibrated
   starting load. Part of the same discussion.

## State of the user's data

One logged session: **session C, 2026-08-23**, 21 sets across 7 exercises.
Planned sessions run through 2026-09-30.

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
