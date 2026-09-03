/**
 * contact-card-ring (THEME-08) — node-testable invariants for `statusGlyph`,
 * the parallel status -> distinct-silhouette mapping added BESIDE the unchanged
 * `ringVisual` (one glyph+hue source, D-05: never a second status source).
 *
 * Pure module (react-native-free), so this runs under the node vitest harness.
 * `StatusGlyph.tsx` (the presentational render) is device-UAT, not node-tested.
 */
import { describe, expect, it } from "vitest";
import {
  statusGlyph,
  type StatusDisplayState,
} from "./contact-card-ring";

/** The full six-state display domain (ProfileStatus + snoozed + null). */
const ALL_STATES: readonly StatusDisplayState[] = [
  "stable",
  "wobble",
  "decay",
  "rogue",
  "snoozed",
  null,
];

describe("statusGlyph", () => {
  it("is total over StatusDisplayState — every state resolves a glyph id", () => {
    for (const state of ALL_STATES) {
      expect(statusGlyph(state), String(state)).toBeTruthy();
      expect(typeof statusGlyph(state)).toBe("string");
    }
  });

  it("maps each of the six display states to a DISTINCT glyph (no merge)", () => {
    const ids = ALL_STATES.map(statusGlyph);
    expect(new Set(ids).size).toBe(ALL_STATES.length);
  });

  it("maps null (never contacted) to the neutral glyph", () => {
    expect(statusGlyph(null)).toBe("status-neutral");
  });

  it("maps snoozed to its own glyph, distinct from every ProfileStatus + neutral", () => {
    const snoozed = statusGlyph("snoozed");
    const others = [
      statusGlyph("stable"),
      statusGlyph("wobble"),
      statusGlyph("decay"),
      statusGlyph("rogue"),
      statusGlyph(null),
    ];
    expect(others).not.toContain(snoozed);
  });

  it("is deterministic — the same state always yields the same glyph id", () => {
    for (const state of ALL_STATES) {
      expect(statusGlyph(state)).toBe(statusGlyph(state));
    }
  });
});
