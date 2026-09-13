# Phase 35 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT caused by the current plan's
changes and are therefore out of scope per the executor SCOPE BOUNDARY rule.

## Pre-existing test failures (discovered during 35-02, unrelated to it)

These two suites fail on the pre-35-02 tree as well. Neither imports any module
35-02 touched (`app-settings-dao`, `backup-schema`, `database.ts`), and the
failures reproduce with 35-02's Task 3 changes reverted. Not fixed here.

1. **`src/db/migrations/006-normalize-custom-field-values.test.ts`** — test
   "preserves the populated v5 profile through normalized lifecycle, read, AI,
   history, and purge paths" fails with `Error: no such column: allow_ai`
   (`allow_ai` is a migration-025 interactions column). The suite's own
   migration/read setup is out of sync with a column a read path expects.
2. **`src/components/orrery/orrery-controls-render.test.tsx`** — render test
   failure, unrelated to the data layer.

Recommend triaging these independently (owner's call on priority); they are not
regressions from 35-02.
## [35-04] Pre-existing unrelated test failure — orrery-controls-render.test.tsx

- **Discovered during:** 35-04 overall verification (full `npx vitest run`).
- **Failure:** `src/components/orrery/orrery-controls-render.test.tsx` — `SyntaxError: Unexpected token 'typeof'` (transform-level; the suite fails to load).
- **Out of scope:** 35-04 touched only `src/logic/ai-*` (7 files). This orrery/Skia component (Phase 30) is untouched by this plan; project-wide `tsc --noEmit` is clean and all 3358 other tests pass. STATE.md already flags Phase 30 as dirty/unreconciled ("30-orrery-systems still shows [ ] in ROADMAP with dirty 30-REVIEW files — reconcile independently").
- **Possible contributor (NOT mine to change):** an inherited uncommitted `M tsconfig.json` edit was present at session start; if vitest's transform reads it, that could be implicated. Left untouched (not a 35-04 change).
- **Action:** none taken here (scope boundary). Reconcile with the Phase 30 cleanup.
