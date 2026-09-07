---
phase: 29-orrery-camera-scale-exploration
plan: "06"
subsystem: ui
tags: [orrery, camera, measurements, shell, accessibility, tdd]
requires:
  - phase: 29-05
    provides: Shared projected world and screen-space labels
provides:
  - Window-space shell/HUD obstacle registry with stale-callback guards
  - Measured Home and arbitrary-body focus framing
  - Reachable Contacts, Recenter and yaw-only Reset north controls
  - Current-System detail sheet with basic member focus/Profile actions
affects: [29-07, 29-08, 29-11, 29-12]
tech-stack:
  added: []
  patterns: [discrete native window measurements, shared obstacle exclusions, bounded scrolling controls]
key-files:
  created:
    - src/stores/shell-obstacle-store.ts
    - src/navigation/use-window-measurement.ts
    - src/components/orrery/orrery-obstacle-logic.ts
    - src/components/orrery/orrery-obstacle-logic.test.ts
    - src/components/orrery/OrreryControls.tsx
    - src/components/orrery/OrreryContactsSheet.tsx
    - src/components/orrery/OrreryObstacle.tsx
    - src/components/orrery/OrreryFeedback.tsx
    - src/components/orrery/orrery-controls-render.test.tsx
  modified:
    - src/navigation/RootNavigator.tsx
    - src/components/UniversalFab.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/OrrerySystemSelector.tsx
    - src/components/orrery/OrreryViewOptions.tsx
    - src/components/icons/icon-registry.ts
    - src/screens/OrreryScreen.tsx
key-decisions:
  - The screen measures the actual canvas container below ShellAppBar so measurement is available before a scene exists; world and controls consume its common viewport.
  - Control placement excludes its own measured rectangle, while world framing includes it, preventing recursive placement feedback.
  - Plan 07 retains explicit Polaris rendering and animated recovery ownership; Plan 06 supplies working direct callbacks and the north-point seam.
requirements-completed: []
requirements-progressed: [ORRC-04, ORRC-09, ORRC-13, ORRC-15]
coverage:
  - id: D1
    description: Keyed measurement lifecycle and window-to-canvas Home/focus exclusions
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-obstacle-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Actual controls and detail sheet props, copy, full identity and action dispatch
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-controls-render.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Native window coordinates, scaled control reachability, modal focus and TalkBack orientation
    verification: []
    human_judgment: true
    rationale: Node native-component mocks do not execute Android layout, Modal focus timing or TalkBack; Plan 12 owns device evidence.
duration: 18min
completed: 2026-09-07
status: complete
actuals:
  tokens: 15872
  tasks: 2
  commits: 7
---

# Phase 29 Plan 06: Measured Shell Obstacles and Reachable Controls Summary

**Orrery Home, focus, labels and camera controls now share measured shell/HUD exclusions, and Contacts opens the current System in a conventional detail sheet.**

## Accomplishments

- The keyed runtime registry stores finite positive window rectangles, suppresses identical publications and removes invalid/hidden/unmounted entries. Native callback generations reject results from older layouts or disposed measurements. Measurements run on layout, window/font changes, visibility and relevant positioning changes, never an animation-frame React loop.
- The existing tab wrapper and FAB publish actual native bounds. Keyboard/focused-route hiding removes their obstacles. Existing tab-height consumers, FAB coordinates, capture actions, shell Back and tab-retap routes remain intact.
- The screen's actual native canvas container supplies its window origin and size. Rectangle conversion subtracts that origin and clips intersections; the app bar and already-excluded tab bar do not create a second guessed clearance. The same viewport reaches the world projection, label allocator, Home and frameBodies focus path. Invalid geometry preserves the previous pose. Single focus retains the identity-level ceiling; groups use the fitting pose.
- System/View triggers and open panels register measured rectangles. Feedback surfaces also participate, allowing recovery controls to avoid error/loading/empty content. The controls use a bottom-right column with 16-unit edge inset and 8-unit obstacle gap. Contacts is above Recenter with 8-unit spacing; targets retain 44-unit minima and text wraps. A bounded ScrollView handles growing labels without shrinking targets.
- Controls' own placement excludes their registry entry; world framing includes it. Popup/sheet ownership disables world gestures and hides covered controls from input/accessibility. System/View panels retain independent transient IDs and dismissal/focus handling.
- Contacts remains enabled before valid camera measurement and during initial/loading/error states. Recenter and Reset north expose disabled state until valid bounds; their callbacks do not save preferences or show persistence spinners. Recenter uses the loaded or empty world and clears focus; Reset north changes yaw alone. On accessible north focus the current shared yaw is read and announced as complete orientation text, avoiding stale render-time yaw or per-frame React state.
- The detail Sheet uses the same requested System, snapshot, member order and error/loading/empty truth as the screen. A qualifying sun appears once through existing member data. Full names wrap, with separately named Focus in Orrery and Open Profile actions. Actions close the sheet before dispatch through the existing generation/identity validation path. Ordinary dismissal restores trigger focus; Profile navigation/blur does not pull focus back to a covered trigger.

## Task Commits

1. Task 29-06-01 RED — `34e8b1e`: registry lifecycle, stale callbacks, coordinate conversion and measured framing specifications.
2. Task 29-06-01 GREEN — `34ccef4`: shell measurement hook/registry and screen camera consumers.
3. Task 29-06-01 follow-up — `d678f72`: measured FAB ref dependency and declaration ordering for its accessibility callback.
4. Task 29-06-02 RED — `172439b`: control column, disabled states, yaw-only recovery and north-point contracts.
5. Task 29-06-02 GREEN — `7066662`: reachable controls, shared-state contact sheet, measured panel/feedback and modal input ownership.

Five source/test commits plus summary and state metadata commits, all local on main with hooks enabled. No tracked deletions, installs, device actions, schema changes, worktrees, branch changes or pushes. The dirty baseline was preserved.

## Exported Contracts

- `createShellObstacleStore()` / `useShellObstacleStore`: `{ rects: Readonly<Record<string,CameraRect>>, publish(key, rect|null) }`; `validWindowRect` and `sameWindowRect` implement shared validity/equality.
- `createWindowMeasurement(publish)` returns `begin(): (x,y,width,height)=>void` and `clear()`. Each begin/clear invalidates older async callbacks.
- `useWindowMeasurement(publish, enabled=true, revision=null)` returns `{ref,onLayout,measure}` for a native View; `useWindowObstacle(key,enabled,revision)` publishes to the shared registry. Owners must keep stable keys and mark hidden views disabled. Registry geometry is window-space, not canvas-local.
- `canvasViewport(canvas: CameraRect|null, obstacles: readonly CameraRect[]): CameraViewport` translates/intersects valid rectangles; invalid canvas returns zero bounds. The screen uses this for both world and controls.
- `controlsRegion(viewport): CameraRect|null` returns the bottom-most free right-hand column; content scrolls within that region. `ORRERY_CONTROLS_OBSTACLE = "orrery-camera-controls"` must be omitted only from the controls' placement input.
- `cameraControlState(measured)`, `northOrientation(yaw,measured): string|undefined`, `resetNorthPose(pose): CameraPose` and `polarisWorldPoint(extent): {x,y}` provide state and north seams. Polaris point is canonical world space; Plan 07 must include its projection/reach in its finite-bound treatment.
- `OrreryControls({viewport,measured,blocked,pose,onContacts,onRecenter,onResetNorth})`; `onContacts` receives a trigger-focus restoration callback. `OrreryWorld`/`createOrreryGestures` add optional `interactive`/`enabled` guards without changing existing default callers.
- `OrreryObstacle({obstacleId,...ViewProps})` registers native HUD/panel geometry while focused. `OrreryFeedback` composes that measurement owner with a bounded ScrollView.
- `OrreryContactsSheet({visible,state:OrrerySystemState,measured,onClose,onAction})`; `onAction(kind:"focus"|"profile",id)` delegates to the screen. No independent data universe, DAO writer, search or sort is introduced. Plan 08 can expand this existing file rather than introduce a competing sheet.

## Verification

- Task 1 RED failed for the missing registry/geometry modules. Task 2 RED failed all four newly added behavior cases before implementation.
- Task 1 geometry suite: **4 tests passed**; typecheck passed. Task 2 targeted obstacle/control/scene/world-render suites: **5 files / 32 tests passed**, `/tmp/orbit-29-06-targeted.log`.
- Final full `npm test`: **264 files / 2,472 tests passed**, 22.77 seconds, exit 0, `/tmp/orbit-29-06-tests-final.log`. No skips. Baseline was 262 files / 2,456 tests.
- Final test-only lint cleanup replaced nonnull/optional assertions with explicit missing-node failures; its affected component suite passed again: **1 file / 8 tests**, `/tmp/orbit-29-06-controls-final.log`. Application implementation was unchanged after the full regression run.
- `npx tsc --noEmit`: passed; `/tmp/orbit-29-06-types-final.log` is empty. Theme color check, targeted Biome across all sixteen source/test files, and diff whitespace checks passed. Component-test lint was rechecked after its explicit-assertion cleanup.
- Native measurement documentation: Context7 tools/CLI unavailable; checked React Native's official [Measuring the Layout](https://reactnative.dev/docs/the-new-architecture/layout-measurements) guidance for native refs, useLayoutEffect and asynchronous measureInWindow. No dependency changes.

## Deviations from Plan

1. **[Rule 2 — Critical integration] Screen-owned native measurement.** Task 1 listed OrreryWorld for measurement, but World mounts only after scene/viewport readiness. The actual matching canvas container is measured in OrreryScreen so loading/error controls can measure before World exists. Added the reusable native hook and moved the task-2 obstacle helper into task 1 to supply its required production conversion API. Commit `34ccef4`.
2. **[Rule 2 — Critical integration] Existing panels and feedback are real obstacles.** Extended System/View wrappers and added OrreryObstacle/OrreryFeedback; otherwise only shell rectangles would leave framing and camera controls underneath existing UI. World gesture builders now honor overlay ownership. Commit `7066662`.
3. **[Rule 2 — Critical integration] Basic sheet and production component tests.** Created the eventual Plan-08 `OrreryContactsSheet.tsx` now because Plan 06 explicitly requires a working Contacts action with shared System state. Plan 08 still owns row media, health/Gravity, expanded accessibility context and focus/cluster semantics. Commit `7066662`.
4. **[Rule 1 — Bug] FAB dependency lint.** The custom measurement hook ref is not inferred as a built-in stable useRef by Biome. Moved its declaration ahead of the focus callback and added the explicit ref dependency. Commit `d678f72`.

## Cross-Plan and Native Limitations

- E8 is a shared truth with explicit `29-07-02` ownership: the actual in-world Polaris drawing/tap target, live controller orientation value and continuous distance-adaptive Recenter remain Plan 07. This plan supplies working direct camera callbacks and the north-point contract. The orchestrator confirmed this split; no duplicate renderer/controller was built. This is not evidence that E8 or ORRC-09 is complete end to end.
- E5's full companion media/health/Gravity/satellite context and advanced focus/accessibility behavior remain Plans 08/10. The sheet here is functional, with real shared members and current guarded actions, not placeholder data.
- All four requirement IDs remain pending because COVERAGE assigns completion across later plans and integrated/native verification. No premature requirement checkbox changes.
- Native window measurement, scaled control reachability, modal focus restoration and TalkBack orientation remain pending in Plan 12. WINDOWS entry **50** records the obligation. No native performance or visual claim is made.
- No mock/placeholder source data, skipped tests, new network/auth/file-access/schema boundary, or unrun automated plan verification was introduced. Empty initial rectangle maps and absent optional snapshots are intentional lifecycle states.
- The owner requested a pause after this plan. Do not start Plan 07 until the parent resumes the workflow; the parent owns the pause handoff.

## Performance

Approximately 09:06–09:24 UTC on 2026-09-07; two tasks, sixteen source/test files. Actual estimate-scale size: ceil(63,486 realized source/test diff characters / 4) = **15,872**, not harness tokens.

## Self-Check: PASSED

All nine new source/test files and all five task/fix commits exist. Source changes are committed, no tracked files were deleted, and the recorded automated checks passed. Summary is on disk before state progression.
