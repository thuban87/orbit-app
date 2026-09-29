/**
 * The active Population/Filters/Sort trigger look (38.5 D-46; code review
 * IN-06). The control row renders with the ROOT palette (it sits in no glass
 * scope), over an opaque `surface` fill in both states, so its text contrast is
 * the palette pair itself, for every package × mode and every accent.
 */
import { describe, expect, it } from "vitest";
import { applyAccent, resolveAccent } from "@/theme/accents";
import { controlTriggerBacking } from "@/theme/art-treatments";
import { AA_NORMAL, contrastRatio } from "@/theme/contrast";
import { ACCENT_IDS, type AccentId } from "@/theme/theme-option-ids";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import { controlTriggerLook } from "./trigger-look";

const PAIRS: readonly [ThemePackage, ResolvedMode][] = [
  ["galaxy", "light"],
  ["galaxy", "dark"],
  ["standard", "light"],
  ["standard", "dark"],
];
/** null = the package default accent. */
const ACCENTS: readonly (AccentId | null)[] = [null, ...ACCENT_IDS];

function paletteOf(
  pkg: ThemePackage,
  mode: ResolvedMode,
  accentId: AccentId | null,
) {
  return applyAccent(
    resolvePalette(pkg, mode),
    resolveAccent(accentId, pkg, mode),
  );
}

describe("controlTriggerLook (D-46)", () => {
  it("active keeps the inactive fill and switches the border and text to the accent", () => {
    const colors = paletteOf("galaxy", "dark", null);
    const inactive = controlTriggerLook(false, true, colors);
    const active = controlTriggerLook(true, true, colors);
    expect(inactive).toEqual({
      fill: colors.surface,
      border: colors.border,
      label: colors.textPrimary,
      summary: colors.textSecondary,
    });
    expect(active).toEqual({
      fill: colors.surface,
      border: colors.accent,
      label: colors.accentText,
      summary: colors.accentText,
    });
  });

  it("the fill follows the table's answer (a DEV `none` override draws no fill)", () => {
    const colors = paletteOf("standard", "light", null);
    expect(controlTriggerLook(true, false, colors).fill).toBeNull();
    expect(
      controlTriggerLook(
        true,
        controlTriggerBacking(true, "full") === "full",
        colors,
      ).fill,
    ).toBe(colors.surface);
  });

  it.each(PAIRS)(
    "%s/%s: the active label and summary (accentText) clear AA on the surface fill for every accent",
    (pkg, mode) => {
      for (const accentId of ACCENTS) {
        const colors = paletteOf(pkg, mode, accentId);
        // An opaque fill: the text's contrast is the palette pair itself.
        expect(colors.surface, `${pkg}/${mode} surface`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        );
        const look = controlTriggerLook(true, true, colors);
        for (const fg of [look.label, look.summary]) {
          expect(
            contrastRatio(fg, look.fill as string),
            `${pkg}/${mode} ${accentId ?? "default"}`,
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        }
      }
    },
  );

  it.each(PAIRS)(
    "%s/%s: the active state is distinguishable from the inactive one (border and label change) for every accent",
    (pkg, mode) => {
      for (const accentId of ACCENTS) {
        const colors = paletteOf(pkg, mode, accentId);
        const inactive = controlTriggerLook(false, true, colors);
        const active = controlTriggerLook(true, true, colors);
        expect(active.border).not.toBe(inactive.border);
        expect(active.label).not.toBe(inactive.label);
      }
    },
  );
});
