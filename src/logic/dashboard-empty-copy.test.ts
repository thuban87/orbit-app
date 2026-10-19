/**
 * Contacts empty-state copy (38.13 D-28, D-30, D-65). The decision of WHICH
 * empty state shows stays in dashboard-empty-logic; this pins what each says.
 */
import { describe, expect, it } from "vitest";
import { ICON_REGISTRY } from "@/components/icons/icon-registry";
import {
  filterEmptyCopy,
  populationEmptyCopy,
  tuckedAwayLines,
} from "@/logic/dashboard-empty-copy";

describe("filterEmptyCopy (D-28)", () => {
  it("a list filtered to nothing names the filters and offers Clear filters", () => {
    const copy = filterEmptyCopy({
      filtersActive: true,
      favouritesOnlyAndNone: false,
    });
    expect(copy.heading).toBe("No contacts match these filters");
    expect(copy.body).toBe("Try fewer filters.");
    expect(copy.actionLabel).toBe("Clear filters");
    expect(copy.icon in ICON_REGISTRY).toBe(true);
  });

  it("keeps the favourites onboarding copy with no Clear filters action", () => {
    for (const filtersActive of [false, true]) {
      const copy = filterEmptyCopy({
        filtersActive,
        favouritesOnlyAndNone: true,
      });
      expect(copy.heading).toBe("No favorites yet");
      expect(copy.body).toBe(
        "Tap the star on a contact's profile to add them here.",
      );
      expect(copy.actionLabel).toBeUndefined();
      expect(copy.icon in ICON_REGISTRY).toBe(true);
    }
  });

  it("offers Clear filters only while a filter is active", () => {
    const copy = filterEmptyCopy({
      filtersActive: false,
      favouritesOnlyAndNone: false,
    });
    expect(copy.actionLabel).toBeUndefined();
  });
});

describe("populationEmptyCopy (D-30)", () => {
  it("Birthdays says what the population is", () => {
    const copy = populationEmptyCopy("birthdays");
    expect(copy.heading).toBe("No birthdays coming up");
    expect(copy.body).toBe(
      "Birthdays shows people whose birthday is in the next 30 days.",
    );
  });

  it("Never Contacted says what the population is, with its glossary label", () => {
    const copy = populationEmptyCopy("not-contacted");
    expect(copy.heading).toBe("Everyone's been contacted");
    expect(copy.body).toBe(
      "Never Contacted shows people you haven't logged an interaction with yet.",
    );
  });

  it("Snoozed says what the population is", () => {
    const copy = populationEmptyCopy("snoozed");
    expect(copy.heading).toBe("No one is snoozed");
    expect(copy.body).toBe(
      "Snoozed shows people whose check-ins you've paused.",
    );
  });

  it("every population uses a registered icon", () => {
    for (const population of [
      "birthdays",
      "not-contacted",
      "snoozed",
    ] as const) {
      const copy = populationEmptyCopy(population);
      expect(copy.icon in ICON_REGISTRY).toBe(true);
    }
  });

  it("every population offers one action, Show Active Contacts (38.13 D-82)", () => {
    for (const population of [
      "birthdays",
      "not-contacted",
      "snoozed",
    ] as const) {
      expect(populationEmptyCopy(population).actionLabel).toBe(
        "Show Active Contacts",
      );
    }
  });
});

describe("tuckedAwayLines (D-65)", () => {
  it("lists Never Contacted and Unbound as buttons, then snoozed and the Bin as text", () => {
    expect(
      tuckedAwayLines({
        neverContacted: 3,
        unbound: 2,
        snoozed: 1,
        archived: 4,
      }),
    ).toEqual([
      {
        kind: "button",
        target: "never-contacted",
        label: "3 Never Contacted →",
        accessibilityLabel: "Show 3 Never Contacted people",
      },
      {
        kind: "button",
        target: "unbound",
        label: "2 Unbound →",
        accessibilityLabel: "Open Unbound contacts, 2 people",
      },
      {
        kind: "text",
        target: "snoozed",
        label: "1 snoozed",
        accessibilityLabel: "1 snoozed",
      },
      {
        kind: "text",
        target: "bin",
        label: "4 in the Bin",
        accessibilityLabel: "4 in the Bin",
      },
    ]);
  });

  it("omits a line whose count is zero", () => {
    expect(
      tuckedAwayLines({
        neverContacted: 0,
        unbound: 1,
        snoozed: 0,
        archived: 0,
      }),
    ).toEqual([
      {
        kind: "button",
        target: "unbound",
        label: "1 Unbound →",
        accessibilityLabel: "Open Unbound contacts, 1 person",
      },
    ]);
    expect(
      tuckedAwayLines({
        neverContacted: 0,
        unbound: 0,
        snoozed: 0,
        archived: 0,
      }),
    ).toEqual([]);
  });

  it("reads a single Never Contacted person in the singular", () => {
    expect(
      tuckedAwayLines({
        neverContacted: 1,
        unbound: 0,
        snoozed: 0,
        archived: 0,
      })[0]?.accessibilityLabel,
    ).toBe("Show 1 Never Contacted person");
  });
});
