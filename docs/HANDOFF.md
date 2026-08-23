# Handoff

Session 1, in progress. Phase 0 + 1 scope (docs/SESSION_PLAN.md). Assume the next
session starts with no memory of this one.

## What shipped

**Repo scaffold** — `web/` is a Vite + React 18 + TypeScript (`strict: true`) app.
Installed: Tailwind v4 (`@tailwindcss/vite`), TanStack Query, `vite-plugin-pwa`
(installability + app-shell caching only — no runtime data caching, no Dexie, no
IndexedDB), `@supabase/supabase-js`, `react-router-dom`, Vitest + Testing Library,
Playwright, ESLint (flat config) with a `no-restricted-imports` rule that blocks
`src/domain/**` from importing `data/`, `features/`, React, or Supabase — enforced,
not just documented (CLAUDE.md §6). `pnpm-workspace.yaml` at repo root so
`pnpm dev` / `test` / `typecheck` / `lint` / `build` / `e2e` all run from the root
via `pnpm --filter web`.

`typecheck`, `lint`, `test:run`, and `build` all pass right now
(`test:run` reports zero tests — expected, `src/domain/` is test-first and
starts in phase 3; `passWithNoTests: true` keeps that from failing the gate
in the meantime).

**Directory structure** matches CLAUDE.md §6:
`web/src/{domain,data,features/{logger,progress,runs,blocks,settings},ui,i18n}`.
Only `data`, `features/settings`, `features/progress`, `ui`, and `i18n` have real
files yet — `domain`, `features/logger`, `features/runs`, `features/blocks` are
empty placeholders for their sessions.

**Auth** — `src/data/auth.tsx` (`AuthProvider`/`useAuth`) wraps Supabase magic-link
sign-in (`signInWithOtp`). `src/ui/ProtectedRoute.tsx` redirects to `/login` when
there's no session. `src/ui/LoginPage.tsx` is the email-entry screen.
`src/features/progress/HomePage.tsx` is the one protected route — fetches the
active program via TanStack Query (`src/data/queries/program.ts`) and lists its
session templates; handles loading/empty states since there's no live data yet.
`src/features/settings/SettingsPage.tsx` shows the build hash (`__BUILD_HASH__`,
injected from `git rev-parse --short HEAD` in `vite.config.ts`, falls back to
`'dev'` with no commits/not a repo).

**Database** — `supabase/migrations/`, one concern per file, RLS enabled in the
same migration that creates each table (not deferred to a later "policies" file):

```
20260823102705_machine_station.sql        machine, station — public read
20260823102706_exercise.sql               exercise — public read
20260823102708_program_session_templates.sql   program, session_template,
                                            session_template_item — user_id = auth.uid()
20260823102709_workout_set_entry.sql       workout, set_entry — pin/external_kg
                                            CHECK constraint, is_warmup
20260823102711_bodyweight_run_activity.sql bodyweight_entry, run_activity
20260823102712_integration_token.sql       RLS enabled, ZERO policies — no client
                                            access at all, by design
20260823102713_suggestion_feedback.sql
20260823102715_views.sql                   v_working_set only (security_invoker)
```

`v_exercise_progress` and `v_week_summary` are deliberately **not** built yet —
they need progression/week logic that doesn't exist until phases 3 and 5.
Building them empty now would be guessed SQL.

Every user-owned table carries its own `user_id` column directly (not inferred
via a join to `program`), so every RLS policy is a flat `user_id = auth.uid()` —
this was a judgment call reading CLAUDE.md rule 2 literally; flag it if that's
not what was intended.

**Seed data** — `supabase/seed.sql`: Inspire M2 (`plate_kg = 4.536`,
`top_plate_kg = 6.804`, `plate_count = 15`), all 6 stations from CLAUDE.md §4.1
at `calibration_status = 'spec'`, and the 11-exercise catalog with
`default_station_id`. Safe to run any time — none of it is user-scoped.

`supabase/seed_program.sql`: Blokk 1 (2026-08-23 → 2026-09-26), templates A/B/C
and all 18 session_template_item rows, transcribed exactly from
`Inspire_M2_program_og_logg_v2.pdf`. **This one can't run yet** — it looks up
`auth.users` by email and is a no-op (with a `raise notice`) until that row
exists. Run it once, after the first magic-link sign-in:

```bash
supabase db execute -f supabase/seed_program.sql
```

Decisions made without asking further (flagged, not blocking, per the user's
"focus on architecture and functionality" steer):
- `session_template_item` got a `note text` column (not in CLAUDE.md §5's
  summary DDL) to hold the PDF's per-exercise comments ("NØKKELØVELSE",
  "Start uten ekstra vekt", etc).
- "Nedtrekk, alternativt grep" in session B is the *same* `nedtrekk` exercise
  row, not a separate catalog entry — the grip variant lives in that `note`.
  Progression is already scoped per session template (CLAUDE.md §4.3), so this
  doesn't collide with session A/C's nedtrekk.
- "Pallof press eller kabelcrunch" in session C is two separate
  `is_optional = true` rows with a matching note — no "choice group" construct.
- Station picks not pinned down by the PDF or CLAUDE.md's worked examples:
  brystpress → `press_arm`, skulderpress → `press_arm`, kabelcrunch →
  `upper_pulley`, pallof press → `mid_pulley`, bicepscurl → `low_pulley`, tåhev →
  no station (`load_source = 'bodyweight'`). All `calibration_status = 'spec'` —
  a one-row UPDATE to correct.

**Design mockups** — early Logger + Dashboard layout exploration published as a
Claude artifact (not part of the repo): `https://claude.ai/code/artifact/4a46ff86-323e-4e2b-9f1f-bab48217f141`.
For layout iteration only, not a source of truth for the real Tailwind build.

**docs/SESSION_PLAN.md** — one phase per session, phases 0–6, mapped from
ARCHITECTURE.md §6.

## What's NOT done yet (this session's remaining scope)

1. **No live Supabase project.** Migrations have been written and manually
   reviewed but never executed — no Docker on this machine, so
   `supabase db reset` couldn't be run locally. Needs either Docker + local
   Supabase, or connecting to a real hosted project and `supabase db push`.
   This is an external-resource action (creating/billing a cloud project) —
   confirm with the user before creating one.
2. **Not deployed.** `netlify.toml` exists (build `pnpm build`, publish
   `web/dist`, SPA redirect) but nothing has been pushed to Netlify or pointed
   at `trening.syndikatet.eu`. Needs the user's Netlify account/site.
3. **`web/.env` doesn't exist.** `web/.env.example` documents
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; the app throws on load
   without them (`src/data/supabaseClient.ts`) — deliberate fail-fast, not a bug.
4. **`supabase/functions/` doesn't exist yet** — correct for this phase
   (strava-oauth/strava-sync are phase 4).

## Exact next step

Get a Supabase project connected (new project via the user's org, or local
Docker + `supabase start`), run `supabase db reset` (local) or
`supabase db push` (hosted) against the migrations above, confirm they apply
clean, run `supabase/seed.sql`, sign in once via magic link to create the real
`auth.users` row, then run `supabase/seed_program.sql`. Then wire `web/.env`,
confirm `pnpm dev` shows Blokk 1 on the home page, and deploy to Netlify /
`trening.syndikatet.eu`. That closes phase 1's "done when" (CLAUDE.md /
ARCHITECTURE.md §6: "du kan logge inn og se programmet").

Session 2 after that: logger UI (docs/SESSION_PLAN.md).
