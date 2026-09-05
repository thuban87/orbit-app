/**
 * Pure cause-aware empty-state gate — proof (DASH-07 / review HIGH-2 + MEDIUM-4).
 *
 * selectDashboardEmptyState resolves an EXPLICIT precedence:
 *   (1) rowCount > 0            → 'none'
 *   (2) else hasTerm            → 'search-empty'
 *   (3) else activeFilter!=all  → 'filter-empty'
 *   (4) else population-count   → 'firstrun' (ALL FOUR zero) | 'hidden'
 *
 * The load-bearing regressions this locks:
 *   - HIGH-2: a never-contacted-only OR snoozed-only OR archived-only user on the
 *     unfiltered default list reads 'hidden', NEVER 'firstrun' — the first-run CTA
 *     requires ALL FOUR populations empty.
 *   - MEDIUM-4: a zero-result filter/search over a NON-empty population resolves to
 *     'filter-empty'/'search-empty' BEFORE the population-count fallback, so it
 *     never wrongly shows the hidden-population copy.
 */
import { describe, expect, it } from "vitest";
import { selectDashboardEmptyState } from "@/logic/dashboard-empty-logic";

// The unfiltered default list inputs (activeFilter 'all', no term) — the only
// context in which the population-count decision (firstrun/hidden) is reachable.
const unfiltered = { activeFilter: "all" as const, hasTerm: false };

describe("selectDashboardEmptyState — precedence + population gate", () => {
  it("rowCount > 0 → 'none' regardless of hidden populations / filter / term", () => {
    expect(
      selectDashboardEmptyState({
        live: 5,
        neverContacted: 2,
        snoozed: 1,
        archived: 3,
        unbound: 2,
        rowCount: 5,
        activeFilter: "favourites",
        hasTerm: true,
      }),
    ).toBe("none");
  });

  it("unfiltered, all FOUR populations zero → 'firstrun'", () => {
    expect(
      selectDashboardEmptyState({
        live: 0,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("firstrun");
  });

  it("unfiltered, never-contacted-ONLY user → 'hidden' (NOT 'firstrun') — HIGH-2", () => {
    expect(
      selectDashboardEmptyState({
        live: 0,
        neverContacted: 3,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("hidden");
  });

  it("unfiltered, snoozed-ONLY user → 'hidden' (NOT 'firstrun') — HIGH-2", () => {
    expect(
      selectDashboardEmptyState({
        live: 0,
        neverContacted: 0,
        snoozed: 2,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("hidden");
  });

  it("unfiltered, archived-ONLY user → 'hidden' (NOT 'firstrun')", () => {
    expect(
      selectDashboardEmptyState({
        live: 0,
        neverContacted: 0,
        snoozed: 0,
        archived: 4,
        unbound: 0,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("hidden");
  });

  it("unfiltered, live population exists but visible list empty → 'hidden'", () => {
    expect(
      selectDashboardEmptyState({
        live: 6,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("hidden");
  });

  it("zero-result category filter over a NON-empty population → 'filter-empty' (NOT 'hidden') — MEDIUM-4", () => {
    expect(
      selectDashboardEmptyState({
        live: 8,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "category-3",
        hasTerm: false,
      }),
    ).toBe("filter-empty");
  });

  it("favourites filter with zero rows → 'filter-empty'", () => {
    expect(
      selectDashboardEmptyState({
        live: 8,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "favourites",
        hasTerm: false,
      }),
    ).toBe("filter-empty");
  });

  it("active search term with zero rows over a non-empty population → 'search-empty'", () => {
    expect(
      selectDashboardEmptyState({
        live: 8,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "all",
        hasTerm: true,
      }),
    ).toBe("search-empty");
  });

  it("term WINS over an active filter (both set, zero rows) → 'search-empty' — LOW-2 term-wins", () => {
    expect(
      selectDashboardEmptyState({
        live: 8,
        neverContacted: 1,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "favourites",
        hasTerm: true,
      }),
    ).toBe("search-empty");
  });

  it("is pure — same inputs yield same output, no throw on all-zero", () => {
    const input = {
      live: 0,
      neverContacted: 0,
      snoozed: 0,
      archived: 0,
      unbound: 0,
      rowCount: 0,
      ...unfiltered,
    };
    expect(selectDashboardEmptyState(input)).toBe(
      selectDashboardEmptyState(input),
    );
  });

  it("an all-Unbound install is hidden, never first-run", () => {
    expect(
      selectDashboardEmptyState({
        live: 0,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 1,
        rowCount: 0,
        ...unfiltered,
      }),
    ).toBe("hidden");
  });

  it("accepts the legacy filter-enum shape unchanged", () => {
    expect(
      selectDashboardEmptyState({
        live: 1,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "all",
        hasTerm: false,
      }),
    ).toBe("hidden");
  });

  it("uses active population filters before the population fallback", () => {
    expect(
      selectDashboardEmptyState({
        live: 4,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "all",
        hasTerm: false,
        activeFilters: { category: ["family"] },
      }),
    ).toBe("filter-empty");
  });

  it("resolves a Birthday population empty cause through the one gate", () => {
    expect(
      selectDashboardEmptyState({
        live: 4,
        neverContacted: 0,
        snoozed: 0,
        archived: 0,
        unbound: 0,
        rowCount: 0,
        activeFilter: "all",
        hasTerm: false,
        activePopulations: ["birthdays"],
        activeFilters: {},
        populationCounts: {
          favourites: 0,
          birthdays: 0,
          "not-contacted": 0,
          snoozed: 0,
          "all-contacts": 4,
        },
      }),
    ).toBe("birthdays-empty");
  });

  it("resolves Not Contacted and Snoozed population empty causes", () => {
    const baseInput = {
      live: 4,
      neverContacted: 0,
      snoozed: 0,
      archived: 0,
      unbound: 0,
      rowCount: 0,
      activeFilter: "all" as const,
      hasTerm: false,
      activeFilters: {},
      populationCounts: {
        favourites: 0,
        birthdays: 0,
        "not-contacted": 0,
        snoozed: 0,
        "all-contacts": 4,
      },
    };

    expect(
      selectDashboardEmptyState({
        ...baseInput,
        activePopulations: ["not-contacted"],
      }),
    ).toBe("not-contacted-empty");
    expect(
      selectDashboardEmptyState({
        ...baseInput,
        activePopulations: ["snoozed"],
      }),
    ).toBe("snoozed-empty");
  });
});
