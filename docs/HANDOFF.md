# Handoff

Session 1, phase 0 + 1 complete. Assume the next session starts with no memory
of this one.

## Live right now — everything below is confirmed working end to end

- **App**: https://gym.syndikatet.eu (Netlify site `treningslogg-794`, id
  `df0356d5-8db0-4957-9778-53450cc2b64b`, team "Holdet"). DNS, custom domain,
  and TLS cert all resolved (`ssl: true`, confirmed via `curl` → `HTTP 200`).
  CLAUDE.md and ARCHITECTURE.md both say `gym.syndikatet.eu` now — the user
  changed it from the original `trening.syndikatet.eu`, docs were updated to
  match.
- **Auto-deploy is fully wired.** Push to `main` → Netlify GitHub App webhook →
  build → deploy, confirmed by watching a real push go live without any manual
  `netlify deploy`. Don't run `netlify deploy --prod` by hand going forward —
  just push.
- **`netlify.toml`**: `base = "web"`, `command = "pnpm build"`,
  `publish = "dist"`. Note `publish` is relative to `base` — an earlier version
  had `publish = "web/dist"` which resolved to the nonexistent `web/web/dist`
  and broke every cloud build silently until diagnosed from the deploy log.
- **Database**: Supabase project "Gym", ref `kwrbykzqukaimvhlieae`, region
  eu-west-1, Postgres 17. All 8 migrations applied, `security` advisor clean
  (the one INFO-level finding, `integration_token` has RLS with no policies, is
  intentional). `seed.sql` and `seed_program.sql` both run — 1 machine,
  6 stations, 11 exercises, Blokk 1 with 3 templates / 23 items.
- **Auth is email+password, not magic link** (changed mid-session — see below).
  lasse.stoltenberg@gmail.com is the only `auth.users` row. Password is
  currently set to the email address itself and `must_change_password` is
  `true` in `user_metadata`, so the next real sign-in forces a redirect to
  `/change-password` before anything else is reachable. This was verified
  working end-to-end against the live project, then reset back to this
  first-login state — the user has not actually completed first login yet.
- `web/.env` exists locally (gitignored) with the real
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Same two vars set on Netlify
  (`netlify env:set`, context "all").

## Why auth changed from magic link to password

Magic link (the original spec, ARCHITECTURE.md §2) hit two real problems
during testing, not hypothetical ones:
1. Supabase's built-in shared SMTP has a low, undisclosed rate limit and is
   explicitly "not meant for production use" — the user hit "email rate
   exceeded" from normal testing volume.
2. Clicking the emailed link opens whatever browser/app handles mail links,
   which is often a different origin/browser than the one that requested the
   link — `localStorage` doesn't carry over, so it looks like login "doesn't
   stick." This bit us for real when testing bounced between
   `treningslogg-794.netlify.app` and `gym.syndikatet.eu` (different origins).

Password auth removes both failure modes — no email on the login path at all
(only needed once, for the initial account, which was done via direct SQL, not
email). Checked first: no duplicate `auth.users`/`identities` rows — that
wasn't the cause of anything.

**How the first-login password was set** (not through the client SDK — there's
no self-service signup flow, single-user app): direct SQL using `pgcrypto`,
matching Supabase's own bcrypt hashing:

```sql
update auth.users
set
  encrypted_password = extensions.crypt(email, extensions.gen_salt('bf')),
  raw_user_meta_data = raw_user_meta_data || '{"must_change_password": true}'::jsonb
where email = 'lasse.stoltenberg@gmail.com';
```

`src/data/auth.tsx` exposes `signIn`, `changePassword`, `mustChangePassword`
(derived from `session.user.user_metadata.must_change_password`), and
`signOut`. `src/ui/ProtectedRoute.tsx` redirects an authenticated-but-must-change
user to `/change-password` from anywhere else; `src/ui/PublicOnlyRoute.tsx`
does the reverse — redirects an already-authenticated user away from `/login`.

**A real bug this surfaced, now fixed**: neither the login form nor the
change-password form navigated on success. The session/user update *did*
happen (confirmed via `localStorage`'s `sb-<ref>-auth-token` before/after),
but nothing told React Router to move — the page just sat there with no error
and no visible change, indistinguishable from "broken," until a manual reload.
Both pages now call `navigate('/', { replace: true })` explicitly on success
instead of relying solely on context propagation from `onAuthStateChange`.

## What shipped

**Repo scaffold** — `web/` is a Vite + React 18 + TypeScript (`strict: true`) app.
Installed: Tailwind v4 (`@tailwindcss/vite`), TanStack Query, `vite-plugin-pwa`
(installability + app-shell caching only — no runtime data caching, no Dexie, no
IndexedDB), `@supabase/supabase-js`, `react-router-dom`, Vitest + Testing Library,
Playwright, ESLint (flat config) with a `no-restricted-imports` rule that blocks
`src/domain/**` from importing `data/`, `features/`, React, or Supabase — enforced,
not just documented (CLAUDE.md §6). `pnpm-workspace.yaml` at repo root so
`pnpm dev` / `test` / `typecheck` / `lint` / `build` / `e2e` all run from the root
via `pnpm --filter web`. `packageManager: "pnpm@11.22.0"` pinned in root
`package.json` to keep Netlify's build environment reproducible.

`typecheck`, `lint`, `test:run`, and `build` all pass right now
(`test:run` reports zero tests — expected, `src/domain/` is test-first and
starts in phase 3; `passWithNoTests: true` keeps that from failing the gate
in the meantime).

**Directory structure** matches CLAUDE.md §6:
`web/src/{domain,data,features/{logger,progress,runs,blocks,settings},ui,i18n}`.
Only `data`, `features/settings`, `features/progress`, `ui`, and `i18n` have real
files yet — `domain`, `features/logger`, `features/runs`, `features/blocks` are
empty placeholders for their sessions.

**Auth** — see the dedicated section above.
`src/features/progress/HomePage.tsx` is the main protected route — fetches the
active program via TanStack Query (`src/data/queries/program.ts`) and lists its
session templates; verified rendering Blokk 1 correctly against live data.
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
`Inspire_M2_program_og_logg_v2.pdf`. **Already run** against the real account
(verified: 3 templates, 23 items). It looks up the user by email and is a safe
no-op otherwise, so it's fine to leave in the repo as-is; don't re-run it
against this project (it has no `on conflict` guard and would duplicate the
program).

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
- Auth switched from magic link to email+password — see dedicated section
  above. ARCHITECTURE.md updated to match (§2 diagram, §4, §6 phase table).

**Design mockups** — early Logger + Dashboard layout exploration published as a
Claude artifact (not part of the repo): `https://claude.ai/code/artifact/4a46ff86-323e-4e2b-9f1f-bab48217f141`.
For layout iteration only, not a source of truth for the real Tailwind build.

**docs/SESSION_PLAN.md** — one phase per session, phases 0–6, mapped from
ARCHITECTURE.md §6.

## What's NOT done yet

1. **The user hasn't actually completed first login.** Password is
   `must_change_password = true` with password = email, reset to that state
   after verification testing. Next session should confirm they've signed in
   and changed it — if `must_change_password` is still `true` a while from now,
   check in rather than assuming it's fine.
2. **`supabase/functions/` doesn't exist yet** — correct for this phase
   (strava-oauth/strava-sync are phase 4).
3. **No local Docker/Supabase.** Verification happened directly against the
   hosted "Gym" project via the Supabase MCP tools, not `supabase db reset`
   locally — fine for a single hosted project, but there's no fast local
   iteration loop yet if that's ever wanted.

Phase 1's "done when" is met: signing in at https://gym.syndikatet.eu shows
Blokk 1 and all three session templates.

## Exact next step

Session 2: logger UI (docs/SESSION_PLAN.md) — pin/station picker, set entry,
workout draft in `localStorage`, manual backdated entry. Point it at the
`session_template_item` rows already seeded for Blokk 1.
