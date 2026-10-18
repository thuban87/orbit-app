import type {
  ContactMethodDraft,
  ContactMethodRow,
} from "@/db/contact-methods-dao";
import {
  type ContactMethodType,
  normalizeContactMethod,
} from "@/logic/contact-method-normalization";

export type MethodLabel = "Mobile" | "Home" | "Work" | "Main" | "Other";

/** The label choices the option sheet lists, in order. */
export const METHOD_LABELS: readonly MethodLabel[] = [
  "Mobile",
  "Home",
  "Work",
  "Main",
  "Other",
];

/** The choice a stored label shows: a custom or empty label reads as "Other". */
export function methodLabelChoice(
  label: string | null | undefined,
): MethodLabel {
  return METHOD_LABELS.includes(label as MethodLabel)
    ? (label as MethodLabel)
    : "Other";
}

/**
 * The label to store after a pick, or null when the pick changes nothing.
 * Re-picking the current choice is not a change, so re-picking "Other" keeps
 * a typed custom label (the native spinner never fired for it). Picking
 * "Other" from a standard label clears it for the custom-label field.
 */
export function nextMethodLabel(
  current: string | null | undefined,
  picked: MethodLabel,
): string | null {
  if (picked === methodLabelChoice(current)) return null;
  return picked === "Other" ? "" : picked;
}

/** The controlled UI shape. Persisted IDs seed rows; uid never changes in a draft. */
export interface ContactMethodEditorDraft extends ContactMethodDraft {
  extension: string;
  label: MethodLabel | string;
  /** DAO-derived actionability; undefined for a newly-entered draft. */
  isActionable?: boolean;
}

export type MethodGroups = Record<
  ContactMethodType,
  ContactMethodEditorDraft[]
>;

export const EMPTY_METHOD_GROUPS: MethodGroups = { phone: [], email: [] };

export function emptyMethodDraft(
  type: ContactMethodType,
  uid: string,
): ContactMethodEditorDraft {
  return { uid, type, value: "", extension: "", label: "Main" };
}

/**
 * An imported phone value as the Import review form's draft (38.12 D-161):
 * the phone's own label as mapped at import (`pickedMethodLabel`), or no
 * label when the phone gave no type — never a forced "Main". An empty label
 * is stored as NULL, like a bulk import's.
 */
export function importedMethodDraft(
  method: ContactMethodDraft,
): ContactMethodEditorDraft {
  return { ...method, extension: "", label: method.label ?? "" };
}

export function seedMethodDraft(
  row: ContactMethodRow,
): ContactMethodEditorDraft {
  return {
    id: row.id,
    uid: row.uid,
    type: row.method_type,
    value: row.raw_value,
    extension: row.extension ?? "",
    label: row.label ?? "Main",
    isPrimary: row.is_primary === 1,
    isActionable: row.is_actionable === 1,
  };
}

export function seedMethodGroups(
  rows: MethodGroups | Record<ContactMethodType, ContactMethodRow[]>,
): MethodGroups {
  return {
    phone: rows.phone.map((row) =>
      "method_type" in row ? seedMethodDraft(row) : row,
    ),
    email: rows.email.map((row) =>
      "method_type" in row ? seedMethodDraft(row) : row,
    ),
  };
}

/** The one empty create-phone affordance is UI-only and never reaches the DAO. */
export function discardBlankMethodDrafts(
  drafts: ContactMethodEditorDraft[],
): ContactMethodEditorDraft[] {
  return drafts.filter((draft) => draft.value.trim().length > 0);
}

export function toMethodDrafts(groups: MethodGroups): ContactMethodDraft[] {
  return ([...groups.phone, ...groups.email] as ContactMethodEditorDraft[])
    .filter((draft) => draft.value.trim().length > 0)
    .map(({ id, uid, type, value, extension, label, isPrimary }) => ({
      ...(id === undefined ? {} : { id }),
      uid,
      type,
      value,
      extension: extension.trim() || undefined,
      label: label.trim() || undefined,
      isPrimary,
    }));
}

export function addMethodDraft(
  groups: MethodGroups,
  type: ContactMethodType,
  uid: string,
): MethodGroups {
  return { ...groups, [type]: [...groups[type], emptyMethodDraft(type, uid)] };
}

/**
 * Apply a patch to one draft row. When the host passes its effective phone
 * region (saved override, else device region) and the patch changes `value`,
 * the row's `isActionable` is recomputed through the one normalization
 * boundary, so the "can't be used yet" warning follows the typing live (38.11
 * D-30). A blank value clears it to undefined (no warning on an empty row).
 * Warn only: nothing here blocks Save (D-17; ADR-059). Hosts that omit the
 * region keep the row's stored warning, as before.
 */
export function updateMethodDraft(
  groups: MethodGroups,
  uid: string,
  patch: Partial<Omit<ContactMethodEditorDraft, "uid" | "type" | "id">>,
  effectivePhoneRegion?: string | null,
): MethodGroups {
  const recompute =
    effectivePhoneRegion !== undefined && patch.value !== undefined;
  const update = (draft: ContactMethodEditorDraft) => {
    if (draft.uid !== uid) return draft;
    const next = { ...draft, ...patch };
    if (!recompute) return next;
    next.isActionable =
      next.value.trim().length === 0
        ? undefined
        : normalizeContactMethod({
            type: next.type,
            value: next.value,
            defaultPhoneRegion: effectivePhoneRegion,
          }).isActionable;
    return next;
  };
  return { phone: groups.phone.map(update), email: groups.email.map(update) };
}

/** Removing a chosen primary promotes the next displayed row of that type. */
export function removeMethodDraft(
  groups: MethodGroups,
  uid: string,
): MethodGroups {
  const remove = (rows: ContactMethodEditorDraft[]) => {
    const removed = rows.find((row) => row.uid === uid);
    const next = rows.filter((row) => row.uid !== uid);
    if (!removed?.isPrimary || next.length === 0) return next;
    return next.map((row, index) => ({ ...row, isPrimary: index === 0 }));
  };
  return { phone: remove(groups.phone), email: remove(groups.email) };
}

export function choosePrimary(groups: MethodGroups, uid: string): MethodGroups {
  const choose = (rows: ContactMethodEditorDraft[]) =>
    rows.map((row) => ({ ...row, isPrimary: row.uid === uid }));
  const phoneHit = groups.phone.some((row) => row.uid === uid);
  return phoneHit
    ? { phone: choose(groups.phone), email: groups.email }
    : { phone: groups.phone, email: choose(groups.email) };
}

export function resolveEffectivePhoneRegion(
  savedOverride: string | null,
  deviceRegion: string | null,
): string | null {
  return savedOverride ?? deviceRegion;
}

export function canonicalDuplicateCopy(type: ContactMethodType): string {
  return `This matches an existing ${type === "phone" ? "phone number" : "email address"}; only one will be kept.`;
}

/** Keep the DAO-selected surviving row and discard the local duplicate. */
export function collapseCanonicalDuplicate(
  groups: MethodGroups,
  type: ContactMethodType,
  survivingDraftUid: string,
): MethodGroups {
  const rows = groups[type];
  const survivor = rows.find((row) => row.uid === survivingDraftUid);
  if (!survivor) return groups;
  const retained = rows.filter(
    (row) =>
      row.uid === survivingDraftUid ||
      row.value.trim() !== survivor.value.trim(),
  );
  return { ...groups, [type]: retained };
}
