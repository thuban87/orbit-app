import { afterEach, describe, expect, it, vi } from "vitest";

const skia = vi.hoisted(() => ({
  make: vi.fn((_: string) => ({ effect: true }) as unknown),
}));
vi.mock("@shopify/react-native-skia", () => ({
  Skia: { RuntimeEffect: { Make: skia.make } },
}));

import {
  getLabEffect,
  LAB_EFFECT_SOURCES,
  labEffectStatuses,
  resetLabEffectsForTest,
  setLabEffectForceFallback,
  WARMUP_EFFECTS,
} from "./labb-effects";

afterEach(() => {
  resetLabEffectsForTest();
  skia.make.mockClear();
});

describe("lazy lab effect loader", () => {
  it("never compiles at import and compiles each effect once", () => {
    expect(skia.make).not.toHaveBeenCalled();
    expect(labEffectStatuses().probe).toBe("pending");
    const a = getLabEffect("probe");
    const b = getLabEffect("probe");
    expect(a).toBe(b);
    expect(skia.make).toHaveBeenCalledTimes(1);
    expect(labEffectStatuses().probe).toBe("ok");
  });

  it("returns null (fallback) when Make returns null or throws, and caches it", () => {
    skia.make.mockReturnValueOnce(null);
    expect(getLabEffect("probe")).toBeNull();
    expect(getLabEffect("probe")).toBeNull();
    expect(skia.make).toHaveBeenCalledTimes(1);
    expect(labEffectStatuses().probe).toBe("null");
    resetLabEffectsForTest();
    skia.make.mockImplementationOnce(() => {
      throw new Error("driver");
    });
    expect(getLabEffect("probe")).toBeNull();
    expect(labEffectStatuses().probe).toBe("error");
  });

  it("force-fallback makes every getter return null", () => {
    setLabEffectForceFallback(true);
    expect(getLabEffect("probe")).toBeNull();
    expect(skia.make).not.toHaveBeenCalled();
  });

  it("keeps colour literals out of SkSL and lists only known warm-up effects", () => {
    for (const src of Object.values(LAB_EFFECT_SOURCES)) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|#define/);
    }
    for (const name of WARMUP_EFFECTS)
      expect(Object.keys(LAB_EFFECT_SOURCES)).toContain(name);
  });
});
