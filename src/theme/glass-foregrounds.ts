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
  };
}
