import { describe, expect, it, vi } from "vitest";
import {
  buildSystemChoices,
  registerSystemSelectorTransient,
  systemEmptyCopy,
  systemSelectorLabel,
} from "@/components/orrery/orrery-controls-logic";
import type { SystemCatalogEntry } from "@/db/systems-catalog-read";
import { BUILTIN_SYSTEMS } from "@/logic/orrery-system-logic";

describe("Orrery System controls", () => {
  it("treats an empty source with count maps as an empty selector catalog", () => {
    expect(buildSystemChoices([], new Map(), new Map())).toEqual([]);
  });

  it("keeps every empty builtin in fixed order and sorts actual categories by display_order then UID", () => {
    expect(buildSystemChoices([])).toEqual(BUILTIN_SYSTEMS);
    const rows = buildSystemChoices([
      { id: 1, uid: "z", name: "Same", display_order: 2 },
      { id: 2, uid: "a", name: "Same", display_order: 2 },
      { id: 3, uid: "first", name: "First", display_order: 1 },
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      ...BUILTIN_SYSTEMS.map((row) => row.id),
      "category:first",
      "category:a",
      "category:z",
    ]);
    expect(rows.filter((row) => row.name === "Same")).toHaveLength(2);
    expect(
      buildSystemChoices(
        [],
        [
          {
            id: 4,
            uid: "manual-system",
            name: "Manual System",
            createdAt: "2026-09-08",
            modifiedAt: "2026-09-08",
          },
        ],
      ).at(-1),
    ).toMatchObject({
      id: "custom:manual-system",
      ref: { kind: "custom", uid: "manual-system" },
      name: "Manual System",
    });
  });

  it("pins All Contacts, omits hidden Systems, and gives empty/broken states distinct semantics", () => {
    const catalog: SystemCatalogEntry[] = [
      {
        id: "builtin:all-contacts",
        ref: { kind: "builtin", id: "all-contacts" },
        name: "All Contacts",
        displayOrder: 99,
        hidden: false,
        hasOverrides: false,
      },
      {
        id: "builtin:favorites",
        ref: { kind: "builtin", id: "favorites" },
        name: "Favorites",
        displayOrder: 2,
        hidden: false,
        hasOverrides: true,
      },
      {
        id: "builtin:snoozed",
        ref: { kind: "builtin", id: "snoozed" },
        name: "Snoozed",
        displayOrder: 1,
        hidden: true,
        hasOverrides: false,
      },
      {
        id: "category:family",
        ref: { kind: "category", uid: "family" },
        name: "Family",
        displayOrder: null,
        hidden: false,
        hasOverrides: false,
        categoryOrder: 1,
      },
      {
        id: "custom:close-friends",
        ref: { kind: "custom", uid: "close-friends" },
        name: "Close Friends",
        displayOrder: null,
        hidden: false,
        hasOverrides: false,
        createdAt: "2026-09-08 12:00:00",
      },
    ];

    const rows = buildSystemChoices(
      catalog,
      new Map([
        ["builtin:all-contacts", 3],
        ["builtin:favorites", 0],
        ["category:family", 2],
        ["custom:close-friends", 1],
      ]),
      new Map([["custom:close-friends", true]]),
    );

    expect(rows.map((row) => row.id)).toEqual([
      "builtin:all-contacts",
      "builtin:favorites",
      "category:family",
      "custom:close-friends",
    ]);
    expect(rows.find((row) => row.id === "builtin:favorites")).toMatchObject({
      count: 0,
      severity: "empty",
      overrides: true,
    });
    expect(rows.find((row) => row.id === "custom:close-friends")).toMatchObject(
      {
        count: 1,
        severity: "broken",
        overrides: false,
      },
    );
  });
  it("preserves full long name in accessibility while the trigger can visually ellipsize", () => {
    const name = "A long name ".repeat(30);
    expect(systemSelectorLabel(name)).toBe(
      `Choose System. Current System: ${name}`,
    );
  });
  it("registered dismissal follows the latest callback and cleanup restores trigger focus", () => {
    const old = vi.fn();
    const current = vi.fn();
    const latest = { current: old };
    const openTransient = vi.fn();
    const closeTransient = vi.fn();
    const restore = vi.fn();
    const cleanup = registerSystemSelectorTransient(
      { openTransient, closeTransient },
      latest,
      restore,
    );
    latest.current = current;
    openTransient.mock.calls[0][1]();
    expect(current).toHaveBeenCalledOnce();
    expect(old).not.toHaveBeenCalled();
    cleanup();
    expect(closeTransient).toHaveBeenCalledWith("orrery-system-selector");
    expect(restore).toHaveBeenCalledOnce();
  });
  it("sun-only copy requires a qualifying member; a global nonmember sun leaves selected-System empty copy", () => {
    expect(systemEmptyCopy("Favorites", false, false).heading).toBe(
      "No contacts in Favorites",
    );
    expect(systemEmptyCopy("Favorites", false, true).heading).toBe(
      "Your contacts are centered here",
    );
    expect(systemEmptyCopy("All Contacts", true, false).heading).toBe(
      "No contacts in your Orrery yet",
    );
  });
});
