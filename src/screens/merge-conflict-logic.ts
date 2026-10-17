import { isStoredPhotoPath } from "@/db/photo-relative-path";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { customValueDisplayText } from "@/profile/knowledge-presentation";
import type { FieldType } from "@/schemas/types";

export type MergeConflictChoice = "survivor" | "absorbed";

export interface MergeConflictCompletionInput {
  scalarKeys: readonly string[];
  customFieldIds: readonly number[];
  primaryTypes: readonly ContactMethodType[];
  hasPhotoConflict: boolean;
  scalarChoices: Readonly<Record<string, MergeConflictChoice | undefined>>;
  customFieldChoices: Readonly<Record<number, MergeConflictChoice | undefined>>;
  primaryChoices: Readonly<
    Partial<Record<ContactMethodType, MergeConflictChoice>>
  >;
  photoChoice: string | null;
}

/** A merge cannot advance until every independently destructive choice is explicit. */
export function hasResolvedMergeConflicts({
  scalarKeys,
  customFieldIds,
  primaryTypes,
  hasPhotoConflict,
  scalarChoices,
  customFieldChoices,
  primaryChoices,
  photoChoice,
}: MergeConflictCompletionInput): boolean {
  return (
    scalarKeys.every((key) => scalarChoices[key] != null) &&
    customFieldIds.every((id) => customFieldChoices[id] != null) &&
    primaryTypes.every((type) => primaryChoices[type] != null) &&
    (!hasPhotoConflict || photoChoice != null)
  );
}

/**
 * The two custom-field choices as shown (38.9 D-23, D-48, D-66; 38.9-13
 * out-of-scope finding #2). Render only: a Date field's values show the
 * date-only display form, every other type shows its raw value, and a value
 * the date parser rejects stays raw. The stored values, `differs()` and the
 * resolution (an option id) never see the display text. If two different raw
 * values would read the same, both raw values are shown so the choice stays
 * visible (same rule as the birthday choice).
 */
export function customConflictDisplayValues(
  type: FieldType,
  survivor: string,
  absorbed: string,
): [string, string] {
  const shownSurvivor = customConflictDisplayValue(type, survivor);
  const shownAbsorbed = customConflictDisplayValue(type, absorbed);
  return shownSurvivor === shownAbsorbed
    ? [survivor, absorbed]
    : [shownSurvivor, shownAbsorbed];
}

/**
 * One custom-field value as shown in a text choice. A photo-type field shown as
 * text (D-129: one side holds text left in the field) never shows a stored
 * photo's file path; that side reads "Photo". Text shows as itself.
 */
function customConflictDisplayValue(type: FieldType, value: string): string {
  if (type === "photo") return isStoredPhotoPath(value) ? "Photo" : value;
  return customValueDisplayText(type, value);
}

/**
 * A photo-field conflict's choice (D-129). The photo choice also offers its
 * "keep" row; in a merge that keeps the surviving contact's photo.
 */
export function customPhotoConflictChoice(
  selection: string,
): MergeConflictChoice {
  return selection === "absorbed" ? "absorbed" : "survivor";
}
