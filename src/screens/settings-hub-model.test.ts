import { describe, expect, it } from "vitest";
import { SETTINGS_REGISTERED_ROUTES } from "@/navigation/settings-routes";
import {
  SETTINGS_CATEGORY_ORDER,
  SETTINGS_HUB_ROWS,
} from "./settings-hub-model";

describe("Settings hub model", () => {
  it("targets only registered routes for every kind:'route' row (§K)", () => {
    for (const row of SETTINGS_HUB_ROWS) {
      if (row.kind === "route") {
        expect(
          SETTINGS_REGISTERED_ROUTES,
          `hub row "${row.key}" targets unregistered route "${row.route}"`,
        ).toContain(row.route);
      }
    }
  });

  it("orders present §A category rows in canonical §A order", () => {
    const presentCategoryIndexes = SETTINGS_HUB_ROWS.filter((row) =>
      (SETTINGS_CATEGORY_ORDER as readonly string[]).includes(row.key),
    ).map((row) =>
      (SETTINGS_CATEGORY_ORDER as readonly string[]).indexOf(row.key),
    );
    const sorted = [...presentCategoryIndexes].sort((a, b) => a - b);
    expect(presentCategoryIndexes).toEqual(sorted);
  });

  it("keeps the transitional SettingsMore row present as the last non-utility row", () => {
    const routeRows = SETTINGS_HUB_ROWS.filter((row) => row.kind === "route");
    expect(routeRows.length).toBeGreaterThan(0);
    const moreRow = routeRows.find(
      (row) => row.kind === "route" && row.route === "SettingsMore",
    );
    expect(moreRow, "transitional SettingsMore row must exist").toBeDefined();
    // It is the LAST non-utility (route) row — the migration scaffold Plan 08
    // removes once every group has migrated.
    expect(routeRows[routeRows.length - 1]).toBe(moreRow);
  });
});
