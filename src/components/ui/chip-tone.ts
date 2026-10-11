/**
 * The two selected-chip tiers (38.9 D-05; 39-LEDGER N-10 owner ruling, 39 D-94)
 * as palette token KEYS, RN-free and node-testable. A chip reads its fill,
 * border and label through `colors[tone.*]`, so the tiers have one definition.
 *
 *   primary   top-level choices: selected = solid `accent` fill with an
 *             `onAccent` label (the ADR-084 pair `accents.test.ts` validates);
 *             unselected = `surface` fill, `border` outline, `textPrimary`
 *   sub       sub-options: selected = `accent` outline with an `accentText`
 *             label and no fill; unselected = `border` outline, `textPrimary`,
 *             no fill (the chip shows the surface it sits on)
 *
 * `accent` is a fill/outline only, never a label (ADR-084, ADR-169). Area
 * phases move their own chip screens onto this helper (D-01); 38.9 codifies it
 * and moves only the duration chips (`durationChipTone`).
 */

export type ChipTier = "primary" | "sub";

export interface PrimaryChipTone {
  readonly fill: "accent" | "surface";
  readonly border: "accent" | "border";
  readonly label: "onAccent" | "textPrimary";
}

export interface SubChipTone {
  /** No fill: the sub-option tier is an outline. */
  readonly fill: null;
  readonly border: "accent" | "border";
  readonly label: "accentText" | "textPrimary";
}

export function chipTone(tier: "primary", selected: boolean): PrimaryChipTone;
export function chipTone(tier: "sub", selected: boolean): SubChipTone;
export function chipTone(
  tier: ChipTier,
  selected: boolean,
): PrimaryChipTone | SubChipTone;
export function chipTone(
  tier: ChipTier,
  selected: boolean,
): PrimaryChipTone | SubChipTone {
  if (tier === "primary") {
    return selected
      ? { fill: "accent", border: "accent", label: "onAccent" }
      : { fill: "surface", border: "border", label: "textPrimary" };
  }
  return selected
    ? { fill: null, border: "accent", label: "accentText" }
    : { fill: null, border: "border", label: "textPrimary" };
}
