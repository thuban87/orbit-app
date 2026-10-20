/**
 * Typography / spacing / radii token invariants (THEME-07, UI-SPEC Design System).
 *
 * Pure-data assertions — these modules import nothing from react-native and carry
 * no colour literal (colour is a TOKEN NAME resolved through useTheme() at render).
 * The core contract (dossier §H): exactly FIVE semantic roles over exactly FOUR
 * sizes and exactly TWO weights, with label vs caption sharing the 14 step and
 * diverging by weight + colour token.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RADII } from "./radii";
import { SPACING } from "./spacing";
import {
  PROFILE_HEADING_SCALE,
  resolveFontFamily,
  TYPOGRAPHY,
  type TypographyRole,
} from "./typography";

const ROOT = resolve(__dirname, "../../..");
const read = (relPath: string) => readFileSync(resolve(ROOT, relPath), "utf8");

/**
 * The keys `src/theme/fonts.ts` `getFontMap()` registers with expo-font. Read
 * from the source (calling getFontMap() would `require` the .ttf assets, which
 * is device-only), so a key rename there fails this contract.
 */
function registeredFontKeys(): string[] {
  const source = read("src/theme/fonts.ts");
  const body = source.slice(
    source.indexOf("export function getFontMap"),
    source.indexOf("export type FontLoader"),
  );
  return [...body.matchAll(/"([^"]+)":\s*require\(/g)].map((m) => m[1]);
}

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

// 38.14 D-52 / D-56: the Profile-only S2 heading scale, separate from
// TYPOGRAPHY so the §H five-role / four-size contract above stays unchanged.
describe("PROFILE_HEADING_SCALE (38.14 D-52, D-56)", () => {
  it("has exactly the three Profile heading levels", () => {
    expect(Object.keys(PROFILE_HEADING_SCALE).sort()).toEqual([
      "h1",
      "h2",
      "h3",
    ]);
  });

  it("pins the S2 sizes 26 / 20 / 14", () => {
    expect(PROFILE_HEADING_SCALE.h1.size).toBe(26);
    expect(PROFILE_HEADING_SCALE.h2.size).toBe(20);
    expect(PROFILE_HEADING_SCALE.h3.size).toBe(14);
  });

  it("colours H1 primary, H2 accent text and H3 muted, by token name only", () => {
    expect(PROFILE_HEADING_SCALE.h1.colorToken).toBe("textPrimary");
    expect(PROFILE_HEADING_SCALE.h2.colorToken).toBe("accentText");
    expect(PROFILE_HEADING_SCALE.h3.colorToken).toBe("textSecondary");
  });

  it("renders H3 upper-case and letter-spaced; H1 and H2 neither", () => {
    expect(PROFILE_HEADING_SCALE.h3.uppercase).toBe(true);
    expect(PROFILE_HEADING_SCALE.h3.letterSpacing).toBeGreaterThan(0);
    for (const level of ["h1", "h2"] as const) {
      expect(PROFILE_HEADING_SCALE[level].uppercase).toBe(false);
      expect(PROFILE_HEADING_SCALE[level].letterSpacing).toBe(0);
    }
  });

  it("uses the bundled Space Grotesk SemiBold for every level (no new font file)", () => {
    const keys = registeredFontKeys();
    for (const level of ["h1", "h2", "h3"] as const) {
      const { family, weight, lineHeight, size } = PROFILE_HEADING_SCALE[level];
      expect(family).toBe("Space Grotesk");
      expect(weight).toBe(600);
      expect(resolveFontFamily(family, weight)).toBe("SpaceGrotesk-SemiBold");
      expect(keys).toContain(resolveFontFamily(family, weight));
      expect(lineHeight).toBeGreaterThan(size);
    }
  });
});

describe("resolveFontFamily (RG-031 ui-accessibility/AUD-UIA-015)", () => {
  it("maps semantic family + weight to the registered font keys", () => {
    expect(resolveFontFamily("Inter", 400)).toBe("Inter-Regular");
    expect(resolveFontFamily("Inter", 600)).toBe("Inter-SemiBold");
    expect(resolveFontFamily("Space Grotesk", 600)).toBe(
      "SpaceGrotesk-SemiBold",
    );
  });

  it("resolves every TYPOGRAPHY role to a key fonts.ts registers", () => {
    const keys = registeredFontKeys();
    expect(keys.sort()).toEqual(
      ["Inter-Regular", "Inter-SemiBold", "SpaceGrotesk-SemiBold"].sort(),
    );
    for (const role of Object.keys(TYPOGRAPHY) as TypographyRole[]) {
      const { family, weight } = TYPOGRAPHY[role];
      expect(keys).toContain(resolveFontFamily(family, weight));
    }
  });

  it.each(["src/components/ListRow.tsx", "src/components/GridCard.tsx"])(
    "%s never assigns a bare semantic TYPOGRAPHY family",
    (relPath) => {
      const source = read(relPath);
      expect(source).not.toMatch(/fontFamily:\s*TYPOGRAPHY\.[a-z]+\.family/);
      expect(
        source.match(/fontFamily:\s*resolveFontFamily\(/g)?.length ?? 0,
      ).toBeGreaterThanOrEqual(3);
    },
  );

  // Plan 08 deferred nit (38.4-20): each swapped site is counted exactly, so a
  // new bare family or a lost swap fails.
  it.each([
    // 38.13-10 (D-39): the bulk-frequency sheet's two label styles left
    // HomeScreen with its days field; the sheet uses AppText and Button.
    ["src/screens/HomeScreen.tsx", 0],
    // 38.13 D-90 retired CardContextMenu.tsx (its 2 sites went with it).
    ["src/components/BulkActionSurface.tsx", 7],
  ])(
    "%s assigns registered font keys only (%i resolveFontFamily sites)",
    (relPath, expected) => {
      const source = read(relPath);
      expect(source).not.toMatch(/fontFamily:\s*TYPOGRAPHY\.[a-z]+\.family/);
      expect(
        source.match(/fontFamily:\s*resolveFontFamily\(/g)?.length ?? 0,
      ).toBe(expected);
    },
  );

  it("AppText uses the shared mapping instead of a private copy", () => {
    const source = read("src/components/ui/AppText.tsx");
    expect(source).not.toMatch(/function resolveFontFamily/);
    expect(source).toMatch(/resolveFontFamily\(t\.family, t\.weight\)/);
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
