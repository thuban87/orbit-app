import { describe, expect, it } from "vitest";
import {
  ACTIVE_SEGREGATION_WHERE,
  resetDashboardView,
  resolveDefaultSort,
} from "@/logic/dashboard-query-logic";

describe("dashboard query logic", () => {
  it("resets the shared query axes while preserving view mode", () => {
    expect(
      resetDashboardView({
        viewMode: "card",
        populations: ["favourites"],
        filters: { category: ["family"] },
        sort: "name-asc",
      }),
    ).toEqual({
      viewMode: "card",
      populations: [],
      filters: {},
      sort: "default",
    });
  });

  it("resolves Active's persisted default to status ordering without a snooze clause", () => {
    expect(resolveDefaultSort("default", [])).toBe("status");
    expect(ACTIVE_SEGREGATION_WHERE).toContain("c.archived_at IS NULL");
    expect(ACTIVE_SEGREGATION_WHERE).toContain("c.tracking_enabled = 1");
    expect(ACTIVE_SEGREGATION_WHERE).toContain("c.last_contact IS NOT NULL");
    expect(ACTIVE_SEGREGATION_WHERE).not.toContain("snooze_until");
  });
});
