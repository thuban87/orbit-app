import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  useClock: () => ({ value: 0 }),
}));
vi.mock("react-native-reanimated", () => ({
  useAnimatedReaction: () => {},
  useSharedValue: (value: unknown) => ({ value }),
}));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

import {
  AMBIENT_HZ,
  AMBIENT_STEP_MS,
  AMBIENT_STILL,
  AmbientFrameClockDriver,
  AmbientIntervalDriver,
  ambientFrameRateVote,
  ambientNeeded,
  createAmbientIntervalController,
  MOTION_VOTE_HZ,
  quantiseAmbient,
  useOrreryAmbient,
} from "./ambient-clock";

describe("quantised ambient value (D-49)", () => {
  it("is ~30 Hz", () => {
    expect(AMBIENT_HZ).toBe(30);
    expect(AMBIENT_STEP_MS).toBeCloseTo(33.333, 3);
  });
  it("floors a clock reading to the ambient step", () => {
    expect(quantiseAmbient(0, false)).toBe(0);
    expect(quantiseAmbient(33, false)).toBe(0);
    expect(quantiseAmbient(34, false)).toBeCloseTo(AMBIENT_STEP_MS, 9);
    expect(quantiseAmbient(1000, false)).toBeCloseTo(1000, 9);
    expect(quantiseAmbient(1010, false)).toBeCloseTo(1000, 9);
    // Every reading inside one step gives the same value: no propagation.
    const step = quantiseAmbient(500, false);
    for (let ms = step; ms < step + AMBIENT_STEP_MS - 1e-6; ms += 3)
      expect(quantiseAmbient(ms, false)).toBe(step);
  });
  it("is −1 under reduced motion and for invalid readings", () => {
    expect(quantiseAmbient(1234, true)).toBe(AMBIENT_STILL);
    expect(AMBIENT_STILL).toBe(-1);
    expect(quantiseAmbient(Number.NaN, false)).toBe(-1);
    expect(quantiseAmbient(-5, false)).toBe(-1);
    expect(quantiseAmbient(Number.POSITIVE_INFINITY, false)).toBe(-1);
  });
  it("ambient is needed only while motion is allowed and a consumer is on screen", () => {
    expect(ambientNeeded(false, { twinkle: true, sunPulse: true })).toBe(true);
    expect(ambientNeeded(false, { twinkle: false, sunPulse: true })).toBe(true);
    expect(ambientNeeded(false, { twinkle: false, sunPulse: false })).toBe(
      false,
    );
    expect(ambientNeeded(true, { twinkle: true, sunPulse: true })).toBe(false);
    // 38.7-09: the sky drift and the orbit pulses are ambient consumers too
    // (and still never under reduced motion).
    expect(
      ambientNeeded(false, {
        twinkle: false,
        sunPulse: false,
        orbitPulses: true,
      }),
    ).toBe(true);
    expect(
      ambientNeeded(false, { twinkle: false, sunPulse: false, skyDrift: true }),
    ).toBe(true);
    expect(
      ambientNeeded(true, {
        twinkle: true,
        sunPulse: true,
        skyDrift: true,
        orbitPulses: true,
      }),
    ).toBe(false);
  });
});

describe("FR-B frame-rate vote (D-65)", () => {
  it("votes the ambient rate only while the ambient clock alone animates", () => {
    expect(ambientFrameRateVote(false, false)).toBe(AMBIENT_HZ);
    expect(AMBIENT_HZ).toBe(30);
  });
  it("votes the panel's top rate while busy (38.7-16 FV-1)", () => {
    expect(ambientFrameRateVote(false, true)).toBe(MOTION_VOTE_HZ);
    expect(MOTION_VOTE_HZ).toBe(120);
  });
  it("withdraws the vote (0) under reduced motion, busy or not", () => {
    expect(ambientFrameRateVote(true, false)).toBe(0);
    expect(ambientFrameRateVote(true, true)).toBe(0);
  });
});

describe("interval driver (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  function harness() {
    const writes: number[] = [];
    const controller = createAmbientIntervalController({
      write: (v) => writes.push(v),
      now: () => Date.now(),
    });
    return { writes, controller };
  }

  it("starts ticking at AMBIENT_HZ and writes only changed values", () => {
    const { writes, controller } = harness();
    expect(controller.running()).toBe(false);
    controller.update(true);
    expect(controller.running()).toBe(true);
    expect(writes).toEqual([0]);
    vi.advanceTimersByTime(1000);
    // One write per step (~30 in a second), each strictly increasing.
    expect(writes.length).toBeGreaterThanOrEqual(AMBIENT_HZ - 1);
    expect(writes.length).toBeLessThanOrEqual(AMBIENT_HZ + 1);
    for (let i = 1; i < writes.length; i++)
      expect(writes[i]).toBeGreaterThan(writes[i - 1]);
    // update(true) again is idempotent (one timer).
    const before = vi.getTimerCount();
    controller.update(true);
    expect(vi.getTimerCount()).toBe(before);
    controller.dispose();
  });

  it("stops on reduced motion: the timer is cleared and the value freezes at −1 once", () => {
    const { writes, controller } = harness();
    controller.update(true);
    vi.advanceTimersByTime(200);
    const ticks = writes.length;
    controller.update(false);
    expect(controller.running()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(writes.at(-1)).toBe(-1);
    expect(writes.length).toBe(ticks + 1);
    vi.advanceTimersByTime(2000);
    controller.update(false);
    expect(writes.length).toBe(ticks + 1); // no repeat −1
  });

  it("resumes from the elapsed time it stopped at", () => {
    const { writes, controller } = harness();
    controller.update(true);
    vi.advanceTimersByTime(500);
    const last = writes.at(-1) as number;
    controller.update(false);
    vi.advanceTimersByTime(10_000);
    controller.update(true);
    expect(writes.at(-1)).toBe(last);
    controller.dispose();
  });

  it("stops for good on unmount (dispose)", () => {
    const { writes, controller } = harness();
    controller.update(true);
    vi.advanceTimersByTime(100);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
    const count = writes.length;
    controller.update(true);
    vi.advanceTimersByTime(1000);
    expect(writes.length).toBe(count);
    expect(controller.running()).toBe(false);
  });
});

describe("useOrreryAmbient (driver selection)", () => {
  const reduced = { value: false } as never;
  it("mounts the frame-clock driver by default and the interval driver when the host says so", () => {
    const frame = useOrreryAmbient({ ambientDriver: "frame-clock" }, reduced);
    expect(frame.driver?.type).toBe(AmbientFrameClockDriver);
    expect(frame.ambient.value).toBe(-1);
    const interval = useOrreryAmbient({ ambientDriver: "interval" }, reduced);
    expect(interval.driver?.type).toBe(AmbientIntervalDriver);
  });
  it("mounts no driver when nothing ambient is needed (the value stays −1)", () => {
    const none = useOrreryAmbient(
      { ambientDriver: "interval" },
      reduced,
      false,
    );
    expect(none.driver).toBeNull();
    expect(none.ambient.value).toBe(-1);
  });
});
