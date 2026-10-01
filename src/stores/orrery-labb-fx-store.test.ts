import { afterEach, describe, expect, it } from "vitest";
import {
  getReducedMotionOverride,
  resolveReducedMotion,
  subscribeReducedMotionOverride,
} from "@/theme/reduced-motion-override";
import {
  defaultLabFlags,
  LAB_FLAG_REGISTRY,
  labFxSnapshot,
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
});
