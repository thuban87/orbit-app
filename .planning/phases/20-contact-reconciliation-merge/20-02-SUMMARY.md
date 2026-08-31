---
phase: 20-contact-reconciliation-merge
plan: "02"
subsystem: merge-ui-and-database
tags: [react-native, expo, sqlite, vitest, contact-merge]
requires:
  - phase: 20-01
    provides: atomic merge writer and profile-initiated merge entry flow
provides:
  - advisory survivor recommendation and reusable scalar/photo choice controls
  - explicit scalar, photo, and per-method-type primary merge conflict resolution
  - empty-survivor fallback that retains populated absorbed values with history snapshots
affects: [20-03-reconciliation, contact-merge, contact-methods]
actuals:
  tokens: 11982.25
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - typed UI-to-writer MergeResolutions hand-off
    - pure completeness predicate for independently required merge choices
key-files:
  created:
    - src/screens/MergeConflictsScreen.tsx
    - src/components/FieldChoiceGroup.tsx
    - src/components/PhotoChoice.tsx
  modified:
    - src/db/merge-dao.ts
    - src/components/MergeImpactSummary.tsx
    - src/navigation/RootNavigator.tsx
key-decisions:
  - "Genuine scalar, photo, and primary-method conflicts have no preselection; every choice must be explicit."
  - "A populated absorbed scalar or custom value fills a null/blank survivor only when the user supplied no contrary resolution."
  - "Primary choices are collected separately for phone and email and passed through MergeResolutions.primaryMethod."
patterns-established:
  - "Merge screens import MergeResolutions from the DAO rather than re-declaring the writer contract."
  - "Per-type primary contention uses the pure choosePrimary model and a completeness predicate before enabling Continue."
requirements-completed: [RCN-03]
coverage:
  - id: D1
    description: Survivor recommendation and reusable choice controls
    requirement: RCN-03
    verification:
      - kind: unit
        ref: npm test
        status: pass
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: false
  - id: D2
    description: Explicit merge conflict resolution and final atomic merge hand-off
    requirement: RCN-03
    verification:
      - kind: unit
        ref: src/screens/merge-conflict-logic.test.ts#requires a choice for every contended method type, including phone and email together
        status: pass
      - kind: unit
        ref: src/db/merge-dao.test.ts#preserves populated absorbed scalar and custom values when the survivor is empty without a resolution
        status: pass
    human_judgment: true
    rationale: Pixel UAT must confirm conflict rendering, disabled Continue behavior, and persisted user selections.
status: complete
---

# Phase 20 Plan 02: Merge Conflict Resolution Summary

**Recommended-survivor guidance and reusable conflict controls now lead into a typed, explicit merge-resolution flow that preserves populated absorbed data when the survivor is blank.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-31T01:31:17Z
- **Completed:** 2026-08-31T02:16:03Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Added a continuity-signal survivor recommendation with an overridable, colourless `Recommended` badge.
- Added reusable, write-free scalar and photo choice controls with correct no-preselection conflict behavior.
- Added the merge-conflict route, including separate phone/email primary-method decisions, typed resolution hand-off, and real final merge counts.
- Preserved populated absorbed scalars and custom values when a conflict-free merge would otherwise retain a null or blank survivor value.

## Task Commits

1. **Task 1: survivor-recommendation heuristic + badge** — `9a4c653` (feat)
2. **Task 2: reusable FieldChoiceGroup + PhotoChoice** — `0bccc18` (feat)
3. **Task 3: merge conflict resolution + impact hand-off** — `84226bb` (feat)
4. **Correctness fix: preserve blank-survivor values** — `12529c8` (fix)
5. **Regression fixture repair** — `b0e23de` (test)

## Files Created/Modified

- `src/screens/MergeConflictsScreen.tsx` — detects actual conflicts, gathers explicit choices, and routes typed resolutions onward.
- `src/screens/merge-conflict-logic.ts` — pure Continue-enable predicate, with dual phone/email contention regression coverage.
- `src/components/FieldChoiceGroup.tsx` and `src/components/PhotoChoice.tsx` — reusable, token-only choice widgets.
- `src/db/merge-dao.ts` — keeps meaningful absorbed scalar/custom values when the survivor is empty and no explicit choice overrides that fallback.
- `src/components/MergeImpactSummary.tsx` — passes imported `MergeResolutions` to `mergeContacts`.

## Decisions Made

- Conflicts remain deliberately manual: no scalar, photo, phone-primary, or email-primary selection is implied.
- The empty-value fallback is limited to non-empty absorbed values and records the prior survivor value in `field_history`.
- Cadence and tracking remain survivor-wins and are not rendered as choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserve informative absorbed values over blank survivor values**
- **Found during:** Task 3
- **Issue:** The merge writer reparented absorbed custom values into an existing blank survivor row and retained blank scalar survivor values unless an absorbed choice was supplied.
- **Fix:** Added the user-authorized fallback for null/blank survivor scalars and custom values, while preserving explicit resolutions and snapshotting overwrites.
- **Files modified:** `src/db/merge-dao.ts`, `src/db/merge-dao.test.ts`
- **Verification:** `npx vitest run src/db/merge-dao.test.ts`
- **Committed in:** `12529c8`

**2. [Rule 1 - Bug] Complete merge-candidate test fixture schema**
- **Found during:** full `npm test` verification
- **Issue:** The Task 1 continuity query reads normalized methods, custom values, and external links, but its lightweight test fixture only created the legacy schema.
- **Fix:** Added minimal read-table fixtures to the unit test.
- **Files modified:** `src/db/merge-candidate-read.test.ts`
- **Verification:** `npm test` — 172 files / 1,735 tests passed.
- **Committed in:** `b0e23de`

**Total deviations:** 2 auto-fixed Rule 1 bugs.

## Issues Encountered

- The full suite initially failed in `merge-candidate-read.test.ts` because its fixture omitted tables that Task 1 now queries; repaired and verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 20-03 can reuse `FieldChoiceGroup` and `PhotoChoice` without another write path.
- End-of-phase Pixel UAT remains required to visually confirm no-preselection conflicts and persisted merge choices.

## Self-Check: PASSED

- Confirmed all declared implementation files and the SUMMARY exist.
- Confirmed task and follow-up commits `9a4c653`, `0bccc18`, `12529c8`, `84226bb`, and `b0e23de` exist in git history.

---
*Phase: 20-contact-reconciliation-merge*
*Completed: 2026-08-31*
