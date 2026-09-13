# Phase 34 — Deferred / Out-of-Scope Items

Discovered during execution but outside the current plan's scope (see gsd-executor
scope boundary — only auto-fix issues directly caused by the current task's changes).

## Pre-existing test-suite failure (Phase 30 orrery) — NOT caused by 34-05

- **File:** `src/components/orrery/orrery-controls-render.test.tsx`
- **Symptom:** Suite fails to load with `SyntaxError: Unexpected token 'typeof'`
  (a whole-suite load error, not an assertion failure). `npm test` reports
  `1 failed | 346 passed` suites; all 3250 individual tests pass.
- **Evidence it is pre-existing:** the file's last commit is `5d38954` (Phase
  29-11); 34-05 touches only `src/db/*` and `src/screens/edit-contact-logic*`.
  It fails identically in isolation with 34-05's changes reverted from the run.
- **Already flagged:** STATE.md Current Position notes "Phase 30 (Orrery Systems)
  still shows [ ] in ROADMAP with dirty 30-REVIEW files — reconcile independently."
- **Disposition:** left untouched (out of scope). Reconcile with Phase 30.
- **34-06 re-confirmation:** still failing identically (`1 failed | 348 passed`
  suites; 3263 individual tests pass). 34-06 touches only `src/screens/post-log-*`,
  `src/stores/snackbar-*`, `src/components/Snackbar.tsx`,
  `src/components/PostLogNoteEditor.tsx`, `src/services/quick-log-command*`,
  `src/screens/HomeScreen.tsx`, `src/components/UniversalFab.tsx` — none in
  `src/components/orrery/`. Untouched by 34-06 commits.
