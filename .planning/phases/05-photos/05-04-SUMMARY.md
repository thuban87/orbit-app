---
phase: 05-photos
plan: 04
subsystem: photos
tags: [expo-image-manipulator, skia-crop, crop-geometry, image-pipeline, jpeg-master]

# Dependency graph
requires:
  - phase: 05-01
    provides: photos subsystem scaffolding (services/photos dir, phase conventions)
  - phase: 05-02
    provides: photo-storage.ts persistMaster (crash-safe .bak swap), relPathForTarget, PhotoTargetDescriptor
provides:
  - "cropRectFromTransform: pure gesture-transform -> clamped source-pixel CropRect (node-tested)"
  - "documented crop transform CONTRACT the crop screen (05-05) must match: input units + centre-origin convention"
  - "persistCroppedMaster: rawUri + cropRect + target -> one 512x512 JPEG master persisted out of cache -> relative path"
  - "PhotoPipelineError for decode/manipulate failures the caller maps to SPEC copy"
affects: [05-05 crop screen (geometry init must match contract), contact/profile/custom-field photo write call sites]

# Tech tracking
tech-stack:
  added: []  # expo-image-manipulator already installed (57.0.10); no new deps
  patterns:
    - "Pure, node-unit-tested geometry module (-logic.ts convention) isolating the one MEDIUM-confidence math area"
    - "DB-decoupled service orchestration: pipeline returns relative path; caller owns the DAO write"
    - "Chainable manipulate().crop().resize().renderAsync()->saveAsync() (SDK 52+), not deprecated manipulateAsync"

key-files:
  created:
    - src/services/photos/crop-geometry.ts
    - src/services/photos/crop-geometry.test.ts
    - src/services/photos/photo-pipeline.ts
  modified: []

key-decisions:
  - "Centre-origin transform convention with positive tx revealing the source LEFT (documented in-file as the 05-05 contract)"
  - "Crop size capped at source bounds + origin clamped to [0, src-size] so no out-of-bounds rect reaches the manipulator"
  - "Decode/manipulate failures throw a typed PhotoPipelineError (message = SPEC copy) with the original as cause; storage errors propagate raw"

patterns-established:
  - "Pattern 1: pure geometry (crop-geometry.ts) node-tested; only the visual convention stays for on-device UAT (Assumption A1)"
  - "Pattern 2: pipeline crops the ORIGINAL rawUri (full fidelity), never a Skia makeImageSnapshot; copies out of evictable cache via persistMaster; returns RELATIVE path only"

requirements-completed: [PHOTO-01, PHOTO-03]

coverage:
  - id: D1
    description: "cropRectFromTransform maps a gesture transform to a clamped source-pixel crop rect (cover/zoom/pan/edge-clamp, landscape + portrait)"
    requirement: "PHOTO-01"
    verification:
      - kind: unit
        ref: "src/services/photos/crop-geometry.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Documented crop transform contract (input units + centre-origin convention) the 05-05 crop screen's geometry init must match"
    requirement: "PHOTO-01"
    verification:
      - kind: other
        ref: "in-file header comment in src/services/photos/crop-geometry.ts (the crop-screen contract)"
        status: pass
    human_judgment: true
    rationale: "Correct framing/sign of the convention is only observable on-device (Assumption A1 / Open Question 2 — one visual check in 05-05)"
  - id: D3
    description: "persistCroppedMaster crops the ORIGINAL rawUri, resizes to 512x512, JPEG-encodes ~0.75, persists via persistMaster, returns relative path; no DAO import; no makeImageSnapshot"
    requirement: "PHOTO-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0) + greps: no @/db import, no makeImageSnapshot call, returns relative"
        status: pass
    human_judgment: true
    rationale: "The native manipulate->cache->document round-trip (one ~30-60 KB 512x512 JPEG under avatars/) is only assertable on-device; node has no expo-image-manipulator/expo-file-system native runtime"

# Metrics
duration: 4min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 4: Crop Geometry + Photo Pipeline Summary

**Pure node-tested `cropRectFromTransform` (gesture transform -> clamped source-pixel rect) plus `persistCroppedMaster`, which crops the ORIGINAL source URI through expo-image-manipulator into one 512x512 JPEG master, copies it out of evictable cache via the crash-safe `persistMaster`, and returns the relative path with zero DB coupling.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-15T09:20:32Z
- **Completed:** 2026-08-15T09:24:04Z
- **Tasks:** 2
- **Files modified:** 3 (created) + 1 planning doc

## Accomplishments
- `crop-geometry.ts`: pure `cropRectFromTransform` implementing 05-RESEARCH Pattern 2 (`eff = baseScale*scale`, `sizeSrc = viewport/eff`, invert pan/centre, clamp origin to `[0, src-size]`, cap size at source bounds). No react-native/Skia/expo import.
- Documented the full transform CONTRACT in-file (every input's units + the centre-origin convention, sign of `tx`/`ty`) so the 05-05 crop screen's one-time geometry init has a single authoritative spec to match (review concern [codex/HIGH 05-04]).
- `crop-geometry.test.ts`: 8 node tests — centred square (landscape + portrait), zoom-in shrink, size never exceeds source, pan direction each axis, and edge-clamp (over-pan can't go negative or past `src-size`).
- `photo-pipeline.ts`: `persistCroppedMaster({rawUri, cropRect, target})` runs `ImageManipulator.manipulate(rawUri).crop().resize(512).renderAsync()->saveAsync(JPEG,0.75)` on the ORIGINAL URI, then `persistMaster(out.uri, relPathForTarget(target))` and returns the relative path. No DAO import; decode failures throw `PhotoPipelineError`.

## Task Commits

1. **Task 1 (RED): failing crop-geometry test** - `b484d78` (test)
2. **Task 1 (GREEN): pure crop-rect geometry** - `3f785b5` (feat)
3. **Task 2: photo-pipeline persistCroppedMaster** - `867f892` (feat)
4. **Out-of-scope log: deferred-items.md** - `3940622` (docs)

_Task 1 was TDD (test -> feat); no refactor commit needed._

## Files Created/Modified
- `src/services/photos/crop-geometry.ts` - Pure gesture-transform -> clamped source-pixel `CropRect`; `CropTransform`/`CropRect` types; the crop-screen contract header.
- `src/services/photos/crop-geometry.test.ts` - 8 vitest cases (cover/zoom/pan/clamp, landscape + portrait).
- `src/services/photos/photo-pipeline.ts` - `persistCroppedMaster` orchestration + `PhotoPipelineError`; imports expo-image-manipulator + photo-storage + crop-geometry, no DAO.
- `.planning/phases/05-photos/deferred-items.md` - Logs a pre-existing (05-03) tree-wide `check:colors` failure as out-of-scope.

## Decisions Made
- **Centre-origin convention, positive `tx` reveals the source LEFT** (so `originX` decreases). Documented in-file as the binding contract for 05-05; the exact visual correctness is the single deferred on-device check (Assumption A1).
- **Clamp + cap in the pure function** (origin to `[0, src-size]`, size to source bounds) so a zoomed/over-panned transform can never hand an out-of-bounds rect to `crop()` (05-RESEARCH A2).
- **Typed `PhotoPipelineError` for decode failures**, message set to the SPEC copy "That image couldn't be used." with the original error as `cause`; `persistMaster` storage errors propagate unchanged so the prior master's recoverability (its own `.bak` contract) is untouched.
- **No pre-delete / destination delete added** in the pipeline — it calls `persistMaster` unchanged and inherits the crash-safe swap (review [codex/HIGH->MED 05-04 + cycle-2 HIGH atomicity]).

## Deviations from Plan

None - plan executed exactly as written.

The pipeline chain signature was confirmed against the installed `expo-image-manipulator@57.0.10` `.d.ts`: `ImageManipulator.manipulate(uri)` -> `ImageManipulatorContext.crop({originX,originY,width,height})` / `.resize({width,height})` / `.renderAsync(): Promise<ImageRef>`, then `ImageRef.saveAsync({format,compress}): Promise<{uri}>`; `ImageManipulator` and `SaveFormat` are index exports. `CropRect` is structurally identical to `ActionCrop['crop']`, so `.crop(cropRect)` type-checks directly.

## Issues Encountered
- **Tree-wide `npm run check:colors` is RED, but pre-existing and out of scope.** The failure is in `src/components/avatar-initials.test.ts:8` (a doc comment naming the barred legacy `hsl(...)`), introduced by commit `114fb56` (plan 05-03) and present before any 05-04 commit. All three files this plan created pass `check:colors` individually. Logged in `deferred-items.md`; not fixed (another plan's file). This plan's own verification commands (`npm test -- crop-geometry.test.ts`, `npx tsc --noEmit`) are both green; full suite is 396/396 passing.

## Verification Results
- `npm test -- src/services/photos/crop-geometry.test.ts` -> **8 passed**.
- `npx tsc --noEmit` -> **exit 0**.
- Full suite `npm test` -> **396 passed (33 files)**.
- `check:colors` on the 3 new files -> **exit 0** (tree-wide gate red only on the pre-existing 05-03 file above).
- On-device UAT (deferred, native): a picked image cropped through this pipeline yields one ~30-60 KB 512x512 JPEG under `avatars/` — requires the Pixel + a rebuilt APK; not run here per phase constraints.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The crop engine (geometry + pipeline) is ready for 05-05's Skia crop screen, which must produce a `CropTransform` matching the documented contract (viewport = measured square side, srcW/srcH = decoded intrinsic dims, baseScale = viewport/min(srcW,srcH), centre-origin tx/ty) and hand the resulting `CropRect` to `persistCroppedMaster`.
- One deferred on-device visual check remains (Assumption A1): confirm the framed square matches the saved master.
- Callers (contact/profile immediate write, custom-field deferred) supply the DAO persist of the returned relative path — the pipeline stays DB-decoupled.

## Self-Check: PASSED

- `src/services/photos/crop-geometry.ts` - FOUND
- `src/services/photos/crop-geometry.test.ts` - FOUND
- `src/services/photos/photo-pipeline.ts` - FOUND
- Commits `b484d78`, `3f785b5`, `867f892`, `3940622` - all FOUND in git log

---
*Phase: 05-photos*
*Completed: 2026-08-15*
