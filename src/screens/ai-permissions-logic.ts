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
