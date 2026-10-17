import type {
  AiPermissionCategory,
  AiPermissionImpact,
  AiPermissionItem,
  AiPermissionRef,
} from "@/db/ai-permissions-dao";
import { aiLockReason } from "@/logic/ai-lock";
import { plural } from "@/utils/plural";

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
   * Exactly what the list below shows: its items of the total, and how many
   * of them are shared with AI (D-44; worded per D-137 W1c). Null without a
   * read, and null when there are no items at all (`emptyLine` covers that).
   */
  listLine: string | null;
  /** Copy for an empty review list; null when the list has rows or no read. */
  emptyLine: string | null;
}

export const PERMISSION_EMPTY_COPY =
  "AI can't access any contact information yet.";
/** A filter or search hides every item (38.12 D-88; 38.4 #17). */
export const PERMISSION_NO_MATCH_COPY = "No items match this filter.";

/** Items AI can access, from a list that may include disabled ones. */
function enabledItems(
  items: readonly AiPermissionItem[],
): readonly AiPermissionItem[] {
  return items.filter((item) => item.enabled === 1);
}

/**
 * The permission summary copy (38.4 RG-008; ui-accessibility/AUD-UIA-013; D-17;
 * D-44). The access line is the truthful total: it is computed from the
 * UNFILTERED enabled items, never from the filtered view, so a search, a type
 * filter or the Enabled-only switch never reads as "AI can access less". The
 * list line describes exactly the rows below — how many items of the total,
 * and how many of those are shared with AI — because the list may include
 * items AI cannot access (D-44). Wording per D-137 W1c: "AI can use N items,
 * from M contacts." and "This list: X of Y items · Z of these shared with
 * AI.". Every count uses
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
  const accessLine = `AI can use ${plural(
    access.items,
    "item",
    "items",
  )}, from ${plural(access.contacts, "contact", "contacts")}.`;
  const total = summarizePermissionView(input.allItems).items;
  const shown = summarizePermissionView(input.filteredItems);
  const accessible = input.enabledOnly
    ? shown.items
    : summarizePermissionView(enabledItems(input.filteredItems)).items;
  let listLine: string | null = null;
  if (total > 0 && shown.items === 0) {
    listLine = `This list: 0 of ${plural(total, "item", "items")}.`;
  } else if (total > 0) {
    listLine = `This list: ${shown.items} of ${plural(
      total,
      "item",
      "items",
    )} · ${accessible} of these shared with AI.`;
  }
  // The empty-library copy is only true with no items at all, or with Enabled
  // only on and nothing enabled; any other empty list is the filter's doing
  // (38.12 D-88; 38.4 #17).
  const emptyLine =
    input.filteredItems.length > 0
      ? null
      : input.allItems.length === 0 || (input.enabledOnly && access.items === 0)
        ? PERMISSION_EMPTY_COPY
        : PERMISSION_NO_MATCH_COPY;
  return { accessLine, listLine, emptyLine };
}

/**
 * A "new items" default row's caption, following its switch (38.12 D-88; the
 * same rule on all five rows, including 38.10's Gift Ideas and Thought of
 * Them, D-28).
 */
export function defaultRowCaption(enabled: boolean): string {
  return `New items start with Allow AI ${enabled ? "on" : "off"}.`;
}

/**
 * A contact header's caption (D-44): its item count, how many of them AI can
 * access, and the expand affordance. Summed over the groups of a view, the
 * counts equal the list line's items and AI-accessible items, because both use
 * the same unique-item-key rule.
 */
export function permissionGroupCaption(
  group: AiPermissionContactGroup,
  expanded: boolean,
): string {
  return `${groupCountParts(group).join(" · ")} · ${
    expanded ? "Hide" : "Review"
  }`;
}

/** A group's D-44 count phrases: its items, and how many of them AI can access. */
function groupCountParts(group: AiPermissionContactGroup): [string, string] {
  const { items } = summarizePermissionView(group.items);
  const accessible = summarizePermissionView(enabledItems(group.items)).items;
  return [plural(items, "item", "items"), `AI can access ${accessible}`];
}

/**
 * The contact header's accessibility label (38.4 review Lane D WR-03). An
 * explicit label replaces the aggregated child text on Android, so it carries
 * the D-44 count itself: the action, the name, then the same counts as the
 * visible caption (without repeating its trailing Review/Hide affordance).
 */
export function permissionGroupA11yLabel(
  group: AiPermissionContactGroup,
  expanded: boolean,
): string {
  return `${expanded ? "Hide" : "Review"} ${group.contactName}, ${groupCountParts(
    group,
  ).join(", ")}`;
}

/**
 * An item row's accessibility label (38.4 review Lane D WR-03): its label and
 * value, then its AI access state, which the visible Enabled/Disabled caption
 * shows and an explicit label would otherwise hide. A locked item (38.10
 * D-102, D-103) also announces its lock reason, which the row shows. Selection
 * is announced by the row's checkbox state.
 */
export function permissionItemA11yLabel(item: AiPermissionItem): string {
  const lock = item.locked ? `. ${aiLockReason(item.locked)}` : "";
  return `${item.label}: ${item.value}, ${
    item.enabled === 1 ? "Enabled, AI can access" : "Disabled, AI can't access"
  }${lock}`;
}

/**
 * Convert selected display rows to unique permission-owning row references.
 * For an Enable action a locked item (a Group Note copy, D-102; a note moved to
 * Off Limits, D-103) is dropped: it can never be turned on. Disable keeps
 * every selected item. The DAO also clamps locked refs to 0 (plan 10).
 */
export function selectedPermissionRefs(
  items: readonly AiPermissionItem[],
  selectedItemKeys: ReadonlySet<string>,
  action: "enable" | "disable" = "disable",
): AiPermissionRef[] {
  const refs = new Map<string, AiPermissionRef>();
  for (const item of items) {
    if (!selectedItemKeys.has(item.itemKey)) continue;
    if (action === "enable" && item.locked !== null) continue;
    refs.set(`${item.category}:${item.id}`, {
      category: item.category,
      id: item.id,
    });
  }
  return [...refs.values()];
}

/**
 * The selected item keys whose rows are on screen (38.4 review Lane D WR-04):
 * in the current filtered view (type, Enabled-only, search) AND under the one
 * expanded contact, since only that contact's rows render. A selection hidden
 * by a filter, a search or a collapse is inert: it neither counts toward
 * "N selected" nor reaches a bulk consent change, so every number on screen
 * reconciles with the visible list (D-44).
 */
export function visibleSelectedKeys(
  filteredItems: readonly AiPermissionItem[],
  expandedContactUid: string | null,
  selectedItemKeys: ReadonlySet<string>,
): Set<string> {
  const visible = new Set<string>();
  if (expandedContactUid === null) return visible;
  for (const item of filteredItems) {
    if (
      item.contactUid === expandedContactUid &&
      selectedItemKeys.has(item.itemKey)
    ) {
      visible.add(item.itemKey);
    }
  }
  return visible;
}

export function selectionImpact(
  items: readonly AiPermissionItem[],
  selectedItemKeys: ReadonlySet<string>,
): AiPermissionImpact {
  return summarizePermissionView(
    items.filter((item) => selectedItemKeys.has(item.itemKey)),
  );
}
