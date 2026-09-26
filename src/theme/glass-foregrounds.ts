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
 *     darken"; `STANDARD_LIGHT_GLASS_VARIANTS`).
 *   - `accentText` (link text) resolves to a darker, lightness-only variant
 *     keyed by the RESOLVED accent id (`STANDARD_LIGHT_GLASS_ACCENT_TEXT`;
 *     owner ruling D-26, which accepts the sub-12% aurora-teal and emerald
 *     variants). The accent FILL and `onAccent` are never touched.
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

import { DEFAULT_ACCENT } from "./accents";
import { ACCENT_IDS, type AccentId } from "./theme-option-ids";
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

/**
 * Darker Standard-Light-only `accentText` (link text, AA_NORMAL 4.5) for every
 * curated accent, keyed by the RESOLVED accent id (D-24; owner ruling D-26,
 * 2026-09-26). Derived like `STANDARD_LIGHT_GLASS_VARIANTS`: only the HSL
 * lightness of the accent's Standard-Light `text` tone (`accents.ts`) is
 * lowered, to the lightest value that clears the both-extrema + interval proof
 * over every Standard asset in the card and chrome regimes with a 0.1 margin.
 * The binding case is Dusk's darkest composite `#94939A`.
 *
 *   nebula-blue  #2A46C7 -> #162568   (L 24.7%)
 *   slate-indigo #3C4AA0 -> #202856   (L 23.1%, Standard default)
 *   aurora-teal  #0B6A64 -> #05312E   (L 10.6%, owner-accepted sub-12%, D-26)
 *   solar-amber  #7A5610 -> #392807   (L 12.5%)
 *   rose-quartz  #A8244D -> #541227   (L 20.0%)
 *   violet-haze  #5E37B5 -> #331E61   (L 24.9%)
 *   emerald      #106A33 -> #083319   (L 11.6%, owner-accepted sub-12%, D-26)
 *   coral        #B03A26 -> #501A11   (L 19.0%)
 *
 * Ratios per asset are recorded in 38.4-RG029-INVENTORY.md; all eight are on
 * the owner's device-review list (Plan 17).
 */
export const STANDARD_LIGHT_GLASS_ACCENT_TEXT: Record<AccentId, string> = {
  "nebula-blue": "#162568",
  "slate-indigo": "#202856",
  "aurora-teal": "#05312E",
  "solar-amber": "#392807",
  "rose-quartz": "#541227",
  "violet-haze": "#331E61",
  emerald: "#083319",
  coral: "#501A11",
};

/**
 * The accents whose glass `accentText` variant sits below the D-24 near-black
 * floor (HSL L 12%) by explicit owner acceptance (D-26, 2026-09-26): lightness
 * alone cannot clear Dusk's darkest composite for them any other way.
 */
export const OWNER_ACCEPTED_SUB12_ACCENT_TEXT = [
  "aurora-teal",
  "emerald",
] as const satisfies readonly AccentId[];

/**
 * Resolve a stored accent id to the curated id actually rendered: NULL or an
 * unknown/tampered id falls back to the package default — the same rule
 * `resolveAccent` applies, so the glass variant always matches the root tone.
 */
function resolvedAccentId(
  id: AccentId | null,
  themePackage: ThemePackage,
): AccentId {
  return id !== null && (ACCENT_IDS as readonly string[]).includes(id)
    ? id
    : DEFAULT_ACCENT[themePackage];
}

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
  const {
    palette,
    package: themePackage,
    mode,
    accentId,
    backgroundIsAsset,
  } = input;
  if (themePackage !== "standard" || mode !== "light" || !backgroundIsAsset) {
    return null;
  }
  return {
    ...palette,
    textSecondary: palette.textPrimary,
    ...STANDARD_LIGHT_GLASS_VARIANTS,
    accentText:
      STANDARD_LIGHT_GLASS_ACCENT_TEXT[
        resolvedAccentId(accentId, themePackage)
      ],
  };
}
