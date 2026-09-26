/**
 * Glass-scoped foreground palette (RG-029 / ui-accessibility/AUD-UIA-001;
 * owner rulings D-12 and D-24, 2026-09-26).
 *
 * Standard Light renders its cards and chrome as 0.5 white glass over light,
 * mid-tone art (`CARD_GLASS_OPACITY.standard`, owner-protected — D-03/D-12). Over
 * the darkest pixels of the Dusk and Mesh assets the composite drops far enough
 * that the ordinary `textSecondary` token (and, per D-24, several non-text
 * foregrounds) no longer clears AA. D-12 forbids fixing that with glass opacity,
 * a wash, artwork or a protected-hue retune, so the fix is foreground-only and
 * SURFACE-SCOPED: inside a GlassSurface card, a ChromeScrim or the ShellAppBar,
 * and ONLY in Standard Light over an asset background, the palette seen by
 * descendants is this resolver's output instead of the root palette.
 *
 *   - `textSecondary` resolves to `textPrimary` (D-24; research-recommended
 *     surface-scoped override — no 133-file consumer sweep).
 *   - The inventoried on-glass status hues, `rogue` and `danger` resolve to
 *     darker, LIGHTNESS-ONLY Standard-Light variants (D-24 "inventory, then
 *     darken"; `STANDARD_LIGHT_GLASS_VARIANTS`). `accentText` is HELD for the
 *     owner: two curated accents cannot pass by lightness alone (D-24 STOP; see
 *     38.4-RG029-INVENTORY.md).
 *
 * Everything else (Galaxy, Standard Dark, the solid `none` background, opaque
 * sheets/dialogs, Orrery overlays) keeps the root palette: the resolver returns
 * `null` and the scope is a pass-through.
 *
 * The contrast proof (`src/theme/tokens/surface.test.ts`) consumes THIS SAME
 * function to build the effective palette it asserts, so the proof and the
 * runtime scope cannot drift. PURE and react-native-free (node-testable); colour
 * literals are allowed here because the file lives under `src/theme/`.
 */

import type { AccentId } from "./theme-option-ids";
import type { ResolvedMode, ThemePackage, ThemePalette } from "./theme-types";

/**
 * Darker Standard-Light-only variants for the non-text foregrounds the RG-029
 * inventory proves render on Standard glass/chrome (D-24). Each was derived by
 * lowering ONLY the HSL lightness of the Standard Light root hex (hue within
 * ±5°, saturation unchanged within rounding) to the lightest value that clears
 * the both-extrema + interval proof over every Standard asset (Dawn, Paper,
 * Dusk, Mesh) in the card-presentation and chrome regimes with a 0.1 ratio
 * margin. Old hex -> new hex and worst ratios are recorded in
 * `.planning/phases/38.4-audit-remediation-ui-performance-release/
 * 38.4-RG029-INVENTORY.md`; the owner reviews them on the device pass.
 *
 *   statusStable #1E7D5A -> #134F39   (Dusk 1.67 -> 3.13, floor 3.0)
 *   statusWobble #836612 -> #57430C   (Dusk 1.78 -> 3.12, floor 3.0)
 *   statusDecay  #B33A22 -> #7E2918   (Dusk 1.95 -> 3.11, floor 3.0)
 *   rogue        #96591A -> #663C12   (Dusk 1.84 -> 3.11, floor 3.0)
 *   danger       #B21D22 -> #590E11   (Dusk 2.23 -> 4.61, floor 4.5)
 *
 * Galaxy, Standard Dark and the root Standard Light palette are untouched; these
 * apply ONLY inside `GlassForegroundScope` in Standard Light over an asset.
 */
export const STANDARD_LIGHT_GLASS_VARIANTS = {
  statusStable: "#134F39",
  statusWobble: "#57430C",
  statusDecay: "#7E2918",
  rogue: "#663C12",
  danger: "#590E11",
} as const satisfies Partial<Record<keyof ThemePalette, string>>;

/** Inputs that decide whether (and how) the glass foreground override applies. */
export interface GlassForegroundInput {
  /** The root palette the provider resolved (accent already overlaid). */
  palette: ThemePalette;
  /** The active theme package. */
  package: ThemePackage;
  /** The resolved (non-`system`) appearance mode. */
  mode: ResolvedMode;
  /** The active package's stored accent id (NULL = package default). */
  accentId: AccentId | null;
  /** True when the active background resolves to a bundled asset (not `none`). */
  backgroundIsAsset: boolean;
}

/**
 * Resolve the palette that glass/chrome descendants render with, or `null` when
 * the override is inactive (the scope then passes the root palette through).
 *
 * Active only for `package === "standard" && mode === "light" &&
 * backgroundIsAsset`. Returns a NEW palette; never mutates the input.
 */
export function resolveGlassForegroundPalette(
  input: GlassForegroundInput,
): ThemePalette | null {
  const { palette, package: themePackage, mode, backgroundIsAsset } = input;
  if (themePackage !== "standard" || mode !== "light" || !backgroundIsAsset) {
    return null;
  }
  return {
    ...palette,
    textSecondary: palette.textPrimary,
    ...STANDARD_LIGHT_GLASS_VARIANTS,
  };
}
