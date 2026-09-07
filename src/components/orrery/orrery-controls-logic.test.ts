import { describe, expect, it, vi } from "vitest";
import {
  buildSystemChoices,
  registerSystemSelectorTransient,
  systemEmptyCopy,
  systemSelectorLabel,
} from "@/components/orrery/orrery-controls-logic";
import { BUILTIN_SYSTEMS } from "@/logic/orrery-system-logic";

describe("Orrery System controls", () => {
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
