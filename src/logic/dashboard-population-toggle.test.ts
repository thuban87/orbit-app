import { describe, expect, it } from "vitest";
import {
  nextPopulations,
  type PopulationPanelKey,
  samePopulations,
} from "@/logic/dashboard-population-toggle";
import {
  DASHBOARD_POPULATIONS,
  type DashboardPopulation,
  parseDashboardPopulations,
} from "@/logic/dashboard-query-logic";

describe("nextPopulations (D-23, D-58)", () => {
  it("All Contacts is exclusive and deselecting it returns to Active", () => {
    expect(nextPopulations([], "all-contacts")).toEqual(["all-contacts"]);
    expect(nextPopulations(["all-contacts"], "all-contacts")).toEqual([]);
    expect(
      nextPopulations(["favourites", "birthdays"], "all-contacts"),
    ).toEqual(["all-contacts"]);
  });

  it("Active Contacts clears every other selection", () => {
    expect(nextPopulations(["favourites", "birthdays"], "active")).toEqual([]);
    expect(nextPopulations(["all-contacts"], "active")).toEqual([]);
    expect(nextPopulations([], "active")).toEqual([]);
  });

  it("picking another population deselects All Contacts", () => {
    expect(nextPopulations(["all-contacts"], "favourites")).toEqual([
      "favourites",
    ]);
  });

  it("the four other populations still combine (ADR-093)", () => {
    expect(nextPopulations(["favourites"], "birthdays")).toEqual([
      "favourites",
      "birthdays",
    ]);
    expect(nextPopulations(["favourites", "birthdays"], "favourites")).toEqual([
      "birthdays",
    ]);
    expect(nextPopulations(["birthdays"], "birthdays")).toEqual([]);
  });

  it("normalises a persisted mixed value on the next tap", () => {
    expect(nextPopulations(["all-contacts", "favourites"], "snoozed")).toEqual([
      "favourites",
      "snoozed",
    ]);
  });

  it("never returns the Active panel key, and the stored format still rejects it", () => {
    const keys: PopulationPanelKey[] = ["active", ...DASHBOARD_POPULATIONS];
    const starts: DashboardPopulation[][] = [
      [],
      ["all-contacts"],
      ["favourites"],
      ["favourites", "birthdays", "not-contacted", "snoozed"],
      ["all-contacts", "favourites"],
    ];
    for (const start of starts) {
      for (const key of keys) {
        const next = nextPopulations(start, key) as string[];
        expect(next).not.toContain("active");
        expect(parseDashboardPopulations(next)).toEqual(next);
      }
    }
    expect(parseDashboardPopulations(["active"])).toBeNull();
    expect(parseDashboardPopulations(["favourites", "active"])).toBeNull();
  });
});

describe("samePopulations (review R1-16)", () => {
  it("is order-sensitive element equality", () => {
    expect(samePopulations([], [])).toBe(true);
    expect(
      samePopulations(["favourites", "birthdays"], ["favourites", "birthdays"]),
    ).toBe(true);
    expect(samePopulations(["favourites"], ["birthdays"])).toBe(false);
    expect(samePopulations([], ["all-contacts"])).toBe(false);
    expect(
      samePopulations(["favourites", "birthdays"], ["birthdays", "favourites"]),
    ).toBe(false);
  });

  it("recognises a re-tap of the selected Active row as no change", () => {
    const current: DashboardPopulation[] = [];
    expect(samePopulations(nextPopulations(current, "active"), current)).toBe(
      true,
    );
  });
});
