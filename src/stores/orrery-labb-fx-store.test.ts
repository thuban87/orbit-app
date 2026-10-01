import { afterEach, describe, expect, it } from "vitest";
import {
  getReducedMotionOverride,
  resolveReducedMotion,
  subscribeReducedMotionOverride,
} from "@/theme/reduced-motion-override";
import {
  defaultLabFlags,
  LAB_FLAG_REGISTRY,
  LAB_PRESETS,
  labFxSnapshot,
  labPresetFlags,
  matchLabPreset,
  useLabFxStore,
} from "./orrery-labb-fx-store";

afterEach(() => useLabFxStore.getState().reset());

describe("Lab B fx store", () => {
  it("defaults to the lab renderer with registry defaults", () => {
    const state = useLabFxStore.getState();
    expect(state.renderer).toBe("lab");
    expect(state.flags).toEqual(defaultLabFlags());
    expect(Object.keys(state.flags)).toHaveLength(LAB_FLAG_REGISTRY.length);
  });

  it("toggles flags, clamps intensity and snapshots plain data", () => {
    const store = useLabFxStore.getState();
    store.toggleFlag("rings");
    store.setIntensity(9);
    store.setRenderer("legacy");
    const snap = labFxSnapshot(useLabFxStore.getState());
    expect(snap).toEqual({
      renderer: "legacy",
      flags: { ...defaultLabFlags(), rings: false },
      intensity: 2,
    });
    store.setIntensity(-1);
    expect(useLabFxStore.getState().intensity).toBe(0);
  });

  it("forces reduced motion app-wide through the override and notifies", () => {
    let calls = 0;
    const off = subscribeReducedMotionOverride(() => calls++);
    useLabFxStore.getState().setReducedMotion("on");
    expect(getReducedMotionOverride()).toBe(true);
    expect(resolveReducedMotion(false)).toBe(true);
    useLabFxStore.getState().setReducedMotion("off");
    expect(resolveReducedMotion(true)).toBe(false);
    useLabFxStore.getState().setReducedMotion("os");
    expect(resolveReducedMotion(true)).toBe(true);
    expect(calls).toBe(3);
    off();
  });

  it("R3 presets: best = defaults, ship-safe drops the costly / glance effects, everything turns on the experiments, legacy switches renderer", () => {
    const store = useLabFxStore.getState();
    store.setFlag("bloom", true);
    store.setIntensity(1.5);
    store.applyPreset("best");
    expect(useLabFxStore.getState().flags).toEqual(defaultLabFlags());
    expect(useLabFxStore.getState().intensity).toBe(1);
    expect(matchLabPreset("lab", defaultLabFlags())).toBe("best");

    store.applyPreset("shipSafe");
    const ship = useLabFxStore.getState().flags;
    for (const off of [
      "bloom",
      "lensFlare",
      "tiltShift",
      "fxShockFilter",
      "ringWake",
      "ringFlow",
      "planeGrid",
      "fxFocusDim",
    ] as const)
      expect(ship[off]).toBe(false);
    for (const on of [
      "homeTilt",
      "planeLight",
      "nearSizeClamp",
      "immersiveChrome",
      "layerPictures",
      "idleClock",
    ] as const)
      expect(ship[on]).toBe(true);
    expect(matchLabPreset("lab", ship)).toBe("shipSafe");

    store.applyPreset("everything");
    const all = useLabFxStore.getState().flags;
    for (const on of [
      "bloom",
      "lensFlare",
      "tiltShift",
      "fxShockFilter",
      "nebulaLive",
      "moonShader",
    ] as const)
      expect(all[on]).toBe(true);
    expect(all.ringsPathRebuild).toBe(false);
    expect(all.forceFallback).toBe(false);
    expect(all.freezeClock).toBe(false);

    store.applyPreset("legacy");
    expect(useLabFxStore.getState().renderer).toBe("legacy");
    expect(matchLabPreset("legacy", useLabFxStore.getState().flags)).toBe(
      "legacy",
    );
  });

  it("presets keep debug instrumentation flags as they are", () => {
    const store = useLabFxStore.getState();
    store.setFlag("fpsHud", false);
    store.setFlag("perfProbe", true);
    store.setFlag("freezeClock", true);
    for (const preset of LAB_PRESETS) {
      const flags = labPresetFlags(preset.id, useLabFxStore.getState().flags);
      expect(flags.fpsHud).toBe(false);
      expect(flags.perfProbe).toBe(true);
      expect(flags.freezeClock).toBe(false);
    }
  });
});
