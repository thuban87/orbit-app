---
phase: 31-profile-experience
plan: 13
subsystem: Profile background crop
tags: [photos, gestures, android, local-first]
status: complete
actuals:
  tasks: 3
  commits: 6
---

# Phase 31 Plan 13: Source-selection Profile crop summary

**Profile backgrounds now use a bounded source-pixel selection model, Modal-local Android gesture root, and accessible Fine tune controls.**

## Accomplishments

- Added deterministic contained selection, pan, focal pinch, textual state, and direct pipeline crop tests.
- Preserved the one-pass local JPEG derivative, UID-relative storage, release, and failure contracts.
- Added `GestureHandlerRootView` at the shared RN Modal root, a contained source preview, selection border, dimmed outside mask, and named Fine tune controls.
- Corrected the workspace integration after Pixel inspection: the source now fills the measured editor width while the Profile-aspect selection stays source-bounded.
- Installed the debug APK on the authorized physical Pixel with Metro and `adb reverse` active; captured debug device artifacts.

## Verification

- Focused crop/pipeline/target/model/sheet/overlay suites passed (17 tests).
- `npx tsc --noEmit`, `npm run check:colors`, and `git diff --check` passed.
- Debug APK build was run on droid and installed on the physical Pixel. No release build was used.

## Pending owner verification

Rows 43–44 are intentionally **PENDING OWNER**. Standard adb automation cannot create a trustworthy two-pointer pinch. The owner should open real portrait and landscape images in the debug crop editor, directly drag and pinch the selection, and confirm Fine tune state/control reachability.

The current physical Pixel screenshot is `evidence/31-13-debug/12-crop-full-width.png`; it shows the landscape source contained across the editor workspace rather than inside a Profile-shaped viewport.

After the workspace correction, Pixel capture `14-fine-tune-open.png` and its UI tree confirm that Fine tune remains open and exposes Reset, zoom, and named directional controls. A genuine two-pointer pinch remains the only required direct-touch observation that safe adb automation cannot establish.

## Deviations from Plan

### Auto-fixed issues

- **[Rule 1 - Gesture bug]** Re-clamped resized selection origins, added the dimmed outside-selection mask, and preserved the original focal-relative point during pinch.

## Files

- `src/services/photos/background-crop-geometry.ts`
- `src/services/photos/background-pipeline.ts`
- `src/components/profile/ProfileBackgroundManager.tsx`
- `src/components/ui/overlay-base.tsx`
- `31-UAT.md`, `31-NATIVE-CHECKLIST.md`, and `evidence/31-13-debug/`

## Self-Check: PASSED
