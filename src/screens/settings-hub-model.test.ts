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

  it("places the Orrery (§A index 4) and AI (§A index 6) rows in §A order, targeting their registered routes", () => {
    const orrery = SETTINGS_HUB_ROWS.find((row) => row.key === "orrery");
    const ai = SETTINGS_HUB_ROWS.find((row) => row.key === "ai");

    expect(orrery, "Orrery hub row must exist").toBeDefined();
    expect(ai, "AI hub row must exist").toBeDefined();

    // Both are route rows targeting the registered category routes.
    expect(orrery?.kind).toBe("route");
    expect(ai?.kind).toBe("route");
    if (orrery?.kind === "route") {
      expect(orrery.route).toBe("SettingsOrrery");
      expect(SETTINGS_REGISTERED_ROUTES).toContain(orrery.route);
    }
    if (ai?.kind === "route") {
      expect(ai.route).toBe("SettingsAI");
      expect(SETTINGS_REGISTERED_ROUTES).toContain(ai.route);
    }

    // Canonical §A indices: orrery = 4, ai = 6 (data-backup at 5 not yet shipped).
    expect(SETTINGS_CATEGORY_ORDER.indexOf("orrery")).toBe(4);
    expect(SETTINGS_CATEGORY_ORDER.indexOf("ai")).toBe(6);

    // Orrery precedes AI in the rendered hub, matching §A order.
    const orreryPos = SETTINGS_HUB_ROWS.findIndex(
      (row) => row.key === "orrery",
    );
    const aiPos = SETTINGS_HUB_ROWS.findIndex((row) => row.key === "ai");
    expect(orreryPos).toBeLessThan(aiPos);
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
