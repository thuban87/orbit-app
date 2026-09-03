---
phase: 23-theme-visual-system
plan: 04
subsystem: ui
tags: [theme, reduced-motion, accessibility, reanimated, skia, motion-tokens]

requires:
  - phase: 23-01
    provides: theme layer / token foundation (src/theme/tokens/* pure-data idiom)
provides:
  - "createReducedMotionController(accessibilityInfo, emit): { dispose() } — plain, node-testable OS reduced-motion controller (emit is the 2nd arg)"
  - "useReducedMotionShared(): SharedValue<boolean> — worklet/Skia-readable reduced-motion flag, no per-frame setState"
  - "useReducedMotion(): boolean — state-backed React-tree twin"
  - "MOTION tokens (fast/base/slow ms durations + ambient per-second SPEED constant)"
  - "EASING tokens (standard/decelerate pure-data descriptors)"
affects: [23-06 orrery, 23-07, galaxy-background, skia-ambient-motion]

actuals:
  tokens: 5000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Injected-dependency controller extracted from React hooks for node-testability (emit-as-argument, dispose-returns)"
    - "OS AccessibilityInfo.reduceMotionChanged bridge → Reanimated SharedValue (never reanimated's boot-time useReducedMotion)"

key-files:
  created:
    - src/theme/use-reduced-motion.ts
    - src/theme/use-reduced-motion.test.ts
    - src/theme/tokens/motion.ts
    - src/theme/tokens/motion.test.ts
  modified: []

key-decisions:
  - "The subscribe/seed/cleanup logic is extracted into createReducedMotionController(accessibilityInfo, emit): { dispose() } — a plain non-React controller with emit as the SECOND ARGUMENT and dispose() as the only returned member, so it is node-testable with a mock accessibilityInfo + a spy emit (the repo has Vitest but no react-test-renderer). Both hooks are thin wrappers each owning ONE controller instance (own listener, no shared subscription)."
  - "The live OS signal comes from AccessibilityInfo.isReduceMotionEnabled() (seed) + addEventListener('reduceMotionChanged') (live), NOT react-native-reanimated's useReducedMotion() which is boot-time-only (RESEARCH Pitfall 1 / D-07)."
  - "useReducedMotionShared writes SharedValue.value (never setState) so the Skia render loop reads it through useDerivedValue with no per-frame re-render; useReducedMotion is a separate state-backed boolean twin for React-tree crossfade-vs-instant decisions — Skia is never driven from the boolean."
  - "A post-dispose seed resolve is guarded (disposed flag) so a late isReduceMotionEnabled() resolution never writes after unmount (T-23-07)."
  - "MOTION.ambient is a per-second SPEED constant (rate, radians/s), deliberately NOT a duration — the exact shape Plan 06's Orrery worklet multiplies into useDerivedValue, so the Plan 04↔06 seam cannot mismatch. Tunable via a single top-of-file AMBIENT_SPEED constant."
  - "EASING tokens are pure-data descriptors ('inOut'/'out'), not live Easing functions — importing reanimated's Easing would break the node-importable / RN-free contract; the consuming surface maps a descriptor to Easing.inOut(Easing.ease) at the call site."

patterns-established:
  - "Node-testable controller extraction: correctness-critical subscribe/seed/cleanup lives in a plain controller with an injected dependency and a callback (emit) argument, hooks are thin wrappers — mirrors the repo's -logic.ts split for RN-bound code."
  - "Motion tokens follow the tokens/spacing.ts pure-data idiom (no react-native import, no colour literal, node-importable)."

requirements-completed: [THEME-06]

coverage:
  - id: D1
    description: "createReducedMotionController seeds via emit(seed), forwards live reduceMotionChanged via emit(value), subscribes exactly once, dispose() removes the listener + stops forwarding + guards a post-dispose seed resolve"
    requirement: THEME-06
    verification:
      - kind: unit
        ref: "src/theme/use-reduced-motion.test.ts (6 tests)"
        status: pass
  - id: D2
    description: "useReducedMotionShared (SharedValue, no setState) + useReducedMotion (boolean twin) hook wrappers, each owning one controller instance"
    requirement: THEME-06
    verification:
      - kind: other
        ref: "npx tsc --noEmit (shape/call-site) + grep imports AccessibilityInfo/useSharedValue, NOT reanimated useReducedMotion"
        status: pass
      - kind: manual_procedural
        ref: "Device UAT (end-of-phase Pixel): toggle OS reduced motion mid-session, confirm Plan 06 ambient motion stops live without restart"
        status: unknown
  - id: D3
    description: "MOTION durations (fast/base/slow) + ambient per-second SPEED + EASING descriptors as pure, node-tested data"
    requirement: THEME-06
    verification:
      - kind: unit
        ref: "src/theme/tokens/motion.test.ts (5 tests)"
        status: pass
      - kind: other
        ref: "npm run check:colors src/theme/tokens/motion.ts (exit 0)"
        status: pass

metrics:
  duration: 8min
  completed: 2026-09-03

status: complete
---

# Phase 23 Plan 04: Reduced-Motion Signal & Motion Tokens Summary

Delivered the phase's highest-risk integration — a live OS reduced-motion signal readable from the Skia render loop as a Reanimated `SharedValue<boolean>` with zero per-frame `setState`, plus a React-tree boolean twin and the semantic motion/easing tokens — satisfying THEME-06/D-05/D-07.

## Accomplishments

- **Task 1 — Reduced-motion hook** (`ea314b3`): `src/theme/use-reduced-motion.ts` (+ `.test.ts`). `createReducedMotionController(accessibilityInfo, emit): { dispose() }` is a plain, non-React controller (pinned signature, emit as 2nd arg) that seeds from `isReduceMotionEnabled()`, subscribes once to `reduceMotionChanged`, forwards each value through `emit`, and guards a post-dispose seed resolve. `useReducedMotionShared()` wraps it writing a `useSharedValue<boolean>` `.value` (never setState) for the Skia loop; `useReducedMotion()` wraps it as a state-backed boolean twin. 6 node tests via a mock `accessibilityInfo` + spy `emit` — no react-test-renderer.
- **Task 2 — Motion tokens** (`552cb36`): `src/theme/tokens/motion.ts` (+ `.test.ts`). `MOTION` = fast(120)/base(200)/slow(320) ms durations + an `ambient` per-second SPEED constant (rate, tunable top-of-file), `EASING` = standard/decelerate pure-data descriptors. 5 node tests; `check:colors` clean.

## Verification

- `npx vitest run src/theme/use-reduced-motion.test.ts src/theme/tokens/motion.test.ts` → 11 tests pass.
- Full suite: 2035 tests pass (206 files).
- `npx tsc --noEmit` clean; `npm run check:colors` (full src) exit 0; biome clean on the four new files.
- grep confirms `use-reduced-motion.ts` imports `AccessibilityInfo` + `useSharedValue` and does NOT import reanimated's `useReducedMotion`.
- Device UAT (toggle OS reduced motion mid-session, confirm Plan 06 ambient motion halts live) is DEFERRED to the end-of-phase Pixel pass — no Plan 06 consumer exists yet.

## Deviations from Plan

None - plan executed exactly as written.

Two implementation notes (not deviations, within delegated detail):
- The controller's seed promise `.catch(() => {})` degrades a rejected capability probe to the false default rather than throwing (aligns with the plan's "degrades to false" intent for the RN-bound path).
- The test mocks `react-native` + `react-native-reanimated` (repo pattern, `handoff.test.ts`) because the module imports them at top level for the hook wrappers; the controller under test uses the injected `accessibilityInfo` and never touches the real modules.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/theme/use-reduced-motion.ts
- FOUND: src/theme/use-reduced-motion.test.ts
- FOUND: src/theme/tokens/motion.ts
- FOUND: src/theme/tokens/motion.test.ts
- FOUND commit: ea314b3 (Task 1)
- FOUND commit: 552cb36 (Task 2)
