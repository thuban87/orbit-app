import type {
  AiPermissionCategory,
  AiPermissionImpact,
  AiPermissionItem,
  AiPermissionRef,
} from "@/db/ai-permissions-dao";

export type AiPermissionTypeFilter = "all" | AiPermissionCategory;

export interface PermissionViewFilter {
  query: string;
  type: AiPermissionTypeFilter;
  enabledOnly: boolean;
}

export interface AiPermissionContactGroup {
  contactUid: string;
  contactName: string;
  items: AiPermissionItem[];
}

export function filterAiPermissionItems(
  items: readonly AiPermissionItem[],
  filter: PermissionViewFilter,
): AiPermissionItem[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (filter.type === "all" || item.category === filter.type) &&
      (!filter.enabledOnly || item.enabled === 1) &&
      (query.length === 0 ||
        item.contactName.toLocaleLowerCase().includes(query)),
  );
}

export function groupAiPermissionItems(
  items: readonly AiPermissionItem[],
): AiPermissionContactGroup[] {
  const groups = new Map<string, AiPermissionContactGroup>();
  for (const item of items) {
    const group = groups.get(item.contactUid);
    if (group) group.items.push(item);
    else {
      groups.set(item.contactUid, {
        contactUid: item.contactUid,
        contactName: item.contactName,
        items: [item],
      });
    }
  }
  return [...groups.values()];
}

export function summarizePermissionView(
  items: readonly AiPermissionItem[],
): AiPermissionImpact {
  return {
    contacts: new Set(items.map((item) => item.contactUid)).size,
    items: new Set(items.map((item) => item.itemKey)).size,
  };
}

/** Whether any narrowing (type, enabled-only, non-blank search) is applied. */
export function isPermissionFilterActive(
  filter: PermissionViewFilter,
): boolean {
  return (
    filter.type !== "all" ||
    filter.enabledOnly ||
    filter.query.trim().length > 0
  );
}

export interface PermissionSummaryCopyInput {
  /** Every loaded item, unfiltered (enabled and disabled). */
  allItems: readonly AiPermissionItem[];
  /** The items the current type / enabled-only / search view shows. */
  filteredItems: readonly AiPermissionItem[];
  /** The "Enabled only" switch: the list then holds only AI-accessible items. */
  enabledOnly: boolean;
  /** No successful read backs the counts (failed or not-yet-completed load). */
  loadFailed: boolean;
}

export interface PermissionSummaryCopy {
  /** Actual AI access, from the unfiltered ENABLED items; null without a read. */
  accessLine: string | null;
  /**
   * Exactly what the list below shows: its items of the total, from how many
   * contacts, and how many of them AI can access (D-44). Null without a read,
   * and null when there are no items at all (`emptyLine` covers that).
   */
  listLine: string | null;
  /** Copy for an empty review list; null when the list has rows or no read. */
  emptyLine: string | null;
}

export const PERMISSION_EMPTY_COPY =
  "AI can't access any contact information yet.";
export const PERMISSION_NO_MATCH_COPY = "No information matches these filters.";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Items AI can access, from a list that may include disabled ones. */
function enabledItems(
  items: readonly AiPermissionItem[],
): readonly AiPermissionItem[] {
  return items.filter((item) => item.enabled === 1);
}

function accessPhrase(shown: number, accessible: number): string {
  if (shown === 1)
    return accessible === 1 ? "AI can access it" : "AI can't access it";
  if (accessible === shown) return "AI can access all of them";
  if (accessible === 0) return "AI can access none of them";
  return `AI can access ${accessible} of them`;
}

/**
 * The permission summary copy (38.4 RG-008; ui-accessibility/AUD-UIA-013; D-17;
 * D-44). The access line is the truthful total: it is computed from the
 * UNFILTERED enabled items, never from the filtered view, so a search, a type
 * filter or the Enabled-only switch never reads as "AI can access less". The
 * list line describes exactly the rows below — how many items of the total,
 * from how many contacts, and how many of those AI can access — because the
 * list may include items AI cannot access (D-44). Every count uses
 * `summarizePermissionView`'s one counting rule (unique item keys and contact
 * uids), so the list line reconciles with the contact headers and, for the
 * full unfiltered view, with the access line. With no successful read there is
 * no truthful count, so nothing is printed (the screen shows its error or
 * loading state instead).
 */
export function buildPermissionSummaryCopy(
  input: PermissionSummaryCopyInput,
): PermissionSummaryCopy {
  if (input.loadFailed) {
    return { accessLine: null, listLine: null, emptyLine: null };
  }
  const access = summarizePermissionView(enabledItems(input.allItems));
  const accessLine = `AI can currently access information from ${plural(
    access.contacts,
    "contact",
    "contacts",
  )} · ${plural(access.items, "item", "items")}`;
  const total = summarizePermissionView(input.allItems).items;
  const shown = summarizePermissionView(input.filteredItems);
  const accessible = input.enabledOnly
    ? shown.items
    : summarizePermissionView(enabledItems(input.filteredItems)).items;
  let listLine: string | null = null;
  if (total > 0 && shown.items === 0) {
    listLine = `Showing 0 of ${plural(total, "item", "items")}`;
  } else if (total > 0) {
    const itemsPhrase =
      shown.items === total
        ? total === 1
          ? "1 item"
          : `all ${total} items`
        : `${shown.items} of ${plural(total, "item", "items")}`;
    listLine = `Showing ${itemsPhrase} from ${plural(
      shown.contacts,
      "contact",
      "contacts",
    )} · ${accessPhrase(shown.items, accessible)}`;
  }
  const emptyLine =
    input.filteredItems.length > 0
      ? null
      : access.items === 0
        ? PERMISSION_EMPTY_COPY
        : PERMISSION_NO_MATCH_COPY;
  return { accessLine, listLine, emptyLine };
}

/** Convert selected display rows to unique permission-owning row references. */
export function selectedPermissionRefs(
  items: readonly AiPermissionItem[],
  selectedItemKeys: ReadonlySet<string>,
): AiPermissionRef[] {
  const refs = new Map<string, AiPermissionRef>();
  for (const item of items) {
    if (!selectedItemKeys.has(item.itemKey)) continue;
    refs.set(`${item.category}:${item.id}`, {
      category: item.category,
      id: item.id,
    });
  }
  return [...refs.values()];
}

export function selectionImpact(
  items: readonly AiPermissionItem[],
  selectedItemKeys: ReadonlySet<string>,
): AiPermissionImpact {
  return summarizePermissionView(
    items.filter((item) => selectedItemKeys.has(item.itemKey)),
  );
}
