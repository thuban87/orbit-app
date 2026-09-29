import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_NORMAL, contrastRatio } from "./contrast";
import {
  PERSISTENT_DANGER_SCRIM_SITES,
  persistentDangerScrim,
} from "./danger-scrim";
import { resolvePalette } from "./theme-presets";
import type { ResolvedMode, ThemePackage } from "./theme-types";

const REPO = join(__dirname, "..", "..");
// The H2 art-checker margin, so the scrim is not a knife-edge pass.
const MARGIN = 0.1;

describe("persistentDangerScrim — D-50 (D25-B)", () => {
  it("backs Galaxy Dark with the opaque root background, clearing 4.5:1 with margin", () => {
    const colors = resolvePalette("galaxy", "dark");
    const scrim = persistentDangerScrim({
      package: "galaxy",
      mode: "dark",
      colors,
    });
    expect(scrim).toEqual({ backgroundColor: colors.background });
    expect(
      contrastRatio(colors.danger, scrim?.backgroundColor ?? ""),
    ).toBeGreaterThanOrEqual(AA_NORMAL + MARGIN);
  });

  it("draws nothing in the other package × mode combinations", () => {
    const others: [ThemePackage, ResolvedMode][] = [
      ["galaxy", "light"],
      ["standard", "light"],
      ["standard", "dark"],
    ];
    for (const [pkg, mode] of others) {
      expect(
        persistentDangerScrim({
          package: pkg,
          mode,
          colors: resolvePalette(pkg, mode),
        }),
        `${pkg}-${mode}`,
      ).toBeUndefined();
    }
  });

  it("is applied at each of the four persistent danger strings", () => {
    // [the style expression carrying the scrim, the string it backs]
    const expected: Record<
      (typeof PERSISTENT_DANGER_SCRIM_SITES)[number],
      [string, string]
    > = {
      "src/screens/BulkImportSetupScreen.tsx": [
        "persistentDangerScrim(theme)",
        "BULK_IMPORT_STOPPED_DISCARD",
      ],
      "src/screens/ReconcileDetailScreen.tsx": [
        "persistentDangerScrim(theme)",
        "Unlink source",
      ],
      "src/components/PhotoSourcePicker.tsx": [
        "removeScrim && [styles.scrimmedActionBtn, removeScrim]",
        "Remove photo",
      ],
      "src/components/MergeImpactSummary.tsx": [
        "persistentDangerScrim(theme)",
        "will be retired.",
      ],
    };
    for (const site of PERSISTENT_DANGER_SCRIM_SITES) {
      const src = readFileSync(join(REPO, site), "utf8");
      const [styleExpr, text] = expected[site];
      expect(src, site).toContain("persistentDangerScrim(theme)");
      const call = src.lastIndexOf(styleExpr);
      expect(call, site).toBeGreaterThan(-1);
      // The scrimmed style is on the element that renders the string: the call
      // sits within a few lines before the string itself.
      const at = src.indexOf(text, call);
      expect(at, site).toBeGreaterThan(call);
      expect(src.slice(call, at).split("\n").length, site).toBeLessThan(12);
    }
  });
});
