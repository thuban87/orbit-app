import { describe, expect, it } from "vitest";
import { dashboardSearchRowPresentation } from "./dashboard-search-row-logic";

describe("HomeScreen Unbound search presentation", () => {
  it("has no neutral rows when search returns no Unbound contacts", () => {
    expect(dashboardSearchRowPresentation([])).toEqual([]);
  });

  it("labels one Unbound search result neutrally", () => {
    expect(
      dashboardSearchRowPresentation([
        { id: 1, name: "Avery", trackingEnabled: 0 },
      ]),
    ).toEqual([{ id: 1, neutral: true, accessibilityLabel: "Avery, Unbound" }]);
  });

  it("labels every Unbound row neutrally in a multi-result search", () => {
    expect(
      dashboardSearchRowPresentation([
        { id: 1, name: "Avery", trackingEnabled: 0 },
        { id: 2, name: "Blair", trackingEnabled: 0 },
      ]),
    ).toEqual([
      { id: 1, neutral: true, accessibilityLabel: "Avery, Unbound" },
      { id: 2, neutral: true, accessibilityLabel: "Blair, Unbound" },
    ]);
  });
});
