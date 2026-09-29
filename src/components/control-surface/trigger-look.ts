/**
 * The colours of a Contacts Population/Filters/Sort trigger (38.5 D-46; code
 * review IN-06, owner ruling 2026-09-29 on gap H-3 / I1).
 *
 * The owner: "fill them when active too actually, just invert the colors maybe?
 * Or leave the regular fill color and just switch the border/font colors. It
 * needs to have some indication that that button has something set within it".
 * He chose the SECOND option:
 *   - inactive: the solid `surface` fill, the `border` border, a `textPrimary`
 *     label and a `textSecondary` summary;
 *   - active: the SAME `surface` fill, with the border switched to `accent` and
 *     the label and summary to `accentText` (AA on `surface` for every accent,
 *     proven in `trigger-look.test.ts`).
 *
 * The fill itself comes from the art treatment table (`controlTriggerBacking`,
 * read by `DashboardControlRow`); `filled` is its answer. Production fills the
 * active state in every combination (`activeTriggerBacking: "full"`).
 *
 * ALTERNATIVE (the owner's first option, "invert the colors"): if the device
 * check (38.5-09) prefers it, change ONLY the active branch below to
 *   fill `colors.accent`, border `colors.accent`, label and summary
 *   `colors.onAccent`
 * (the accent fill / onAccent text pair every accent is tuned for), and prove
 * `onAccent` on `accent` in the test instead.
 *
 * PURE: palette-token reads only, no react-native import.
 */
import type { ThemePalette } from "@/theme";

export interface TriggerLook {
  /** The trigger's fill, or null for no fill. */
  fill: string | null;
  border: string;
  label: string;
  summary: string;
}

export function controlTriggerLook(
  active: boolean,
  filled: boolean,
  colors: Pick<
    ThemePalette,
    | "surface"
    | "border"
    | "accent"
    | "accentText"
    | "textPrimary"
    | "textSecondary"
  >,
): TriggerLook {
  const fill = filled ? colors.surface : null;
  if (!active) {
    return {
      fill,
      border: colors.border,
      label: colors.textPrimary,
      summary: colors.textSecondary,
    };
  }
  // ACTIVE (D-46): the regular fill, accent border and accent text. See the
  // header for the inverted alternative.
  return {
    fill,
    border: colors.accent,
    label: colors.accentText,
    summary: colors.accentText,
  };
}
