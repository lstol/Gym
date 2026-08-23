# Session plan — Treningslogg build

One phase (ARCHITECTURE.md §6) per coding session, in order. Each session starts by reading
CLAUDE.md, docs/ARCHITECTURE.md and docs/HANDOFF.md, and ends by rewriting HANDOFF.md. Ambiguous
schema/load-model/progression decisions get asked, not guessed (CLAUDE.md §8).

| # | Phase | Scope | Done when |
|---|---|---|---|
| 1 | 0 + 1 | Repo scaffold (Vite+React+TS+Tailwind+TanStack Query+vite-plugin-pwa), CI-ready lint/typecheck/test, Netlify config, machine/station/exercise/program schema + RLS, seed data, magic-link auth, empty app deployed | You can log in at trening.syndikatet.eu and see Blokk 1's program |
| 2 | 2 | Logger UI: pin/station picker, set entry, workout draft in `localStorage`, **manual backdated entry with date picker** | The paper log from block 1 can be keyed in end to end |
| 3 | 3 | Domain engine only, `src/domain/`, **test-first**: effective load, double progression, rep-drop prediction, station ceiling warnings, stalling detection. Wired into the logger as proposals only | Proposal is correct on all three station types (high/mid-low/press-arm), matches the worked examples in CLAUDE.md §4.4 |
| 4 | 4 | Strava OAuth + `strava-sync` Edge Function + pg_cron, `perceived_effort`/`heavy_legs` columns that survive re-sync | Runs show up without manual entry |
| 5 | 5 | Progress views: top work set per exercise, weekly aggregation (ISO week, mean bodyweight), run vs. strength overlay | "Is it going forward" is answerable without counting by hand |
| 6 | 6 | Block review (progression + stalls + completion rate + free text), station calibration tool (`calibration_status → 'measured'`), CSV export | Block 2 can be planned from the app, not from memory |

## Notes

- **Session 3 is the one that must be right.** A progression bug is silent — see CLAUDE.md §4,
  ARCHITECTURE.md §3.6. Full unit coverage before any UI consumes the engine; no exceptions.
- **Session 5 is the one most tempting to start early.** Don't — there's nothing to visualize
  correctly until session 3's engine exists and session 2 has real logged sets behind it.
- Session boundaries are a default, not a fence: a session can end early if a phase is done, or
  spill into a second sitting if it isn't. What doesn't move is the order — phase 3 depends on
  phase 2's data shape, phase 5 depends on phase 3's numbers.
- Block 1 (paper) runs concurrently with sessions 1–2. Backdated entry in session 2 is what lets
  it catch up to the app rather than being lost.
