import { describe, expect, it } from "vitest";
import type { AiPermissionItem } from "@/db/ai-permissions-dao";
import {
  filterAiPermissionItems,
  groupAiPermissionItems,
  selectedPermissionRefs,
  selectionImpact,
  summarizePermissionView,
} from "./ai-permissions-logic";

const ITEMS: AiPermissionItem[] = [
  {
    category: "memory",
    id: 1,
    itemKey: "memory:1",
    contactId: 10,
    contactUid: "alex",
    contactName: "Alex",
    label: "Memory",
    value: "Astronomy",
    enabled: 1,
  },
  {
    category: "interaction-note",
    id: 2,
    itemKey: "interaction-note:2",
    contactId: 10,
    contactUid: "alex",
    contactName: "Alex",
    label: "Interaction note",
    value: "Telescope",
    enabled: 0,
  },
  {
    category: "custom-field",
    id: 3,
    itemKey: "custom-field:30",
    contactId: 11,
    contactUid: "blair",
    contactName: "Blair",
    label: "Favorite constellation",
    value: "Lyra",
    enabled: 1,
  },
];

describe("AI permission screen logic", () => {
  it("narrows review by enabled state, type, and case-insensitive contact search", () => {
    expect(
      filterAiPermissionItems(ITEMS, {
        query: "AL",
        type: "all",
        enabledOnly: true,
      }).map((item) => item.itemKey),
    ).toEqual(["memory:1"]);
    expect(
      filterAiPermissionItems(ITEMS, {
        query: "",
        type: "custom-field",
        enabledOnly: false,
      }).map((item) => item.itemKey),
    ).toEqual(["custom-field:30"]);
  });

  it("derives counts from the filtered view without double-counting contacts", () => {
    expect(summarizePermissionView(ITEMS)).toEqual({ contacts: 2, items: 3 });
    expect(groupAiPermissionItems(ITEMS)).toEqual([
      { contactUid: "alex", contactName: "Alex", items: ITEMS.slice(0, 2) },
      { contactUid: "blair", contactName: "Blair", items: ITEMS.slice(2) },
    ]);
  });

  it("derives selection impact and unique permission refs", () => {
    const selected = new Set(["memory:1", "interaction-note:2"]);
    expect(selectionImpact(ITEMS, selected)).toEqual({ contacts: 1, items: 2 });
    expect(selectedPermissionRefs(ITEMS, selected)).toEqual([
      { category: "memory", id: 1 },
      { category: "interaction-note", id: 2 },
    ]);
  });
});
