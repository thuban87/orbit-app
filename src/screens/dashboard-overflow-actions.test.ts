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
    });

    expect(actions).toHaveLength(5);
    expect(actions.map(({ label }) => label)).toEqual([
      "Group Events",
      "Unbound Contacts",
      "Archived Contacts",
      "Select Contacts",
      "Reset Dashboard View",
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
      expect(actions.some(({ label }) => label.includes(forbiddenLabel))).toBe(false);
    }

    actions[4]?.onPress();
    expect(onReset).toHaveBeenCalledOnce();
    actions[3]?.onPress();
    expect(onSelectContacts).toHaveBeenCalledOnce();
  });
});
