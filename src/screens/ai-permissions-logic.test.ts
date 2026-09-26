import { describe, expect, it } from "vitest";
import type { AiPermissionItem } from "@/db/ai-permissions-dao";
import {
  buildPermissionSummaryCopy,
  filterAiPermissionItems,
  groupAiPermissionItems,
  isPermissionFilterActive,
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

/**
 * 38.4 RG-008 / ui-accessibility/AUD-UIA-013 (D-17): the access claim comes from
 * the UNFILTERED enabled items; a filtered view gets its own "Showing N of M"
 * line; a failed load prints no count at all.
 */
describe("buildPermissionSummaryCopy", () => {
  const ALL_ENABLED = ITEMS.filter((item) => item.enabled === 1);

  it("states access totals and no showing line when every item is enabled and unfiltered", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: ALL_ENABLED,
        filteredItems: ALL_ENABLED,
        filterActive: false,
        loadFailed: false,
      }),
    ).toEqual({
      accessLine:
        "AI can currently access information from 2 contacts · 2 items",
      showingLine: null,
      emptyLine: null,
    });
  });

  it("keeps access totals from the unfiltered enabled items when a type filter is active", () => {
    const filteredItems = filterAiPermissionItems(ITEMS, {
      query: "",
      type: "custom-field",
      enabledOnly: false,
    });
    const copy = buildPermissionSummaryCopy({
      allItems: ITEMS,
      filteredItems,
      filterActive: true,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.showingLine).toBe("Showing 1 of 3 items");
  });

  it("describes an enabled-only view against the unfiltered item count", () => {
    const filteredItems = filterAiPermissionItems(ITEMS, {
      query: "",
      type: "all",
      enabledOnly: true,
    });
    const copy = buildPermissionSummaryCopy({
      allItems: ITEMS,
      filteredItems,
      filterActive: true,
      loadFailed: false,
    });
    expect(copy.showingLine).toBe("Showing 2 of 3 items");
  });

  it("counts only enabled items as access while a view may include disabled ones", () => {
    const filteredItems = filterAiPermissionItems(ITEMS, {
      query: "alex",
      type: "all",
      enabledOnly: false,
    });
    expect(filteredItems.map((item) => item.enabled)).toEqual([1, 0]);
    const copy = buildPermissionSummaryCopy({
      allItems: ITEMS,
      filteredItems,
      filterActive: true,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.showingLine).toBe("Showing 2 of 3 items");
  });

  it("shows 'Showing 0 of M' for an unmatched search and leaves the access totals unchanged", () => {
    const filteredItems = filterAiPermissionItems(ITEMS, {
      query: "nobody",
      type: "all",
      enabledOnly: false,
    });
    const copy = buildPermissionSummaryCopy({
      allItems: ITEMS,
      filteredItems,
      filterActive: true,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.showingLine).toBe("Showing 0 of 3 items");
    expect(copy.emptyLine).toBe("No information matches these filters.");
  });

  it("prints no count at all when the load failed", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: [],
        filteredItems: [],
        filterActive: true,
        loadFailed: true,
      }),
    ).toEqual({ accessLine: null, showingLine: null, emptyLine: null });
  });

  it("says AI can't access anything only when no item is enabled", () => {
    const disabledOnly = ITEMS.filter((item) => item.enabled === 0);
    const copy = buildPermissionSummaryCopy({
      allItems: disabledOnly,
      filteredItems: [],
      filterActive: true,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 0 contacts · 0 items",
    );
    expect(copy.emptyLine).toBe("AI can't access any contact information yet.");
  });

  it("uses singular nouns for a single contact and item", () => {
    const single = ITEMS.slice(0, 1);
    expect(
      buildPermissionSummaryCopy({
        allItems: single,
        filteredItems: single,
        filterActive: true,
        loadFailed: false,
      }),
    ).toEqual({
      accessLine: "AI can currently access information from 1 contact · 1 item",
      showingLine: "Showing 1 of 1 item",
      emptyLine: null,
    });
  });
});

describe("isPermissionFilterActive", () => {
  it("is inactive only for the all-type, full, unsearched view", () => {
    expect(
      isPermissionFilterActive({ query: "", type: "all", enabledOnly: false }),
    ).toBe(false);
    expect(
      isPermissionFilterActive({
        query: "   ",
        type: "all",
        enabledOnly: false,
      }),
    ).toBe(false);
  });

  it("is active for a type filter, enabled-only, or a non-blank search", () => {
    expect(
      isPermissionFilterActive({
        query: "",
        type: "memory",
        enabledOnly: false,
      }),
    ).toBe(true);
    expect(
      isPermissionFilterActive({ query: "", type: "all", enabledOnly: true }),
    ).toBe(true);
    expect(
      isPermissionFilterActive({
        query: "al",
        type: "all",
        enabledOnly: false,
      }),
    ).toBe(true);
  });
});
