---
phase: 20-contact-reconciliation-merge
plan: "05"
subsystem: reconciliation
tags: [react-native, sqlite, launch-sweep, resume, relink]
requires:
  - phase: 20-04
    provides: durable reconciliation sessions, staged photos, and pending-session detection
provides:
  - Foreground-only reconciliation resume prompt with corrupt-session discard recovery
  - Global-source-safe relink and non-destructive missing-source review actions
affects: [20-06, reconciliation, contact-links]
actuals:
  tokens: 11300
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns: [launch-sweep recovery hook, explicit resume prompt precedence, transaction-scoped active-link preflight]
key-files:
  created: [src/services/import/reconcile-resume-sweep.ts, src/components/ResumeReconcilePrompt.tsx, src/db/reconcile-relink-dao.ts]
  modified: [App.tsx, src/screens/SettingsScreen.tsx, src/screens/ReconcileDetailScreen.tsx]
key-decisions:
  - "Import resume wins over reconciliation resume so app-root recovery sheets never overlap."
  - "A globally active external identity returns a typed duplicate outcome instead of relying on a unique-index abort."
patterns-established:
  - "Resume sweeps catch malformed durable payloads and expose discard-only descriptors through a parser-independent ID read."
  - "Missing sources retire or replace only external links; Orbit contact fields remain untouched."
requirements-completed: [RCN-02, RCN-01]
coverage:
  - id: D1
    description: Durable reconciliation resume, corrupt-session recovery, and staging sweep
    requirement: RCN-02
    verification:
      - kind: unit
        ref: src/services/import/reconcile-resume-sweep.test.ts
        status: pass
      - kind: unit
        ref: src/services/resume-prompt-precedence.test.ts
        status: pass
    human_judgment: true
    rationale: Process-death recovery and sheet interaction require Pixel UAT.
  - id: D2
    description: Non-destructive missing-source relink and unlink lifecycle
    requirement: RCN-01
    verification:
      - kind: unit
        ref: src/db/reconcile-relink-dao.test.ts
        status: pass
      - kind: other
        ref: npm test
        status: pass
    human_judgment: true
    rationale: System picker and relink presentation require Pixel UAT.
duration: 12 min
completed: 2026-08-31
status: complete
---

# Phase 20 Plan 05: Resume and Missing-Source Lifecycle Summary

**Foreground-only recovery for durable reconciliation checks, paired with safe external-source relink and unlink actions that preserve Orbit-owned data.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-08-31T02:55:26Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Added the reconciliation launch sweep, orphaned staging cleanup, corrupt-session discard-only fallback, and the reconcile-specific resume sheet.
- Made import-vs-reconciliation prompt precedence deterministic and intercepted new checks until pending work is resumed or explicitly discarded.
- Added transactional global-link preflight plus Keep, Relink, and Unlink missing-source actions without deleting or changing Orbit contact data.

## Task Commits

1. **Task 1: reconcile-resume-sweep launch hook + ResumeReconcilePrompt + App wiring** — `2521739` (feat)
2. **Task 2: Missing-source state + Relink / Unlink lifecycle** — `09e7f91` (feat)
3. **Rule 1 correction: themed resume-sheet scrim** — `a117866` (fix)

## Files Created/Modified

- `src/services/import/reconcile-resume-sweep.ts` — foreground recovery hook and durable staging cleanup.
- `src/components/ResumeReconcilePrompt.tsx` — explicit Resume/Discard reconciliation sheet.
- `src/services/resume-prompt-precedence.ts` — unit-tested one-sheet precedence helper.
- `App.tsx` and `src/screens/SettingsScreen.tsx` — app-root resume state and pending-new-check interception.
- `src/db/reconcile-relink-dao.ts` — atomic source relink/unlink writers with duplicate-link outcomes.
- `src/screens/ReconcileDetailScreen.tsx` — missing-source Keep, Relink, and Unlink branch.

## Decisions Made

- Import resume has precedence when both resumable session kinds are present.
- Relink preflights the global active source identity, returning a non-destructive result before writes rather than letting SQLite abort a transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Color-token violation] Replaced a hardcoded resume-sheet scrim color.**

- **Found during:** Task 2 verification
- **Issue:** `check:colors` rejected the new hardcoded RGBA overlay.
- **Fix:** Mirrored `ResumeImportPrompt`'s themed background plus opacity scrim idiom.
- **Files modified:** `src/components/ResumeReconcilePrompt.tsx`
- **Verification:** `npm run check:colors` passes.
- **Committed in:** `a117866`

**Total deviations:** 1 auto-fixed (Rule 1)

## Issues Encountered

None beyond the auto-fixed color-token check.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 20-06 can verify reconciliation resume and missing-source behavior on the Pixel. The remaining human checks are process-death resume and source relink against a deleted phone contact.

## Self-Check: PASSED

- Summary and all four primary implementation artifacts exist.
- Task and corrective commits `2521739`, `a117866`, and `09e7f91` exist in git history.
