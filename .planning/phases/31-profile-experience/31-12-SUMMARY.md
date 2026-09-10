---
phase: 31-profile-experience
plan: 12
subsystem: ui
tags: [react-native, expo, android, release-apk, profile, backgrounds, webp]
requires:
  - phase: 31-11
    provides: repaired Profile presentation renderer and focused regression suite
provides:
  - owner-approved bundled Galaxy and Standard background art in the established slots
  - standalone-release Pixel evidence for the five repaired Profile gaps
  - release-build source-set repair for react-native-screens codegen and safe Sheet geometry
affects: [profile, android-release, background-assets, native-uat]
actuals:
  tokens: 7004
  tasks: 4
  commits: 4
tech-stack:
  added: [patch-package patch for react-native-screens 4.26.2]
  patterns: [approved local-art provenance, physical-Pixel release evidence, full-height overlay content for percentage detail sheets]
key-files:
  created:
    - .planning/phases/31-profile-experience/evidence/31-12-art/contact-sheet.png
    - .planning/phases/31-profile-experience/evidence/31-12-release/release-layout-chooser-fixed.png
    - patches/react-native-screens+4.26.2.patch
  modified:
    - assets/backgrounds/README.md
    - src/components/ui/Sheet.tsx
    - .planning/phases/31-profile-experience/31-NATIVE-CHECKLIST.md
    - docs/systems/profile.md
key-decisions:
  - "Adopted the complete owner-approved eight-slot art board without changing IDs, mappings, defaults, or local-only delivery."
  - "Kept nonempty background, crop, accessibility, and varied-data Pixel checks owner-gated instead of fabricating destructive device state."
  - "Preserved the selected Galaxy device theme after Standard release inspection."
patterns-established:
  - "Release claims use an installed droid-built APK, one dynamically resolved physical Pixel, persisted screenshots, and direct image inspection."
  - "Percentage-height detail sheets receive a concrete full-height overlay parent so bottom actions cannot clip at large font scales."
requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-08, PROF-18, PROF-20]
coverage:
  - id: D1
    description: Owner-approved local background bundle with resolver and AA coverage
    requirement: PROF-01
    verification:
      - kind: unit
        ref: npx vitest run src/theme/backgrounds.test.ts src/theme/tokens/surface.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Release Profile renderer, background host, chooser/editor, and manager evidence
    requirement: PROF-02
    verification:
      - kind: automated_ui
        ref: .planning/phases/31-profile-experience/evidence/31-12-release/release-layout-chooser-fixed.png
        status: pass
      - kind: unit
        ref: npx vitest run src/components/ui/sheet-contract.test.ts src/profile/layout-editor-session.test.ts src/profile/background-manager-model.test.ts
        status: pass
    human_judgment: true
    rationale: Physical-device visual quality, crop gestures, assistive technology, and varied owner data require owner review.
status: complete
---

# Phase 31 Plan 12: Approved Background Art and Release Profile Verification Summary

**Eight owner-approved local Galaxy/Standard WebPs, a repaired standalone Android release, and inspected Pixel evidence for the Profile background, sheet, manager, collapse, and compact-header gaps.**

## Performance

- **Duration:** 2h 2m
- **Started:** 2026-09-09T20:04:53-05:00
- **Completed:** 2026-09-09T22:07:02-05:00
- **Tasks:** 4/4
- **Files modified:** 48 (including eight production assets and persisted evidence)

## Accomplishments

- Recorded the owner's complete approval of the eight-slot art board and adopted the exact approved bytes into every existing local WebP path, with provenance and measured brightness retained in the asset README.
- Built a standalone release APK on droid, installed it on the authorized Pixel 6 Pro, and directly inspected Galaxy/Standard factory Profile, overflow, repaired layout chooser/editor, and real empty Background manager evidence.
- Repaired a release-only `react-native-screens` codegen class omission and the shared percentage-sheet geometry that clipped the layout chooser action at the owner's 1.15 font scale.
- Resumed the native checklist with objective release evidence while leaving subjective, varied-data, crop, accessibility, and local-media acceptance explicitly owner-gated.

## Verification

- `npx vitest run src/theme/backgrounds.test.ts src/theme/tokens/surface.test.ts` — 39 passed.
- Final focused release suite (`sheet-contract`, layout editor/session, background manager model, presentation schema/resolver, backgrounds/surface, Profile logic, and origin integration) — 78 passed across 9 files.
- `npx tsc --noEmit` and `npm run check:colors` — passed.
- Droid release pipeline rebuilt successfully after `npm ci` applied `react-native-screens@4.26.2`; the final release APK contained both `ScreenContainerViewManager` and its generated `RNSScreenContainerManagerInterface`, installed successfully, and launched Orbit on Pixel 6 Pro.
- The final release APK remains at `C:\\Users\\bwales\\projects\\orbit-app\\android\\app\\build\\outputs\\apk\\release\\app-release.apk`.

## Task Commits

1. **Task 1: Generate the eight named local background candidates and one contact sheet** — `986c25a` (`docs`)
2. **Task 2: Owner approves the complete eight-slot art direction** — `86d6907` (`docs`)
3. **Task 3: Adopt approved art into the eight existing bundled WebP slots** — `49e83da` (`feat`)
4. **Task 4: Verify the release renderer and resume the remaining native checklist** — `093fbf2` (`fix`)

## Files Created/Modified

- `assets/backgrounds/*.webp` — exact approved art replaces all eight established bundled slots.
- `assets/backgrounds/README.md` — source, owner approval, dimensions, and brightness measurements.
- `patches/react-native-screens+4.26.2.patch` — compiles generated Java code into the release module source set.
- `src/components/ui/Sheet.tsx` — gives percentage-height detail sheets a concrete full-height parent.
- `31-NATIVE-CHECKLIST.md` and `evidence/31-12-release/` — final release observations, inspected PNGs, and UI-bound evidence.
- `docs/systems/profile.md` — observed release-only Profile system contract update.

## Decisions Made

- The complete eight-slot approval was treated as one decision, as requested; no slot mapping, order, default, resolver behavior, or network boundary changed.
- Only real, non-destructive Pixel states were captured. Background loaded/error/populated, crop, TalkBack, light-mode, and varied-data rows remain for owner acceptance instead of receiving fabricated proof.
- Galaxy was restored after Standard inspection; no persisted contact layout or background assignment was created during evidence capture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking release build] Included react-native-screens generated codegen Java sources**

- **Found during:** Task 4
- **Issue:** The initially installed release APK crashed while loading `ScreenContainerViewManager` because its generated `RNSScreenContainerManagerInterface` was absent from the packaged build.
- **Fix:** Added the module's generated codegen Java directory to its Android source set through a version-pinned `patch-package` patch.
- **Files modified:** `patches/react-native-screens+4.26.2.patch`
- **Verification:** Clean droid release rebuild, APK dex inspection, successful install, and Pixel launch.
- **Committed in:** `093fbf2`

**2. [Rule 1 - UI bug] Gave detail sheets a concrete percentage-height parent**

- **Found during:** Task 4
- **Issue:** At the owner's 1.15 font scale, the layout chooser's `Edit layout` action was clipped to a 47-pixel target.
- **Fix:** Made the shared overlay content flex to the full screen and bottom-align its sheet.
- **Files modified:** `src/components/ui/Sheet.tsx`
- **Verification:** Focused suite passed; final release chooser shows a fully visible 161-pixel action and a visible Close action.
- **Committed in:** `093fbf2`

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1).

## Known Stubs

None. The deliberately unexercised Pixel states are owner-acceptance scenarios, not unwired UI data or placeholder behavior.

## Issues Encountered

- The original release launch and first chooser capture exposed concrete defects. Both were repaired, rebuilt, and re-evidenced; neither is a waiver.
- The remaining native rows require owner-controlled local media, screen-reader, varied contact data, crop gestures, and subjective visual judgment. They are recorded as `PENDING OWNER` in the checklist rather than self-approved.

## User Setup Required

None. The owner can install the already-built standalone APK from the documented droid output path.

## Next Phase Readiness

The implementation and objective release evidence are ready. Phase 31's final owner acceptance is still required for the explicitly pending rows in `31-NATIVE-CHECKLIST.md`; that approval is not implied by this plan's earlier art approval.

## Self-Check: PASSED

Verified the summary, final chooser capture, approved production asset, release-build
patch, and all four task commits exist. `git diff --check` passed before the
summary commit.

---

*Phase: 31-profile-experience*
*Completed: 2026-09-09*
