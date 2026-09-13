# Phase 34 — Deferred / Out-of-Scope Items

Discovered during execution; NOT fixed (pre-existing or unrelated to the current plan's changes).

## 34-01

- **[pre-existing] `src/db/database.ts` biome findings.** `biome check src/db/database.ts` reports an
  unused import (`INTERACTION_HISTORY_SCHEMA_VERSION` from migration 025) and an `organizeImports`
  sort warning on the migration-import block (`profile-presentation` sorted before `025/026`). Both are
  present identically on HEAD (verified via `git show HEAD:src/db/database.ts`), predate this plan, and
  are not introduced by the migration 027 registration. No git pre-commit hook runs biome, so this is
  not a commit gate. Left untouched per the executor scope boundary.

- **[pre-existing] `src/components/orrery/orrery-controls-render.test.tsx` fails to load** with
  `SyntaxError: Unexpected token 'typeof'` (a vitest/esbuild transform error, no tests run). Verified
  identical at the pre-work commit `df0393a`, so it predates plan 34-01 and is unrelated to the
  migration-027 / DAO / backup work. Not touched. Likely tied to the open Phase 30 orrery review items
  (STATE.md notes dirty 30-REVIEW files). Should be triaged with that Phase 30 reconciliation.

## 34-04

- **[pre-existing] `src/components/orrery/orrery-controls-render.test.tsx` still fails to load**
  (`SyntaxError: Unexpected token 'typeof'`, "0 test" collected) — the SAME failure 34-01 recorded
  above, re-confirmed out of scope for 34-04:
  - The suite imports NONE of 34-04's changed modules (TouchpointRefineForm, log-interaction-logic,
    LogInteractionScreen, app-settings-dao, recency-dao, the three navigation stacks).
  - The file is not modified by 34-04 and fails identically in isolation (not a parallel-transform flake).
  - The rest of the suite is green (3225 tests pass; the 22 new log-interaction-logic cases included).
  Belongs to the Phase 30 orrery area (note the pre-existing dirty `.planning/phases/30-*` +
  `tsconfig.json` working-tree files at session start). Left untouched — triage with Phase 30.
