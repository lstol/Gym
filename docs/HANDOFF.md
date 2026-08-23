# Handoff

Session 1, phase 0 + 1 complete. Assume the next session starts with no memory
of this one.

## Live right now

- **App**: https://treningslogg-794.netlify.app (Netlify site `treningslogg-794`,
  id `df0356d5-8db0-4957-9778-53450cc2b64b`, team "Holdet"). Custom domain
  `trening.syndikatet.eu` is set on the Netlify side (`custom_domain` field) but
  **DNS is not pointed yet** — add a `CNAME` record for `trening` →
  `treningslogg-794.netlify.app` at whatever provider hosts `syndikatet.eu`
  (Netlify does not manage that zone — `getDnsZones` came back empty).
- **Database**: Supabase project "Gym", ref `kwrbykzqukaimvhlieae`, region
  eu-west-1, Postgres 17. All 8 migrations applied, `security` advisor clean
  (the one INFO-level finding, `integration_token` has RLS with no policies, is
  intentional). `seed.sql` and `seed_program.sql` both run — 1 machine,
  6 stations, 11 exercises, Blokk 1 with 3 templates / 23 items.
- **Auth**: lasse.stoltenberg@gmail.com signed in once via magic link
  (`auth.users` row exists), so `seed_program.sql` has already run against the
  real account — no need to re-run it.
- **GitHub**: pushed to https://github.com/lstol/Gym (`main`), Netlify site is
  linked to this checkout's `.netlify` folder for CLI deploys but **not** wired
  to auto-deploy on push yet — every deploy so far was `netlify deploy --prod`
  run manually from this machine. Enabling git-based CI/CD means installing the
  Netlify GitHub App for this repo, which is an OAuth/app-install action for
  the user to do from the Netlify dashboard (Site configuration → Build & deploy
  → Link repository), not something to script.
- `web/.env` exists locally (gitignored) with the real
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. The same two vars are also set
  on Netlify (`netlify env:set`, context "all").

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
and all 23 session_template_item rows, transcribed exactly from
`Inspire_M2_program_og_logg_v2.pdf`. **Already run** — lasse.stoltenberg@gmail.com
signed in once, the script found that `auth.users` row, and seeded Blokk 1
against it (verified: 3 templates, 23 items). It looks up the user by email and
is a safe no-op otherwise, so it's fine to leave in the repo as-is; don't
re-run it against this project (it has no `on conflict` guard and would
duplicate the program).

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

## What's NOT done yet

1. **DNS for `trening.syndikatet.eu` isn't pointed.** Add a `CNAME` record:
   `trening` → `treningslogg-794.netlify.app`, at whatever registrar/DNS
   provider hosts `syndikatet.eu` (not Netlify — confirmed empty via
   `getDnsZones`). Once that resolves and Netlify issues the cert, the app is
   reachable at the real domain instead of the `.netlify.app` one.
2. **No git-based CI/CD.** Every deploy so far was `netlify deploy --prod`,
   run manually from this machine. To get "push to `main` auto-deploys":
   Netlify dashboard → this site → Site configuration → Build & deploy →
   Link repository → authorize the Netlify GitHub App for `lstol/Gym`. That's
   an OAuth/app-install grant, so it's a for-the-user action, not something to
   script from here.
3. **`supabase/functions/` doesn't exist yet** — correct for this phase
   (strava-oauth/strava-sync are phase 4).
4. **No local Docker/Supabase.** Verification happened directly against the
   hosted "Gym" project via the Supabase MCP tools, not `supabase db reset`
   locally — fine for a single hosted project, but there's no fast local
   iteration loop yet if that's ever wanted.

Phase 1's "done when" is met: signing in at
https://treningslogg-794.netlify.app shows Blokk 1 and all three session
templates.

## Exact next step

Session 2: logger UI (docs/SESSION_PLAN.md) — pin/station picker, set entry,
workout draft in `localStorage`, manual backdated entry. Point it at the
`session_template_item` rows already seeded for Blokk 1.
