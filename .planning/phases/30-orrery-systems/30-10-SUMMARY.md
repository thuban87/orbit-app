---
phase: 30-orrery-systems
plan: 10
subsystem: ui
tags: [orrery, skia, reanimated, zustand, system-selection, reduced-motion]
requires:
  - phase: 30-01
    provides: System snapshots including custom-system broken-rule diagnostics
  - phase: 30-02
    provides: durable Orrery preferences and local System selection store
provides:
  - Membership-delta-adaptive System switch presentation
  - Commit-origin guarded live cross-route System reconciliation
  - Missing-custom restore fallback to All Contacts
affects: [30-06, 30-08, orrery, settings, custom-systems]
actuals:
  tokens: 7617
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - Shared-value switch intensity modulates the existing frame transition
    - committedOrigin identifies actual preference publications without phantom local echoes
key-files:
  created:
    - src/components/orrery/orrery-switch-animation.ts
  modified:
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/stores/orrery-preferences-store.ts
    - src/logic/orrery-frame.ts
key-decisions:
  - "Selection reconciliation keys off a committed-origin token, never a pre-recorded ref ledger."
  - "A preserved focus remains selected on a System switch, while the camera still frames canonical Home."
  - "Switch spin transforms the existing frame pipeline rather than adding a competing membership transition."
patterns-established:
  - "Only real in-session System changes may drive switch intensity or force Home framing; reloads and session restores do neither."
  - "Skia mapper tests must register every new derived-worklet shared-value capture."
requirements-completed: [ORRS-12, ORRS-13]
coverage:
  - id: D1
    description: Membership-delta intensity, focus retention, Home framing, and zero-intensity reload behavior.
    requirement: ORRS-12
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-switch-animation.test.ts
        status: pass
      - kind: automated_ui
        ref: src/screens/orrery-screen-framing.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Render-loop switch spin and Reduced Motion suppression through the existing frame transition.
    requirement: ORRS-13
    verification:
      - kind: unit
        ref: src/logic/orrery-frame.test.ts
        status: pass
      - kind: automated_ui
        ref: src/components/orrery/orrery-frame-mapper.test.ts
        status: pass
    human_judgment: true
    rationale: Physical Pixel verification is required to judge Skia smoothness and reduced-motion presentation.
duration: 12min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 10: Orrery System Switching Summary

**Durable live System selection now lands at canonical Home with shared-focus retention and a membership-delta-scaled Skia spin/shed/capture transition.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-08T15:58:14-05:00
- **Completed:** 2026-09-08T16:08:44-05:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added pure, count-independent membership delta/intensity math plus focus and framing selection helpers.
- Reconciled the global committed last-System preference into OrreryScreen's local store. Commits from the local adapter carry `LOCAL_SELECT_ORIGIN`; foreign writers trigger a live selection, while stale local B→C publications cannot reverse C.
- Published `committedOrigin` only upon a real successful `lastSystem` commit, so no-op, failed, or coalesced saves cannot leak a phantom self-echo guard.
- Replaced unconditional focus clearing: a singular focus present in source and destination remains selected, but a real switch forces `deriveHomePose`; same-System reloads retain ordinary focus framing and session restore retains its saved pose/focus.
- Added stale custom-System fallback to All Contacts and the active custom-rule needs-attention affordance.
- Modulated the existing `beginWorldTransition`/`sampleWorldTransition` frame path with a shared intensity and reversible per-body spin; Reduced Motion suppresses both modulation and rotational sweep.

## Task Commits

1. **Task 1: Pure switch-transition math** — `0bc1c98` (RED test), `08a78f9` (implementation)
2. **Task 2: Switch selection, focus, persistence, fallback, and affordance wiring** — `3834fd3`
3. **Task 3: Existing frame pipeline intensity/spin modulation** — `b74c230`
4. **Task 3 regression coverage** — `e549b3e`
5. **Cross-route failure-edge correction** — `807ae0c`

## Decisions Made

- Intensity is the symmetric membership-turnover fraction, not a raw-count measure: larger overlap is subtle and complete turnover reaches one.
- The observer compares `committedOrigin` with `LOCAL_SELECT_ORIGIN`, rather than maintaining a speculative value ledger. This prevents both a stale B→C self-commit reversal and a no-op/failed-save phantom from swallowing a later external write.
- The switch token is created only from a ready-to-loading requested-System change after an in-session ready state. Same-System reloads and `sessionResume === "restore"` remain zero-intensity and never force Home.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registered new worklet captures in the native frame-mapper regression test**
- **Found during:** Task 3 full-suite verification
- **Issue:** The mapper test could not execute the compiled derived frame closure after it began capturing `reducedMotion`, `switchIntensity`, and `spinSwitchWorld`.
- **Fix:** Added those real closure dependencies to the mapper harness.
- **Files modified:** `src/components/orrery/orrery-frame-mapper.test.ts`
- **Verification:** Targeted mapper test passes.
- **Commit:** `e549b3e`

**2. [Rule 1 - Bug] Allowed a foreign same-ref selection to republish after a local write failure**
- **Found during:** Final cross-route persistence review
- **Issue:** A failed local save left a pending same-ref intent, which could make a later genuine external writer of that ref look like a no-op and retain the local origin.
- **Fix:** A foreign origin may reassert the pending same `lastSystem`, producing its own real commit and observer-visible origin token.
- **Files modified:** `src/stores/orrery-preferences-store.ts`, `src/stores/orrery-preferences-store.test.ts`
- **Verification:** Preference store test covers the failed-local then foreign-same-ref sequence.
- **Commit:** `807ae0c`

## Issues Encountered

- `npm test` runs 2,600 tests successfully but remains nonzero because the known `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts` suites hit Vitest/Rolldown's React Native Flow parser limitation. This was not masked or changed. The former Task 3 mapper failure is resolved.

## Device UAT Required

- On the physical Pixel, switch between Systems with small and large membership deltas; confirm spin/shed/capture intensity scales accordingly and input remains usable.
- Enable OS Reduced Motion; confirm only crossfade/reposition remains, with no rotational sweep.
- Verify a shared focused contact stays selected through a switch while the camera lands at Home, and confirm a stale persisted custom System falls back to All Contacts.

## Next Phase Readiness

Phase 30's management and builder routes can persist `lastSystem` without an origin argument; OrreryScreen will apply those commits live. Device tuning remains an end-of-phase requirement.

---
*Phase: 30-orrery-systems*
*Completed: 2026-09-08*

## Self-Check: PASSED

- Summary exists and all task commits (`0bc1c98`, `08a78f9`, `3834fd3`, `b74c230`, `e549b3e`, `807ae0c`) exist in git history.
