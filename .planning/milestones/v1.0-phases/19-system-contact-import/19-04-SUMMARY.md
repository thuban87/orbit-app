---
phase: 19-system-contact-import
plan: 04
subsystem: import
tags: [android-contact-picker, import-sessions, expo-file-system, react-navigation, reanimated]
requires:
  - phase: 19-01
    provides: durable import sessions and row lifecycle writers
  - phase: 19-02
    provides: Android Contact Picker snapshot contract
  - phase: 19-03
    provides: picked-contact mapping and atomic import writer
provides:
  - durable flat document-dir staging for accepted picker photos
  - single-contact review and atomic imported-row resolution
  - dashboard and Settings contact-import entry points
affects: [19-06, 19-07, 19-08, 19-09, 19-10, 19-11]
actuals:
  tokens: 13743
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [snapshot-then-drive import acquisition, flat recovery staging, shared import capability gate]
key-files:
  created:
    - src/services/import/import-acquire.ts
    - src/services/import/import-acquire.test.ts
    - src/screens/ImportReviewScreen.tsx
    - src/screens/use-import-leave-guard.ts
    - src/components/AddSpeedDialFab.tsx
  modified:
    - src/services/photos/photo-storage.ts
    - src/db/photo-relative-path.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/SettingsScreen.tsx
key-decisions:
  - "Accepted picker photos move into flat import-staging before the session transaction; a later DB failure leaves a reconcilable orphan."
  - "Staged photos use direct expo-image resolution and never pass through Avatar's avatars-only resolver."
  - "Leaving an unresolved review discards both its session rows and staged photos."
requirements-completed: [IMP-01, IMP-02, IMP-04]
coverage:
  - id: D1
    description: Durable acquisition creates a session, row, Unbound contact, resolved row, and complete session.
    requirement: IMP-04
    verification:
      - kind: integration
        ref: src/services/import/import-acquire.test.ts#single pick → one session + one row → one Unbound contact + row resolved imported + session complete
        status: pass
      - kind: unit
        ref: src/services/photos/photo-storage.test.ts#import staging — flat durable picker-cache namespace
        status: pass
    human_judgment: false
  - id: D2
    description: Android 17 picker, review, import, cancellation, and unsupported-state entry paths.
    requirement: IMP-01
    verification:
      - kind: manual_procedural
        ref: Android 17 device UAT runbook in 19-04-PLAN.md
        status: unknown
    human_judgment: true
    rationale: Native Android Contact Picker availability and end-to-end UI behavior require device interaction.
  - id: D3
    description: Reanimated speed dial routes single versus multi-pick acquisition.
    requirement: IMP-02
    verification:
      - kind: other
        ref: npx tsc --noEmit --pretty false; npm run check:colors
        status: pass
    human_judgment: true
    rationale: Animation, native picker selection, and touch targets require device interaction.
status: complete
---

# Phase 19 Plan 04: System Contact Import Tracer Summary

**A durable Android contact-picker tracer that stages photos, reviews one imported contact, atomically creates it as Unbound, and exposes safe dashboard and Settings entry points.**

## Performance

- **Tasks:** 3/3
- **Files modified:** 13
- **Verification:** import acquisition and photo-storage tests, TypeScript, colour checks, and Biome passed.

## Accomplishments

- Added a flat, validated `import-staging/` document-dir namespace with copy-to-temp, atomic move, enumeration, deletion, and preview-only URI resolution.
- Added `acceptPickedContacts`, `commitSingleImport`, and cardinality routing: cancellation writes nothing; one pick opens review; multiple picks target the registered bulk placeholder.
- Added Import Review navigation, field editing, direct staged-image preview, atomic contact-plus-row resolution, Settings and speed-dial launchers, old-Android gating, and unresolved-review cleanup.

## Task Commits

1. Task 1 — `ecac156` feat: durable single-contact import
2. Task 2 — `57acb93` feat: contact-import speed dial
3. Task 3 — `985e82d` feat: Settings entry and leave guard
4. Supporting verification/formatting — `2b1af6e`, `17d23d6`, `e71404f`

## Decisions Made

- Import staging is flat so the launch reconciliation lister can enumerate every file.
- `Avatar` remains restricted to canonical `avatars/` masters; import staging is previewed by direct `expo-image` URI.
- Accepted but unresolved sessions are discarded when review is left, including their staged files.

## Deviations from Plan

None - plan executed as specified. Formatter-only follow-up commits normalized the touched import files and tests.

## Known Stubs

- `ImportRoutePlaceholder` in `src/navigation/RootNavigator.tsx` intentionally keeps BulkImportSetup, ImportProgress, DuplicateReview, and ImportComplete runtime-reachable until plans 06–08 replace each placeholder.

## Issues Encountered

- Android 17 hardware is attached (SDK 37), but the full desktop-build APK/device UAT was not run in this executor. It remains required for native picker, cancellation, animation, and unsupported-state confirmation.

## Next Phase Readiness

- Plans 06–11 can rely on the stable import route parameters, acquisition seam, flat staging helpers, and direct staged-photo preview resolver.

## Self-Check: PASSED

- Created import acquisition, review, speed-dial, leave-guard, and staging files exist.
- All six implementation commits are present in local history.
