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

import { resolveOrreryRenderHost } from "./render-host";

beforeEach(() => {
  native.os = "android";
  native.ratio = 2.625;
});

describe("OrreryRenderHost (D-46)", () => {
  it("Android: today's TextureView, frame clock, live base, world-plane rings, Mali flags", () => {
    const host = resolveOrreryRenderHost();
    expect(host).toMatchObject({
      platform: "android",
      opaqueCanvas: false,
      ambientDriver: "frame-clock",
      bakePath: "none",
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
