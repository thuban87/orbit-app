import { describe, expect, it } from "vitest";
import {
  DASHBOARD_POPULATIONS,
  DASHBOARD_SORT_MODES,
} from "@/logic/dashboard-query-logic";
import {
  AXIS_DEFAULT_LABELS,
  defaultSortLabel,
  POPULATION_LABELS,
  RESOLVED_DEFAULT_SORT_LABELS,
  sortModeLabel,
} from "./control-labels";

describe("dashboard control labels", () => {
  it("labels every population key", () => {
    for (const population of DASHBOARD_POPULATIONS) {
      expect(POPULATION_LABELS[population]).toEqual(expect.any(String));
      expect(POPULATION_LABELS[population].length).toBeGreaterThan(0);
    }
  });

  it("provides all default axis labels; Filters reads None when nothing is set (D-36)", () => {
    expect(AXIS_DEFAULT_LABELS).toEqual({
      population: "Active Contacts",
      filters: "None",
      sort: "Default",
    });
  });

  it("labels Default with what it resolves to for the population (D-35)", () => {
    expect(defaultSortLabel([])).toBe("Default (Status)");
    expect(defaultSortLabel(["not-contacted"])).toBe("Default (Oldest added)");
    expect(defaultSortLabel(["snoozed"])).toBe("Default (Snooze ends soonest)");
    expect(defaultSortLabel(["birthdays"])).toBe("Default (Soonest birthday)");
    expect(defaultSortLabel(["favourites", "birthdays"])).toBe(
      "Default (Status)",
    );
    expect(defaultSortLabel(["all-contacts"])).toBe("Default (Status)");
  });

  it("keeps Status as its own sort option (D-19) and labels every resolved sort", () => {
    expect(DASHBOARD_SORT_MODES).toContain("status");
    expect(sortModeLabel("status")).toBe("Status");
    for (const label of Object.values(RESOLVED_DEFAULT_SORT_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
    expect(RESOLVED_DEFAULT_SORT_LABELS["name-asc"]).toBe(
      sortModeLabel("name-asc"),
    );
  });
});
