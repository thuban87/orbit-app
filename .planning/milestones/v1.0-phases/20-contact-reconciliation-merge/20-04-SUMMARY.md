---
phase: 20-contact-reconciliation-merge
plan: "04"
subsystem: reconciliation
tags: [react-native, expo, sqlite, contacts, durable-session, vitest]
requires:
  - phase: 20-03
    provides: classified reconciliation diffs, shared stale-safe apply writer, and photo staging
provides:
  - durable reconciliation session and card state machine
  - corruption-tolerant newest-pending resume lookup and completion counts
  - bulk linked-contact scan and CandidateCardGrid review workspace
affects: [20-05-reconcile-resume, contact-reconciliation, settings]
actuals:
  tokens: 39513
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [caller-owned-transaction-core, durable-review-cards, live-selection-eligibility, manual-only-photo-bulk]
key-files:
  created:
    - src/db/reconcile-session-dao.ts
    - src/db/reconcile-session-read.ts
    - src/screens/ReconcileGridScreen.tsx
    - src/screens/ReconcileCompleteScreen.tsx
  modified:
    - src/components/CandidateCardGrid.tsx
    - src/screens/SettingsScreen.tsx
    - src/navigation/RootNavigator.tsx
key-decisions:
  - "Use Contact Values is evaluated against CandidateCardGrid's internal live selection through a pure eligibility helper."
  - "Bulk source-wins actions never include the photo family; photos remain manual in ReconcileDetailScreen."
  - "A pending reconciliation session blocks a fresh Settings scan until the resume/discard UX arrives in Plan 20-05."
patterns-established:
  - "Session and all scanned cards compose non-mutexed DAO cores inside one outer write transaction."
  - "Completion disposition is retained in valid card diff JSON so grouped summary counts distinguish updates from Keep Orbit."
requirements-completed: [RCN-02]
coverage:
  - id: D1
    description: Durable reconciliation sessions, terminal state handling, newest-resume sweep, and completion counts.
    requirement: RCN-02
    verification:
      - kind: integration
        ref: npx vitest run src/db/reconcile-session-dao.test.ts src/db/reconcile-session-read.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Additive-only eligibility and node-testable CandidateCardGrid bulk-action gate.
    requirement: RCN-02
    verification:
      - kind: unit
        ref: npx vitest run src/logic/reconcile-bulk-eligibility.test.ts src/components/candidate-card-grid-actions.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Settings-launched bulk Contacts scan, reconciliation grid, partial review refresh, and completion summary.
    requirement: RCN-02
    verification:
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors && npm test
        status: pass
    human_judgment: true
    rationale: Pixel UAT must confirm live Android Contacts access, staged photo behavior, grid interactions, and summary presentation.
duration: 13min
completed: 2026-08-30
status: complete
---

# Phase 20 Plan 04: Bulk Linked-Contact Reconciliation Summary

**Durable bulk linked-contact reconciliation now scans into the existing card grid, blocks unsafe source-wins selections, and finishes with a calm per-session summary.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-31T02:31:00Z
- **Completed:** 2026-08-31T02:43:46Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Added transaction-composable reconciliation session/card DAOs with terminal completion, unresolved-only discard cleanup, and staged-photo paths.
- Added resume-newest/sweep-older reads, a corruption-tolerant pending-session-id lookup, and durable completion buckets.
- Reused and extended CandidateCardGrid for the Settings-launched linked-contact check, including safe live-selection gating, manual-only photos, detail return refresh, and completion counts.

## Task Commits

1. **Task 1: reconcile-session-dao (durable session + cards state machine)** — `a7f5e39` (feat)
2. **Task 2: reconcile-session-read (resume-newest/sweep-older + completion counts)** — `ca8376b` (feat)
3. **Task 3: Bulk reconcile UI — Settings entry, grid workspace, completion summary** — `508cfcc` (feat)

## Files Created/Modified

- `src/db/reconcile-session-dao.ts` — durable session/card writers with core and wrapper forms.
- `src/db/reconcile-session-read.ts` — durable resume descriptors, card reads, and completion count queries.
- `src/components/CandidateCardGrid.tsx` — additive reconciliation actions, scoring/chip customization, and live eligibility enforcement.
- `src/screens/ReconcileGridScreen.tsx` — in-memory scan followed by atomic card persistence and per-card bulk apply.
- `src/screens/ReconcileCompleteScreen.tsx` — footer-entry completion summary with unresolved and Done actions.

## Decisions Made

- Source-wins bulk apply is available only for a non-empty all-additive, non-photo selection; the pure gate protects both the action sheet and execution path.
- Staged source photos are written only as durable reconcile-staging paths, never as picker cache URIs.
- A missing source remains visible for review and becomes a terminal `missing_source` card only once that review is resolved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Persist detail-screen card outcomes before the grid refreshes.**
- **Found during:** Task 3
- **Issue:** ReconcileDetailScreen could apply a card but did not update its durable reconciliation-card status, leaving the grid unable to reflect resolved versus partial work on return.
- **Fix:** Composed `markCardStatusCore` and terminal-session finalization after a successful detail apply, preserving partial stale-field work.
- **Files modified:** `src/screens/ReconcileDetailScreen.tsx`
- **Verification:** `npx tsc --noEmit` and `npm test` pass.
- **Committed in:** `508cfcc`

**Total deviations:** 1 auto-fixed Rule 2 correction.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 20-05 can consume `getNewestPendingReconcileSessionId` and the durable card/session reads to present Resume or Discard.
- Pixel UAT remains required for real Contacts-provider reads, multi-select bulk interactions, and the completion summary.

## Self-Check: PASSED

- Confirmed DAO, eligibility, grid, and completion-screen source files exist.
- Confirmed task commits `a7f5e39`, `ca8376b`, and `508cfcc` exist in git history.

---
*Phase: 20-contact-reconciliation-merge*
*Completed: 2026-08-30*
