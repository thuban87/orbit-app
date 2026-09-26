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
  filterActive: boolean;
  /** No successful read backs the counts (failed or not-yet-completed load). */
  loadFailed: boolean;
}

export interface PermissionSummaryCopy {
  /** Actual AI access, from the unfiltered ENABLED items; null without a read. */
  accessLine: string | null;
  /** The filtered view against the unfiltered item count; null when unfiltered. */
  showingLine: string | null;
  /** Copy for an empty review list; null when the list has rows or no read. */
  emptyLine: string | null;
}

export const PERMISSION_EMPTY_COPY =
  "AI can't access any contact information yet.";
export const PERMISSION_NO_MATCH_COPY = "No information matches these filters.";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The permission summary copy (38.4 RG-008; ui-accessibility/AUD-UIA-013; D-17).
 * The access claim is computed from the UNFILTERED enabled items, never from
 * the filtered view — a search or type filter must not read as "AI can access
 * less". When any filter is active a separate "Showing N of M" line describes
 * the view. With no successful read there is no truthful count, so nothing is
 * printed (the screen shows its error or loading state instead).
 */
export function buildPermissionSummaryCopy(
  input: PermissionSummaryCopyInput,
): PermissionSummaryCopy {
  if (input.loadFailed) {
    return { accessLine: null, showingLine: null, emptyLine: null };
  }
  const access = summarizePermissionView(
    input.allItems.filter((item) => item.enabled === 1),
  );
  const accessLine = `AI can currently access information from ${plural(
    access.contacts,
    "contact",
    "contacts",
  )} · ${plural(access.items, "item", "items")}`;
  const showingLine = input.filterActive
    ? `Showing ${summarizePermissionView(input.filteredItems).items} of ${plural(
        summarizePermissionView(input.allItems).items,
        "item",
        "items",
      )}`
    : null;
  const emptyLine =
    input.filteredItems.length > 0
      ? null
      : access.items === 0
        ? PERMISSION_EMPTY_COPY
        : PERMISSION_NO_MATCH_COPY;
  return { accessLine, showingLine, emptyLine };
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
