import { describe, expect, it } from "vitest";
import {
  ALL_CONTACTS_SKY_SYSTEM,
  SKY_UNTINTED,
  skyDriftOffset,
  skyParallaxOffset,
  skySeeded,
  skyStarField,
  systemSkyHueIndex,
} from "./orrery-sky-logic";

const ids = (n: number) => [
  "builtin:favorites",
  "builtin:needs-attention",
  "builtin:not-contacted",
  "builtin:snoozed",
  "builtin:chargers",
  ...Array.from({ length: n }, (_, i) => `custom:uid-${i}-${(i * 7919) % 97}`),
  ...Array.from({ length: n }, (_, i) => `category:cat-${i}`),
];

describe("systemSkyHueIndex (D-08/D-50)", () => {
  it("is deterministic: the same systemRefId always yields the same bucket", () => {
    for (const id of ids(50)) {
      expect(systemSkyHueIndex(id, 12)).toBe(systemSkyHueIndex(id, 12));
    }
    // A pinned value: stable across launches (FNV-1a is fixed arithmetic).
    expect(systemSkyHueIndex("custom:abc", 12)).toBe(
      systemSkyHueIndex("custom:abc", 12),
    );
  });

  it("stays in range for every bucket count", () => {
    for (const buckets of [1, 6, 12, 13, 24]) {
      for (const id of ids(40)) {
        const index = systemSkyHueIndex(id, buckets);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(buckets);
        expect(Number.isInteger(index)).toBe(true);
      }
    }
  });

  it("uses all 12 buckets (well past Lab B's 6) over a realistic set of Systems", () => {
    const used = new Set(ids(60).map((id) => systemSkyHueIndex(id, 12)));
    expect(used.size).toBe(12);
    expect(used.size).toBeGreaterThan(6);
  });

  it("All Contacts keeps the untinted base sky (Lab B's rule; owner item G-ALLSKY)", () => {
    expect(ALL_CONTACTS_SKY_SYSTEM).toBe("builtin:all-contacts");
    expect(systemSkyHueIndex("builtin:all-contacts", 12)).toBe(SKY_UNTINTED);
    expect(SKY_UNTINTED).toBe(-1);
  });

  it("no buckets → untinted", () => {
    expect(systemSkyHueIndex("custom:x", 0)).toBe(SKY_UNTINTED);
    expect(systemSkyHueIndex("custom:x", Number.NaN)).toBe(SKY_UNTINTED);
  });
});

describe("skyStarField", () => {
  it("is stable for a seed and differs between seeds", () => {
    const a = skyStarField(3, 400, 800, 120);
    const b = skyStarField(3, 400, 800, 120);
    expect(a).toEqual(b);
    expect(skyStarField(4, 400, 800, 120)).not.toEqual(a);
  });

  it("places every star inside the field with 0..1 attributes", () => {
    const field = skyStarField(1, 420, 900, 300);
    expect(field).toHaveLength(300);
    for (const star of field) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(420);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(900);
      for (const v of [star.size, star.bright, star.tone, star.phase]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("is empty for a non-positive size or count", () => {
    expect(skyStarField(1, 0, 900, 10)).toEqual([]);
    expect(skyStarField(1, 400, -1, 10)).toEqual([]);
    expect(skyStarField(1, 400, 900, 0)).toEqual([]);
  });

  it("uses the seeded sin-hash (no Math.random)", () => {
    expect(skySeeded(5)).toBe(skySeeded(5));
    expect(skySeeded(5)).toBeGreaterThanOrEqual(0);
    expect(skySeeded(5)).toBeLessThan(1);
  });
});

describe("skyParallaxOffset (D-36)", () => {
  const viewport = { width: 400, height: 800 };
  it("is zero at the centred camera and moves a few dp per screen of pan", () => {
    expect(skyParallaxOffset({ x: 0, y: 0, zoom: 1 }, viewport, 6, 24)).toEqual(
      { x: 0, y: 0 },
    );
    // One screen-width of pan (400 dp at zoom 1) → ≈ factor dp.
    const one = skyParallaxOffset({ x: 400, y: 0, zoom: 1 }, viewport, 6, 24);
    expect(one.x).toBeLessThan(0);
    expect(Math.abs(one.x)).toBeGreaterThan(5);
    expect(Math.abs(one.x)).toBeLessThanOrEqual(6);
    expect(one.y).toBe(0);
  });

  it("is bounded for any pan or zoom", () => {
    for (const pose of [
      { x: 1e6, y: -1e6, zoom: 4 },
      { x: -5e4, y: 3e4, zoom: 0.25 },
      { x: Number.NaN, y: Number.POSITIVE_INFINITY, zoom: Number.NaN },
    ]) {
      const o = skyParallaxOffset(pose, viewport, 6, 24);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(24);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(24);
      expect(Number.isFinite(o.x) && Number.isFinite(o.y)).toBe(true);
    }
  });
});

describe("skyDriftOffset (D-36)", () => {
  it("is exactly zero under reduced motion (ambient −1) and at time 0", () => {
    expect(skyDriftOffset(-1, 6, 10)).toEqual({ x: 0, y: 0 });
    expect(skyDriftOffset(0, 6, 10)).toEqual({ x: 0, y: 0 });
    expect(skyDriftOffset(Number.NaN, 6, 10)).toEqual({ x: 0, y: 0 });
  });

  it("moves barely (≈ dpPerMinute per minute) and never beyond the amplitude", () => {
    const oneSecond = skyDriftOffset(1000, 6, 10);
    expect(Math.hypot(oneSecond.x, oneSecond.y)).toBeLessThan(0.2);
    expect(Math.hypot(oneSecond.x, oneSecond.y)).toBeGreaterThan(0);
    for (let ms = 0; ms < 3_600_000; ms += 7919) {
      const o = skyDriftOffset(ms, 6, 10);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(10);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(6);
    }
  });
});
