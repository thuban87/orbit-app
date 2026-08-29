---
phase: 19-system-contact-import
plan: 09
subsystem: import-recovery
tags: [react-native, sqlite, launch-sweep, contact-import, durable-sessions]
requires:
  - phase: 19-system-contact-import
    provides: durable import sessions, session discard semantics, and flat private photo staging
provides:
  - Launch-time durable import resume detection with stale-session and orphan-staging cleanup
  - Explicit Resume/Discard recovery prompt driven entirely by durable session rows
affects: [contact-import, import-retry, app-launch]
actuals:
  tokens: 5687
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Foreground launch hooks use injected callbacks and filesystem adapters for node tests
    - Import staging cleanup follows a DB-commit-before-filesystem-delete boundary
key-files:
  created:
    - src/services/import/contact-import-resume-sweep.ts
    - src/services/import/contact-import-resume-sweep.test.ts
    - src/components/ResumeImportPrompt.tsx
  modified:
    - App.tsx
key-decisions:
  - "Corrupt source snapshots are discard-only and never re-query an expired picker grant."
  - "A bulk import resumes through setup only before any row changes; interrupted batches continue through ImportProgress."
patterns-established:
  - "Import resume sweep: reconcile flat staging files against non-discarded durable session rows on every foreground launch."
requirements-completed: [IMP-04]
coverage:
  - id: D1
    description: "Durable import sessions are discovered, stale sessions and orphan staging are cleaned, and corrupt snapshots are discard-only."
    requirement: IMP-04
    verification:
      - kind: unit
        ref: "src/services/import/contact-import-resume-sweep.test.ts (6 cases); npx vitest run src/services/import/contact-import-resume-sweep.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The app-root recovery prompt resumes or discards a process-interrupted import while preserving already committed contacts."
    requirement: IMP-04
    verification:
      - kind: other
        ref: "npx tsc --noEmit --pretty false && npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "Process death and navigation presentation require device confirmation."
duration: 5min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 09: Durable Import Resume Summary

**Durable launch-sweep recovery for interrupted contact imports, with explicit Resume/Discard navigation and private staged-photo cleanup.**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-08-29T14:07:58Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added a node-tested foreground sweep that selects one durable import session, cleans stale-session paths after the discard transaction, and reconciles orphaned flat staging files without deleting live Retry inputs.
- Added a non-tap-dismissable recovery sheet that routes single, never-started bulk, interrupted bulk, review-only, terminal, and failed-only sessions to their correct durable flow.
- Registered the sweep after migration readiness behind an App-level one-shot guard so remounts cannot duplicate the prompt.

## Task Commits

1. **Task 1: contact-import-resume-sweep** - `128f8d1` (test), `8e9696e` (feat), `557fb02` (style)
2. **Task 2: ResumeImportPrompt + App wiring** - `4546c98` (feat)

## Files Created/Modified

- `src/services/import/contact-import-resume-sweep.ts` - Pure foreground hook, corrupt-snapshot description, and scoped/orphan staging cleanup.
- `src/services/import/contact-import-resume-sweep.test.ts` - Six durable-session and staging-cleanup cases.
- `src/components/ResumeImportPrompt.tsx` - Explicit-action recovery modal and state-machine navigation.
- `App.tsx` - Ready-gated, one-shot hook registration and app-root prompt state.

## Verification

- `npx vitest run src/services/import/contact-import-resume-sweep.test.ts` — passed (6 tests).
- `npx tsc --noEmit --pretty false` — passed.
- `npm run check:colors` — passed.
- `npx biome check src/components/ResumeImportPrompt.tsx App.tsx src/services/import/contact-import-resume-sweep.ts src/services/import/contact-import-resume-sweep.test.ts` — passed.

## Decisions Made

- Resume navigation consumes durable counts and snapshot rows only; it never reads the original system-contact URI.
- Files are deleted only after `discardSession` commits and the recurring reconciliation preserves every non-discarded session-row reference, including failed Retry inputs.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Test isolation] Mocked the native photo-storage module in the node-only sweep test.**
   - **Found during:** Task 1 verification
   - **Issue:** The service's production default filesystem adapter loaded React Native Flow syntax under the node test transform before the injected test filesystem could run.
   - **Fix:** Added a narrow photo-storage mock; the tests still exercise the injected adapter and the production flat-lister is covered by its existing storage test.
   - **Verification:** Resume-sweep suite passes all six cases.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Automated coverage is complete. Device UAT remains for the planned force-stop/relaunch confirmation: the prompt should appear, Resume should reopen durable state, and Discard should leave already committed contacts intact.

## Self-Check: PASSED

- All four delivered source files exist.
- All four task commits are present in git history.
