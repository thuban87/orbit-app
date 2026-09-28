# ADR-168: Truthful Read Phases for Import, Review, and Settings Screens

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstream E; 38.3-CONTEXT D-04, D-06, D-07, D-20, D-24, D-26; RG-035; review B-CR-02, B-WR-01, B-WR-02, B-WR-03, B-WR-04
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Five screens conflated loading, failure, empty, and success. A fatal import setup failure left "Importing… X of Y" on screen forever, ReconcileComplete had no loading branch, MemoryScreen could open an editor over a failed read, BackupSettings could present a known "Off", folder, or passphrase state it had not read, and DuplicateReview showed "Nothing to review" after a failed read.

## Decision

Read screens use an explicit read phase gated by the latest-request authority (`runGatedRead`, which never rejects), so a failed re-read after a committed write cannot reach the write's error path. ReconcileComplete gains a loading branch with a summary-only Retry; MemoryScreen shows loading and "Couldn't load memories" with Retry; BackupSettings shows "Couldn't read backup settings" with Retry and hides every known-state group until loaded; DuplicateReview shows an error with Retry and latches link and bulk writes. A fatal import shows "Import stopped" with a route to Import Complete, or Back when the session itself is unreadable; nothing re-runs automatically, the open-import-session hold is released, and Import Complete's Retry also covers pending rows behind a synchronous latch. The Phase 22 ContactPicker read-error empty-state fallback (CF-02) is kept unchanged.

## Alternatives Considered

- **Supersede CF-02 with an error + Retry picker** — rejected by the owner (D-07).
- **Inline import error with automatic Retry** — rejected (D-20) in favour of routing to Import Complete, which owns 38.2's Retry / Skip.
- **Release the hold by replacing Setup** — rejected in review B-CR-02 because Setup's leave guard would discard pending rows; Setup holds the mark only while focused.

## Consequences

### Positive

- Users can tell an unread screen from an empty one, and interrupted imports are recoverable by the resume sweep.

### Negative

- Each read screen carries a phase state machine rather than a boolean loading flag.

### Risks

- The D-20 hold release relies on `BulkImportSetup` losing focus when ImportProgress is pushed; this is proven only with a hand-built fixture (verification coincidental-reliance item).

## Implementation

**Key files:**
- `src/logic/read-phase.ts` — read phases and the never-rejecting `runGatedRead`.
- `src/screens/BackupSettingsScreen.tsx` — unreadable-settings error state.
- `src/screens/backup-settings-logic.ts` — known-state presentation and `commitThenRefresh` sequencing.
- `src/screens/ReconcileCompleteScreen.tsx` — loading branch and summary-only Retry.
- `src/screens/MemoryScreen.tsx` — loading and read-error states.
- `src/screens/ImportProgressScreen.tsx` — "Import stopped" fatal state.
- `src/screens/import-progress-state.ts` — fatal-state resolution and run identity.
- `src/screens/use-open-import-session.ts` — hold release on fatal exit.
- `src/screens/BulkImportSetupScreen.tsx` — focus-scoped session hold.
- `src/screens/ImportCompleteScreen.tsx` — pending-aware latched Retry and read-only reload.
- `src/screens/import-complete-logic.ts` — Retry eligibility and single-flight runs.
- `src/screens/DuplicateReviewScreen.tsx` — read error with Retry and latched resolutions.
- `src/screens/duplicate-review-logic.ts` — resolve-then-recover sequencing.
- `src/utils/single-flight.ts` — shared synchronous in-flight latch.

**Depends on:** ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos); ADR-161 (Durable Post-Commit Import Recovery and AI-Off Provenance)
**Required by:** None
