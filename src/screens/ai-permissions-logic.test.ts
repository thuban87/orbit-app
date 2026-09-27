import { describe, expect, it } from "vitest";
import type { AiPermissionItem } from "@/db/ai-permissions-dao";
import {
  buildPermissionSummaryCopy,
  filterAiPermissionItems,
  groupAiPermissionItems,
  isPermissionFilterActive,
  PERMISSION_NO_MATCH_COPY,
  permissionGroupA11yLabel,
  permissionGroupCaption,
  permissionItemA11yLabel,
  selectedPermissionRefs,
  selectionImpact,
  summarizePermissionView,
  visibleSelectedKeys,
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
 * the UNFILTERED enabled items; a failed load prints no count at all.
 * 38.4 D-44 (owner, OA-C1): a list line ALWAYS states what the list below shows
 * (items of the total, from how many contacts, how many of them AI can access),
 * replacing the old conditional "Showing N of M" line.
 */
describe("buildPermissionSummaryCopy", () => {
  const ALL_ENABLED = ITEMS.filter((item) => item.enabled === 1);

  it("states access totals and a list line when every item is enabled and unfiltered", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: ALL_ENABLED,
        filteredItems: ALL_ENABLED,
        enabledOnly: false,
        loadFailed: false,
      }),
    ).toEqual({
      accessLine:
        "AI can currently access information from 2 contacts · 2 items",
      listLine:
        "Showing all 2 items from 2 contacts · AI can access all of them",
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
      enabledOnly: false,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.listLine).toBe(
      "Showing 1 of 3 items from 1 contact · AI can access it",
    );
  });

  it("describes an enabled-only view as holding only items AI can access", () => {
    const filteredItems = filterAiPermissionItems(ITEMS, {
      query: "",
      type: "all",
      enabledOnly: true,
    });
    const copy = buildPermissionSummaryCopy({
      allItems: ITEMS,
      filteredItems,
      enabledOnly: true,
      loadFailed: false,
    });
    expect(copy.listLine).toBe(
      "Showing 2 of 3 items from 2 contacts · AI can access all of them",
    );
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
      enabledOnly: false,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.listLine).toBe(
      "Showing 2 of 3 items from 1 contact · AI can access 1 of them",
    );
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
      enabledOnly: false,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 2 contacts · 2 items",
    );
    expect(copy.listLine).toBe("Showing 0 of 3 items");
    expect(copy.emptyLine).toBe("No information matches these filters.");
  });

  it("prints no count at all when the load failed", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: [],
        filteredItems: [],
        enabledOnly: true,
        loadFailed: true,
      }),
    ).toEqual({ accessLine: null, listLine: null, emptyLine: null });
  });

  it("prints no list line when there are no items at all (the empty copy covers it)", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: [],
        filteredItems: [],
        enabledOnly: false,
        loadFailed: false,
      }),
    ).toEqual({
      accessLine:
        "AI can currently access information from 0 contacts · 0 items",
      listLine: null,
      emptyLine: "AI can't access any contact information yet.",
    });
  });

  it("says AI can't access anything only when no item is enabled", () => {
    const disabledOnly = ITEMS.filter((item) => item.enabled === 0);
    const copy = buildPermissionSummaryCopy({
      allItems: disabledOnly,
      filteredItems: [],
      enabledOnly: true,
      loadFailed: false,
    });
    expect(copy.accessLine).toBe(
      "AI can currently access information from 0 contacts · 0 items",
    );
    expect(copy.listLine).toBe("Showing 0 of 1 item");
    expect(copy.emptyLine).toBe("AI can't access any contact information yet.");
  });

  it("says none of them when the list holds only items AI cannot access", () => {
    const disabledOnly = ITEMS.filter((item) => item.enabled === 0);
    const extra: AiPermissionItem = {
      ...disabledOnly[0],
      id: 9,
      itemKey: "interaction-note:9",
    };
    const list = [...disabledOnly, extra];
    expect(
      buildPermissionSummaryCopy({
        allItems: list,
        filteredItems: list,
        enabledOnly: false,
        loadFailed: false,
      }).listLine,
    ).toBe("Showing all 2 items from 1 contact · AI can access none of them");
  });

  it("uses singular nouns for a single contact and item", () => {
    const single = ITEMS.slice(0, 1);
    expect(
      buildPermissionSummaryCopy({
        allItems: single,
        filteredItems: single,
        enabledOnly: true,
        loadFailed: false,
      }),
    ).toEqual({
      accessLine: "AI can currently access information from 1 contact · 1 item",
      listLine: "Showing 1 item from 1 contact · AI can access it",
      emptyLine: null,
    });
  });
});

/**
 * 38.4 D-44 reconciliation invariants. The fixture's enabled items belong to
 * FEWER contacts than its disabled ones — the owner's report ("1 contact · 3
 * items" above a longer list) in miniature.
 */
const RECONCILE_ITEMS: AiPermissionItem[] = [
  ...ITEMS,
  {
    category: "memory",
    id: 4,
    itemKey: "memory:4",
    contactId: 12,
    contactUid: "casey",
    contactName: "Casey",
    label: "Memory",
    value: "Chess",
    enabled: 0,
  },
  {
    category: "interaction-note",
    id: 5,
    itemKey: "interaction-note:5",
    contactId: 12,
    contactUid: "casey",
    contactName: "Casey",
    label: "Interaction note",
    value: "Lunch",
    enabled: 0,
  },
  {
    category: "custom-field",
    id: 3,
    itemKey: "custom-field:31",
    contactId: 13,
    contactUid: "drew",
    contactName: "Drew",
    label: "Favorite constellation",
    value: "Orion",
    enabled: 1,
  },
  {
    category: "memory",
    id: 6,
    itemKey: "memory:6",
    contactId: 14,
    contactUid: "emery",
    contactName: "Emery",
    label: "Memory",
    value: "Sailing",
    enabled: 0,
  },
  {
    category: "memory",
    id: 7,
    itemKey: "memory:7",
    contactId: 15,
    contactUid: "finley",
    contactName: "Finley",
    label: "Memory",
    value: "Birding",
    enabled: 0,
  },
];

/** The four view states the owner walks through on the device (D-44). */
const RECONCILE_STATES: Array<{
  name: string;
  filter: { query: string; type: "all" | "memory"; enabledOnly: boolean };
}> = [
  {
    name: "Enabled only OFF, type All, empty search",
    filter: { query: "", type: "all", enabledOnly: false },
  },
  {
    name: "Enabled only ON (the screen default)",
    filter: { query: "", type: "all", enabledOnly: true },
  },
  {
    name: "after Review existing… (one type, Enabled only OFF)",
    filter: { query: "", type: "memory", enabledOnly: false },
  },
  {
    name: "search narrowing to one contact",
    filter: { query: "cas", type: "all", enabledOnly: false },
  },
];

function copyFor(filter: {
  query: string;
  type: "all" | "memory";
  enabledOnly: boolean;
}) {
  const filteredItems = filterAiPermissionItems(RECONCILE_ITEMS, filter);
  return {
    filteredItems,
    copy: buildPermissionSummaryCopy({
      allItems: RECONCILE_ITEMS,
      filteredItems,
      enabledOnly: filter.enabledOnly,
      loadFailed: false,
    }),
  };
}

describe("buildPermissionSummaryCopy reconciliation (D-44)", () => {
  it("with Enabled only OFF, type All and no search, lists every contact and AI can access exactly the access line's items", () => {
    const { filteredItems, copy } = copyFor(RECONCILE_STATES[0].filter);
    expect(groupAiPermissionItems(filteredItems)).toHaveLength(6);
    expect(copy.accessLine).toBe(
      "AI can currently access information from 3 contacts · 3 items",
    );
    expect(copy.listLine).toBe(
      "Showing all 8 items from 6 contacts · AI can access 3 of them",
    );
  });

  it("with Enabled only ON, every listed item is AI-accessible and the contact count matches the access line", () => {
    const { copy } = copyFor(RECONCILE_STATES[1].filter);
    expect(copy.accessLine).toBe(
      "AI can currently access information from 3 contacts · 3 items",
    );
    expect(copy.listLine).toBe(
      "Showing 3 of 8 items from 3 contacts · AI can access all of them",
    );
  });

  it("after Review existing… shows S of N and the enabled items of that type", () => {
    const { copy } = copyFor(RECONCILE_STATES[2].filter);
    expect(copy.listLine).toBe(
      "Showing 4 of 8 items from 4 contacts · AI can access 1 of them",
    );
    expect(copy.accessLine).toBe(
      "AI can currently access information from 3 contacts · 3 items",
    );
  });

  it("an unmatched search shows Showing 0 of N and leaves the access line unchanged", () => {
    const { copy } = copyFor({ query: "zz", type: "all", enabledOnly: false });
    expect(copy.listLine).toBe("Showing 0 of 8 items");
    expect(copy.accessLine).toBe(
      "AI can currently access information from 3 contacts · 3 items",
    );
    expect(copy.emptyLine).toBe(PERMISSION_NO_MATCH_COPY);
  });

  it("prints no line at all before a clean read", () => {
    expect(
      buildPermissionSummaryCopy({
        allItems: RECONCILE_ITEMS,
        filteredItems: RECONCILE_ITEMS,
        enabledOnly: false,
        loadFailed: true,
      }),
    ).toEqual({ accessLine: null, listLine: null, emptyLine: null });
  });
});

describe("permissionGroupCaption (D-44)", () => {
  it("states the contact's item count and how many of them AI can access", () => {
    const [alex, blair] = groupAiPermissionItems(ITEMS);
    expect(permissionGroupCaption(alex, false)).toBe(
      "2 items · AI can access 1 · Review",
    );
    expect(permissionGroupCaption(blair, true)).toBe(
      "1 item · AI can access 1 · Hide",
    );
    const [casey] = groupAiPermissionItems(
      RECONCILE_ITEMS.filter((item) => item.contactUid === "casey"),
    );
    expect(permissionGroupCaption(casey, false)).toBe(
      "2 items · AI can access 0 · Review",
    );
  });

  it("headers sum to the list line in every view state", () => {
    for (const state of RECONCILE_STATES) {
      const { filteredItems, copy } = copyFor(state.filter);
      const groups = groupAiPermissionItems(filteredItems);
      const counts = groups.map((group) => {
        const match = /^(\d+) items? · AI can access (\d+) · Review$/.exec(
          permissionGroupCaption(group, false),
        );
        if (!match)
          throw new Error(`unparsed caption for ${group.contactName}`);
        return { n: Number(match[1]), e: Number(match[2]) };
      });
      const n = counts.reduce((sum, c) => sum + c.n, 0);
      const e = counts.reduce((sum, c) => sum + c.e, 0);
      const shown = summarizePermissionView(filteredItems);
      expect(n, state.name).toBe(shown.items);
      expect(groups.length, state.name).toBe(shown.contacts);
      expect(e, state.name).toBe(
        summarizePermissionView(
          filteredItems.filter((item) => item.enabled === 1),
        ).items,
      );
      // The same three numbers the list line prints.
      expect(copy.listLine, state.name).toContain(
        `from ${groups.length} contact`,
      );
      if (e === n) {
        expect(copy.listLine, state.name).toMatch(
          /AI can access (all of them|it)$/,
        );
      } else if (e === 0) {
        expect(copy.listLine, state.name).toMatch(
          /AI can access none of them$|AI can't access it$/,
        );
      } else {
        expect(copy.listLine, state.name).toContain(
          `AI can access ${e} of them`,
        );
      }
      const shownPhrase =
        n === RECONCILE_ITEMS.length ? `all ${n} items` : `${n} of `;
      expect(copy.listLine, state.name).toContain(`Showing ${shownPhrase}`);
    }
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

/**
 * 38.4 review Lane D WR-04: a selection may only count, and only reach a bulk
 * consent change, where its row is on screen: in the filtered view AND under
 * the one expanded contact. Hidden selections are inert.
 */
describe("visibleSelectedKeys (Lane D WR-04)", () => {
  const all = new Set(ITEMS.map((item) => item.itemKey));

  it("keeps only selected rows of the expanded contact in the filtered view", () => {
    expect([...visibleSelectedKeys(ITEMS, "alex", all)]).toEqual([
      "memory:1",
      "interaction-note:2",
    ]);
    expect([...visibleSelectedKeys(ITEMS, "blair", all)]).toEqual([
      "custom-field:30",
    ]);
  });

  it("drops a selection a filter or search has hidden", () => {
    const filtered = filterAiPermissionItems(ITEMS, {
      query: "",
      type: "all",
      enabledOnly: true,
    });
    expect([...visibleSelectedKeys(filtered, "alex", all)]).toEqual([
      "memory:1",
    ]);
    const searched = filterAiPermissionItems(ITEMS, {
      query: "blair",
      type: "all",
      enabledOnly: false,
    });
    expect(visibleSelectedKeys(searched, "alex", all).size).toBe(0);
  });

  it("drops a selection whose contact is collapsed, and is empty with none expanded", () => {
    const selected = new Set(["memory:1", "custom-field:30"]);
    expect([...visibleSelectedKeys(ITEMS, "blair", selected)]).toEqual([
      "custom-field:30",
    ]);
    expect(visibleSelectedKeys(ITEMS, null, selected).size).toBe(0);
  });

  it("feeds refs only for visible selected rows", () => {
    const visible = visibleSelectedKeys(ITEMS, "blair", all);
    expect(selectedPermissionRefs(ITEMS, visible)).toEqual([
      { category: "custom-field", id: 3 },
    ]);
  });
});

/**
 * 38.4 review Lane D WR-03: an explicit accessibilityLabel replaces the
 * aggregated child text on Android, so the D-44 per-contact count and each
 * item's AI access state must be IN the labels, or TalkBack never speaks them.
 */
describe("AI permission accessibility labels (Lane D WR-03)", () => {
  const alex = groupAiPermissionItems(ITEMS)[0];

  it("the contact header announces the action, the name and the D-44 count once", () => {
    expect(permissionGroupA11yLabel(alex, false)).toBe(
      "Review Alex, 2 items, AI can access 1",
    );
    expect(permissionGroupA11yLabel(alex, true)).toBe(
      "Hide Alex, 2 items, AI can access 1",
    );
  });

  it("uses the caption's counting rule, singular included", () => {
    const blair = groupAiPermissionItems(ITEMS)[1];
    expect(permissionGroupA11yLabel(blair, false)).toBe(
      "Review Blair, 1 item, AI can access 1",
    );
  });

  it("an item row announces whether AI can access it", () => {
    expect(permissionItemA11yLabel(ITEMS[0])).toBe(
      "Memory: Astronomy, Enabled, AI can access",
    );
    expect(permissionItemA11yLabel(ITEMS[1])).toBe(
      "Interaction note: Telescope, Disabled, AI can't access",
    );
  });
});
