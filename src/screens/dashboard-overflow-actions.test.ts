import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildDashboardOverflowActions } from "@/screens/dashboard-overflow-actions";

describe("buildDashboardOverflowActions", () => {
  it("returns the fixed five-row Dashboard overflow from its object input", () => {
    const navigation = { navigate: vi.fn(), openEvents: vi.fn() };
    const onReset = vi.fn();
    const onSelectContacts = vi.fn();

    const actions = buildDashboardOverflowActions({
      navigation,
      onReset,
      onSelectContacts,
      selectionMode: false,
    });

    expect(actions).toHaveLength(5);
    expect(actions.map(({ label }) => label)).toEqual([
      "Events",
      "Unbound Contacts",
      "Bin",
      "Select Contacts",
      "Reset Contacts View",
    ]);
    expect(actions.map(({ testID }) => testID)).toEqual([
      "dashboard-group-events-overflow-entry",
      "dashboard-unbound-overflow-entry",
      "dashboard-archived-overflow-entry",
      "dashboard-select-contacts-entry",
      "dashboard-reset-view-entry",
    ]);
    expect(actions[3]?.disabled).toBeUndefined();

    actions[0]?.onPress();
    expect(navigation.openEvents).toHaveBeenCalledOnce();
    expect(navigation.navigate).not.toHaveBeenCalledWith("GroupEvents");

    const forbiddenLabels = [
      "Manage Favorites",
      "Import",
      "Settings",
      "Backup",
      "Orrery",
      "Your Week",
    ];
    for (const forbiddenLabel of forbiddenLabels) {
      expect(actions.some(({ label }) => label.includes(forbiddenLabel))).toBe(
        false,
      );
    }

    actions[4]?.onPress();
    expect(onReset).toHaveBeenCalledOnce();
    actions[3]?.onPress();
    expect(onSelectContacts).toHaveBeenCalledOnce();
  });

  it("offers no Select Contacts or Reset Contacts View while selecting (D-76, ADR-102 frozen universe; review A-WR-02)", () => {
    const actions = buildDashboardOverflowActions({
      navigation: { navigate: vi.fn(), openEvents: vi.fn() },
      onReset: vi.fn(),
      onSelectContacts: vi.fn(),
      selectionMode: true,
    });
    expect(actions.map(({ testID }) => testID)).toEqual([
      "dashboard-group-events-overflow-entry",
      "dashboard-unbound-overflow-entry",
      "dashboard-archived-overflow-entry",
    ]);
  });

  it("HomeScreen passes its selection mode into the builder", () => {
    const home = readFileSync("src/screens/HomeScreen.tsx", "utf8");
    const call = home.slice(home.indexOf("buildDashboardOverflowActions({"));
    expect(call.slice(0, call.indexOf("});"))).toMatch(/\bselectionMode,?\s/);
  });
});
