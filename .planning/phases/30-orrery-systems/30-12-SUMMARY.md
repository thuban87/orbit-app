---
phase: 30-orrery-systems
plan: 12
subsystem: ui
tags: [orrery, animation, skia, reanimated, android, pixel, reduced-motion]
requires:
  - phase: 30-orrery-systems
    plan: 11
    provides: deterministic five-stage choreography, membership-delta scaling, re-targeting, and Reduced Motion semantics
  - phase: 29-orrery-camera-scale-exploration
    provides: canonical Home camera and single world-to-projection frame pipeline
provides:
  - screen-owned UI-thread switch runtime integrated into the live Orrery
  - fluid retained/leaving/entering choreography across canvas unmount and lifecycle pause
  - canonical Home camera coordination and displayed-sample re-targeting
  - physical Pixel fixture matrix, recordings, debug install, and owner-approved release APK
  - owner-approved normal and Reduced Motion System switching satisfying ORRS-13
affects: [orrery, system-switching, physical-device-uat, phase-30-verification]
actuals:
  tokens: 12056
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - screen-owned SharedValue runtime surviving conditional Skia canvas mounts
    - discrete Zustand scene publication filtered from persistence-only updates
    - physical Pixel visual approval after deterministic worklet tests
key-files:
  created:
    - src/components/orrery/use-orrery-switch-runtime.ts
    - src/components/orrery/orrery-switch-runtime.test.ts
    - .planning/phases/30-orrery-systems/30-12-DEVICE.md
  modified:
    - src/components/orrery/OrreryWorld.tsx
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/orrery-frame-mapper.test.ts
    - src/components/orrery/orrery-switch-animation.ts
    - src/components/orrery/orrery-switch-animation.test.ts
key-decisions:
  - "The switch runtime belongs to OrreryScreen above the conditional OrreryWorld mount, so lifecycle unmounts cannot discard displayed transition state."
  - "Persistence-only Zustand publications are not scene changes and must never restart or settle the UI-thread choreography."
  - "ORRS-13 closes only from physical-Pixel owner approval; the owner approved normal motion and confirmed Reduced Motion switches to no animation."
patterns-established:
  - "Discrete publication, continuous sampling: React publishes scene/lifecycle boundaries while Reanimated and Skia own every animation frame."
  - "Lifecycle hold: pause cancels the UI-thread driver at its exact sample, then remounts that sample before resuming remaining duration."
requirements-completed: [ORRS-13]
coverage:
  - id: D1
    description: Live System switching visibly accelerates, sheds leaving contacts, preserves retained contacts, captures entering contacts, and settles exactly at destination Home.
    requirement: ORRS-13
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-switch-runtime.test.ts
        status: pass
      - kind: automated_ui
        ref: /tmp/orbit-30-12-evidence/normal-3-to-9-fixed.mp4 and normal-9-to-3-fixed.mp4
        status: pass
      - kind: manual_procedural
        ref: Owner approval of the normal-motion choreography on the physical Pixel
        status: pass
    human_judgment: true
    rationale: Fluidity, visual stage legibility, and membership-delta drama require owner judgment on the physical Pixel; the owner approved the result.
  - id: D2
    description: Re-target, lifecycle pause/resume, retained focus, destination input, and non-Home-to-canonical-Home continuity preserve the displayed sample without snap.
    requirement: ORRS-13
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-switch-runtime.test.ts and src/components/orrery/orrery-frame-mapper.test.ts
        status: pass
      - kind: automated_ui
        ref: /tmp/orbit-30-12-evidence/rapid-retarget.mp4, blur-resume.mp4, background-resume.mp4, and nonhome-to-home.mp4
        status: pass
    human_judgment: false
  - id: D3
    description: Android Reduced Motion replaces rotational peel/capture choreography with the simple non-spectacle alternative.
    requirement: ORRS-13
    verification:
      - kind: unit
        ref: src/logic/orrery-switch-choreography.test.ts and src/components/orrery/orrery-switch-runtime.test.ts
        status: pass
      - kind: manual_procedural
        ref: 'Owner confirmation: "Confirmed the reduced motion change works well, switches to no animation really"'
        status: pass
    human_judgment: true
    rationale: Android accessibility behavior and the perceived absence of spectacle require physical-device confirmation; the owner explicitly confirmed it.
  - id: D4
    description: Fresh debug and release Android artifacts were built on droid, with debug installed on the physical Pixel and release retained for the owner.
    requirement: ORRS-13
    verification:
      - kind: manual_procedural
        ref: .planning/phases/30-orrery-systems/30-12-DEVICE.md
        status: pass
      - kind: other
        ref: ssh droid release artifact existence check
        status: pass
    human_judgment: false
duration: 1h 45min
completed: 2026-09-09
status: complete
---

# Phase 30 Plan 12: Live System-switch Choreography Summary

**The full five-stage System-switch choreography now runs continuously on the Skia/Reanimated UI-thread path, survives lifecycle unmounts, lands at canonical Home, and is approved on the physical Pixel in both normal and Reduced Motion modes.**

## Performance

- **Duration:** 1h 45min across implementation, Pixel diagnosis, build, and owner approval
- **Started:** 2026-09-08T22:50:00-05:00
- **Completed:** 2026-09-09T00:45:00-05:00
- **Tasks:** 3
- **Files modified:** 10 implementation/test/evidence files

## Accomplishments

- Integrated Plan 11's accelerate, shed, capture, and settle sampler into one screen-owned UI-thread runtime instead of driving animation through React publications.
- Preserved exact displayed world, camera, resources, roles, and held progress through re-targeting, navigation blur, AppState background, and OrreryWorld remount.
- Coordinated arbitrary source camera state continuously into exact destination canonical Home, with shared frame authority for rings, bodies, labels, visibility, and hit testing.
- Found and fixed the real physical-device blocker: persistence status publications were replacing active motion with a settled scene after only a few visible steps.
- Exercised the membership-delta fixture matrix on Pixel 6 Pro, installed a fresh debug APK, restored the original adb reverse, and retained a fresh release APK on droid.
- Recorded the owner's explicit approval of normal motion and the final Reduced Motion confirmation: "Confirmed the reduced motion change works well, switches to no animation really."

## Task Commits

1. **Task 1 RED: screen-owned runtime and live choreography contract** — `8874f56`
2. **Task 1 GREEN: integrate staged choreography into the live Orrery** — `7bdf2a2`
3. **Task 2: preserve active choreography and record Pixel/build evidence** — `95246e2`

Task 3 is the owner-approval checkpoint recorded by this summary; it required no implementation change.

## Files Created/Modified

- `src/components/orrery/use-orrery-switch-runtime.ts` — persistent SharedValue transition, camera, resource, pause/resume, and re-target owner.
- `src/components/orrery/orrery-switch-runtime.test.ts` — runtime boundary, interruption, lifecycle hold, and exact completion coverage.
- `src/components/orrery/OrreryWorld.tsx` — pure consumer of the retained runtime's single projected frame.
- `src/screens/OrreryScreen.tsx` — publishes discrete scene/lifecycle events and owns runtime above the canvas mount gate.
- `src/components/orrery/orrery-frame-mapper.test.ts` — compiled worklet-closure and phase-sampling harness.
- `src/components/orrery/orrery-switch-animation.ts` — filters persistence-only store publications from genuine scene changes.
- `src/components/orrery/orrery-switch-animation.test.ts` — regression coverage for the physical-device early-settle blocker.
- `.planning/phases/30-orrery-systems/30-12-DEVICE.md` — Pixel fixtures, recordings, diagnostics, build/install evidence, reverse restoration, and release artifact hash.

## Decisions Made

- Kept all frame-by-frame motion on the existing Skia/Reanimated path. React owns only discrete scene, lifecycle, and selection publications.
- Kept the runtime above OrreryWorld so conditional canvas unmount is a consumer lifecycle event rather than transition destruction.
- Treated the early-settle Pixel result as an implementation defect, not a tuning problem. The correct seam was store-publication filtering; spectacle constants did not need compensating changes.
- Accepted ORRS-13 only after the owner's physical-Pixel approval covered both normal choreography and Reduced Motion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Persistence publications prematurely settled live choreography**

- **Found during:** Task 2 physical-Pixel fixture testing
- **Issue:** The ready scene correctly started a 2100 ms UI-thread driver, but subsequent `persistence: saving/saved` Zustand publications carried no switch source and republished the same snapshot as an immediate settled scene.
- **Fix:** Added `shouldPublishSwitchScene` and ignored publications whose status, generation, and snapshot identity did not change.
- **Files modified:** `src/screens/OrreryScreen.tsx`, `src/components/orrery/orrery-switch-animation.ts`, and its test.
- **Verification:** 55 focused tests passed; pre/post Pixel recordings show the difference between a few steps and the full fluid choreography.
- **Committed in:** `95246e2`

**2. [Rule 3 - Blocking] Device fixture membership was insufficient**

- **Found during:** Task 2 physical-Pixel setup
- **Issue:** The debug database had six active contacts, two favorites, and no category assignments, so the required 3-to-9, high-overlap, and disjoint matrix could not be exercised.
- **Fix:** Backed up the exact DB database/WAL/SHM trio, then created device-only UAT memberships from existing test contacts. The original remains recoverable at the paths recorded in `30-12-DEVICE.md`.
- **Files modified:** Physical debug database only; no production schema or application data path changed.
- **Verification:** Pixel selector reported All 9, Favorites 8, Family 3, Friends 3, and Work 3, and each core motion fixture was recorded.

---

**Total deviations:** 2 auto-fixed (one correctness bug, one device-fixture blocker)
**Impact on plan:** Both fixes were necessary to execute the approved contract; neither weakened D-11 or introduced a React frame loop.

## Issues Encountered

- The literal `tcp:8082 tcp:8082` reverse could not serve a standard debug client requesting device port 8081. The effective temporary mapping was device `tcp:8081` to host Metro `tcp:8082`, then restored to `tcp:8081 tcp:8081`.
- Full validation retained three unrelated stale migration-target assertions (`22` versus current `23`). One load-related framing-test timeout passed immediately when rerun alone. Focused Plan 12 validation remained 55/55.
- ADB-injected selector row presses were unreliable during the executor's animator-scale-zero debug attempts. This was not represented as a pass; the owner subsequently exercised the release build and explicitly approved the Reduced Motion result.

## User Setup Required

None. The release APK remains at:

`C:\Users\bwales\projects\orbit-app\android\app\build\outputs\apk\release\app-release.apk`

## Owner Approval

The owner had already accepted the bulk normal-motion phase result and identified Reduced Motion as the sole remaining acceptance check. After testing it on the physical Pixel, the owner confirmed verbatim:

> Confirmed the reduced motion change works well, switches to no animation really

Together, those statements explicitly approve the five-stage normal choreography and its Reduced Motion alternative. ORRS-13 is complete. This plan summary does **not** mark the entire phase complete; phase-level UAT and verification reconciliation remain with the root orchestrator.

## Next Phase Readiness

- Plan 30-12 and ORRS-13 are complete with physical-device owner approval.
- The root orchestrator can reconcile the remaining Phase 30 UAT/verification artifacts without rerunning this plan or weakening its approval gate.
- No release rebuild is needed unless source changes after `95246e2`.

## Self-Check: PASSED

- Task commits `8874f56`, `7bdf2a2`, and `95246e2` exist.
- Device evidence exists at `.planning/phases/30-orrery-systems/30-12-DEVICE.md`.
- The focused eight-suite validation passed: 8 files, 55 tests.
- The droid release artifact existence check returned `RELEASE_READY`.
- `requirements-completed` records ORRS-13, backed by the owner's explicit physical-device approval.

---
*Phase: 30-orrery-systems, Plan 12*
*Completed: 2026-09-09*
