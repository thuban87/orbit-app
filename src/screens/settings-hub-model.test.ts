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

  it("has retired the transitional SettingsMore scaffold (Plan 08)", () => {
    // No hub row targets the removed monolith route... (cast: `SettingsMore` is
    // no longer even a member of the registered-route type — its absence there
    // is itself the retirement guard).
    const moreRow = SETTINGS_HUB_ROWS.find(
      (row) => row.kind === "route" && (row.route as string) === "SettingsMore",
    );
    expect(moreRow, "SettingsMore hub row must be gone").toBeUndefined();
    // ...and it is no longer a registered route at all (source-scan test also
    // asserts no <Stack.Screen> for it).
    expect(SETTINGS_REGISTERED_ROUTES).not.toContain("SettingsMore");
  });

  it("renders the COMPLETE §A category order, then the widget action row (§A/§K/§L)", () => {
    // The route (category) rows, in render order, are EXACTLY the canonical §A
    // top-level order — every category present, none missing, none out of order.
    const routeKeys = SETTINGS_HUB_ROWS.filter(
      (row) => row.kind === "route",
    ).map((row) => row.key);
    expect(routeKeys).toEqual([...SETTINGS_CATEGORY_ORDER]);

    // The Home Screen Widget access is a single bottom utility row, modeled as
    // kind:"action" (§L) — after the whole category/About hierarchy.
    const lastRow = SETTINGS_HUB_ROWS[SETTINGS_HUB_ROWS.length - 1];
    expect(lastRow.kind).toBe("action");
    const actionRows = SETTINGS_HUB_ROWS.filter((row) => row.kind === "action");
    expect(actionRows).toHaveLength(1);

    // No route row precedes About out of order: About is the final category.
    expect(routeKeys[routeKeys.length - 1]).toBe("about");
  });

  it("renders no row targeting the reserved CategoryManagement route (D-03)", () => {
    const reserved = SETTINGS_HUB_ROWS.find(
      (row) =>
        row.kind === "route" &&
        (row.route as string) === "CategoryManagement",
    );
    expect(
      reserved,
      "no hub row may target the inert CategoryManagement reservation",
    ).toBeUndefined();
  });
});
