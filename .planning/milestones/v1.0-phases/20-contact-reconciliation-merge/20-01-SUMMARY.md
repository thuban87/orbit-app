---
phase: 20-contact-reconciliation-merge
plan: 01
subsystem: contact-merge
tags: [sqlite, migration, reconciliation, navigation]
requires: [migration012, tombstones, contact-method-normalization]
provides: [migration013, mergeContacts, listMergeCandidates, merge-ui-tracer]
affects: [contacts, reconciliation-sessions, profile-navigation]
tech-stack:
  added: []
  patterns: [single-write-transaction, tombstone-retirement, explicit-child-reparent]
key-files:
  created:
    - src/db/migrations/013-reconciliation-and-merge.ts
    - src/db/merge-dao.ts
    - src/db/merge-candidate-read.ts
    - src/screens/SurvivorSelectScreen.tsx
    - src/components/MergeImpactSummary.tsx
  modified:
    - src/db/database.ts
    - src/db/contacts-dao.ts
    - src/screens/ContactProfileScreen.tsx
    - src/navigation/RootNavigator.tsx
    - src/navigation/types.ts
decisions:
  - Migration 013 is tombstone-only; no contact_redirects table is created.
  - Merge candidates include every live contact regardless of tracking_enabled.
metrics:
  duration: 12m
  completed: 2026-08-30
status: complete
actuals:
  tokens: 11000
  tasks: 3
  commits: 4
---

# Phase 20 Plan 01: Contact Merge Tracer Summary

Migration 013, an atomic tombstone-backed contact merge writer, and a minimal profile-to-confirm merge path.

## Completed Work

- Registered migration 013 with durable reconciliation session, card, snapshot, and bulk-review resolution tables.
- Added `mergeContacts`, including child reparenting, collision pre-resolution, field-history preservation, tombstone retirement, and last-contact recomputation.
- Extracted `setContactPhotoCore` so a chosen photo can be updated inside the merge transaction.
- Added the profile overflow action, live Bound-and-Unbound candidate read, survivor selection, impact summary, and native destructive confirmation.

## Verification

- `npx vitest run src/db/merge-dao.test.ts src/db/migrations/013-reconciliation-and-merge.test.ts src/backup/reconciliation.test.ts` — passed (13 tests).
- `npx vitest run src/db/merge-candidate-read.test.ts` — passed.
- `npm run check:colors` — passed.
- `npx tsc --noEmit` — passed.

## Decisions Made

- The owner-resolved retirement policy is generic contact tombstones only; `contact_redirects` is intentionally absent.
- Merge candidates intentionally omit any `tracking_enabled` predicate so imported Unbound duplicates are reachable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retained absorbed-photo choices during resolution normalization**
- **Found during:** Task 2 verification.
- **Issue:** The normalizer retained `keep-survivor` but discarded a valid absorbed-photo selection.
- **Fix:** Normalize the typed absorbed-photo relative path so `setContactPhotoCore` can apply it atomically.
- **Files modified:** `src/db/merge-dao.ts`
- **Commit:** `48fd04c`

## Known Stubs

The plan's accepted bounded gap remains: conflict-specific selection is deferred to Plan 20-02. With empty resolutions, the tracer follows the explicit survivor-wins default.

## Self-Check: PASSED

- Migration, merge DAO, candidate read, screens, and component exist.
- Task commits `c540cf7`, `48b6f63`, `48fd04c`, and `3c27050` exist.
