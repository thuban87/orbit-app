# Phase 10 — Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed by the discovering plan
(scope boundary: only auto-fix issues directly caused by the current task's changes).

## Pre-existing biome drift on `main` (found during 10-01)

`npx biome check .` reports **13 errors across 8 files that plan 10-01 never touches**
(all clean in git; unmodified by this plan). They are formatter/`organizeImports` drift,
almost certainly from the biome 2.5.8 formatter being stricter than whatever last formatted
these files:

- `src/components/BirthdayBanner.tsx` (organizeImports + format)
- `src/logic/dashboard-empty-logic.ts` (format)
- `src/navigation/RootNavigator.tsx` (format)
- `src/screens/ComposeScreen.tsx` (organizeImports + format)
- `src/screens/ContactProfileScreen.tsx` (format)
- `src/screens/HomeScreen.tsx` (organizeImports + format)
- `src/screens/ManageFavouritesScreen.tsx` (organizeImports + format)
- `src/screens/NeverContactedScreen.tsx` (organizeImports + format)

All are `FIXABLE` via `npx biome check --write` (formatting/import-order only — no logic).

**Impact on Phase 10's wave-merge gate:** the plan's gate is
`npx tsc --noEmit && npx biome check . && npm run check:colors`. `biome check .` fails on
this pre-existing drift even though every 10-01-scoped file (app.config.ts, the local module,
package files) is biome-clean and tsc/check:colors are green. A follow-up housekeeping pass
(or the phase orchestrator) should run `npx biome check --write` on the drifted files so the
whole-repo gate is green — this is an owner/planner call on whether it belongs in Phase 10 or
a separate chore commit, not something 10-01 should silently fold in.

**Verification that it is NOT 10-01's regression:** `git status --short src/ biome.json`
returns empty during 10-01 execution — none of the erroring files were modified by this plan.
