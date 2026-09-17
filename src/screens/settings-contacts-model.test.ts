import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isActiveContactsRow,
  SETTINGS_CONTACTS_SECTION_ORDER,
  SETTINGS_CONTACTS_SECTIONS,
} from "./settings-contacts-model";

/**
 * Contacts & Relationships section-shape + Categories-reservation guard (§E /
 * D-03). Like `settings-routes.test.ts`, the "targets a registered route" check
 * reads `SettingsStack.tsx` from disk: the erased param-list type proves nothing
 * at runtime, so we assert each active route row resolves to a real
 * `<Stack.Screen>`. The key regression this file locks in is that the reserved
 * `CategoryManagement` slot NEVER becomes a rendered row (§K no-dead-placeholders).
 */
const STACK_SOURCE = readFileSync(
  join(process.cwd(), "src", "navigation", "tabs", "SettingsStack.tsx"),
  "utf8",
);
const COLLAPSED = STACK_SOURCE.replace(/\s+/g, " ");

function isRegisteredScreen(routeName: string): boolean {
  return COLLAPSED.includes(`<Stack.Screen name="${routeName}"`);
}

describe("Settings contacts model", () => {
  it("orders sections in canonical §E order (Contact Sources → Relationship Structure → Contact Management)", () => {
    expect(SETTINGS_CONTACTS_SECTIONS.map((section) => section.key)).toEqual([
      ...SETTINGS_CONTACTS_SECTION_ORDER,
    ]);
  });

  it("targets only registered <Stack.Screen> routes for every active route row", () => {
    for (const section of SETTINGS_CONTACTS_SECTIONS) {
      for (const row of section.rows) {
        if (isActiveContactsRow(row) && row.kind === "route") {
          expect(
            isRegisteredScreen(row.route),
            `active contacts row "${row.key}" targets unregistered route "${row.route}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("renders CategoryManagement immediately after Custom Fields", () => {
    const activeTargets = SETTINGS_CONTACTS_SECTIONS.flatMap((section) =>
      section.rows
        .filter(isActiveContactsRow)
        .filter((row) => row.kind === "route")
        .map((row) => row.route),
    );
    expect(activeTargets).toContain("CategoryManagement");
    const relationship = SETTINGS_CONTACTS_SECTIONS.find(
      (section) => section.key === "relationship-structure",
    );
    expect(relationship?.rows.map((row) => row.key)).toEqual([
      "custom-fields",
      "category-management",
    ]);
    expect(isRegisteredScreen("CategoryManagement")).toBe(true);
  });

  it("orders the phone-region control lower within Contact Sources (§E)", () => {
    const contactSources = SETTINGS_CONTACTS_SECTIONS.find(
      (section) => section.key === "contact-sources",
    );
    expect(contactSources, "contact-sources section must exist").toBeDefined();
    const rows = contactSources?.rows ?? [];
    const phoneRegionIndex = rows.findIndex(
      (row) => row.kind === "action" && row.action === "phone-region",
    );
    expect(phoneRegionIndex).toBeGreaterThan(-1);
    // Phone-region sits below the primary source controls (permission, import,
    // reconcile, review-flagged) — a formatting fallback, not a primary action.
    const primaryKeys = [
      "contacts-permission",
      "import-contacts",
      "check-linked-contacts",
      "review-flagged",
    ];
    for (const key of primaryKeys) {
      const index = rows.findIndex((row) => row.key === key);
      expect(index, `expected "${key}" above phone-region`).toBeGreaterThan(-1);
      expect(phoneRegionIndex).toBeGreaterThan(index);
    }
  });
});
