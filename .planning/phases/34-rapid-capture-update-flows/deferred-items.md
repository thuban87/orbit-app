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
