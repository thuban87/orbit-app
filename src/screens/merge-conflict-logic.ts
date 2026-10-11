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
  const shownSurvivor = customValueDisplayText(type, survivor);
  const shownAbsorbed = customValueDisplayText(type, absorbed);
  return shownSurvivor === shownAbsorbed
    ? [survivor, absorbed]
    : [shownSurvivor, shownAbsorbed];
}
