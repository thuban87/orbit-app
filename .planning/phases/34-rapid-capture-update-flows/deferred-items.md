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

## Pre-existing TypeScript error (34-06 PostLogNoteEditor) — NOT caused by 34-07

- **File:** `src/components/PostLogNoteEditor.tsx` (lines 134, 142)
- **Symptom:** `tsc --noEmit` reports 2 errors — `Property 'interactionId' does
  not exist on type 'PostLogSaveResult'` and `Property 'note' does not exist on
  type 'PostLogSaveResult'` (the union `PostLogSaveResult` includes
  `PostLogMemoryResult`, which lacks those fields; the Note branch is not
  narrowed before the `editTouchpointFull` call).
- **Evidence it is pre-existing:** the errors are present verbatim in
  `git show HEAD:src/components/PostLogNoteEditor.tsx` (34-06 commit `7fd3b02`);
  34-07 touches only `src/screens/update-contact-chooser-logic*`,
  `src/screens/UpdateContactScreen.tsx`, `src/screens/MemoryScreen.tsx`,
  `src/navigation/tabs/DashboardStack.tsx`, none of which import
  `PostLogSaveResult`. `git status` shows PostLogNoteEditor.tsx unmodified.
- **Disposition:** left untouched (out of scope — 34-06 territory; reversing a
  committed 34-06 file is not this plan's job). The 34-07 files typecheck clean;
  the phase-gate `npm test` (vitest) is unaffected. Reconcile with 34-06.

## Pre-existing test-suite failure — 34-07 re-confirmation

- The Phase 30 orrery suite (`src/components/orrery/orrery-controls-render.test.tsx`,
  `SyntaxError: Unexpected token 'typeof'`) still fails identically under 34-07
  (`1 failed | 349 passed` suites; **3280 individual tests pass**, including the
  17 new `update-contact-chooser-logic` tests). 34-07 touches only
  `src/screens/update-contact-chooser-logic*`, `src/screens/UpdateContactScreen.tsx`,
  `src/screens/MemoryScreen.tsx`, `src/navigation/tabs/DashboardStack.tsx` — none
  in `src/components/orrery/`. Untouched by 34-07 commits.

## Biome a11y baseline (`lint/a11y/useValidAriaRole`) — house AppText idiom, NOT a 34-07 regression

- `biome check` reports `useValidAriaRole` on every `<AppText role="heading|body|
  caption|label">` — the canonical typography prop. This is the shipped house
  pattern: `src/screens/ThingsToRememberScreen.tsx` alone triggers it 9 times.
  34-07's screens use the identical idiom. No Biome pre-commit hook gates it and
  the plan's quality gates are `check:colors` + `npm test` (both green), so these
  are the project's accepted baseline, not new. Left as-is (changing AppText's
  `role` prop is a cross-cutting decision, not this plan's scope).
