/**
 * Live OS reduced-motion signal (THEME-06 / D-05 / D-07) — the phase's
 * highest-risk integration.
 *
 * Exposes the OS reduced-motion preference two ways:
 *   - `useReducedMotionShared()` → a Reanimated `SharedValue<boolean>` the Skia
 *     render loop reads through `useDerivedValue` WITHOUT per-frame `setState`
 *     (D-07: animation is never driven from React state).
 *   - `useReducedMotion()` → a state-backed boolean twin for NON-Skia React-tree
 *     consumers that need to re-render on change (e.g. crossfade vs instant swap).
 *     Skia is NEVER driven from this boolean.
 *
 * The seed/subscribe/cleanup logic is extracted into a plain, non-React
 * controller (`createReducedMotionController`) with ONE pinned signature so it
 * is fully node-testable by mocking `accessibilityInfo` and passing a spy
 * `emit` — the repo has Vitest but no react-test-renderer, so a hook cannot be
 * mounted/unmounted in a node test. The two hooks are thin wrappers: each
 * instantiates its OWN controller in a `useEffect` (its own listener — no
 * shared subscription).
 *
 * NOT react-native-reanimated's `useReducedMotion()` — that reads the value at
 * boot only and never re-updates on a live toggle (RESEARCH Pitfall 1). The
 * `AccessibilityInfo.reduceMotionChanged` subscription is the only correct
 * source for the LIVE requirement.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

/**
 * The minimal AccessibilityInfo-shaped dependency the controller needs. The
 * real `AccessibilityInfo` from react-native satisfies this structurally; a
 * mock satisfies it in node tests.
 */
export interface ReducedMotionAccessibilityInfo {
  isReduceMotionEnabled(): Promise<boolean>;
  addEventListener(
    eventName: "reduceMotionChanged",
    handler: (value: boolean) => void,
  ): { remove(): void };
}

export interface ReducedMotionController {
  dispose(): void;
}

/**
 * Plain (non-React) reduced-motion controller. PINNED signature
 * (REVIEWS 23-04 MEDIUM): `accessibilityInfo` is the injected dependency and
 * `emit` is the SECOND ARGUMENT — a `(value: boolean) => void` callback the
 * controller calls once with the seeded value and again on every
 * `reduceMotionChanged` event. `emit` is an ARGUMENT, not a `start(emit)`
 * method or a subscription-return API.
 *
 * Behaviour:
 *   - subscribes ONCE to `reduceMotionChanged`, forwarding each change via emit,
 *   - seeds from `isReduceMotionEnabled()` and calls `emit(seed)`,
 *   - returns exactly `{ dispose() }` which removes the listener and guards a
 *     post-dispose seed resolve (no emit after dispose).
 */
export function createReducedMotionController(
  accessibilityInfo: ReducedMotionAccessibilityInfo,
  emit: (value: boolean) => void,
): ReducedMotionController {
  let disposed = false;

  // Subscribe ONCE, synchronously — a live toggle that fires before the seed
  // promise resolves is still forwarded.
  const subscription = accessibilityInfo.addEventListener(
    "reduceMotionChanged",
    (value: boolean) => {
      if (disposed) return;
      emit(value);
    },
  );

  // Seed from the current OS value. Guard against a resolve that lands after
  // dispose (T-23-07: no emit / write after unmount).
  accessibilityInfo
    .isReduceMotionEnabled()
    .then((value) => {
      if (disposed) return;
      emit(value);
    })
    .catch(() => {
      // A rejected capability probe degrades to "no reduced motion" (the
      // shared value / boolean stay at their false default). Never throw.
    });

  return {
    dispose() {
      disposed = true;
      subscription.remove();
    },
  };
}

/**
 * Worklet/Skia-readable reduced-motion flag as a Reanimated shared value. The
 * render loop reads `.value` inside `useDerivedValue` WITHOUT re-rendering the
 * React tree each frame (D-07). Writing `.value` is not a `setState`.
 */
export function useReducedMotionShared(): SharedValue<boolean> {
  const reduced = useSharedValue(false);
  useEffect(() => {
    const controller = createReducedMotionController(
      AccessibilityInfo,
      (value) => {
        reduced.value = value; // writing .value ≠ setState → no re-render
      },
    );
    return () => controller.dispose();
  }, [reduced]);
  return reduced;
}

/**
 * State-backed boolean twin for NON-Skia React-tree consumers that must
 * re-render on change. Do NOT drive Skia/worklet animation from this boolean —
 * use `useReducedMotionShared()` for that.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const controller = createReducedMotionController(
      AccessibilityInfo,
      setReduced,
    );
    return () => controller.dispose();
  }, []);
  return reduced;
}
