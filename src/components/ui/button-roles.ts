/**
 * button-roles (THEME-10, dossier §P) — the PURE, react-native-free role→treatment
 * mapping for the shared `Button`, extracted into a sibling module (mirroring
 * `contact-card-ring.ts` beside `ContactCard.tsx` and `avatar-initials.ts` beside
 * `Avatar.tsx`) so it is node-unit-testable WITHOUT loading `react-native`
 * (Flow-typed, unparseable in the vitest node env). `Button.tsx` imports and
 * RE-EXPORTS these, so they are still "exported from Button" for app consumers.
 *
 * This module returns theme-token KEYS (never resolved colours), so it carries NO
 * colour literal — the real colour resolves at render via `useTheme().colors[key]`
 * in `Button.tsx`. The five roles express the formal hierarchy:
 *
 *   Primary     filled accent + onAccent text (highest emphasis, one per surface)
 *   Secondary   tonal surface + outline border, textPrimary
 *   Tertiary    text-only, the accent-as-link tone (accentText)
 *   Destructive danger fill/border + the NAMED onDanger foreground for BOTH the
 *               label AND the reserved `warning` registry glyph — distinct beyond
 *               colour (never `onAccent`, never a literal; dossier §P / THEME-10)
 *   IconOnly    registry glyph, 44px min target, accessibilityLabel REQUIRED
 *
 * The foreground token is deliberately an `IconTone` (a string-valued
 * `ThemePalette` key) so it can drive BOTH the AppText label colour AND the
 * `Icon` `tone` prop with one value — the destructive warning glyph is therefore
 * guaranteed to be tinted the same `onDanger` foreground as its label.
 *
 * PURE DATA — only `import type` erasures + the pure `RADII` token map; nothing
 * from `react-native`.
 */
import type { IconName, IconTone } from "@/components/icons/icon-registry";
import { type RadiusToken } from "@/theme/tokens/radii";

/** The five formal button roles (dossier §P). */
export type ButtonRole =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "iconOnly";

/**
 * The Android a11y minimum touch target (dossier §Q). A target-size FLOOR, not a
 * spacing token — every button variant pads up to at least this even when the
 * glyph/label is smaller.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * The resolved visual treatment for a role, expressed as theme-token KEYS +
 * numeric geometry (no colour literal). `Button.tsx` reads `colors[fillToken]`
 * etc. at render.
 */
export interface ButtonVisual {
  /** Palette key filling the background, or `null` for no fill (tertiary/iconOnly). */
  fillToken: IconTone | null;
  /** Palette key for the border colour, or `null` for no border. */
  borderToken: IconTone | null;
  /** Border width in px (0 = no border). */
  borderWidth: number;
  /** Palette key for the label + glyph foreground (drives AppText colour AND Icon tone). */
  foregroundToken: IconTone;
  /** Radius token for the button corners. */
  radiusToken: RadiusToken;
  /** A role-forced registry glyph (destructive → the reserved `warning`); else `null`. */
  glyph: IconName | null;
  /** Whether an `accessibilityLabel` is REQUIRED (icon-only has no text label). */
  requiresAccessibilityLabel: boolean;
  /** The 44×44 minimum touch target every variant honours. */
  minTouchTarget: number;
}

/**
 * The pure role→treatment map. Token KEYS only — resolve to real colour at render
 * via `useTheme()`. Every role returns `minTouchTarget: MIN_TOUCH_TARGET`.
 */
export function buttonVisual(role: ButtonRole): ButtonVisual {
  const base = {
    minTouchTarget: MIN_TOUCH_TARGET,
    requiresAccessibilityLabel: false,
    glyph: null as IconName | null,
  };
  switch (role) {
    case "primary":
      return {
        ...base,
        fillToken: "accent",
        borderToken: null,
        borderWidth: 0,
        foregroundToken: "onAccent",
        radiusToken: "md",
      };
    case "secondary":
      // Tonal surface + an outline border, textPrimary label (dossier §P).
      return {
        ...base,
        fillToken: "surface",
        borderToken: "border",
        borderWidth: 1,
        foregroundToken: "textPrimary",
        radiusToken: "md",
      };
    case "tertiary":
      // Text-only; the accent-as-LINK tone (accentText), never the fill accent.
      return {
        ...base,
        fillToken: null,
        borderToken: null,
        borderWidth: 0,
        foregroundToken: "accentText",
        radiusToken: "md",
      };
    case "destructive":
      // danger fill/border + the NAMED onDanger foreground for label AND the
      // reserved `warning` glyph — distinct beyond colour (never onAccent).
      return {
        ...base,
        fillToken: "danger",
        borderToken: "danger",
        borderWidth: 0,
        foregroundToken: "onDanger",
        radiusToken: "md",
        glyph: "warning",
      };
    case "iconOnly":
      // Circular icon button; caller supplies the registry glyph + a REQUIRED
      // accessibilityLabel; padded to the 44×44 floor.
      return {
        ...base,
        fillToken: null,
        borderToken: null,
        borderWidth: 0,
        foregroundToken: "textPrimary",
        radiusToken: "full",
        requiresAccessibilityLabel: true,
      };
  }
}

/**
 * The pure a11y contract enforced at render by `Button.tsx` (and asserted in the
 * test): an IconOnly button with no `accessibilityLabel` has no accessible name
 * at all (it has no text label to fall back on), so it is rejected. Throws rather
 * than shipping a silently-unlabelled control.
 */
export function assertButtonAccessibility(
  role: ButtonRole,
  opts: { accessibilityLabel?: string },
): void {
  if (
    buttonVisual(role).requiresAccessibilityLabel &&
    !opts.accessibilityLabel?.trim()
  ) {
    throw new Error(
      `Button role "${role}" requires an accessibilityLabel (icon-only a11y contract, THEME-10).`,
    );
  }
}
