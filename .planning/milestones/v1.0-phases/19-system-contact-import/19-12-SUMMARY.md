---
phase: 19-system-contact-import
plan: 12
subsystem: android-native-import
tags: [android-17, contact-picker, expo-modules-kotlin, reliability]
requires:
  - phase: 19-02
    provides: Android Contact Picker native bridge and session snapshot contract
  - phase: 19-04
    provides: Add and Settings import entry points wired to the bridge
provides:
  - documented Android 17 Contact Picker intent action
  - recoverable synchronous picker-launch failures
affects: [19-17, system-contact-import, IMP-01]
actuals:
  tokens: 508
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [API-37 string-literal contracts, sanitized native promise rejection]
key-files:
  created: []
  modified:
    - modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt
key-decisions:
  - "The Android 17 picker action remains a literal so the module builds without API-37 SDK constants."
  - "Synchronous launch errors reset module state and reject with a coded, sanitized error."
requirements-completed: [IMP-01]
coverage:
  - id: D1
    description: "Native picker intent uses Android's documented provider action while retaining birthday and photo field requests."
    requirement: IMP-01
    verification:
      - kind: other
        ref: "grep action/Event/Photo static contract checks"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed native picker launch clears its pending request and settles the promise."
    requirement: IMP-01
    verification:
      - kind: other
        ref: "grep pendingPickPromise reset and guarded startActivityForResult contract checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "Import launches the Android 17 system Contact Picker on a physical device and permits a later retry after a launch failure."
    requirement: IMP-01
    verification:
      - kind: manual_procedural
        ref: "Phase 19 Plan 17 Android device UAT"
        status: unknown
    human_judgment: true
    rationale: "System activity resolution and retry behavior require the planned Android 17 device drive."
duration: 4min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 12: Contact Picker Action and Launch Recovery Summary

**Android 17 Contact Picker launches through the documented provider action and cannot remain permanently busy after a synchronous launch failure.**

## Performance

- **Duration:** 4min
- **Started:** 2026-08-29T18:06:05Z
- **Completed:** 2026-08-29T18:10:05Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Corrected the native launch action to `android.provider.action.PICK_CONTACTS` without relying on API-37 SDK constants.
- Preserved Event and Photo requested fields and their existing result-cursor handling for birthday and photo import.
- Added a launch failure reset plus sanitized coded rejection, so the next picker request is not blocked by stale module state.

## Task Commits

1. **Task 1: Target the documented Android 17 Contact Picker action** - `0be1fdb` (fix)
2. **Task 2: Guard the picker launch so a synchronous failure never wedges the module** - `ebb38d2` (fix)

## Files Created/Modified

- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` - Targets the platform Contact Picker and safely settles failed launches.

## Decisions Made

- Kept the action and extras as API-37 string literals because the native module intentionally compiles against the existing Expo toolchain.
- Used an internal `CodedException` with generic text so native activity/provider details and stack data never cross the JS boundary.

## Verification

- Static contracts passed: provider action count `1`, Event count `2`, Photo count `2`, pending-promise reset count `2`.
- `git diff --check` passed for the Kotlin module.
- Android 17 launch and retry behavior remain intentionally scheduled for the agent-driven physical-device UAT in Plan 19-17.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 19-17 can now validate the actual picker launch and a post-failure retry on Android 17 hardware.

## Self-Check: PASSED

- Kotlin module and summary file exist.
- Task commits `0be1fdb` and `ebb38d2` exist in local history.
