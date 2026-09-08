import type { ContactPickerRow } from "@/logic/contact-picker-source";

/** A durable local contact row used by the System membership editor. */
export interface SystemMemberRow {
  readonly id: number;
  readonly name: string | null;
  /** App-local relative photo path, never a Contacts Provider thumbnail URI. */
  readonly photo: string | null;
  readonly searchMethods: readonly string[];
  /** Active, tracked contacts are available for a manual inclusion. */
  readonly available: boolean;
}

export type MemberCardState =
  | "member"
  | "excluded"
  | "added"
  | "archived-added";

export type DerivedMemberRow = SystemMemberRow & {
  readonly state: MemberCardState;
};

/** Delta consumed by systems-dao's setSystemOverride replacement operation. */
export interface OverrideIntent {
  readonly contactId: number;
  readonly mode: "include" | "exclude" | null;
}

/**
 * Derive only currently meaningful cards. Rule candidates seed the dynamic
 * bucket; an exclusion outside it is intentionally invisible and prunable.
 */
export function deriveMemberRows(
  candidateIds: readonly number[],
  includeIds: readonly number[],
  excludeIds: readonly number[],
  contactRows: readonly SystemMemberRow[],
): DerivedMemberRow[] {
  const candidates = new Set(candidateIds);
  const includes = new Set(includeIds);
  const excludes = new Set(excludeIds);

  return contactRows.flatMap((row): DerivedMemberRow[] => {
    if (candidates.has(row.id)) {
      return [{ ...row, state: excludes.has(row.id) ? "excluded" : "member" }];
    }
    if (!includes.has(row.id)) return [];
    return [{ ...row, state: row.available ? "added" : "archived-added" }];
  });
}

/** Selecting an active contact outside the dynamic bucket creates an include. */
export function applyAdd(row: SystemMemberRow): OverrideIntent | null {
  return row.available ? { contactId: row.id, mode: "include" } : null;
}

/** Toggle a selected card off, or undo the override that made it unselected. */
export function applyDeselect(row: DerivedMemberRow): OverrideIntent {
  if (row.state === "member") return { contactId: row.id, mode: "exclude" };
  return { contactId: row.id, mode: null };
}

export function overrideCounts(rows: readonly DerivedMemberRow[]): {
  total: number;
  added: number;
  excluded: number;
} {
  return rows.reduce(
    (counts, row) => ({
      total:
        counts.total +
        (row.state === "member" || row.state === "added" ? 1 : 0),
      added: counts.added + (row.state === "added" ? 1 : 0),
      excluded: counts.excluded + (row.state === "excluded" ? 1 : 0),
    }),
    { total: 0, added: 0, excluded: 0 },
  );
}

/**
 * The picker helpers own search behavior. Adapt a local row without leaking
 * the durable photo path into their external-thumbnail field.
 */
export function toPickerRow(row: SystemMemberRow): ContactPickerRow {
  const searchMethods = row.searchMethods.filter(
    (method) => method.trim() !== "",
  );
  return {
    lookupKey: String(row.id),
    displayName: row.name?.trim() || "Unnamed contact",
    primaryMethod: searchMethods[0] ?? null,
    searchMethods,
    photoThumbUri: null,
  };
}
