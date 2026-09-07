/**
 * Reduced-motion controller invariants (THEME-06 / D-05 / D-07).
 *
 * The subscribe/seed/cleanup logic lives in a plain, non-React controller
 * (`createReducedMotionController`) so it is node-testable with a mock
 * AccessibilityInfo and a spy `emit` — the repo has Vitest but no
 * react-test-renderer, so the hook wrappers themselves cannot be mounted here.
 * These tests pin the controller's seed / live-toggle / single-subscribe /
 * dispose-cleanup / post-dispose-seed-guard behaviour.
 */
import { describe, expect, it, vi } from "vitest";

// The module under test imports react-native + react-native-reanimated at the
// top level (for the two hook wrappers). Neither parses under the node vitest
// env, so stub them — the controller we exercise here takes an INJECTED
// accessibilityInfo and never touches these (repo pattern: handoff.test.ts).
vi.mock("react-native", () => ({ AccessibilityInfo: {} }));
vi.mock("react-native-reanimated", () => ({
  useSharedValue: () => ({ value: false }),
}));

import {
  createReducedMotionController,
  type ReducedMotionAccessibilityInfo,
} from "./use-reduced-motion";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * A mock AccessibilityInfo whose seed promise and event handler are directly
 * controllable. `seed` defaults to a pre-resolved value; pass a Deferred to
 * control the resolve timing (for the post-dispose-seed-guard test).
 */
function makeMock(opts: { seed?: boolean; seedPromise?: Promise<boolean> }) {
  const remove = vi.fn();
  let handler: ((value: boolean) => void) | null = null;
  const isReduceMotionEnabled = vi.fn(
    () => opts.seedPromise ?? Promise.resolve(opts.seed ?? false),
  );
  const addEventListener = vi.fn(
    (_event: "reduceMotionChanged", h: (value: boolean) => void) => {
      handler = h;
      return { remove };
    },
  );
  const accessibilityInfo: ReducedMotionAccessibilityInfo = {
    isReduceMotionEnabled,
    addEventListener,
  };
  return {
    accessibilityInfo,
    remove,
    isReduceMotionEnabled,
    addEventListener,
    emitChange: (value: boolean) => handler?.(value),
  };
}

describe("createReducedMotionController", () => {
  it("live changes outrank a seed that resolves later", async () => {
    const seed = deferred<boolean>();
    const mock = makeMock({ seedPromise: seed.promise });
    const emit = vi.fn();
    createReducedMotionController(mock.accessibilityInfo, emit);
    mock.emitChange(true);
    seed.resolve(false);
    await Promise.resolve();
    expect(emit.mock.calls).toEqual([[true]]);
  });
  it("multiple live changes stay authoritative and repeated disposal is harmless", async () => {
    const seed = deferred<boolean>();
    const mock = makeMock({ seedPromise: seed.promise });
    const emit = vi.fn();
    const controller = createReducedMotionController(
      mock.accessibilityInfo,
      emit,
    );
    mock.emitChange(true);
    mock.emitChange(false);
    mock.emitChange(true);
    seed.resolve(false);
    await Promise.resolve();
    expect(emit.mock.calls).toEqual([[true], [false], [true]]);
    controller.dispose();
    controller.dispose();
    expect(mock.remove).toHaveBeenCalledTimes(1);
  });
  it("seeds from isReduceMotionEnabled() via emit(seed)", async () => {
    const mock = makeMock({ seed: true });
    const emit = vi.fn();

    createReducedMotionController(mock.accessibilityInfo, emit);
    await Promise.resolve();
    await Promise.resolve();

    expect(mock.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(true);
  });

  it("forwards live reduceMotionChanged events via emit(value)", async () => {
    const mock = makeMock({ seed: false });
    const emit = vi.fn();

    createReducedMotionController(mock.accessibilityInfo, emit);
    await Promise.resolve();
    emit.mockClear();

    mock.emitChange(true);
    expect(emit).toHaveBeenCalledWith(true);

    mock.emitChange(false);
    expect(emit).toHaveBeenCalledWith(false);
  });

  it("subscribes to reduceMotionChanged exactly once", () => {
    const mock = makeMock({ seed: false });
    createReducedMotionController(mock.accessibilityInfo, vi.fn());

    expect(mock.addEventListener).toHaveBeenCalledTimes(1);
    expect(mock.addEventListener).toHaveBeenCalledWith(
      "reduceMotionChanged",
      expect.any(Function),
    );
  });

  it("dispose() removes the listener exactly once", () => {
    const mock = makeMock({ seed: false });
    const controller = createReducedMotionController(
      mock.accessibilityInfo,
      vi.fn(),
    );

    expect(mock.remove).not.toHaveBeenCalled();
    controller.dispose();
    expect(mock.remove).toHaveBeenCalledTimes(1);
  });

  it("stops forwarding events after dispose()", async () => {
    const mock = makeMock({ seed: false });
    const emit = vi.fn();
    const controller = createReducedMotionController(
      mock.accessibilityInfo,
      emit,
    );
    await Promise.resolve();
    emit.mockClear();

    controller.dispose();
    mock.emitChange(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it("guards a post-dispose seed resolve (no emit after dispose)", async () => {
    const seed = deferred<boolean>();
    const mock = makeMock({ seedPromise: seed.promise });
    const emit = vi.fn();
    const controller = createReducedMotionController(
      mock.accessibilityInfo,
      emit,
    );

    // Dispose BEFORE the seed promise resolves.
    controller.dispose();
    seed.resolve(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(emit).not.toHaveBeenCalled();
  });
});
