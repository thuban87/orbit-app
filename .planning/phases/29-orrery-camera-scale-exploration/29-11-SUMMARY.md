---
phase: 29-orrery-camera-scale-exploration
plan: "11"
subsystem: ui
tags: [orrery, navigation, reduced-motion, recovery, tdd]
requires:
  - phase: 29-10
    provides: Shared projected scene, guarded contact actions, optional satellite context
provides:
  - Memory-only departure reasons and route-key-validated Profile Back restoration
  - Live Reduced Motion precedence and inactive input/frame cleanup
  - Shared named recovery messages, duplicate retry suppression and membership size continuity
affects: [29-12]
tech-stack:
  added: []
  patterns: [discrete UI-thread session capture, route-key pop validation, named feedback states]
key-files:
  created:
    - src/stores/orrery-session-store.ts
    - src/logic/orrery-session-logic.ts
    - src/logic/orrery-session-logic.test.ts
    - src/components/orrery/orrery-feedback-logic.ts
    - src/components/orrery/orrery-feedback-logic.test.ts
  modified:
    - src/navigation/tabs/OrreryStack.tsx
    - src/screens/OrreryScreen.tsx
    - src/theme/use-reduced-motion.ts
    - src/theme/use-reduced-motion.test.ts
    - src/components/orrery/use-orrery-camera.ts
    - src/components/orrery/OrreryFeedback.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/OrreryContactsSheet.tsx
    - src/components/orrery/OrreryClusterPanel.tsx
    - src/components/orrery/OrreryFocusContext.tsx
    - src/components/orrery/OrreryViewOptions.tsx
    - src/components/orrery/orrery-controls-render.test.tsx
    - src/components/orrery/orrery-render.test.tsx
    - src/logic/orrery-frame.ts
    - src/logic/orrery-frame.test.ts
    - src/services/orrery-scene.ts
    - src/stores/orrery-system-store.ts
    - src/stores/orrery-system-store.test.ts
key-decisions:
  - Tab blur invalidates saved session generations; only an armed Profile pop to the original Orrery route restores context.
  - Explicit recovery taps coalesce independently of normal reloads so actual data refreshes retain their newer-generation semantics.
requirements-completed: []
requirements-progressed: [ORRC-08, ORRC-11, ORRC-13, ORRC-16]
coverage:
  - id: D1
    description: Reason-specific session restoration, live identity revalidation and actual camera hook cleanup
    verification:
      - kind: unit
        ref: src/logic/orrery-session-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Live motion seed ordering, disposal and in-flight continuation cancellation
    verification:
      - kind: unit
        ref: src/theme/use-reduced-motion.test.ts
        status: pass
      - kind: unit
        ref: src/logic/orrery-recovery-logic.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Named feedback, retry ownership, coherent failures and shared-frame continuity
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-feedback-logic.test.ts
        status: pass
      - kind: integration
        ref: src/stores/orrery-system-store.test.ts
        status: pass
      - kind: unit
        ref: src/logic/orrery-frame.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Native navigation return, OS motion toggle, inactive Skia clock and large-text recovery
    verification: []
    human_judgment: true
    rationale: Node tests cannot establish Android navigation presentation, actual Skia clock disposal, TalkBack or gesture usability; Plan 12 retains native evidence.
duration: 14min
completed: 2026-09-07
status: complete
actuals:
  tokens: 15320
  tasks: 3
  commits: 8
---

# Phase 29 Plan 11: Session and Recovery Lifecycles Summary

**Profile Back now restores a validated memory-only camera session, live motion changes outrank stale seeds, and Orrery failures share truthful retryable feedback.**

## Accomplishments

- The Orrery tab stack explicitly records route keys and tab departure. Camera capture stops and samples the shared pose on the UI thread, then crosses to JS once on Profile navigation/background. No frame-by-frame store writes, route-pose parameters, persistence middleware, settings columns or backup fields were added. Capture generations reject delayed work after tab departure, new intent, changed scene or disposal.
- Restoration waits for route activation, current local reload and valid measurement. It validates focused ID/UID against current members or the current global contact sun, clamps pose through the existing camera helper, and keeps dismissed clusters closed. Fresh tab visits start Home. Background-only pauses retain pose. Subsequent measurement changes clamp existing framing rather than immediately undoing the restored pose. New System/density domains still derive Home.
- The live Reduced Motion controller now records whether any live event occurred before seed resolution; even a later false seed cannot undo a live true. Dispose is idempotent. Existing camera recovery generations already cancel coast and replace recovery with short direct movement; the actual hook cleanup test additionally verifies inert input, cleared reorder/frame state and blocked continuation. Canvas/SunBody retain their existing shared live gates and sole clock subtree; screen visibility continues to unmount World/Canvas while inactive.
- All named E9 error/loading messages now come from one copy catalog and inline notice renderer, reused by world overlays, companion, cluster, focus and options. Existing empty/sun-only copy remains in its shared resolver. Bounded scroll surfaces and wrapping text remain intact. Retry notices synchronously suppress duplicate taps, expose disabled/busy state and release after settlement; operation owners retain failure state. System recovery taps coalesce separately from ordinary fresh-data reloads, persistence retries guard their generation, and optional satellite reads coalesce the same pending immutable scene.
- World transitions preserve sampled positions and radii, grow entries and shrink decorative exits. Removed bodies remain immediately noninteractive. A live Reduced Motion change cancels the current continuation and settles directly over 100ms. Resource/focus callbacks reject stale scenes/focus identities or unmounted owners. Existing world projection remains the sole rendering/hit authority.

## Exported Contracts

- `OrrerySessionSnapshot {pose:CameraPose, focus:OrreryContactTarget|null, systemId:string}`; `restoreOrrerySession({saved,systemId,members,sun,extent}):OrrerySessionSnapshot|null`.
- `createOrrerySessionStore()` / `useOrrerySessionStore`: `generation`, `resume:home|restore|active`, `departure:profile|background|tab|other|null`, `saved`, `capture(reason,snapshot,generation?)`, `routeChanged(routes)`, `leaveTab()`, `resumed()`.
- `feedbackCopy(kind):{message,action?}` and `OrreryFeedbackKind`: world-loading, list-loading, read, stale, preferences, settings, reorder, satellites, removed, missing.
- `OrreryNotice({kind,onAction?,busy?})` renders shared inline feedback. `OrreryFeedback` retains its measured scroll wrapper API. `createFeedbackRetry(publish)` exposes `run(operation)`, `activate()`, `dispose()`; cleanup is safe across effect replay.
- `OrrerySystemState.retryReload():Promise<void>` coalesces explicit recovery requests; `reload()` retains existing latest-generation semantics. Optional satellite `reload(scene,enabled)` retains its existing signature and now returns the same pending operation for the same enabled scene.

## Task Commits

1. Task 29-11-01 RED `7f3d061`; GREEN `1e14fc2` — reason-aware session restoration and route/screen integration.
2. Task 29-11-02 RED `4065835`; GREEN `bd40b78` — live seed precedence, idempotent disposal and inactive camera cleanup.
3. Task 29-11-03 RED `2dc7a24`; GREEN `5d38954` — feedback/retries, continuity and integrated lifecycle/render verification.

Six task commits plus summary and tracking commits, all local on main with hooks. No tracked deletions. Baseline unrelated planning edits, tsconfig change and native build output were preserved.

## Verification

- Each RED gate failed before its implementation: missing session modules; two stale-motion assertions; missing feedback module/retry API and missing size transition behavior.
- Task 1: 1 file / 4 tests passed. Task 2: 3 files / 17 tests passed. Task 3 expanded integration: 7 files / 53 tests passed.
- Final targeted verification: **10 files / 71 tests passed**, exit 0, `/tmp/orbit-29-11-targeted-final.log`.
- Final full regression: **274 files / 2,567 tests passed**, exit 0, **28.42s**, `/tmp/orbit-29-11-tests-final.log`. Baseline: 272 files / 2,556 tests. No skips; no source changes after this run.
- Final typecheck: exit 0, empty `/tmp/orbit-29-11-type-final.log`. Colors: exit 0, `/tmp/orbit-29-11-colors-final.log`. Biome: 23 files, exit 0, no fixes/warnings, `/tmp/orbit-29-11-biome-final.log`. `git diff --check`: exit 0.
- Context7 and ctx7 unavailable. Consulted official [React Navigation event documentation](https://reactnavigation.org/docs/navigation-events/) for stack state events and parent navigation listeners; native behavior remains pending verification.

## Deviations from Plan

1. **[Rule 2 — Integration]** Added a pure feedback catalog/controller and updated conventional notice consumers, optional scene reader scheduling and frame size interpolation beyond the filename list. These existing owners are necessary to share exact copy, suppress concurrent surface retries and finish the specified continuity. No data writer or shared-table invariant changed.
2. **[Rule 3 — Test integration]** Existing render harnesses needed useMemo/useCallback/useRef mocks for the new production hooks. Updated those harnesses; real component text, native Group ordering and callbacks remain exercised.
3. **[Rule 1 — Lifecycle]** Guarded delayed focus/resource and UI→JS capture publication; measurement-only changes preserve the restored pose. Task 1's initial Biome extra-dependency finding was resolved in Task 2 by reading the subscribed resume state directly. Final static checks are clean.

## Limits and Next Plan

- Plan 12 owns the combined native check: Profile Back versus fresh tab visit, app background clock shutdown, actual OS motion events, scaled-text recovery, gestures and TalkBack. WINDOWS entry **54** records that obligation. No native visual/accessibility/performance result is claimed.
- ORRC-08/11/13/16 remain unchecked at phase level because their integration/native evidence spans Plan 12. They progressed here; no partial requirement is marked complete.
- No known placeholder source data, skipped test or unrun automated verify remains. Existing empty transient fields represent cleanup/state, not stubs. No new network, authentication, filesystem or schema trust boundary was introduced.
- Estimate-scale actuals: ceil(61,278 realized source/test diff characters / 4) = **15,320**; not harness token usage.
- Tracking SDK advanced to Plan 12 of 12 and recorded metrics/session/decision. Progress recalculation declined the truncated milestone scope. ROADMAP incorrectly included `29-PLAN-CHECK.md` as plan 13; its generated checkbox/count were corrected to 11/12 actual executable plans.

## Self-Check: PASSED

All five new source/test files and all six task commits exist. Required checks passed; source changes are committed. Summary is written before tracking advances.
