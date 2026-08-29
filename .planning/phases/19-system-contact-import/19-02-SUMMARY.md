---
phase: 19-system-contact-import
plan: 02
subsystem: android-native
tags: [expo-modules, kotlin, android-17, contact-picker, privacy]
requires:
  - phase: 18.1-contact-method-normalization
    provides: normalized contact-method and system-contact provenance foundation
provides:
  - Android 17-gated privacy-preserving system Contact Picker module
  - Typed JavaScript picker API with cache-only photo URI semantics
affects: [19-system-contact-import, import-review, Android build]
actuals:
  tokens: 2686
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - Expo local native module with Android runtime capability gate
    - Snapshot temporary OS grants to app-owned cache paths before JS receives results
key-files:
  created:
    - modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt
    - modules/orbit-contact-picker/index.ts
    - modules/orbit-contact-picker/src/OrbitContactPickerModule.ts
    - modules/orbit-contact-picker/src/OrbitContactPickerModule.web.ts
  modified: []
key-decisions:
  - "Use API-37 string-literal intent actions and extras plus an SDK_INT gate, avoiding an unnecessary build-SDK pin."
  - "Treat returned photoTempUri values as evictable app-cache copies; plan 04 owns durable staging."
patterns-established:
  - "Android-only picker APIs expose a web no-op so callers can use one availability probe."
requirements-completed: [IMP-01]
coverage:
  - id: D1
    description: Android contact-picker module has no broad contacts permission and is autolinked.
    requirement: IMP-01
    verification:
      - kind: integration
        ref: "grep permission check; npx expo-modules-autolinking search --platform android"
        status: pass
    human_judgment: true
    rationale: Android 17 device UAT must prove the new system picker, grant fields, and merged generated manifest.
  - id: D2
    description: Typed availability and selection API is safe on web and delegates to the Android native module.
    requirement: IMP-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit --pretty false; npx biome check modules/orbit-contact-picker/index.ts modules/orbit-contact-picker/src/OrbitContactPickerModule.ts modules/orbit-contact-picker/src/OrbitContactPickerModule.web.ts"
        status: pass
    human_judgment: false
duration: 2min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 02: Android Contact Picker Acquisition Summary

**Android 17-gated Expo module launches the permissionless system Contact Picker and snapshots selected contact fields plus app-cache photo copies through a typed JavaScript surface.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-29T08:23:55-05:00
- **Completed:** 2026-08-29T08:25:06-05:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added an Android-only `OrbitContactPicker` Expo module gated by `Build.VERSION.SDK_INT >= 37`.
- Launches the raw API-37 Contact Picker intent without declaring `READ_CONTACTS`, then copies selected values and photo data out of the temporary grant.
- Added typed JS exports and a web no-op; Expo autolinking discovers the local module without an `app.config.ts` plugin entry.

## Task Commits

1. **Task 1: Native Kotlin module — ACTION_PICK_CONTACTS + SDK_INT gate + copyToCache photo** - `c3811d8` (feat)
2. **Task 2: JS surface + web no-op + prebuild registration** - `95d7594` (feat)

## Files Created/Modified

- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` - API-37-gated picker, grant snapshotting, and cache-owned photo handling.
- `modules/orbit-contact-picker/android/build.gradle` - Expo Android library module configuration.
- `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` - Permission-free module manifest.
- `modules/orbit-contact-picker/expo-module.config.json` - Android module registration for Expo autolinking.
- `modules/orbit-contact-picker/index.ts` - Public `PickedContact` and `PickedMethod` types plus picker API.
- `modules/orbit-contact-picker/src/OrbitContactPickerModule.ts` - Native module wrapper.
- `modules/orbit-contact-picker/src/OrbitContactPickerModule.web.ts` - Unavailable-on-web no-op implementation.

## Decisions Made

- Used raw API-37 intent/extra literals and an SDK runtime gate, so no `expo-build-properties` SDK pin or `app.config.ts` change is needed.
- The native layer returns only plain field values and app-owned `file://` cache photo copies, never the temporary picker session URI.
- Cache copies are deliberately non-durable; plan 04 must move accepted photos to document-directory staging.

## Verification

- PASS: `npx tsc --noEmit --pretty false`.
- PASS: `npx biome check modules/orbit-contact-picker/index.ts modules/orbit-contact-picker/src/OrbitContactPickerModule.ts modules/orbit-contact-picker/src/OrbitContactPickerModule.web.ts`.
- PASS: `npx expo-modules-autolinking search --platform android` lists `orbit-contact-picker`.
- PASS: static scan confirms no `READ_CONTACTS` text in `modules/orbit-contact-picker/`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The Android 17 API's exact runtime field behavior (birthday/photo support and string-literal extras) cannot be verified on this host. The planned plan-04 tracer device UAT remains responsible for confirming it, including a generated merged-manifest `READ_CONTACTS` scan after prebuild.

## User Setup Required

Android 17 (API 37) must be installed on the desktop build host and an Android 17 device is needed for the tracer verification.

## Next Phase Readiness

Downstream import UI can gate entry points with `isContactPickerAvailable()` and receive grant-safe `PickedContact[]` snapshots. Device verification remains queued in plan 04.

## Self-Check: PASSED

- All seven module files exist.
- Task commits `c3811d8` and `95d7594` exist in local history.

---
*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
