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
