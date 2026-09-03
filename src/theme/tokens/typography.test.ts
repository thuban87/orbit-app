/**
 * Typography / spacing / radii token invariants (THEME-07, UI-SPEC Design System).
 *
 * Pure-data assertions — these modules import nothing from react-native and carry
 * no colour literal (colour is a TOKEN NAME resolved through useTheme() at render).
 * The core contract (dossier §H): exactly FIVE semantic roles over exactly FOUR
 * sizes and exactly TWO weights, with label vs caption sharing the 14 step and
 * diverging by weight + colour token.
 */
import { describe, expect, it } from "vitest";
import { RADII } from "./radii";
import { SPACING } from "./spacing";
import { TYPOGRAPHY, type TypographyRole } from "./typography";

describe("TYPOGRAPHY", () => {
  const roles = Object.keys(TYPOGRAPHY) as TypographyRole[];

  it("has exactly five semantic roles", () => {
    expect(roles.sort()).toEqual(
      ["body", "caption", "display", "heading", "label"].sort(),
    );
  });

  it("uses exactly four distinct sizes (28/20/16/14)", () => {
    const sizes = new Set(roles.map((r) => TYPOGRAPHY[r].size));
    expect([...sizes].sort((a, b) => b - a)).toEqual([28, 20, 16, 14]);
  });

  it("uses exactly two weights (400 Regular, 600 SemiBold)", () => {
    const weights = new Set(roles.map((r) => TYPOGRAPHY[r].weight));
    expect([...weights].sort((a, b) => a - b)).toEqual([400, 600]);
  });

  it("maps families per dossier §H (Space Grotesk display/heading, Inter rest)", () => {
    expect(TYPOGRAPHY.display.family).toBe("Space Grotesk");
    expect(TYPOGRAPHY.heading.family).toBe("Space Grotesk");
    expect(TYPOGRAPHY.body.family).toBe("Inter");
    expect(TYPOGRAPHY.label.family).toBe("Inter");
    expect(TYPOGRAPHY.caption.family).toBe("Inter");
  });

  it("label and caption share the 14 step but diverge by weight + colour token", () => {
    expect(TYPOGRAPHY.label.size).toBe(14);
    expect(TYPOGRAPHY.caption.size).toBe(14);
    expect(TYPOGRAPHY.label.weight).toBe(600);
    expect(TYPOGRAPHY.caption.weight).toBe(400);
    expect(TYPOGRAPHY.label.colorToken).toBe("textPrimary");
    expect(TYPOGRAPHY.caption.colorToken).toBe("textSecondary");
  });

  it("carries a colour TOKEN name, never a hex literal", () => {
    for (const r of roles) {
      const token = TYPOGRAPHY[r].colorToken;
      expect(token).toMatch(/^text(Primary|Secondary)$/);
      expect(token).not.toMatch(/#/);
    }
  });

  it("every role has a positive line height (reflow-friendly)", () => {
    for (const r of roles) {
      expect(TYPOGRAPHY[r].lineHeight).toBeGreaterThan(TYPOGRAPHY[r].size);
    }
  });
});

describe("SPACING", () => {
  it("exposes the 4-multiple scale xs..2xl", () => {
    expect(SPACING).toEqual({
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 24,
      xl: 32,
      "2xl": 48,
    });
  });

  it("every value is a multiple of 4", () => {
    for (const v of Object.values(SPACING)) {
      expect(v % 4).toBe(0);
    }
  });
});

describe("RADII", () => {
  it("exposes sm..full with pill 999 and full 9999", () => {
    expect(RADII).toEqual({
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      pill: 999,
      full: 9999,
    });
  });
});
