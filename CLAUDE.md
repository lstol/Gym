# CLAUDE.md — Treningslogg (gym.syndikatet.eu)

> Written in English on purpose: this file steers a coding agent, and mixed-language
> instruction files cause identifier drift. **UI strings are Norwegian; code is English.**
>
> Revision 2. Changed from rev 1: offline-first removed; load model rewritten around
> machine stations and pulley ratios.

---

## 1. What this is

A personal training log and progression tracker for **one athlete**: 54-year-old male runner
training on an Inspire M2 multi-gym at home. It replaces a printed paper log.

Two jobs, and no third:

1. **Log strength sets fast** — on a phone, between sets, with 60–90 seconds to do it.
2. **Answer one question honestly**: is progression happening, and what should go on next
   time? Suggestions follow double progression, constrained by what the machine can
   physically produce.

Strava running data exists as *context* for the strength data — the point is to see whether
strength work is helping or hurting the running, not to build a running app.

The first training block runs on paper while this app is being built. **Manual backdated
entry is a first-class feature, not an afterthought** — roughly 100 rows of paper log will be
keyed in once the logger exists.

### Non-goals — do not build without asking
Offline data sync · social features · nutrition tracking · barbell plate calculator (there is
no barbell) · exercise videos · an LLM chat coach · periodisation planner.

---

## 2. Stack — fixed, do not substitute

| Layer | Choice |
|---|---|
| Frontend | Vite + React 18 + TypeScript (`strict: true`) |
| PWA | `vite-plugin-pwa` — **installability and app-shell caching only, no data offline** |
| Server state | TanStack Query |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Supabase: Postgres, Auth, RLS, Edge Functions (Deno) |
| Hosting | Netlify — static build only, domain `gym.syndikatet.eu` |
| Tests | Vitest (unit), Playwright (e2e smoke) |
| Package manager | pnpm |

**No Dexie, no IndexedDB, no sync engine.** The one piece of local persistence is an
in-progress workout draft in `localStorage`, so a locked phone or an accidental refresh does
not lose the session. It is a draft, not a queue: roughly thirty lines of code. If you find
yourself writing conflict resolution, you have misread this file.

**Netlify serves static assets and nothing else.** All server-side code lives in Supabase Edge
Functions. Do not add Netlify Functions.

---

## 3. Hard constraints

1. **No secrets in the client bundle.** `STRAVA_CLIENT_SECRET` and the Supabase *service role*
   key exist only as Edge Function environment variables. Anything prefixed `VITE_` is public.

2. **RLS on every user table, from the first migration.** Policy: `user_id = auth.uid()`.
   There is one user today. Never write a table that assumes that stays true.

3. **Store what was observed, derive everything else.** See section 4.1 — the single most
   important rule in this file.

4. **Domain logic is pure.** Everything under `src/domain/` takes plain data and returns plain
   data: no `fetch`, no Supabase client, no `Date.now()` (pass `now` in), no React. A
   progression bug is *silent* — it produces plausible numbers that are quietly wrong.

5. **Suggestions are proposals, never actions.** The engine suggests; the user confirms or
   overrides; every override is written to `suggestion_feedback`.

6. **Norwegian UI, English code.** All user-facing strings in `src/i18n/nb.ts`.

7. **No `any`.** No `@ts-expect-error` without a comment saying what is suppressed and when
   it can go.

---

## 4. Domain rules

This section is the product. Read it before touching `src/domain/`.

### 4.1 Log the pin, not the kilos — the load model

The Inspire M2 has one weight stack feeding several stations through different pulley ratios.
The same pin position produces a different resistance depending on which station is used.

**The stack.** Top plate 15 lb = **6.804 kg**. Plates 1–15 are 10 lb = **4.536 kg** each.
Total 165 lb = 74.84 kg, which matches the manufacturer figure exactly — treat that as
confirmation the model is right.

```
stackKg(pin) = 6.804 + 4.536 * pin        // pin 1 = top plate + plate 1 = 11.34 kg
                                           // pin 15 = 74.84 kg = full stack
```

Station factors, manufacturer spec (sourcing and caveats in `docs/ARCHITECTURE.md`):

| Station | Ratio | Factor on stack | Effective step per pin | Max effective |
|---|---|---|---|---|
| `upper_pulley` (lat) | 1:1 | 1.0 | 4.54 kg | 74.8 kg |
| `mid_pulley` | 2:1 | 0.5 | 2.27 kg | 37.4 kg |
| `low_pulley` | 2:1 | 0.5 | 2.27 kg | 37.4 kg |
| `press_arm` | 2:1.2 | ~0.6 | 2.72 kg | 44.9 kg |
| `leg_extension` | 1:1 | 1.0 | 4.54 kg | 74.8 kg |
| `leg_curl` | 4:3 | 0.75 | 3.40 kg | 56.1 kg |
| `leg_press` (tilleggsutstyr) | 1:2 | 2.0 | 9.07 kg | 149.7 kg |

Ratios are written **stack:resistance**, so factor = right ÷ left.

The per-station ceiling matters: an exercise approaching its station maximum needs an exercise
change, not a load change. Surface it in the UI at 90 % of max.

**All seven are settled.** The manufacturer's M2 ratio list is the source, read as
stack:resistance. Inspire's own exercise chart prints the press arm as "1 to 1.2" = **1.2**,
double the M2 list's **0.6** — that chart is for the M3 and has been rejected for this
machine. The owner confirmed **0.6** on 2026-08-23; the discrepancy is closed.

`calibration_status` stays `'spec'` rather than `'measured'`: 0.6 is a confirmed reading of
the manufacturer's figure, not a scale measurement. Because kg is computed and never stored, a
later measurement would still recompute all history correctly.

Factors are therefore stored as *machine configuration with a calibration status*, never as
constants in code.

The rule that follows:

- `set_entry` stores **`pin` (integer — which plate the pop-pin sits in)** and **`station_id`**.
- It also stores `external_kg` for exercises where the load does not come from the stack at
  all (a dumbbell in a Bulgarian split squat).
- **Effective kilograms are never stored.** They are computed in the `v_working_set` view:
  `(machine.top_plate_kg + pin * machine.plate_kg) * station.factor`, or `external_kg`.
- There are **no magnetic micro-plates and none are planned.** Do not model them. The
  consequence is handled by rep-range width instead — see 4.4.
- Consequence: when a ratio is later measured empirically and corrected, *all history
  recomputes correctly*. If you store computed kg, a wrong factor corrupts the record
  permanently. This is not a performance question. Do not "optimise" it into a stored column.

`station.calibration_status` is `'spec'` or `'measured'`. The UI shows a quiet marker on any
chart derived from an uncalibrated station.

### 4.2 Work sets vs warmup
Rows with `is_warmup = true` are excluded from every progression calculation, volume chart and
personal record. New sets default to `is_warmup = false`; marking a warmup is an explicit tap.

### 4.3 Progression rules — see `docs/PROGRESSION_V2.md`

The authoritative specification is **`docs/PROGRESSION_V2.md`**. It supersedes the earlier
version of this section, which read the *top* set and so told a collapsing session (12/9/7 at
RIR 0) to add a rep. Summary of what governs now:

Evaluate in order, first match wins, over the last session's working sets of the SAME session
template (warmups **and AMRAP sets** excluded):

```
0  no previous session                                   → no_history
1  exercise uncalibrated (see 4.3a)                      → calibrating / calibration_jump
2  next pin would exceed 90% of station max              → station_ceiling
3  minRir == 0 and topReps < rep_max                     → failure_below_target, target topReps
4  spread (topReps - minReps) >= 3                       → ragged_sets, target topReps
5  all sets at rep_max, all rir >= 1, sets complete      → progress_load, next pin
6  all sets at rep_max but minRir == 0                   → consolidate
7  same pin 3+ sessions with no rise in minReps          → stalled, ~90% and rebuild
8  otherwise                                             → progress_reps, target minReps + 1
```

**Rule 8 targets the LOWEST working set**, not the highest. When sets are even the two are
identical, so it does not misfire in the ordinary case. An unknown RIR counts as 0, never as
readiness. Never propose an increase in load **and** sets in the same session.

### 4.3a Calibration

An exercise is uncalibrated until three sessions contain it, or any session had `minRir <= 3`.
While uncalibrated the engine asks for an **AMRAP** on the last set and sizes the load from
that counted result — RIR cannot be trusted to calibrate itself, because a novice reporting
RIR 8 may well have had 12. `exercise.amrap_allowed = false` (shoulder/chest press, split
squat, hip hinge) falls back to a RIR estimate, capped harder and labelled as an estimate.

`set_entry.is_amrap` forces `rir = 0` (CHECK constraint) and the set is excluded from every
rule above — an AMRAP is a measuring instrument, not a working set. It still counts as volume
and still appears in `v_working_set`.

### 4.4 Predict the rep drop

Going up one pin costs repetitions, and how many depends on the station and on where you sit
on the stack — 28.6 % on the upper pulley at pin 2, 7.4 % high on the low pulley.

One Epley model does both this forecast and the calibration jump. **There is no
`PCT_PER_REP`**: the load cost of a rep is `1 / (k + reps)`, which is ~2.6 % at 8 reps and
~2.0 % at 20 — not a constant, and this programme spans that whole band.

```
e1rm(kg, reps, k)                 = kg * (1 + reps / k)
predictedReps(cur, reps, new, k)  = round(k * (e1rm(cur, reps, k) / new - 1))
EPLEY_K_DEFAULT                   = 30
```

`k` is calibrated per exercise from observed pin changes (`rep_cost_observation`): the closed
form `k = (to_kg*to_reps - from_kg*from_reps) / (from_kg - to_kg)`, kept only when it lands in
`[15, 60]`, median once there are three. Settings shows the value, the count, and whether it
is still the default.

**The engine forecasts; it does not block.** With no micro-plates, refusing a pin increase
would mean never progressing. Always show the predicted reps so 14 becoming 6 is not a
surprise. The UI says "anslagsvis", never "du klarer".

Worked examples the tests must cover (`stackKg(pin) = 6.804 + 4.536 * pin`, k = 30):
- Seated row, `low_pulley`, pin 12 → 13: e1RM 42.865 → **9 reps**.
- Lat pulldown, `upper_pulley`, pin 6 → 7: e1RM 47.628 → **7 reps**.
- Triceps pushdown, `upper_pulley`, pin 2 → 3 at 14 reps: e1RM 23.285 → **4 reps**.

Rep ranges are per exercise, set by the station's step size and joint tolerance, not one
global range — see `docs/PROGRESSION_V2.md` §5. Range advisories are re-evaluated at block
review, never mid-block, and never rewrite the template automatically.

### 4.5 Unilateral exercises
`exercise.is_unilateral = true` → sets are logged per side (`side: 'L' | 'R'`). Progression
follows the **weaker** side.

### 4.6 Estimated 1RM
Epley may be computed but is a **secondary signal only**: never presented as a measurement,
never used above 12 reps, never the driver of a suggestion. Always labelled "estimert". The
primary signal is top work set at a given RIR.

### 4.7 Weekly aggregation
ISO weeks, Monday–Sunday. A week's bodyweight is the **mean of daily weigh-ins**, never a
single reading. Fewer than 3 weigh-ins → show the mean, marked low-confidence.

### 4.8 Runs
Only Strava activities with `type = 'Run'` are ingested. **The client never writes run rows.**
The user may add `perceived_effort` (1–10) and `heavy_legs` (bool); these live in separate
nullable columns and **must survive a re-sync** — the upsert touches Strava-owned columns only.

### 4.9 Blocks and session status
A `program` is a training block with start date, end date and `status`. Workouts belong to a
block. A workout is `planned`, `completed` or `skipped` — a skipped session is data, not
absence. The whole reason to track session C is finding out whether it actually happens.

At block end the app produces a **block review**: per-exercise progression, stalls, completion
rate per session type, run volume, bodyweight trend, plus free-text answers. The next block is
planned from that review, so the review is the app's actual output.

---

## 5. Data model (summary — full DDL in `supabase/migrations/`)

```
machine               name, plate_kg (4.536), top_plate_kg (6.804), plate_count (15)
station               machine_id, code, factor, max_effective_kg, calibration_status, note
exercise              slug, name_nb, muscle_group, is_unilateral, default_station_id,
                      load_source ('stack' | 'bodyweight' | 'external')
program               name, start_date, end_date, status, notes
session_template      program_id, code (A/B/C), name_nb, weekday
session_template_item template_id, exercise_id, order, target_sets, rep_min, rep_max,
                      rest_sec, rir_min, rir_max, is_optional
workout               program_id, template_id, date (DATE), status, duration_min,
                      sleep_1_5, energy_1_5, post_1_5, notes
set_entry             workout_id, exercise_id, station_id, set_index,
                      pin, external_kg, reps, rir, side, is_warmup
bodyweight_entry      date, weight_kg           -- unique (user_id, date)
run_activity          strava_activity_id UNIQUE, start_date, distance_m, moving_time_s,
                      elevation_gain_m, avg_hr, perceived_effort, heavy_legs, notes
integration_token     provider, refresh_token, expires_at   -- NO client policy at all
suggestion_feedback   exercise_id, suggested_pin, actual_pin, predicted_reps, actual_reps,
                      accepted, reason
```

Views: `v_working_set` (non-warmup sets **with effective_kg computed**),
`v_exercise_progress` (per exercise per ISO week), `v_week_summary`.

---

## 6. Repo layout

```
/
├─ CLAUDE.md
├─ docs/{ARCHITECTURE.md, HANDOFF.md}
├─ web/src/
│  ├─ domain/     load.ts progression.ts e1rm.ts week.ts   ← pure, heavily tested
│  ├─ data/       supabase client, queries, workout draft
│  ├─ features/   logger/ progress/ runs/ blocks/ settings/
│  ├─ ui/
│  └─ i18n/nb.ts
└─ supabase/{migrations/, functions/strava-oauth/, functions/strava-sync/, seed.sql}
```

`src/domain/` must not import from `src/data/` or `src/features/`. Enforce with an ESLint
`no-restricted-imports` rule, not with good intentions.

---

## 7. Commands

```bash
pnpm install
pnpm dev
pnpm test / pnpm test:run
pnpm typecheck            # tsc --noEmit
pnpm lint
pnpm build                # → web/dist
pnpm e2e

supabase start
supabase db reset
supabase migration new <name>
supabase functions serve <name>
```

---

## 8. Working agreement

- **Migrations are append-only.** Never edit one already applied to the hosted project.
- **Tests before implementation for anything in `src/domain/`.**
- Small commits, conventional messages (`feat:`, `fix:`, `test:`, `chore:`).
- **End of every session: rewrite `docs/HANDOFF.md`** — what shipped, what is half-built,
  known bugs, exact next step. Assume the next session starts with no memory.
- **When a decision is genuinely ambiguous, stop and ask.** Especially on schema shape, the
  load model, and the progression rules.
- No new dependency without a reason in the commit message.

---

## 9. Known traps

- **Pin numbering is resolved, and there is an arithmetic check.** Pin *n* lifts the 6.804 kg
  top plate plus *n* × 4.536 kg. Pin 15 must come out at 74.84 kg (165 lb). If a change makes
  pin 15 land anywhere else, the change is wrong. Put this in a test.
- **Station ceilings bite before you expect.** `low_pulley` maxes at 37.4 kg effective, which
  for a bilateral hip hinge is reachable within a block or two. When an exercise passes 90 %
  of its station maximum the UI must say so — the answer is a different exercise (unilateral,
  or a different station), not another pin.
- **Timezone.** User is in Norway (CET/CEST). Timestamps are `timestamptz`, but a *workout
  date* is a calendar `date` decided in local time. A 21:30 session must not land on tomorrow.
  Never derive a workout date from a UTC timestamp.
- **Strava access tokens expire in 6 hours.** Always refresh via `refresh_token` first.
- **Strava rate limits**: 100 req / 15 min, 1000 / day. Never walk full history on each sync.
- **Service worker will serve a stale app** while you debug a bug you already fixed. Register
  with `autoUpdate` and show the build hash in Settings.
- **`pin` and `external_kg` are mutually exclusive** per row, and a bodyweight exercise has
  neither. Add a CHECK constraint; do not rely on the UI to enforce it.
- **Rep ranges are per template item, and they are wide on purpose.** Do not "normalise" a
  6–16 range to 8–12 because it looks unusual. It is derived from the machine's step size.
