---
phase: 19-system-contact-import
plan: 10
subsystem: import
tags: [android-contact-import, photos, expo-image-manipulator, sqlite]
requires:
  - phase: 19-03
    provides: Validated in-transaction birthday writes for imported contacts
  - phase: 19-04
    provides: Durable document-directory staged photo paths and the single import seam
  - phase: 19-06
    provides: The shared bulk import-as-new seam and photo-failure row flag
provides:
  - Post-commit, failure-isolated imported photo mastering from durable staging
  - Single and bulk import hooks that retain imported contacts when photos fail
affects: [19-07, 19-08, 19-11, import completion, source consolidation]
actuals:
  tokens: 2732
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Injectable post-commit photo I/O boundary for native-safe node verification
    - Durable import-staging relative path resolved only at photo persistence time
key-files:
  created:
    - src/services/import/import-photo.ts
    - src/services/import/import-photo.test.ts
  modified:
    - src/services/import/import-acquire.ts
    - src/services/import/import-driver.ts
key-decisions:
  - "Resolve import-staging paths inside the photo service so callers only pass durable relative paths."
  - "Treat both photo persistence and photo_failed bookkeeping as post-commit best effort."
patterns-established:
  - "Import photo work runs after importContactRecord resolves the row; it never participates in contact creation."
requirements-completed: [IMP-02]
coverage:
  - id: D1
    description: Post-commit photo service creates a stable contact master or safely returns a non-throwing failure.
    requirement: IMP-02
    verification:
      - kind: unit
        ref: src/services/import/import-photo.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Android picker-provided photos and birthdays render correctly after single and bulk import.
    requirement: IMP-02
    verification: []
    human_judgment: true
    rationale: Android 17 picker field availability and visible avatar/birthday behavior require a device interaction.
duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 10: Post-Commit Import Photos Summary

**Durable staged contact photos now become failure-isolated 512px Orbit masters after single and bulk import commits.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added an idempotent post-commit photo service that resolves only durable `import-staging/` paths, resizes to JPEG, uses the crash-safe master persister, and writes the contact-relative filename.
- Wired the same service into `commitSingleImport` and shared `importRowAsNew`; a failed photo marks `photo_failed` while retaining the row as imported.
- Kept birthday ownership in `importContactRecord`; this plan neither reimplemented it nor changed its transaction boundary.

## Task Commits

1. **Task 1: import-photo — post-commit Orbit-owned master, failure-isolated** - `63f2b44` (test), `125aab4` (feat)
2. **Task 2: Wire photo post-commit into single + bulk paths** - `3af716c` (feat)

## Files Created/Modified

- `src/services/import/import-photo.ts` - Injectable post-commit resize, durable-path resolution, master persistence, and contact-photo write boundary.
- `src/services/import/import-photo.test.ts` - Red/green coverage for persistence, swallowed failures, and missing-photo no-ops.
- `src/services/import/import-acquire.ts` - Single-create post-commit photo hook.
- `src/services/import/import-driver.ts` - Shared bulk/import-as-new post-commit photo hook.

## Decisions Made

- The service receives the durable relative staging path and resolves it internally, preventing cache or picker-grant paths from reaching the photo pipeline.
- Failure to set `photo_failed` is also swallowed and logged so it cannot turn a successfully committed contact into a failed import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred native photo dependencies until the photo path is used**
- **Found during:** Task 2
- **Issue:** Static native image/file imports made the node bulk-import suite parse React Native even when every fixture had no photo.
- **Fix:** Kept the documented photo-storage pipeline but lazily loaded its native dependencies through the injected photo I/O boundary.
- **Files modified:** `src/services/import/import-photo.ts`, `src/services/import/import-photo.test.ts`
- **Verification:** Import-photo, driver, acquisition, and imported-contact DAO tests pass together; TypeScript and scoped Biome checks pass.
- **Committed in:** `3af716c`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Preserves the planned runtime behavior while restoring node verification for bulk and single import tests.

## Issues Encountered

- `npx biome check` runs against the entire repository and reports 137 pre-existing unrelated diagnostics. The four changed files pass their scoped Biome check.

## Known Stubs

None.

## Next Phase Readiness

- Plan 07 and Plan 11 can call their existing shared seams and inherit post-commit photo persistence.
- Android 17 device UAT remains required for picker-returned photo and birthday availability, visual avatar fallback, `photo_failed` behavior, and birthday display. It is recorded in `.planning/WINDOWS.md`.

## Self-Check: PASSED

- Confirmed both new import-photo files exist.
- Confirmed task commits `63f2b44`, `125aab4`, and `3af716c` exist.
- Targeted Vitest suites (11 tests), TypeScript, scoped Biome, and color checks pass.
