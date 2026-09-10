---
phase: 31-profile-experience
plan: 13
subsystem: Profile background crop
tags: [photos, gestures, android, local-first]
status: complete
actuals:
  tasks: 3
  commits: 17
---

# Phase 31 Plan 13: Source-selection Profile crop summary

**Profile backgrounds now use a bounded source-pixel selection model, Modal-local Android gesture root, and accessible Fine tune controls.**

## Accomplishments

- Added deterministic contained selection, pan, focal pinch, textual state, and direct pipeline crop tests.
- Preserved the one-pass local JPEG derivative, UID-relative storage, release, and failure contracts.
- Added `GestureHandlerRootView` at the shared RN Modal root, a contained source preview, selection border, dimmed outside mask, and named Fine tune controls.
- Corrected the workspace integration after Pixel inspection: the source now fills the measured editor width while the Profile-aspect selection stays source-bounded.
- Installed the debug APK on the authorized physical Pixel with Metro and `adb reverse` active; captured debug device artifacts.
- Proved direct one-finger drag on real landscape and portrait sources: the selections and textual state moved from center to an edge without a gesture/worklet exception.
- Proved the persistent Fine tune fallback and named zoom behavior: Zoom in changed the textual crop size from 62% to 54%.

## Verification

- Focused crop/pipeline/target/storage/reconciliation/model/sheet/overlay suites passed (24 tests).
- `npx tsc --noEmit`, `npm run check:colors`, and `git diff --check` passed.
- Debug APK build was run on droid and installed on the physical Pixel. No release build was used.
- Full regression run: 320 test files / 2,835 tests passed; the pre-existing unrelated `src/components/orrery/orrery-controls-render.test.tsx` transform failure remains outside this gap plan.

## Pending owner verification

Rows 43–44 are intentionally **PENDING OWNER** only for genuine two-pointer pinch coverage across portrait and landscape sources. Standard adb automation cannot create a trustworthy multi-touch gesture.

Physical Pixel pairs `17-landscape-contained.*` → `18-landscape-horizontal-left.*` and `20-portrait-contained.*` → `21-portrait-horizontal-left.*` show both source orientations contained across the editor workspace and directly dragged to an edge.

`19-fine-tune-zoom.*` confirms Fine tune remains open, exposes Reset/zoom/directional controls, and updates crop size. A genuine two-pointer pinch remains the direct-touch observation that safe adb automation cannot establish.

## Deviations from Plan

### Auto-fixed issues

- **[Rule 1 - Gesture bug]** Re-clamped resized selection origins, added the dimmed outside-selection mask, and preserved the original focal-relative point during pinch.
- **[Rule 1 - Layout/gesture bug]** Split source initialization from workspace remeasurement so Fine tune no longer auto-closes or resets the selection; made the gesture surface fill the editor and used measured sheet width rather than window width.

## Files

- `src/services/photos/background-crop-geometry.ts`
- `src/services/photos/background-pipeline.ts`
- `src/components/profile/ProfileBackgroundManager.tsx`
- `src/components/ui/overlay-base.tsx`
- `31-UAT.md`, `31-NATIVE-CHECKLIST.md`, and `evidence/31-13-debug/`

## Self-Check: PASSED
