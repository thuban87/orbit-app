---
phase: 31
fixed_at: 2026-09-09T22:29:14-05:00
review_path: /home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/31-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 31: Code Review Fix Report

**Fixed at:** 2026-09-09T22:29:14-05:00
**Source review:** `/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/31-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Local background render errors never remain on the solid fallback

**Files modified:** `src/components/ui/BackgroundHost.tsx`, `src/components/ui/background-host-model.ts`, `src/components/ui/background-host-model.test.ts`
**Commit:** e7db666
**Applied fix:** Preserved the validated app-owned URI in the selection key, so an image `onError` suppresses rendering but cannot reset its own solid-fallback latch. The regression test proves the latch clears only for a distinct original URI.

### CR-02: “Save as template” drops the layout editor’s draft and can save stale data

**Files modified:** `src/screens/ContactProfileScreen.tsx`, `src/components/profile/ProfileTemplateManager.tsx`, `src/profile/template-manager-model.ts`, `src/profile/template-manager-model.test.ts`
**Commit:** 3c4ac77
**Applied fix:** Kept the canonical editor draft in screen state, passed it into the template manager ahead of persisted freeform state, and clear it only after create/cancel resolution. The manager now hides the save-current action when no supplied or freeform layout exists; its integration contract covers edited order and collapsed defaults from an inherited layout.

### CR-03: Imported-background crop geometry is landscape while the rendered Profile background is portrait/full-screen

**Files modified:** `src/components/profile/ProfileBackgroundManager.tsx`, `src/services/photos/profile-background-target.ts`, `src/services/photos/profile-background-target.test.ts`, `src/services/photos/background-crop-geometry.test.ts`, `src/services/photos/background-pipeline.test.ts`
**Commit:** 341ce5c
**Applied fix:** Replaced the fixed 360×240 target with one shared target derived from the current Profile window. Preview and derivative output now share that aspect; output is capped at a 2048px long edge for bounded local storage. Geometry coverage exercises portrait, landscape, and square source photos.

**Status:** fixed: requires human verification of the release/device crop view.

### WR-01: Background-template deletion errors escape without feedback or recovery

**Files modified:** `src/components/profile/ProfileBackgroundManager.tsx`, `src/profile/background-manager-model.ts`, `src/profile/background-manager-model.test.ts`
**Commit:** 86929cf
**Applied fix:** Wrapped deletion in recovery handling that logs rejections, shows a retryable list error, and refreshes only after the transactional deletion succeeds. The regression test verifies no refresh or commit callback occurs on rejection.

## Verification

Verification ran in the **main checkout** (`workflow.use_worktrees=false`), not an isolated worktree.

- Focused Vitest suite: 10 files / 56 tests passed.
- `npx tsc --noEmit` passed.
- `npm run check:colors` passed.
- `git diff --check` passed.

## Focused Crop Follow-up

The first device-oriented redesign in `00d9c56` made the crop controls
reachable, but a focused full-subsystem review found that the full-window
preview was still clipped inside the 92%-height Sheet. Commit `91cc837` fixed
that remaining blocker by measuring only the in-flow space between the header
and controls, fitting the complete Profile-aspect preview within it, and using
that same display aspect for crop geometry while retaining the bounded 2048px
output.

- Pure fit regression coverage exercises both normal and enlarged-text control
  footprints.
- The full suite passed 319 files / 2845 tests; TypeScript, Biome, colour, and
  whitespace checks passed.
- The final standalone release on the Pixel exposed an unobstructed 838×1816
  preview, all named controls, Cancel, and Use background.
- Final APK SHA-256:
  `fdda5f69ba95b794b847bc78e9b821c6b4fbbcf38671bbf11d48f08eaf60532d`.

---

_Fixed: 2026-09-09T22:29:14-05:00_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
