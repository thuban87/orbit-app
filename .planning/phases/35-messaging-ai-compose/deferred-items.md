# Phase 35 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT caused by the current plan's
changes and are therefore out of scope per the executor SCOPE BOUNDARY rule.

## Pre-existing test failures (discovered during 35-02, unrelated to it)

These two suites fail on the pre-35-02 tree as well. Neither imports any module
35-02 touched (`app-settings-dao`, `backup-schema`, `database.ts`), and the
failures reproduce with 35-02's Task 3 changes reverted. Not fixed here.

1. **`src/db/migrations/006-normalize-custom-field-values.test.ts`** — ✅ **RESOLVED
   (commit `51c8eb9`).** This was NOT pre-existing: it was a phase-35 cross-plan
   regression introduced by **35-05**, which added an unconditional
   `SELECT note, allow_ai FROM interactions` into `readPromptContext` via
   `readGatedRecentInteractionNotes`. The 006 test builds its DB only to schema v6
   and calls `readPromptContext`, so the v25 `allow_ai` column was absent. The
   orchestrator's Wave-1 post-merge gate caught it and fixed the **test fixture**
   (added `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))`, mirroring
   migration 025); production egress code is unchanged. **Do not re-log this as an
   open failure — the 006 test passes (9/9) as of Wave 1.**
2. **`src/components/orrery/orrery-controls-render.test.tsx`** — genuinely
   pre-existing (`SyntaxError: Unexpected token 'typeof'`, transform-level; the
   suite fails to load). Added in Phase 29 (`5d38954`), references no phase-35
   file. Still open — owner's call, tracked with the Phase 30 cleanup.

Only #2 remains open; #1 is fixed.
## [35-04] Pre-existing unrelated test failure — orrery-controls-render.test.tsx

- **Discovered during:** 35-04 overall verification (full `npx vitest run`).
- **Failure:** `src/components/orrery/orrery-controls-render.test.tsx` — `SyntaxError: Unexpected token 'typeof'` (transform-level; the suite fails to load).
- **Out of scope:** 35-04 touched only `src/logic/ai-*` (7 files). This orrery/Skia component (Phase 30) is untouched by this plan; project-wide `tsc --noEmit` is clean and all 3358 other tests pass. STATE.md already flags Phase 30 as dirty/unreconciled ("30-orrery-systems still shows [ ] in ROADMAP with dirty 30-REVIEW files — reconcile independently").
- **Possible contributor (NOT mine to change):** an inherited uncommitted `M tsconfig.json` edit was present at session start; if vitest's transform reads it, that could be implicated. Left untouched (not a 35-04 change).
- **Action:** none taken here (scope boundary). Reconcile with the Phase 30 cleanup.

## [35-06] Pre-existing unrelated test failure — orrery-controls-render.test.tsx

- **Discovered during:** 35-06 overall verification (full `npx vitest run`).
- **Failure:** `src/components/orrery/orrery-controls-render.test.tsx` — `SyntaxError: Unexpected token 'typeof'` (transform-level; the suite reports 0 tests / fails to load). Same pre-existing failure logged under 35-02 and 35-04.
- **Out of scope:** 35-06 touched only compose-research-read / compose-session-store / profile-knowledge-read / ComposeResearchScreen — none referenced by this orrery (Phase 30) suite. `tsc --noEmit` clean; `check:colors` passes; the full suite is otherwise **3371 passing, 355/356 suites green**.
- **Action:** none taken here (scope boundary). Reconcile with the Phase 30 cleanup.

## [35-08] Pre-existing unrelated test failure — orrery-controls-render.test.tsx

- **Discovered during:** 35-08 overall verification (full `npm test`).
- **Failure:** `src/components/orrery/orrery-controls-render.test.tsx` — `SyntaxError: Unexpected token 'typeof'` (transform-level; the suite fails to load). Same pre-existing Phase-30 failure logged under 35-02 / 35-04 / 35-06; the file existed unchanged at the pre-plan commit `6e985b4`.
- **Out of scope:** 35-08 touched only `src/ai/prompt-template.ts(.test)`, `src/screens/ComposeScreen.tsx`, `src/logic/ai-availability.ts(.test)` — none referenced by this orrery (Phase 30) suite. `tsc --noEmit` clean; `check:colors` passes; the full suite is otherwise **3384 passing, 355/356 suites green**.
- **Action:** none taken here (scope boundary). Reconcile with the Phase 30 cleanup.
