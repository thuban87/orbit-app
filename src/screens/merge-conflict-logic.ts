import type { ContactMethodType } from "@/logic/contact-method-normalization";

export type MergeConflictChoice = "survivor" | "absorbed";

export interface MergeConflictCompletionInput {
  scalarKeys: readonly string[];
  customFieldIds: readonly number[];
  primaryTypes: readonly ContactMethodType[];
  hasPhotoConflict: boolean;
  scalarChoices: Readonly<Record<string, MergeConflictChoice | undefined>>;
  customFieldChoices: Readonly<Record<number, MergeConflictChoice | undefined>>;
  primaryChoices: Readonly<Partial<Record<ContactMethodType, MergeConflictChoice>>>;
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
  return scalarKeys.every((key) => scalarChoices[key] != null) &&
    customFieldIds.every((id) => customFieldChoices[id] != null) &&
    primaryTypes.every((type) => primaryChoices[type] != null) &&
    (!hasPhotoConflict || photoChoice != null);
}
