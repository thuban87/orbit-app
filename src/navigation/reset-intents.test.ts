import { describe, expect, it } from "vitest";
import { resetToDashboardRoot, resetToDashboardWith } from "./reset-intents";

describe("Dashboard reset intents", () => {
  it("resets to the Dashboard tab root", () => {
    expect(resetToDashboardRoot()).toEqual({
      index: 0,
      routes: [
        {
          name: "DashboardTab",
          state: { index: 0, routes: [{ name: "Home" }] },
        },
      ],
    });
  });

  it("retains Home below a Dashboard target for Back", () => {
    expect(
      resetToDashboardWith({ name: "Profile", params: { contactId: 42 } }),
    ).toEqual({
      index: 0,
      routes: [
        {
          name: "DashboardTab",
          state: {
            index: 1,
            routes: [
              { name: "Home" },
              { name: "Profile", params: { contactId: 42 } },
            ],
          },
        },
      ],
    });
  });
});
