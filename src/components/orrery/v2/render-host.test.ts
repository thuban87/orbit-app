import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ os: "android", ratio: 2.625 as unknown }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return native.os;
    },
  },
  PixelRatio: { get: () => native.ratio },
}));

import {
  clearOrreryHostOverride,
  orreryHostOverride,
  setOrreryHostOverride,
} from "@/__dev__/orrery-host-override";
import {
  applyOrreryHostOverride,
  defaultOrreryRenderHost,
  describeOrreryHost,
  resolveOrreryRenderHost,
} from "./render-host";

beforeEach(() => {
  native.os = "android";
  native.ratio = 2.625;
});

describe("OrreryRenderHost (D-46)", () => {
  it("Android (D-64): opaque SurfaceView, frame clock, GPU-baked base, world-plane rings, Mali flags", () => {
    const host = resolveOrreryRenderHost();
    expect(host).toMatchObject({
      platform: "android",
      opaqueCanvas: true,
      ambientDriver: "frame-clock",
      bakePath: "gpu-offscreen",
      ringMethod: "world-plane",
      mali: { strokeUnderPerspective: false, cpuBakedNebula: true },
    });
    expect(host.ringFieldMinRings).toBeGreaterThan(0);
    expect(host.devicePixelRatio()).toBe(2.625);
  });
  it("iOS and web values are defined (opaque is a no-op; web bakes through raster)", () => {
    const ios = resolveOrreryRenderHost("ios");
    expect(ios).toMatchObject({
      platform: "ios",
      opaqueCanvas: false,
      bakePath: "none",
      ringMethod: "world-plane",
    });
    const web = resolveOrreryRenderHost("web");
    expect(web).toMatchObject({
      platform: "web",
      opaqueCanvas: false,
      bakePath: "raster",
      ringMethod: "world-plane",
    });
    expect(resolveOrreryRenderHost("windows").platform).toBe("other");
  });
  it("Android-only behaviour is a value: every platform has the same shape", () => {
    const keys = Object.keys(resolveOrreryRenderHost("android")).sort();
    for (const os of ["ios", "web", "macos"])
      expect(Object.keys(resolveOrreryRenderHost(os)).sort()).toEqual(keys);
  });
  it("the device pixel ratio falls back to 1 when unavailable or invalid", () => {
    native.ratio = Number.NaN;
    expect(resolveOrreryRenderHost().devicePixelRatio()).toBe(1);
    native.ratio = 0.5;
    expect(resolveOrreryRenderHost().devicePixelRatio()).toBe(1);
    native.ratio = undefined;
    expect(resolveOrreryRenderHost().devicePixelRatio()).toBe(1);
  });
});

describe("38.7-08 spike overrides (D-59)", () => {
  it("without the dev build or the spike flag, the host is the code defaults", () => {
    // vitest has no __DEV__ and no EXPO_PUBLIC_ORRERY_SPIKE: neither seam loads.
    const { devicePixelRatio: _a, ...resolved } = resolveOrreryRenderHost();
    const { devicePixelRatio: _b, ...defaults } = defaultOrreryRenderHost();
    expect(resolved).toEqual(defaults);
  });
  it("applies only the known override keys, later wins, platform and Mali untouched", () => {
    const base = defaultOrreryRenderHost("android");
    const next = applyOrreryHostOverride(base, {
      opaqueCanvas: false,
      ambientDriver: "interval",
      bakePath: "gpu-offscreen",
      ringMethod: "hybrid",
      ringFieldMinRings: 300,
      platform: "ios",
    } as never);
    expect(next).toMatchObject({
      platform: "android",
      opaqueCanvas: false,
      ambientDriver: "interval",
      bakePath: "gpu-offscreen",
      ringMethod: "hybrid",
      ringFieldMinRings: 300,
      mali: { strokeUnderPerspective: false, cpuBakedNebula: true },
    });
    expect(base.opaqueCanvas).toBe(true); // not mutated
    expect(applyOrreryHostOverride(base, null)).toBe(base);
  });
  it("describes a host on one log line", () => {
    expect(describeOrreryHost(defaultOrreryRenderHost("android"))).toBe(
      "opaque=on,driver=frame-clock,bake=on,ring=world-plane,minRings=400",
    );
    expect(describeOrreryHost(defaultOrreryRenderHost("ios"))).toBe(
      "opaque=off,driver=frame-clock,bake=off,ring=world-plane,minRings=400",
    );
  });
  it("the DEBUG dev override merges patches and clears", () => {
    clearOrreryHostOverride();
    setOrreryHostOverride({ opaqueCanvas: true });
    setOrreryHostOverride({ ambientDriver: "interval" });
    expect(orreryHostOverride()).toEqual({
      opaqueCanvas: true,
      ambientDriver: "interval",
    });
    setOrreryHostOverride({ opaqueCanvas: undefined });
    expect(orreryHostOverride()).toEqual({ ambientDriver: "interval" });
    clearOrreryHostOverride();
    expect(orreryHostOverride()).toEqual({});
  });
});
