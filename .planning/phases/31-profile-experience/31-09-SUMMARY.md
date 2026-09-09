---
phase: 31-profile-experience
plan: "09"
subsystem: profile-backgrounds
tags: [react-native, expo-image-picker, expo-image-manipulator, local-storage, sqlite, vitest]
requires:
  - phase: 31-profile-experience
    plan: "02"
    provides: independent Profile background templates, assignments, and DAO hierarchy
  - phase: 31-profile-experience
    plan: "08"
    provides: Profile-owned template-manager and assignment UI patterns
provides:
  - Profile-aspect source-pixel crop geometry and one-pass local derivative preparation
  - UID-derived durable background storage with crash recovery and refcounted launch cleanup
  - Profile-owned crop, template, and independent assignment manager with ready-gated reconciliation
affects: [31-10, 36-ai-configuration-prompting, profile-presentation, local-photo-lifecycle]
actuals:
  tokens: 16530
  tasks: 3
  commits: 7
tech-stack:
  added: []
  patterns:
    - Explicit-aspect crop geometry shared by pan/pinch and named adjustments
    - UID-derived tmp/bak background writes serialized per durable relative path
    - Template-row image refcount protects global, Category, and contact assignments during launch cleanup
key-files:
  created:
    - src/services/photos/background-crop-geometry.ts
    - src/services/photos/background-pipeline.ts
    - src/services/photos/background-storage.ts
    - src/services/photos/background-reconcile-sweep.ts
    - src/profile/background-manager-model.ts
    - src/components/profile/ProfileBackgroundManager.tsx
  modified:
    - App.tsx
    - .planning/phases/31-profile-experience/31-VALIDATION.md
key-decisions:
  - "Background derivatives use only UID-derived profile-backgrounds/<uid>.jpg paths; picker and cache paths never enter SQLite."
  - "A durable template row, rather than an individual assignment, is the background-byte referrer because all assignment scopes point at template UIDs."
  - "Background reconciliation registers once after migration readiness and before the launch trigger; it never runs at module scope or from a timer."
patterns-established:
  - "Keep native crop processing behind a pure manager state machine so cancellation, stale tokens, and failure retention stay node-testable."
  - "Extract a node-pure reconciliation model when a launch-sweep adapter would otherwise load React Native in Vitest."
requirements-completed: [PROF-01, PROF-04, PROF-05, PROF-07, PROF-20]
coverage:
  - id: D1
    description: Profile-aspect crop geometry and one-pass derivative preparation preserve source bounds and release intermediates.
    requirement: PROF-04
    verification:
      - kind: unit
        ref: src/services/photos/background-crop-geometry.test.ts#Profile background crop geometry
        status: pass
      - kind: unit
        ref: src/services/photos/background-pipeline.test.ts#prepareProfileBackground
        status: pass
    human_judgment: false
  - id: D2
    description: UID-derived durable storage recovers interrupted writes and deletes only zero-referrer background bytes.
    requirement: PROF-05
    verification:
      - kind: unit
        ref: src/services/photos/background-storage.test.ts#background storage
        status: pass
      - kind: unit
        ref: src/services/photos/background-reconcile-sweep.test.ts#background launch reconciliation plan
        status: pass
    human_judgment: false
  - id: D3
    description: Profile-owned picker/crop/template/assignment manager is race-safe and registers ready-gated lifecycle cleanup.
    requirement: PROF-01
    verification:
      - kind: unit
        ref: src/profile/background-manager-model.test.ts#background manager model
        status: pass
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: "ProfileBackgroundManager is intentionally mounted by Plan 31-10, so actual Pixel crop, pinch, picker, assignment, relaunch, focus, Back, and readability smoke cannot be observed truthfully in this plan."
duration: 15m
completed: 2026-09-09
status: complete
---

# Phase 31 Plan 09: Safe Profile Backgrounds Summary

**Local Profile background templates now crop to the actual Profile aspect, survive cache eviction and interrupted writes, and compose independently from layout templates.**

## Performance

- **Duration:** 15m
- **Started:** 2026-09-09T15:40:11-05:00
- **Completed:** 2026-09-09T15:54:43-05:00
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added deterministic rectangular source-pixel crop math with shared clamp bounds for pinch/drag and accessible named adjustments, then produces one screen-class JPEG derivative.
- Added app-owned `profile-backgrounds/` storage with UID allowlists, serialized tmp→bak→destination replacement, interruption recovery, reference-aware orphan cleanup, and restore diagnostics.
- Added a Profile-owned background manager with system-library selection, in-sheet pan/pinch crop, save/cancel/retry isolation, template CRUD, and separate global, Category, and contact assignment flows.
- Registered background reconciliation exactly once from App's migration-ready launch block before the launch trigger.

## Task Commits

1. **Task 1 RED: Profile-aspect crop contracts** — `604123f`
2. **Task 1 RED: Derivative pipeline contracts** — `072d146`
3. **Task 1 GREEN: Crop geometry and derivative pipeline** — `7918c62`
4. **Task 2 RED: Storage and reconciliation contracts** — `d050c72`
5. **Task 2 GREEN: Crash-safe background storage lifecycle** — `3237e2d`
6. **Task 3 RED: Background manager state contracts** — `e622d51`
7. **Task 3 GREEN: Profile background manager workflow** — `3529179`

## Files Created/Modified

- `src/services/photos/background-crop-geometry.ts` — rectangular crop and shared pan-bound calculations.
- `src/services/photos/background-pipeline.ts` — DB-free crop/resize/persist coordinator with observable release handling.
- `src/services/photos/background-storage.ts` — durable background namespace, serialized replacement, and sidecar recovery.
- `src/services/photos/background-reconcile-model.ts` / `background-reconcile-sweep.ts` — reference-aware pure planning and ready-gated launch application.
- `src/profile/background-manager-model.ts` — token-safe crop/manager state contract.
- `src/components/profile/ProfileBackgroundManager.tsx` — Profile sheet for local creation, template management, and independent assignment.
- `App.tsx` — exactly-once background sweep registration before trigger installation.

## Decisions Made

- Background bytes remain entirely local and resolve only through an allowlisted relative path; no upload, cloud pack, filter, blur, brightness, or overlay control was added.
- A template row protects its image bytes while any scope can reference that template; deleting an assignment cannot remove shared bytes.
- Crop resources and picker state are released/dropped before the template page, while an interrupted or cancelled prepared file is either deleted immediately or swept only if unreferenced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted the node-pure reconciliation model from the launch adapter**
- **Found during:** Task 2
- **Issue:** Vitest importing the ready-gated launch adapter followed React Native's Flow runtime through the launch-sweep dependency, preventing the required pure reconciliation tests from loading.
- **Fix:** Added `background-reconcile-model.ts`; the launch adapter imports and re-exports the same model, so tests exercise production planning logic without loading React Native.
- **Files modified:** `src/services/photos/background-reconcile-model.ts`, `src/services/photos/background-reconcile-sweep.ts`, `src/services/photos/background-reconcile-sweep.test.ts`
- **Verification:** 7 storage/reconciliation tests, TypeScript, Biome, token-color validation, and whitespace checks passed.
- **Committed in:** `3237e2d`

**Total deviations:** 1 auto-fixed (Rule 3 - blocking verification boundary).

## Issues Encountered

- `npm run check` is absent from `package.json`, a pre-existing Phase 31 tooling condition. Direct equivalents passed: `npx tsc --noEmit`, targeted Biome, `npm run check:colors`, and `git diff --check`.
- The physical Pixel was available (one authorized Pixel 6 Pro, Metro `orbit`, package `com.bwales.orbit`), but this manager intentionally has no screen caller until Plan 31-10. Its device smoke remains that plan's integration acceptance rather than an unsupported claim here.

## Known Stubs

None. The unmounted manager is an intentional thin-controller sequencing boundary owned by Plan 31-10, not a placeholder implementation.

## Threat Flags

None. Picker media enters only through crop/resize into app-owned UID paths; durable deletion is reference-counted and no network, credential, backup, or AI path was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 31-10 can mount `ProfileBackgroundManager` into the Profile overflow and pass the already-resolved presentation/reload callback.
- Plan 31-10 owns physical Pixel validation for portrait/landscape crop, cancel/failure retention, relaunch/reconciliation, assignment scopes, drag/pinch, focus/Back, and readability treatment.

## Self-Check: PASSED

- All six required implementation artifacts exist on disk.
- Task commits `604123f`, `072d146`, `7918c62`, `d050c72`, `3237e2d`, `e622d51`, and `3529179` exist in local history.
- Targeted verification passed 6/6 files and 25/25 tests; TypeScript, Biome, color-token validation, and whitespace checks passed.

---
*Phase: 31-profile-experience*
*Completed: 2026-09-09*
