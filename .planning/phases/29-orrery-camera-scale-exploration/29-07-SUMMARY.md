---
phase: 29-orrery-camera-scale-exploration
plan: "07"
subsystem: ui
tags: [orrery, camera, gestures, polaris, reduced-motion, tdd]
requires:
  - phase: 29-06
    provides: Measured viewport, camera controls and shared world projection
provides:
  - Shared bounded pan/pinch/yaw and deliberately activated two-finger tilt
  - Interruptible distance-adaptive Home and shortest-path north recovery
  - World-projected tokenized Polaris and live accessible orientation
affects: [29-08, 29-09, 29-10, 29-11, 29-12]
tech-stack:
  added: []
  patterns: [UI-thread input ownership, injected motion scheduler, generation-guarded completion]
key-files:
  created:
    - src/components/orrery/use-orrery-camera.ts
    - src/components/orrery/Polaris.tsx
    - src/logic/orrery-gesture-logic.ts
    - src/logic/orrery-gesture-logic.test.ts
    - src/logic/orrery-recovery-logic.ts
    - src/logic/orrery-recovery-logic.test.ts
  modified:
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/OrreryControls.tsx
    - src/components/orrery/orrery-controls-render.test.tsx
    - src/components/orrery/orrery-render.test.tsx
    - src/screens/OrreryScreen.tsx
    - src/navigation/RootNavigator.tsx
    - src/services/orrery-scene.test.ts
key-decisions:
  - Camera input and recovery are screen-owned shared cells; World retains the single authoritative projected frame.
  - Tilt activation measures fresh two-pointer centroid travel rather than inherited one-pointer pan displacement.
  - Accessible north orientation uses live native accessibilityValue instead of an unsupported accessibility-focus callback.
requirements-completed: []
requirements-progressed: [ORRC-02, ORRC-09, ORRC-10, ORRC-16]
coverage:
  - id: D1
    description: Bounded gesture composition, stationary-hold ownership, cancellation and focal anchoring
    verification:
      - kind: unit
        ref: src/logic/orrery-gesture-logic.test.ts
        status: pass
      - kind: integration
        ref: src/services/orrery-scene.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Continuous adaptive Home/north, bounded continuation and interrupted completion
    verification:
      - kind: unit
        ref: src/logic/orrery-recovery-logic.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Tokenized projected Polaris and live north accessibility props
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-render.test.tsx
        status: pass
      - kind: integration
        ref: src/components/orrery/orrery-controls-render.test.tsx
        status: pass
    human_judgment: false
  - id: D4
    description: Native recognition, gesture handoff feel, Polaris visibility and TalkBack orientation
    verification: []
    human_judgment: true
    rationale: Node callbacks and projection tests cannot prove Android recognizer arbitration, native animated accessibility props or phone motion feel. Plan 12 owns device evidence.
duration: 15min
completed: 2026-09-07
status: complete
actuals:
  tokens: 14159
  tasks: 2
  commits: 5
---

# Phase 29 Plan 07: Bounded Camera and Polaris Summary

**The Orrery now composes pan, focal pinch, deliberate tilt and yaw through one shared camera, with interruptible Home/north recovery and a projected Polaris landmark.**

## Accomplishments

- One-pointer motion activates pan at 10 points. Native tap succeeds only for pending input; failed/cancelled/multitouch input cannot emit contact actions. A second pointer invalidates reorder ownership before camera manipulation. Finalize callbacks only clear transient state; no DAO or navigation bridge exists there.
- Pinch samples initialize at native active/start, then apply scale ratios to the current bounded pose and preserve its focal world anchor. Yaw likewise applies incremental rotation without overwriting zoom or tilt. Pan returning from multitouch discards its stale anchor sample. Each manual update cancels previous camera motion.
- Two-pointer tilt uses Gesture Handler's manual activation with a fresh centroid origin and 28-point vertical threshold. Prior one-pointer travel cannot satisfy that threshold. Activation rebases translation, so consuming the threshold does not jump the pose. Tilt stays within existing 0–60 degree limits.
- Home recovery targets current measured framing and clears focused IDs, including the existing group representation. North targets yaw zero through the shortest angular path while retaining pan, zoom, tilt and focus. A single quintic ease-out supplies continuous acquisition/approach/docking; duration varies smoothly from 180 to at most 850ms.
- Pan continuation is capped at 18 screen points per axis and yaw at 0.08 radians, over 120ms. Zoom and tilt have no continuation. Live Reduced Motion cancels existing motion first, replaces recovery with a 100ms direct transition, and drops inertia. Manual input remains available. Generation and live-state guards reject old completion after manual input, preference change, blur or unmount.
- Polaris is a restrained tokenized starburst at the existing canonical north point, projected from the same frame as bodies. Camera extent includes its minimum 32-unit reach. Its successful current-frame tap resets north only; body touch targets retain priority. Reset north exposes current degrees through UI-thread animated `accessibilityValue` without per-frame React state.

## Task Commits

1. Task 29-07-01 RED — `f22a20f`: gesture ownership/focal anchoring specifications.
2. Task 29-07-01 GREEN — `90c3d20`: pure arbitration, native adapters, shared input hook and World wiring.
3. Task 29-07-02 RED — `f967fb4`: adaptive recovery, exact north/Home, inertia and Polaris specifications.
4. Task 29-07-02 GREEN — `9ddf361`: interruption-safe recovery/controller, Polaris, screen/control integration and phase typing repairs.

Task commits are local on main with normal hooks. No tracked file deletion, dependency, installation, device action, schema change, push or worktree was introduced. Unrelated baseline changes remain untouched.

## Exported Contracts

- `useOrreryCamera({pose: SharedValue<CameraPose>, enabled, extent, viewport, reduced: SharedValue<boolean>}): OrreryCameraController` returns shared `input`, `samples`, `live` plus worklet `stop()`, `recover(target, kind?: "recovery" | "coast")`, `coast(kind: "pan" | "yaw", vx, vy)`, `motionChanged()`.
- The screen owns that controller and passes required `camera` to `OrreryWorld`. World still derives its authoritative animated frame once. `createOrreryGestures` moved to the hook module and remains re-exported from World for existing tracer imports; it accepts the existing pose/frame/extent/send/stop inputs plus optional shared camera, coast, north-hit handler and enabled guard. Legacy `panStart` remains supported in the Node tracer.
- `orrery-gesture-logic.ts`: `CameraInput {owner,generation,pointers}`, `initialInput`, `beginInput`, `moveInput`, `cancelInput`, `claimHold`, `cameraGestureStep`. Constants: pan 10, tap/hold slop 8, hold 850ms, tilt threshold 28, tilt radians/point 0.004. `claimHold` is the pure ownership seam for Plan 09; actual hold recognizer, ghost ring, haptic and persisted reorder remain Plan 09.
- `orrery-recovery-logic.ts`: `CameraRecovery {from,target,animatedTarget,duration,reduced}`, `planRecovery`, `sampleRecovery`, `recoveryCurve`, `shortestYaw`, `northTarget`, `inertiaTarget`, `cameraExtent`, `polarisProjection`, `hitPolaris`. `createCameraMotion` accepts structural cells and injected animate/cancel functions, providing the exact worklet transition/guard logic exercised by Node tests.
- `Polaris({frame: Readonly<CameraCell<ProjectedFrame>>,extent,colors})` consumes only existing frame geometry and theme tokens. The body Group batch remains contiguous and separate from the Polaris/ring/label layers.
- `OrreryControls` retains its public props; Reset north uses `Animated.createAnimatedComponent(Pressable)` and `useAnimatedProps` for native orientation text.

## Verification

- Both RED gates failed for their missing production module before implementation. Both have subsequent GREEN commits.
- Task 1 targeted camera/frame/gesture/scene/render checks: **5 files / 33 tests passed**, `/tmp/orbit-29-07-task1.log`.
- Final Task 2 gesture/recovery/render/scene/control checks: **5 files / 30 tests passed**, exit 0, `/tmp/orbit-29-07-task2-final.log`.
- One final full `npm test`: **266 files / 2,482 tests passed**, exit 0, 22.76 seconds, `/tmp/orbit-29-07-tests-final.log`. Baseline 264 files / 2,472 tests; no skips. No source changes followed this regression run.
- Final `npx tsc --noEmit`: exit 0; `/tmp/orbit-29-07-types-final.log` empty. Thirteen-file targeted Biome, `npm run check:colors` and `git diff --check` each exited 0.
- Native adapters are tested through mocked builder callbacks; real SQLite tracer still proves pan never changes ranks, timestamps or data revision. Recovery tests inject scheduled completions to verify cancellation, preference changes and blur, plus finite continuous sampling and exact end poses.
- Context7 and ctx7 unavailable. Read installed Gesture Handler 2.32 pan/pinch/rotation/base gesture APIs, its Android pointer-count handling and Reanimated 4.5 timing source; checked official [pinch gesture documentation](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pinch-gesture/). No library API was substituted from a newer package version.

## Deviations from Plan

1. **[Rule 2 — Critical integration] Screen controller ownership.** Added `OrreryScreen.tsx` because the Plan-06 controls were direct pose assignments there. Screen ownership lets controls, focus and World gestures interrupt the same animation instead of competing controllers. Pure injected motion scheduling makes its generation/lifecycle behavior testable. Commit `9ddf361`.
2. **[Rule 1 — Bug] Native tilt activation.** Replaced inherited pan displacement activation with a manually recognized fresh two-touch centroid threshold. Otherwise one-pointer travel before the second finger could activate tilt immediately. The actual native adapter test covers below/equal threshold and start rebase. Commit `9ddf361`.
3. **[Rule 3 — Blocking verification] Existing Phase-06 typing errors.** Installed RN Pressable has no `onAccessibilityFocus`; replaced the workaround with supported live `accessibilityValue`, preserving orientation access. RootNavigator's animated style union needs an explicit `display in tabStyle` guard before checking `none`. Parent authorized both narrow phase integration repairs. Component tests and typecheck pass. Commit `9ddf361`.
4. Existing tracer/render mocks were extended for the real four-gesture composition and additional independent Polaris layer; their data and body-depth assertions remain intact.

## Cross-Plan and Native Limitations

- SDK advancement inherited stale Plan 1 state and again counted 29-PLAN-CHECK as executable. Corrected STATE to next Plan 8 of 12 and ROADMAP to 7/12; removed its spurious plan-check checkbox. Global progress recalculation reported truncated phase scope and preserved the milestone progress.
- ORRC-02/09/10/16 remain pending at requirement level because COVERAGE assigns later hold-reorder/lifecycle/integrated and native completion. This summary records progress, not premature phase-wide requirement completion.
- Plan 09 consumes the ownership seam and must wire actual stationary hold/reorder acknowledgement and rank persistence. Plans 08/10/11 retain focus, satellite and session lifecycle responsibilities. No later plan was executed here.
- Native pan/pinch/tilt/yaw arbitration, tiny continuation/recovery feel, world Polaris visibility and TalkBack animated orientation remain pending Plan 12. WINDOWS entry **51** records that obligation. No performance claim is made.
- No placeholder source data, skipped test, unrun automated verification or new network/auth/file-access/schema boundary was introduced. Optional sample origins and idle motion cells are transient lifecycle state, not stubs.

## Performance

Approximately 16:32–16:47 UTC on 2026-09-07; two tasks, thirteen source/test files. Actuals use ceil(56,635 realized source/test diff characters / 4) = **14,159**, not harness tokens. Four task commits plus metadata.

## Self-Check: PASSED

All six new source/test files and all four task commits exist. The full suite and static checks pass; source changes are committed and no tracked files were deleted. Summary is on disk before state progression.
