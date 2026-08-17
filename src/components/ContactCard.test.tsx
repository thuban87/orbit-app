/**
 * ringVisual unit coverage (12-01) — the PURE status→ring mapping extracted from
 * ContactCard so the retired OD-1 opacity-encoding cannot silently return
 * (addresses Codex/Claude M1). No render: this asserts the pure helper directly
 * against a sentinel-string colours fixture, so no hex literal appears here
 * (check:colors bars a literal outside src/**\/theme/**).
 */
import { describe, expect, it } from "vitest";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { ThemePalette } from "@/theme/theme-types";
// Import from the pure RN-free sibling module — importing from ContactCard.tsx
// would transitively load `react-native` (Flow-typed, unparseable in the node
// test env). ringVisual is ALSO re-exported from ContactCard.tsx for app use.
import { ringVisual } from "./contact-card-ring";

// Sentinel colours — arbitrary NON-HEX strings so the test asserts token WIRING
// (which palette field each status reads) without embedding a colour literal.
// Only the fields ringVisual can read are populated; the cast fills the rest.
const colors = {
  statusStable: "token:statusStable",
  statusWobble: "token:statusWobble",
  statusDecay: "token:statusDecay",
  rogue: "token:rogue",
  border: "token:border",
} as unknown as ThemePalette;

describe("ringVisual (retires OD-1 opacity placeholder)", () => {
  it("maps stable to the statusStable token, full opacity, weight 2", () => {
    expect(ringVisual("stable", colors)).toEqual({
      color: colors.statusStable,
      opacity: 1,
      width: 2,
    });
  });

  it("maps wobble to the statusWobble token, full opacity, weight 3", () => {
    expect(ringVisual("wobble", colors)).toEqual({
      color: colors.statusWobble,
      opacity: 1,
      width: 3,
    });
  });

  it("maps decay to the statusDecay token, full opacity, thickest weight 4", () => {
    expect(ringVisual("decay", colors)).toEqual({
      color: colors.statusDecay,
      opacity: 1,
      width: 4,
    });
  });

  it("maps rogue to the rogue token, full opacity, weight 3", () => {
    expect(ringVisual("rogue", colors)).toEqual({
      color: colors.rogue,
      opacity: 1,
      width: 3,
    });
  });

  it("maps null (never-contacted) to a faint neutral border ring, weight 2", () => {
    expect(ringVisual(null, colors)).toEqual({
      color: colors.border,
      opacity: 0.5,
      width: 2,
    });
  });

  it("never signals a REAL status through opacity — all four are fully opaque", () => {
    const real: ProfileStatus[] = ["stable", "wobble", "decay", "rogue"];
    for (const status of real) {
      expect(ringVisual(status, colors).opacity).toBe(1);
    }
    // and colour is the primary channel — every real status resolves a distinct token
    const realColors = real.map((s) => ringVisual(s, colors).color);
    expect(new Set(realColors).size).toBe(real.length);
  });
});
