import { describe, expect, it } from "vitest";
import type { DashboardRow } from "@/db/dashboard-read";
import { favouriteTapOutcome, isUnboundRow } from "./dashboard-unbound-row";

function row(overrides: Partial<DashboardRow>): DashboardRow {
  return {
    id: 1,
    name: "Ann Lee",
    photo: null,
    modified_at: "2026-10-01 10:00:00",
    categoryLabel: null,
    trackingEnabled: 1,
    favourite_rank: null,
    last_contact: "2026-10-01 10:00:00",
    snooze_until: null,
    status: "stable",
    progress: 0.1,
    ...overrides,
  };
}

describe("isUnboundRow (D-59, ADR-233)", () => {
  it("is true for tracking_enabled 0 and false for 1", () => {
    expect(isUnboundRow({ trackingEnabled: 0 })).toBe(true);
    expect(isUnboundRow({ trackingEnabled: 1 })).toBe(false);
  });

  it("marks an Unbound row shown by the Never Contacted opt-in, outside search (review R1-14)", () => {
    const optInRow = row({
      trackingEnabled: 0,
      last_contact: null,
      status: null,
      progress: null,
    });
    expect(isUnboundRow(optInRow)).toBe(true);
    expect(favouriteTapOutcome(optInRow)).toBe("explain");
  });
});

describe("favouriteTapOutcome (ADR-233; review R2-04)", () => {
  it("explains for an Unbound row and toggles for a Bound one", () => {
    expect(favouriteTapOutcome(row({ trackingEnabled: 0 }))).toBe("explain");
    expect(favouriteTapOutcome(row({ trackingEnabled: 1 }))).toBe("toggle");
  });

  it("ignores a tap whose row is unknown: no write, no notice", () => {
    expect(favouriteTapOutcome(undefined)).toBe("ignore");
  });

  it("never toggles an unexpected lifecycle value", () => {
    expect(favouriteTapOutcome(row({ trackingEnabled: 2 }))).toBe("ignore");
  });
});
