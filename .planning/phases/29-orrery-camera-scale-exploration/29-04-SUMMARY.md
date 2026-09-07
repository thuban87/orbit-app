---
phase: 29-orrery-camera-scale-exploration
plan: "04"
subsystem: ui
tags: [orrery, gravity, sqlite, camera, perspective, tdd]
requires:
  - phase: 29-03
    provides: Coherent System snapshots, global sun and guarded publication
provides:
  - Canonical full-history batched Gravity inputs and modest rendered mass
  - Growing density-aware worlds with deterministic bounded collision correction
  - Readable Home, arbitrary body framing and invertible bounded perspective
affects: [29-05, 29-06, 29-07, 29-08, 29-09, 29-10, 29-11, 29-12, 40]
tech-stack:
  added: []
  patterns: [read-only batch core, viewport-independent world, shared projected ring and body frame]
key-files:
  created:
    - src/db/orrery-impact-read.ts
    - src/db/orrery-impact-read.test.ts
    - src/logic/orrery-world-logic.ts
    - src/logic/orrery-world-logic.test.ts
    - src/logic/orrery-camera-logic.test.ts
  modified:
    - src/db/orrery-system-read.ts
    - src/services/orrery-scene.ts
    - src/services/orrery-scene.test.ts
    - src/logic/orrery-camera-logic.ts
    - src/components/orrery/OrreryWorld.tsx
    - src/screens/OrreryScreen.tsx
    - src/db/lifecycle-consumer-ledger.test.ts
key-decisions:
  - Gravity retains canonical full-history and recency policy; only its display scope is extended by dossier §E/§Z.
  - Collision neighborhoods use canonical Balanced geometry and the widest-preset displacement bound, keeping corrections independent of density and camera.
  - Impossible arbitrary framing returns a legal pose with fits false; invalid measurement returns null and preserves the prior pose.
requirements-completed: []
requirements-progressed: [ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06]
coverage:
  - id: D1
    description: Batch parity, statement bounds, coherent read-only composition and cancelled queued publication/persistence
    verification:
      - kind: integration
        ref: src/db/orrery-impact-read.test.ts
        status: pass
      - kind: integration
        ref: src/services/orrery-scene.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Growing dense rings, truthful neutral/timestamp placement and bounded deterministic corrections
    verification:
      - kind: unit
        ref: src/logic/orrery-world-logic.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Readable Home, obstacle-aware arbitrary framing, positive perspective and inverse precision
    verification:
      - kind: unit
        ref: src/logic/orrery-camera-logic.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Native Gravity mass, Home density calibration, projected rings and actual gesture behavior
    verification: []
    human_judgment: true
    rationale: Native Skia and phone calibration remain assigned to the approved end-of-phase device session; node math tests do not prove visual or gesture behavior.
duration: 16min
completed: 2026-09-07
status: complete
actuals:
  tokens: 15048
  tasks: 3
  commits: 8
---

# Phase 29 Plan 04: Growing World and Readable Camera Summary

**Full-history Gravity now influences rendered body mass in a growing density-aware world, with bounded invertible perspective and count-independent readable Home.**

## Performance

- Started approximately 2026-09-07T08:28:00Z; completed 2026-09-07T08:44:00Z.
- Three tasks; thirteen source/test/validation files changed.
- Actuals: ceil(60,190 realized task-diff characters / 4) = 15,048; seven task/fix commits plus metadata. No harness-token estimate substitution.

## Accomplishments

- `readOrreryImpactInputsCore` accepts only `ReadOnlyExecutor`, filters invalid IDs, deduplicates and uses chunks of 256 bound IDs. Empty IDs perform no SELECT; 1/100/256/257/513 cases establish statement bounds. Existing no-history contacts map to empty history, missing IDs have no entry. Complete ancient/future/tied history matches `getImpactInputs` and `computeContactGravity` exactly at the same `now`, including connected-only Rarely responds scope.
- The existing System read snapshot includes member and resolved global-sun ImpactInputs. Tests compose through a deliberately narrow executor with one outer BEGIN/COMMIT and exercise real shared-mutex ordering. Cancellation while queued prevents scene publication and persistence after release; a later live request succeeds. Gravity derives once per contact with one shared local `now` after the lock returns. No score is stored and the Profile reader/policy is unchanged.
- Density changes actual world spacing: Compact 32, Balanced 34, Spacious 44 world units. Rings use dense rank with creation/id tie breaks; no viewport compression or stored-rank rewrite. Neutral progress/status remain null at the fixed north resting angle. Drift retains the existing bounded decay/rogue policy. Gravity tiers scale nominal radii from 0.9 to 1.1.
- Collision corrections use stable UID signs and canonical local collision neighborhoods, capped at one degree and four world units. The widest preset establishes the arc budget, so the same neighborhood gets the same angular correction across density changes. No random packing, camera-dependent positions or neutral progress fabrication.
- Home is top-down/north-up/sun-centered and fits complete rails until the 10-unit rendered-radius floor. Saved-density and System/measurement changes reframe Home in the screen, while ordinary refreshes retain the camera. Invalid measurements do not overwrite the prior valid pose.
- Perspective shares one transform between centers, billboard radii, projected ring paths and inverse world coordinates. Tilt is bounded to 60 degrees; zoom is 0.25–4; focal distance includes world extent and legal pan, keeping the depth fraction at most 0.45 for legal world points. Ring paths now use Skia Path while avatars remain circular. Large drags and sky pinches are finite without a discontinuous projection-denominator clamp.

## Task Commits

1. Task 29-04-01 RED — `4870773`: batched parity and coherent cancellation tests.
2. Task 29-04-01 GREEN — `75ee4b9`: full-history batch read, snapshot composition and rendered Gravity mass.
3. Task 29-04-02 RED — `912ccf7`: density/rank/neutral/collision specifications.
4. Task 29-04-02 GREEN — `6313cbd`: growing canonical world and density wiring.
5. Task 29-04-03 RED — `17f2621`: camera bounds, round trips, Home and arbitrary framing specifications.
6. Task 29-04-03 GREEN — `f127919`: perspective, Home wiring, ring paths and lifecycle ledger registration.
7. Camera boundary follow-up — `5ab9197`: finite gestures beyond the plane horizon with regression test.

All commits are local on main with hooks enabled. No tracked files were deleted, no dependency/migration/device action was introduced, and unrelated baseline work was preserved.

## Exported Contracts

- `orrery-impact-read.ts`: `ORRERY_IMPACT_CHUNK_SIZE = 256`; `readOrreryImpactInputsCore(ro, readonly number[]): Promise<Map<number, ImpactInputs>>`. `OrrerySystemSnapshot.impactInputs` carries the coherent results. The member read also projects `created_at` for deterministic rank ties.
- `OrrerySceneSnapshot.gravity: Map<number, GravityResult>` supplies existing named Gravity tiers to later semantic/companion consumers; raw values are not UI labels.
- `orrery-world-logic.ts`: `DENSITY_PRESETS`, `MAX_NUDGE_ANGLE`, `MAX_NUDGE_WORLD`, `NEUTRAL_RESTING_ANGLE`, `gravityMassModifier`, `orderOrreryMembers`, `deriveOrreryWorld(members, density, gravity, sun): { bodies, extent }`. Returned contact bodies have canonical `angle` and bounded `nudgeAngle`; sun remains last. Scene contact ordering matches body ordering.
- `CameraPose` extends x/y/zoom with optional tilt/yaw/focalDistance for older callers; `HOME_CAMERA` and clamped poses contain all axes. `clampCameraPose` is also exported as existing `constrainCamera`.
- `CameraViewport` accepts optional `usable: CameraRect` and measured `obstacles`. `usableCameraRect` returns the largest unobstructed axis-aligned region, or null. `deriveHomePose(world, viewport): CameraPose | null` handles no-body and invalid-measurement cases.
- `frameBodies(world, viewport, extent, orientation = HOME_CAMERA): CameraFraming | null`; result contains `{ pose, fits, usable }`. It fits projected media and minimum touch bounds rather than averaging centers. Impossible sets return a bounded pose with `fits: false`; empty/invalid inputs return null.
- `deriveFocalDistance`, `worldExtent`, `perspectiveScale`, `projectWorldPoint`, `unprojectToWorldPlane`, `anchorCameraPose` are worklet-compatible camera primitives. `ProjectedBody` adds `depth` and `ringPath: WorldPoint[]`; drawing and touch use the same projected radius/center. `panCamera` takes optional viewport for inverse-plane pan.
- Pinch anchoring applies zoom clamps before preserving the world point. Legal pan bounds take precedence if exact anchoring would exceed them. Sky beyond the plane horizon has no finite world anchor and falls back to centered zoom. Native pinch/tilt/yaw recognizers remain Plan 07.

## Verification

- Task 1: `npm test -- src/db/orrery-impact-read.test.ts src/services/orrery-scene.test.ts` — 20 tests passed.
- Task 2: `npm test -- orrery-world-logic orrery-scene impact` — 42 tests passed.
- Task 3 final: `npm test -- orrery-camera-logic orrery-world-logic orrery-scene` — 27 tests passed. Boundary fixtures include legal zoom/tilt/yaw/pan endpoints, adjacent epsilon, readability thresholds, maximum-tilt round trips within 1e-6, asymmetric body/touch framing and sky gesture safety.
- `npx tsc --noEmit` — passed after final source change.
- `npm run check:colors` — passed. Targeted Biome on eleven primary changed files — passed, no warnings.
- Full regression final: **259 files / 2,437 tests passed**, `/tmp/orbit-29-04-tests-final.log`, 22.20 seconds. The first run had only the newly required lifecycle-reader inventory failure; registration plus its historical validation mirror fixed it, and all eleven ledger tests pass.
- Native library lookup: Context7/ctx7 were unavailable. Checked installed Skia 2.6.2 Path interfaces and official [Path](https://shopify.github.io/react-native-skia/docs/shapes/path/) / [Reanimated integration](https://shopify.github.io/react-native-skia/docs/animations/animations/) docs; used installed `Skia.Path.Make` API rather than the newer docs' PathBuilder spelling.

## Deviations from Plan

1. **[Rule 2 — Critical integration] Screen Home ownership.** Added thirteen lines plus import in `OrreryScreen.tsx` because the world is generation-keyed; resetting in the world component would incorrectly reset every refresh. Screen-owned System/density/measurement keys implement the requested Home wiring and preserve prior valid poses.
2. **[Rule 3 — Blocking verification] Lifecycle inventory.** Added the new nullable-cadence reader to `lifecycle-consumer-ledger.test.ts` and its mandated historical validation mirror. Included in `f127919`.
3. **[Rule 1 — Bug] Horizon gestures.** Added bounded pan sampling and unanchored sky-pinch behavior after inspection exposed inverse singularity risk for gestures outside the finite plane; `5ab9197` and its regression test cover it. Projection itself remains continuous and invertible over the legal world.
4. All five multi-plan requirements remain pending: readiness query reports 0/5 ready; semantic hysteresis/labels belong to Plan 05, measured shell/HUD exclusions to Plan 06, gestures to Plan 07, and integrated/native evidence to Plan 12. No early phase-wide completion is claimed.

## Deferred Issues and Native Evidence

- Pre-existing Biome formatter drift in `src/db/lifecycle-consumer-ledger.test.ts` remains outside the newly added owner entry. Baseline `c1e1a3a` reproduces the same findings (`/tmp/orbit-29-04-ledger-baseline-biome.log`). Recorded in `deferred-items.md` and WINDOWS **48**; runtime ledger tests pass. This does not invalidate the eleven-file primary Biome result.
- Native Gravity/density/Home appearance, projected ring smoothness, gesture arbitration and phone performance remain pending final Plan 12; WINDOWS **47**. No device was accessed.
- Full-history reads retain the shared FIFO mutex. A scene may wait behind photo-inclusive backup and delay queued Quick Log/app writes. Query count does not establish wall-clock responsiveness. Cancellation invalidates publication but cannot dequeue SQL. Wait/hold latency is unmeasured; Plan 12 records native backup/tap and scene/write observations, and D-10 assigns measured optimization to Phase 40. No timeout/priority/bypass/extra connection was introduced.
- No new placeholder/mock source feeds were introduced. Empty arrays/maps represent real empty history/membership. Semantic labels/hysteresis, measured HUD controls, full focus/cluster UI, Polaris and gesture registration remain with their already-assigned later plans.

## Governance and KB Handoff

The graph's impact-read→ADR-027 and old geometry→ADR-046 edges were INFERRED metadata; actual ADR text establishes the retained policy. New source comments cite ADR-011/046/077 and ADR-027. Plan 12 must carry the precise partial supersession: dossier §E/§Z and ORRC-03/15 authorize Orrery mass/context, replacing ADR-027's old profile-only/Orrery-rejection display clauses only. Its full-history/floor, derived-never-stored, connected-scope and intensity policies remain intact. Immutable ADR bodies were not edited.

## Self-Check: PASSED

All five created source/test files exist and all seven task/fix commits are present in local history. Full regression/typecheck/colors/primary Biome passed; the known baseline formatter and native limitations are explicit. No new network, schema, auth or file-access trust boundary was introduced.

## Next Plan Readiness

Plan 29-05 can consume named Gravity, projected depth/radii/ring paths and canonical world positions for billboard ordering and semantic labels. Plans 06–08 can consume the explicit framing/measurement contracts above. No later plan was executed.
