---
phase: 20-contact-reconciliation-merge
plan: "03"
subsystem: reconciliation
tags: [react-native, expo, sqlite, contacts, photo-storage, vitest]
requires:
  - phase: 20-01
    provides: migration 013 and contact-photo writer
  - phase: 20-02
    provides: FieldChoiceGroup and PhotoChoice
provides:
  - canonical five-family reconciliation classifier and reviewed-source snapshot memory
  - guarded shared reconciliation apply writer with scalar freshness protection
  - durable source-photo staging and per-contact reconciliation detail route
affects: [20-04-bulk-reconciliation, 20-05-resume-sweep, contact-profile]
actuals:
  tokens: 42725
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [canonical-source-memory, caller-owned-transaction-core, post-commit-photo-promotion, stale-field-revalidation]
key-files:
  created:
    - src/logic/reconcile-diff.ts
    - src/db/reconcile-snapshot-dao.ts
    - src/db/reconcile-apply.ts
    - src/services/photos/reconcile-photo.ts
    - src/screens/ReconcileDetailScreen.tsx
  modified:
    - src/db/photo-relative-path.ts
    - src/services/photos/photo-storage.ts
    - src/screens/ContactProfileScreen.tsx
    - src/navigation/RootNavigator.tsx
key-decisions:
  - "Orbit/source method equality uses type plus canonical value; labels participate only in source-memory serialization."
  - "The first active linked source with a photo is the sole staged photo for a per-contact review."
  - "Photo promotion and its reviewed snapshot stay outside the non-photo apply transaction."
patterns-established:
  - "Reconciliation writes compose existing metadata and method cores inside one owner transaction."
  - "A scanned scalar baseline is re-read before writing so delayed applies preserve newer Orbit edits."
requirements-completed: [RCN-01]
coverage:
  - id: D1
    description: Canonical source-to-Orbit classification and last-reviewed source memory
    requirement: RCN-01
    verification:
      - kind: unit
        ref: npx vitest run src/logic/reconcile-diff.test.ts src/db/reconcile-snapshot-dao.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Guarded scalar/method reconciliation apply and deferred photo snapshot ordering
    requirement: RCN-01
    verification:
      - kind: integration
        ref: src/db/reconcile-apply.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Per-contact Update from Contacts detail and durable staged-photo choice
    requirement: RCN-01
    verification:
      - kind: unit
        ref: src/services/photos/reconcile-photo.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors && npm test
        status: pass
    human_judgment: true
    rationale: Pixel UAT must confirm live Contacts reads, source-photo rendering, and selection interaction.
duration: 11m
completed: 2026-08-30
status: complete
---

# Phase 20 Plan 03: Per-Contact Reconciliation Summary

**Per-contact Contacts reconciliation now classifies canonical source changes, preserves newer Orbit edits, and promotes chosen source photos only after transactional data changes commit.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-30T21:20:00-05:00
- **Completed:** 2026-08-30T21:31:00-05:00
- **Tasks:** 3/3
- **Files modified:** 16

## Accomplishments

- Added deterministic name, methods, birthday, and photo reconciliation outcomes, including missing-source short-circuiting and narrow reviewed-source suppression.
- Persisted source memory per active link and field family using shared canonical multi-method serialization.
- Added a shared guarded apply composition that snapshots overwritten scalars, preserves existing methods, advances scalar backup revision, and returns stale fields rather than overwriting post-scan edits.
- Added durable `reconcile-staging/` photo handling, post-commit photo promotion, profile entry gating, and the reconciliation detail route with a merge entry point.

## Task Commits

1. **Task 1: reconcile-diff pure classifier** — `c0c1eb3` (feat)
2. **Task 2: reconcile-snapshot-dao** — `1a4d5cc` (feat)
3. **Task 3: ReconcileDetailScreen + per-contact entry + apply-through-existing-writers** — `8734bc9` (feat)

## Files Created/Modified

- `src/logic/reconcile-diff.ts` — pure five-family classifier, source-memory serializer, and complete desired-method helper.
- `src/db/reconcile-snapshot-dao.ts` — transaction-composable snapshot upserts and classifier-ready reads.
- `src/db/reconcile-apply.ts` — shared stale-safe writer composition through authoritative metadata/method DAOs.
- `src/services/photos/reconcile-photo.ts` — durable stage/hash and post-commit promotion boundary.
- `src/screens/ReconcileDetailScreen.tsx` — live source read, one-photo collapse, choice UI, and post-commit photo handling.
- `src/screens/ContactProfileScreen.tsx` — active-link-gated Update from Contacts entry.

## Decisions Made

- Source values do not gain authority: conflicts require a choice; removals retain Orbit by default; missing sources are one distinct card state.
- Reconciliation does not add method provenance rows in v1; existing authoritative method persistence remains the bounded implementation.
- A failed post-commit photo apply leaves the photo snapshot unwritten, so the source photo is offered again on the next scan.

## Verification

- `npx vitest run src/logic/reconcile-diff.test.ts src/db/reconcile-snapshot-dao.test.ts src/db/reconcile-apply.test.ts src/services/photos/reconcile-photo.test.ts` — passed (16 tests).
- `npx tsc --noEmit` — passed.
- `npm run check:colors` — passed.
- `npm test` — passed (176 files, 1,751 tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Registered the new nullable-cadence consumer in the lifecycle ledger**
- **Found during:** Task 3 full-suite verification.
- **Issue:** The complete metadata input in the shared apply helper reads `interval_days`, so the enforced lifecycle-consumer ledger correctly rejected the unregistered production consumer.
- **Fix:** Added the 20-03 ownership entry and mirrored it in the human-readable validation ledger.
- **Files modified:** `src/db/lifecycle-consumer-ledger.test.ts`, `.planning/phases/18.2-bound-unbound-lifecycle/18.2-VALIDATION.md`
- **Verification:** `src/db/lifecycle-consumer-ledger.test.ts` and full `npm test` pass.
- **Committed in:** `8734bc9`

**Total deviations:** 1 auto-fixed Rule 1 regression.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 20-04 can reuse `applyReconcileSelections` for durable cards and bulk actions.
- Pixel UAT remains needed for the live Android Contacts path and staged photo presentation.

## Self-Check: PASSED

- Confirmed all reconciliation classifier, snapshot, apply, staging, and detail-screen files exist.
- Confirmed task commits `c0c1eb3`, `1a4d5cc`, and `8734bc9` exist in git history.

---
*Phase: 20-contact-reconciliation-merge*
*Completed: 2026-08-30*
