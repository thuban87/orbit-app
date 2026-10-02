import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import { LAB_EFFECT_SOURCES } from "./labb-effects";
import { uniformOrder } from "./labb-layer-plan";
import {
  buildRingField,
  FIELD_LUT_W,
  FIELD_RING,
  FIELD_TRIM,
  fieldEntryAt,
  fieldLutAt,
  pushFieldEntry,
} from "./labb-ring-field";

describe("ring field data textures (tilt fix)", () => {
  it("encodes entries sorted by radius, round-tripping every field", () => {
    const entries: number[] = [];
    pushFieldEntry(entries, 300, 3, FIELD_RING, 0.8, 4.2, 0, 0);
    pushFieldEntry(entries, 40, 1, FIELD_RING, 1, 0, 0, 0);
    pushFieldEntry(entries, 180, 4, FIELD_TRIM, 0.5, 0, 0.62, -1.1);
    pushFieldEntry(entries, 90, 0, FIELD_RING, 0, 1, 0, 0); // alpha 0: dropped
    const data = buildRingField(entries);
    if (!data) throw new Error("no data");
    expect(data.count).toBe(3);
    expect(data.width).toBe(3);
    expect(data.table).toHaveLength(3 * 3 * 4);
    const decoded = [0, 1, 2].map((k) => fieldEntryAt(data, k));
    expect(decoded.map((e) => Math.round(e.R))).toEqual([40, 180, 300]);
    // 16-bit radius: < 0.01 world error here.
    expect(Math.abs(decoded[2].R - 300)).toBeLessThan(0.01);
    expect(decoded[0]).toMatchObject({ cls: 1, type: FIELD_RING, alpha: 1 });
    expect(decoded[1].cls).toBe(4);
    expect(decoded[1].type).toBe(FIELD_TRIM);
    expect(decoded[1].trimLen).toBeCloseTo(0.62, 2);
    expect(decoded[1].trimHead).toBeCloseTo(2 * Math.PI - 1.1, 3);
    expect(decoded[2].wake).toBeCloseTo(4.2, 3);
    expect(decoded[2].alpha).toBeCloseTo(0.8, 2);
    // Alpha channel always opaque (image shaders return premultiplied colour).
    for (let i = 3; i < data.table.length; i += 4)
      expect(data.table[i]).toBe(255);
  });

  it("LUT bins point at the entry whose radius is nearest the bin centre", () => {
    const radii = [12, 30, 31, 75, 200, 205, 600];
    const entries: number[] = [];
    for (const R of radii)
      pushFieldEntry(entries, R, 1, FIELD_RING, 1, 0, 0, 0);
    const data = buildRingField(entries);
    if (!data) throw new Error("no data");
    for (let b = 0; b < FIELD_LUT_W; b += 37) {
      const rc = ((b + 0.5) / FIELD_LUT_W) * data.rmax;
      const best = radii.reduce(
        (bi, R, i) => (Math.abs(R - rc) < Math.abs(radii[bi] - rc) ? i : bi),
        0,
      );
      expect(Math.abs(radii[fieldLutAt(data, b)] - rc)).toBeCloseTo(
        Math.abs(radii[best] - rc),
        9,
      );
    }
  });

  it("returns null when nothing is drawable", () => {
    expect(buildRingField([])).toBeNull();
    const entries: number[] = [];
    pushFieldEntry(entries, 0, 1, FIELD_RING, 1, 0, 0, 0);
    expect(buildRingField(entries)).toBeNull();
  });

  it("the ringField shader declares the uniform blocks the picture fills", () => {
    expect(uniformOrder(LAB_EFFECT_SOURCES.ringField)).toEqual([
      "uInv0",
      "uInv1",
      "uInv2",
      "uH0",
      "uH1",
      "uH2",
      "uCam",
      "uFlow",
      "uHi",
      "uSpin",
      "uView",
      "uWake",
      "uTrim",
      "uC0",
      "uC1",
      "uC2",
      "uC3",
      "uC4",
      "uS0",
      "uS1",
      "uS2",
      "uS3",
      "uS4",
    ]);
    expect(LAB_EFFECT_SOURCES.ringField).toContain("uniform shader uTable;");
    expect(LAB_EFFECT_SOURCES.ringField).toContain("uniform shader uLut;");
  });
});
