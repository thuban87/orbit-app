---
phase: 30-orrery-systems
plan: "09"
subsystem: ui
tags: [react-native, react-native-skia, reanimated, sqlite, orrery, systems]
requires:
  - phase: 30-02
    provides: database-facing draft membership resolution with Gravity input loading
  - phase: 30-08
    provides: System Builder draft state, atomic save routing, and discard/keep guard
  - phase: 29
    provides: shared Orrery world derivation, layout scale, and canvas lifecycle patterns
provides:
  - coherent provisional Orrery scenes for unsaved System membership
  - simplified full-canvas System Preview with pan/zoom and local-only body focus
  - Preview/Edit bar that retains the Builder's save and discard semantics
affects: [30-05-system-switcher, 30-10-orrery-system-observer, phase-30-device-uat]
actuals:
  tokens: 9838
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns: [coherent provisional scene read, tokenized simplified Skia preview, worklet-to-JS focus bridge]
key-files:
  created:
    - src/components/orrery/SystemPreviewCanvas.tsx
    - src/components/orrery/system-preview-logic.ts
  modified:
    - src/services/orrery-scene.ts
    - src/screens/SystemBuilderScreen.tsx
    - src/services/orrery-scene.test.ts
    - src/screens/SystemBuilderScreen.test.tsx
key-decisions:
  - "readProvisionalOrreryScene expands resolver IDs inside one inReadSnapshot and shares deriveOrreryWorld with the saved Orrery."
  - "Preview markers carry only id, world position, approximate size, and rail radius; they never receive photos or labels."
  - "Preview body taps focus only; Save calls the Builder's existing atomic save closure."
requirements-completed: [ORRS-07]
coverage:
  - id: D1
    description: Coherent provisional scene expansion, shared geometry, and sun exclusion.
    requirement: ORRS-07
    verification:
      - kind: integration
        ref: src/services/orrery-scene.test.ts#derives provisional System geometry from full records and keeps a resolved sun out of orbit
        status: pass
    human_judgment: false
  - id: D2
    description: Simplified marker projection, empty-state descriptor, and textual membership summary.
    requirement: ORRS-07
    verification:
      - kind: unit
        ref: src/components/orrery/system-preview-logic.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Full-canvas Preview interaction and largest-text reflow on a physical Pixel.
    requirement: ORRS-07
    verification: []
    human_judgment: true
    rationale: Skia responsiveness and Android text-scale layout need physical-device observation.
duration: 13min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 09: System Preview Summary

**System Builder now previews unsaved membership on the real Orrery world layout through a simplified, tokenized Skia canvas before the user saves.**

## Accomplishments

- Added `readProvisionalOrreryScene(exec, memberIds)`, which reads full contact records, Gravity inputs, preferences, profile, and sun occupant in one `inReadSnapshot`; it returns `{ preferences, contacts, world, extent, gravity, sun }` from the shared `deriveOrreryWorld` derivation.
- Added pure `buildPreviewMarkers(scene)` descriptors (`id`, `x`, `y`, `size`, `ringRadius`) and `previewMembershipSummary(records)`; no preview marker carries photo or label data.
- Added full-canvas pan/zoom Preview, explicit clipping, local-only marker focus, focus/AppState canvas unmounting, zero-member copy, and a Preview/Edit bar that invokes the exact existing Builder save closure.

## Task Commits

1. **Task 1: provisional scene seam and pure projection** — `87e3283` (RED), `f68b5e7` (GREEN)
2. **Task 2: Preview canvas and Builder wiring** — `ee7abb1` (RED), `96b5b8c` (GREEN)
3. **Worklet callback correction** — `b59d358` (fix)

## Verification

- Passed: `npx vitest run src/screens/SystemBuilderScreen.test.tsx src/components/orrery/system-preview-logic.test.ts src/services/orrery-scene.test.ts` — 20 tests.
- Passed: `npx tsc --noEmit -p tsconfig.json`, targeted Biome checks, and `npm run check:colors`.
- `npm test` reached 2,619 passing tests but retains two unrelated pre-existing Flow-parser suite failures: `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts` import `react-native/index.js`, which Rolldown cannot parse. No Plan 09 suite failed.

## Device UAT Carried Forward

- On the physical Pixel, verify simplified Preview rendering and responsiveness with a large System.
- At the largest supported text size, verify Preview/Edit bar and marker treatment remain usable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the Reanimated worklet-to-JS focus call argument-free.**

- **Found during:** Task 2
- **Issue:** Passing a React callback through the worklet as a `runOnJS` argument risks an invalid cross-runtime function transfer.
- **Fix:** Wrapped the local focus handler in a JS callback and passed only the selected contact ID over `runOnJS`.
- **Files modified:** `src/components/orrery/SystemPreviewCanvas.tsx`
- **Verification:** targeted Builder/preview tests, TypeScript, and colour gate passed.
- **Committed in:** `b59d358`

**Total deviations:** 1 auto-fixed (Rule 1).

## Known Stubs

None.

## Next Phase Readiness

The provisional-scene seam is ready for the remaining System consumers. The physical-device Preview UAT remains an end-of-phase backstop.

## Self-Check: PASSED

- Confirmed the canvas, projection logic, provisional-scene service, Builder integration, and this Summary exist on disk.
- Confirmed task commits `87e3283`, `f68b5e7`, `ee7abb1`, `96b5b8c`, and `b59d358` are present in local history.
