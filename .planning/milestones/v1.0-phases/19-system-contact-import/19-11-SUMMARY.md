---
phase: 19-system-contact-import
plan: 11
subsystem: import
tags: [react-native, sqlite, contact-import, consolidation, expo-image]
requires:
  - phase: 19-01
    provides: durable import-session rows and atomic row-resolution cores
  - phase: 19-03
    provides: composed contact creation and imported-contact provenance writers
  - phase: 19-05
    provides: canonical phone/email duplicate-evidence normalization
  - phase: 19-10
    provides: post-commit imported-photo persistence
provides:
  - Conservative canonical-method source-record cluster detection
  - Atomic one-contact, multi-link consolidation writer
  - Explicit pre-batch Combine into one or Keep separate user choice
affects: [phase-20-contact-reconciliation, import-batch-flow]
actuals:
  tokens: 7110
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Pre-batch source consolidation over pending session rows
    - One transaction for contact creation, source links, provenance, and row resolution
    - Direct expo-image rendering for import-staging previews
key-files:
  created:
    - src/services/import/source-consolidation.ts
    - src/services/import/source-consolidation.test.ts
    - src/components/ConsolidationPrompt.tsx
  modified:
    - src/db/imported-contact-dao.ts
    - src/screens/BulkImportSetupScreen.tsx
key-decisions:
  - "Source consolidation accepts only shared canonical phone/email evidence; names and birthdays never form clusters."
  - "Combined source rows are imported new contacts, so each receives row_status=imported and match_outcome=new."
  - "Staged import photos render with a direct Image and use Avatar only for its null-photo initials fallback."
patterns-established:
  - "Import consolidation composes non-mutexed DAO cores within exactly one outer inWriteTransaction."
requirements-completed: [IMP-03]
coverage:
  - id: D1
    description: "Conservative canonical-method source clustering and atomic multi-link contact creation"
    requirement: IMP-03
    verification:
      - kind: integration
        ref: "src/services/import/source-consolidation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pre-batch explicit Combine into one / Keep separate flow with staged-photo preview"
    requirement: IMP-03
    verification:
      - kind: other
        ref: "npx tsc --noEmit --pretty false && npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "The device flow must confirm the modal is offered before batch navigation and that a real selected source pair combines correctly."
duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 11: Source Consolidation Summary

**Conservative pre-batch source consolidation that atomically creates one Unbound contact with multiple Android provenance links.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T14:22:00Z
- **Completed:** 2026-08-29T14:33:34Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Groups pending system-contact rows only when they share a canonical phone or email, never by name alone.
- Combines an approved source cluster into one Unbound contact, all external links and provenance, valid birthday, and imported row resolutions in one transaction.
- Offers a neutral pre-batch modal with explicit Combine into one and Keep separate actions; staged previews use direct expo-image rendering.

## Task Commits

1. **Task 1: source-consolidation — detect same-person source clusters + atomic combine writer** - `aac5dbe` (test), `30e8f88` (feat), `528179f` (refactor)
2. **Task 2: ConsolidationPrompt + BulkImportSetup PRE-batch wiring (never silent)** - `9568902` (feat)

## Files Created/Modified

- `src/services/import/source-consolidation.ts` - canonical cluster detector and atomic combine writer.
- `src/services/import/source-consolidation.test.ts` - integration coverage for clustering, rollback, photo isolation, and no-name guard.
- `src/components/ConsolidationPrompt.tsx` - explicit modal and safe staged-photo previews.
- `src/screens/BulkImportSetupScreen.tsx` - pre-batch detection and user-directed combine flow.
- `src/db/imported-contact-dao.ts` - exports existing non-mutexed provenance cores for atomic composition.

## Decisions Made

- A canonical phone/email match is the only consolidation signal; low-confidence records remain ordinary batch rows.
- The first calendar-valid birthday and first available staged photo are retained; photo persistence remains failure-isolated after the transaction.
- An all-nameless cluster returns `name-required` without writing a contact or resolving rows.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED: `aac5dbe` introduced the failing source-consolidation contract.
- GREEN: `30e8f88` implemented the passing writer.
- REFACTOR: `528179f` formatted the implementation while preserving green coverage.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 20 can treat multiple Android source links on one contact as provenance breadth while deterministic lookup still resolves each external ID to the same contact. Device verification remains required for the pre-batch interaction.

## Self-Check: PASSED

- All created consolidation files exist and the four task commits are present.
- `npx vitest run src/services/import/source-consolidation.test.ts`, `npx tsc --noEmit --pretty false`, `npm run check:colors`, and targeted Biome checks pass.
