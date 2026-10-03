/**
 * 38.7-08 (D-49/D-40): the Orrery's ONE quantised ambient clock.
 *
 * Every ambient consumer (the star twinkle, the sun pulse and — 38.7-09 — the
 * sky drift and the orbit pulses) reads ONE SharedValue: ambient time in
 * milliseconds, quantised to `AMBIENT_HZ`, or −1 under reduced motion (every
 * consumer then freezes). The value changes at most `AMBIENT_HZ` times a
 * second, and an unchanged tick writes nothing, so the canvas re-records an
 * ambient picture only when its input actually moved.
 *
 * Two drivers, chosen by the render host (`host.ambientDriver`, D-46):
 * - "frame-clock": Skia's `useClock()` (a per-vsync frame callback) quantised
 *   in a reaction. Smooth phase, but a callback runs every vsync while
 *   mounted.
 * - "interval": a JS `setInterval(1000 / AMBIENT_HZ)` that writes the value.
 *   No per-vsync callback runs at idle; the UI thread wakes only on a write.
 * The spike (Plan 08) measures both on both phones and the decided default is
 * recorded in the host. Each driver is its own tiny component, so no hook is
 * ever called conditionally and `useClock` is never called when the interval
 * driver is active. The canvas owns the value; the driver only writes it.
 *
 * The canvas mounts only while the Orrery is focused and foregrounded, so the
 * driver (and its timer or frame callback) stops on blur and background.
 */
import { useClock } from "@shopify/react-native-skia";
import { createElement, type ReactElement, useEffect, useMemo } from "react";
import {
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import type { OrreryRenderHost } from "./render-host";

/** Ambient ticks per second (D-49: ~30 Hz). Tunable. */
export const AMBIENT_HZ = 30;
/** One ambient step, in ms. */
export const AMBIENT_STEP_MS = 1000 / AMBIENT_HZ;
/** The ambient value while still (reduced motion, or no driver running). */
export const AMBIENT_STILL = -1;

/**
 * Quantises a clock reading to the ambient step; −1 under reduced motion or
 * for a non-finite / negative reading.
 */
export function quantiseAmbient(clockMs: number, reduced: boolean): number {
  "worklet";
  if (reduced || !Number.isFinite(clockMs) || clockMs < 0) return AMBIENT_STILL;
  // Integer tick index first (ms × Hz / 1000 is exact for whole ms), so a
  // reading on a step boundary never floors to the previous step.
  return (Math.floor((clockMs * AMBIENT_HZ) / 1000) * 1000) / AMBIENT_HZ;
}

/** Which ambient consumers are on screen (all of them today). */
export interface AmbientConsumers {
  twinkle: boolean;
  sunPulse: boolean;
  /** 38.7-09 (D-36): the painted sky's barely-there drift. */
  skyDrift?: boolean;
  /** 38.7-09 (D-10): the subtle orbit pulses. */
  orbitPulses?: boolean;
}

/**
 * Whether any ambient consumer needs the clock. False under reduced motion:
 * nothing ambient may move, so no driver needs to run at all.
 */
export function ambientNeeded(
  reduced: boolean,
  consumers: AmbientConsumers,
): boolean {
  if (reduced) return false;
  return (
    consumers.twinkle ||
    consumers.sunPulse ||
    consumers.skyDrift === true ||
    consumers.orbitPulses === true
  );
}

/** The timer seam of the interval driver (real timers in the app). */
export interface AmbientIntervalDeps {
  write: (ambientMs: number) => void;
  now?: () => number;
  setInterval?: (callback: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

export interface AmbientIntervalController {
  /** Starts (true) or stops (false) the ticks; idempotent. */
  update(active: boolean): void;
  /** Unmount: stops the ticks for good. */
  dispose(): void;
  /** True while a timer is armed. */
  running(): boolean;
}

/**
 * The interval driver's logic, React-free (node-testable with fake timers).
 * While active it writes the quantised elapsed time once per step (only when
 * it changed). Stopping clears the timer and writes −1 once, so every
 * consumer freezes; restarting continues from the elapsed time it stopped at.
 */
export function createAmbientIntervalController(
  deps: AmbientIntervalDeps,
): AmbientIntervalController {
  const now = deps.now ?? (() => Date.now());
  const arm = deps.setInterval ?? ((cb, ms) => setInterval(cb, ms));
  const disarm =
    deps.clearInterval ??
    ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  let timer: unknown = null;
  let origin = 0;
  let elapsed = 0;
  let last: number | null = null;
  let disposed = false;

  function emit(value: number): void {
    if (value === last) return;
    last = value;
    deps.write(value);
  }
  function tick(): void {
    elapsed = Math.max(0, now() - origin);
    emit(quantiseAmbient(elapsed, false));
  }
  function stop(): void {
    if (timer !== null) disarm(timer);
    timer = null;
  }
  return {
    update(active) {
      if (disposed) return;
      if (active) {
        if (timer !== null) return;
        origin = now() - elapsed;
        tick();
        timer = arm(tick, AMBIENT_STEP_MS);
        return;
      }
      stop();
      emit(AMBIENT_STILL);
    },
    dispose() {
      disposed = true;
      stop();
    },
    running: () => timer !== null,
  };
}

interface AmbientDriverProps {
  ambient: SharedValue<number>;
  reducedMotion: SharedValue<boolean>;
}

/**
 * "frame-clock": the canvas's ONE `useClock()`, quantised. The reaction runs
 * every vsync (that is this driver's cost) but writes only when the
 * quantised value changes, so pictures re-record at most AMBIENT_HZ.
 */
export function AmbientFrameClockDriver({
  ambient,
  reducedMotion,
}: AmbientDriverProps): null {
  const clock = useClock();
  useAnimatedReaction(
    () => quantiseAmbient(clock.value, reducedMotion.value),
    (value) => {
      if (ambient.value !== value) ambient.value = value;
    },
  );
  return null;
}

/**
 * "interval": JS ticks at AMBIENT_HZ while mounted and motion is allowed.
 * Reduced motion (the OS state twin) stops the timer and freezes the value.
 * No per-vsync callback runs.
 */
export function AmbientIntervalDriver({ ambient }: AmbientDriverProps): null {
  const reduced = useReducedMotion();
  const controller = useMemo(
    () =>
      createAmbientIntervalController({
        write: (value) => {
          ambient.value = value;
        },
      }),
    [ambient],
  );
  useEffect(() => {
    controller.update(!reduced);
  }, [controller, reduced]);
  useEffect(() => () => controller.dispose(), [controller]);
  return null;
}

/**
 * The canvas's ambient source: the quantised SharedValue every ambient layer
 * reads, plus the driver element the canvas renders (null when nothing
 * ambient is needed; the value then stays −1).
 */
export function useOrreryAmbient(
  host: Pick<OrreryRenderHost, "ambientDriver">,
  reducedMotion: SharedValue<boolean>,
  needsAmbient = true,
): { ambient: SharedValue<number>; driver: ReactElement | null } {
  const ambient = useSharedValue(AMBIENT_STILL);
  const driver = needsAmbient
    ? createElement(
        host.ambientDriver === "interval"
          ? AmbientIntervalDriver
          : AmbientFrameClockDriver,
        { ambient, reducedMotion },
      )
    : null;
  return { ambient, driver };
}
