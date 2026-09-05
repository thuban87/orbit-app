import { describe, expect, it } from "vitest";
import {
  ACTIVE_SEGREGATION_WHERE,
  buildPopulationWhere,
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

  it("builds selected populations as a closed OR-union with dashboard scope", () => {
    const where = buildPopulationWhere(["favourites", "not-contacted"]);

    expect(where.sql).toContain("c.archived_at IS NULL");
    expect(where.sql).toContain("c.tracking_enabled = 1");
    expect(where.sql).toContain("c.favourite_rank IS NOT NULL");
    expect(where.sql).toContain("c.last_contact IS NULL");
    expect(where.sql).toContain(" OR ");
    expect(where.params).toEqual([]);
  });

  it("uses Active when the final population is deselected", () => {
    const where = buildPopulationWhere([]);

    expect(where.sql).toContain(ACTIVE_SEGREGATION_WHERE);
    expect(where.sql).not.toContain("snooze_until");
  });

  it("drops unknown population tokens rather than interpolating them", () => {
    const where = buildPopulationWhere(["untrusted-token"] as never[]);

    expect(where.sql).toContain(ACTIVE_SEGREGATION_WHERE);
    expect(where.sql).not.toContain("untrusted-token");
  });

  it("binds birthday ids and emits a false predicate for an empty birthday set", () => {
    expect(
      buildPopulationWhere(["birthdays"], { birthdayIds: [41, 99] }),
    ).toMatchObject({ params: [41, 99] });
    expect(
      buildPopulationWhere(["birthdays"], { birthdayIds: [41, 99] }).sql,
    ).toContain("c.id IN (?, ?)");
    expect(buildPopulationWhere(["birthdays"], { birthdayIds: [] }).sql).toContain(
      "0",
    );
  });

  it("resolves population-aware Defaults while preserving explicit sorts", () => {
    expect(resolveDefaultSort("default", ["favourites"])).toBe("status");
    expect(resolveDefaultSort("default", ["birthdays"])).toBe(
      "soonest-birthday",
    );
    expect(resolveDefaultSort("default", ["not-contacted"])).toBe(
      "natural-not-contacted",
    );
    expect(resolveDefaultSort("default", ["snoozed"])).toBe("natural-snooze");
    expect(resolveDefaultSort("default", ["all-contacts"])).toBe("status");
    expect(resolveDefaultSort("default", ["favourites", "birthdays"])).toBe(
      "status",
    );
    expect(resolveDefaultSort("name-asc", ["birthdays"])).toBe("name-asc");
  });
});
