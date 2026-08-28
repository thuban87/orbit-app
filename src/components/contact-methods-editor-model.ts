import type {
  ContactMethodDraft,
  ContactMethodRow,
} from "@/db/contact-methods-dao";
import type { ContactMethodType } from "@/logic/contact-method-normalization";

export type MethodLabel = "Mobile" | "Home" | "Work" | "Main" | "Other";

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

export function seedMethodDraft(
  row: ContactMethodRow,
): ContactMethodEditorDraft {
  return {
    id: row.id,
    uid: row.uid,
    type: row.method_type,
    value: row.raw_value,
    extension: row.extension ?? "",
    label: "Main",
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
    .map(({ id, uid, type, value, extension, isPrimary }) => ({
      ...(id === undefined ? {} : { id }),
      uid,
      type,
      value,
      extension: extension.trim() || undefined,
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

export function updateMethodDraft(
  groups: MethodGroups,
  uid: string,
  patch: Partial<Omit<ContactMethodEditorDraft, "uid" | "type" | "id">>,
): MethodGroups {
  const update = (draft: ContactMethodEditorDraft) =>
    draft.uid === uid ? { ...draft, ...patch } : draft;
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
