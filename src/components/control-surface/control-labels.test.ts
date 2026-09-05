import { describe, expect, it } from "vitest";
import { DASHBOARD_POPULATIONS } from "@/logic/dashboard-query-logic";
import { AXIS_DEFAULT_LABELS, POPULATION_LABELS } from "./control-labels";

describe("dashboard control labels", () => {
  it("labels every population key", () => {
    for (const population of DASHBOARD_POPULATIONS) {
      expect(POPULATION_LABELS[population]).toEqual(expect.any(String));
      expect(POPULATION_LABELS[population].length).toBeGreaterThan(0);
    }
  });

  it("provides all default axis labels", () => {
    expect(AXIS_DEFAULT_LABELS).toEqual({
      population: "Active Contacts",
      filters: "Filters",
      sort: "Default",
    });
  });
});
