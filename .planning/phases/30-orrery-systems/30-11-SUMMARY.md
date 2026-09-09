---
phase: 30-orrery-systems
plan: 11
subsystem: ui
tags: [orrery, animation, skia, reanimated, choreography, reduced-motion]
requires:
  - phase: 29-orrery-camera-scale-exploration
    provides: single canonical world-to-projection frame pipeline
  - phase: 30-orrery-systems
    provides: System membership delta math and scene-generation switching
provides:
  - deterministic retained/leaving/entering/anchor choreography state
  - staged forward rotation, outward shedding, inward capture, and exact settle sampler
  - displayed-sample re-targeting and non-rotational Reduced Motion semantics
  - one choreography world feeding projection, rings, visibility, and hit authority
affects: [30-12, OrreryWorld, OrreryScreen, system-switch-runtime]
actuals:
  tokens: 7604
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - pure elapsed-progress worklet sampler
    - stable-key role classification and deterministic stagger
key-files:
  created:
    - src/logic/orrery-switch-choreography.ts
    - src/logic/orrery-switch-choreography.test.ts
  modified:
    - src/logic/orrery-frame.ts
    - src/logic/orrery-frame.test.ts
    - src/components/orrery/orrery-switch-animation.ts
    - src/components/orrery/orrery-switch-animation.test.ts
key-decisions:
  - "Rotation integrates a positive velocity envelope and ends on whole turns, preserving exact canonical destination geometry without reversing."
  - "Membership turnover controls whole-turn impulse and radial displacement; stable-key stagger prevents frame-count or publication-batch timing."
  - "Re-targeting samples the displayed world first, so the next transition begins from exact visible geometry rather than its stale original source."
patterns-established:
  - "One sampled world: choreography output is projected once and remains authoritative for bodies, rings, culling, and hits."
  - "Progress-only time: repeated samples at held progress are byte-stable, enabling lifecycle pause without wall-clock advance."
requirements-completed: []
coverage:
  - id: D1
    description: Deterministic normal-motion choreography model with explicit roles, phases, trajectory direction, velocity envelope, and exact settle.
    verification:
      - kind: unit
        ref: src/logic/orrery-switch-choreography.test.ts
        status: pass
      - kind: unit
        ref: src/logic/orrery-frame.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Membership-delta profile mapping, deterministic stagger, re-target continuity, pause stability, and Reduced Motion replacement.
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-switch-animation.test.ts
        status: pass
      - kind: unit
        ref: src/logic/orrery-switch-choreography.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: ORRS-13 live renderer integration, physical-Pixel fluidity, and owner approval.
    requirement: ORRS-13
    verification: []
    human_judgment: true
    rationale: Plan 30-12 must integrate and tune the model on the physical Pixel, and the owner must explicitly approve the complete visual choreography.
duration: 13min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 11: System-switch Choreography Model Summary

**A deterministic worklet-safe model now proves forward acceleration, outward shedding, inward capture, retained continuity, exact settle, re-targeting, pause stability, and Reduced Motion replacement before live renderer tuning.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-08T22:58:57-05:00
- **Completed:** 2026-09-08T23:11:22-05:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added explicit retained, leaving, entering, and anchor roles over immutable source/destination geometry, with named accelerate, shed, capture, settle, and complete samples.
- Replaced semantic token checks with numeric trajectory proof: acceleration/deceleration finite differences, consecutive outward/inward radial samples, exact endpoint geometry, and shared projected-frame authority.
- Scaled spin and radial travel from count-independent membership turnover and staggered contacts deterministically by stable key.
- Added exact displayed-sample re-targeting, byte-stable held-progress sampling, and a Reduced Motion branch with direct crossfade/reposition and zero rotational/radial spectacle.

## Task Commits

1. **Task 1 RED: staged trajectory and projection contract** — `ddac136`
2. **Task 1 GREEN: choreography core and projected-frame integration** — `70dc8af`
3. **Task 2 RED: delta scaling, continuity, and stagger contract** — `6402981`
4. **Task 2 GREEN: turnover-scaled profile and stable-key stagger** — `f1b3d5b`
5. **Task 3 RED: interruption, pause, and Reduced Motion contract** — `1e38712`
6. **Task 3 GREEN: exact re-targeting and Reduced Motion semantics** — `8a6bbcc`

## Files Created/Modified

- `src/logic/orrery-switch-choreography.ts` — canonical pure role/timeline/trajectory/re-target sampler.
- `src/logic/orrery-switch-choreography.test.ts` — property-level proof of actual angular and radial motion.
- `src/logic/orrery-frame.ts` — projects a single choreography sample for every visual and interaction consumer.
- `src/logic/orrery-frame.test.ts` — verifies projected geometry, rings, stable ordering, hits, and interruption continuity.
- `src/components/orrery/orrery-switch-animation.ts` — maps membership delta and switch identity into choreography options.
- `src/components/orrery/orrery-switch-animation.test.ts` — preserves count-independent delta and same-System zero-intensity behavior.

## Decisions Made

- A positive integrated velocity envelope supplies non-reversing acceleration and deceleration. Whole-turn endpoints let visible motion accumulate while still ending at exact canonical coordinates.
- Turnover affects observable travel, not merely a passed scalar: full turnover increases whole-turn impulse and radial displacement over high-overlap switches.
- Re-target construction consumes the prior displayed sample. It never restarts from the original System snapshot.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The complete repository suite ran 2,689 tests: 2,686 passed and three pre-existing `src/db/orrery-preferences.test.ts` assertions failed because they still expect `TARGET_VERSION` 22 while the current code reports 23. No Plan-11 animation file touches migrations or that test. All Plan-11 focused suites, TypeScript, Biome, and the color-token check pass.

## User Setup Required

None.

## Next Phase Readiness

- Plan 30-12 can replace the live scalar/reversible-spin path with this model and retain the choreography runtime above OrreryWorld's conditional mount.
- ORRS-13 is deliberately not listed as complete. Live Skia/Reanimated integration, physical-Pixel timing/fluidity evidence, and explicit owner approval remain required.

## Self-Check: PASSED

- Both created files exist; all six task commits exist in git history.
- Focused verification passes: 31 tests across choreography, frame, membership math, and satellite regression coverage.
- `npx tsc --noEmit --pretty false`, touched-file Biome, and `npm run check:colors` pass.

---
*Phase: 30-orrery-systems*
*Completed: 2026-09-08*
