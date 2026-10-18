import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECK_LINKED_CONTACTS } from "@/constants/glossary";
import {
  contactsRowSubtitle,
  importEntryNeedsPrecheck,
  importRowOpensPhotoRecovery,
  isActiveContactsRow,
  SETTINGS_CONTACTS_SECTION_ORDER,
  SETTINGS_CONTACTS_SECTIONS,
  type SettingsContactsActionRow,
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

  it("lists Unbound contacts beside the Bin in Contact Management (D-97)", () => {
    const management = SETTINGS_CONTACTS_SECTIONS.find(
      (section) => section.key === "contact-management",
    );
    const rows = (management?.rows ?? []).filter(isActiveContactsRow);
    expect(rows.map((row) => row.title)).toEqual(["Bin", "Unbound contacts"]);
    const unbound = rows[1];
    expect(unbound?.kind).toBe("route");
    expect(unbound?.kind === "route" ? unbound.route : null).toBe(
      "UnboundContacts",
    );
    expect(isRegisteredScreen("UnboundContacts")).toBe(true);
    // Imports start Unbound (D-16), so most were never Bound (D-IN-07).
    expect(unbound?.subtitle).toBe(
      "People outside your active orbit. Open someone to bind them.",
    );
  });
});

/**
 * 38.12 D-105 / D-111: paused work stays findable on its Settings row, and a
 * new import asks first while people are still left (failed rows included,
 * convergence c5 F-2; photo-only work never blocks a new import, B-6).
 */
describe("paused import and check rows (D-105, D-111)", () => {
  const actionRow = (key: string): SettingsContactsActionRow => {
    const row = SETTINGS_CONTACTS_SECTIONS.flatMap(
      (section) => section.rows,
    ).find((candidate) => candidate.key === key);
    if (row?.kind !== "action") throw new Error(`missing action row ${key}`);
    return row;
  };
  const importRow = actionRow("import-contacts");
  const checkRow = actionRow("check-linked-contacts");
  const none = { importResume: null, checkCardsLeft: null };

  it("titles the Check linked contacts row with the glossary constant (fix-pass queue 3)", () => {
    expect(checkRow.title).toBe(CHECK_LINKED_CONTACTS);
    const source = readFileSync(
      join(__dirname, "settings-contacts-model.ts"),
      "utf8",
    );
    expect(source).not.toContain('title: "Check linked contacts"');
  });

  it("keeps each row's normal subtitle with nothing paused", () => {
    expect(contactsRowSubtitle(importRow, none)).toBe(importRow.subtitle);
    expect(contactsRowSubtitle(checkRow, none)).toBe(checkRow.subtitle);
    expect(importEntryNeedsPrecheck(null)).toBe(false);
    expect(importRowOpensPhotoRecovery(null)).toBe(false);
  });

  it("reads 'Finish your import (4 left)' with 4 people pending", () => {
    const importResume = { peopleLeft: 4, photosLeft: 0 };
    expect(
      contactsRowSubtitle(importRow, { importResume, checkCardsLeft: null }),
    ).toBe("Finish your import (4 left)");
    expect(importEntryNeedsPrecheck(importResume)).toBe(true);
    expect(importRowOpensPhotoRecovery(importResume)).toBe(false);
  });

  it("counts a failed-only session: 'Finish your import (3 left)' and the pre-check (F-2)", () => {
    const importResume = { peopleLeft: 3, photosLeft: 0 };
    expect(
      contactsRowSubtitle(importRow, { importResume, checkCardsLeft: null }),
    ).toBe("Finish your import (3 left)");
    expect(importEntryNeedsPrecheck(importResume)).toBe(true);
  });

  it("reads 'Finish adding photos (1 left)' for photo-only work, never '0 left', with no pre-check (B-6)", () => {
    const importResume = { peopleLeft: 0, photosLeft: 1 };
    const subtitle = contactsRowSubtitle(importRow, {
      importResume,
      checkCardsLeft: null,
    });
    expect(subtitle).toBe("Finish adding photos (1 left)");
    expect(subtitle).not.toContain("0 left");
    expect(importEntryNeedsPrecheck(importResume)).toBe(false);
    expect(importRowOpensPhotoRecovery(importResume)).toBe(true);
  });

  it("people left win over photos left on the import row", () => {
    const importResume = { peopleLeft: 2, photosLeft: 5 };
    expect(
      contactsRowSubtitle(importRow, { importResume, checkCardsLeft: null }),
    ).toBe("Finish your import (2 left)");
    expect(importRowOpensPhotoRecovery(importResume)).toBe(false);
  });

  it("reads 'Finish your check (2 left)' with a pending check of 2", () => {
    expect(
      contactsRowSubtitle(checkRow, { importResume: null, checkCardsLeft: 2 }),
    ).toBe("Finish your check (2 left)");
    expect(
      contactsRowSubtitle(checkRow, { importResume: null, checkCardsLeft: 0 }),
    ).toBe(checkRow.subtitle);
  });

  it("leaves every other row's subtitle alone", () => {
    const busy = {
      importResume: { peopleLeft: 4, photosLeft: 1 },
      checkCardsLeft: 2,
    };
    const region = actionRow("phone-region");
    expect(contactsRowSubtitle(region, busy)).toBe(region.subtitle);
  });
});

describe("Import contacts' Resume / Discard ask (D-111, D-150)", () => {
  it("is one choice whose Discard and start new is styled destructive", () => {
    const source = readFileSync(
      join(__dirname, "SettingsContactsScreen.tsx"),
      "utf8",
    );
    const ask = source.slice(
      source.indexOf('title: "Finish your last import first?"'),
    );
    expect(ask).toMatch(
      /confirmLabel: "Resume",\s+secondaryLabel: "Discard and start new",[\s\S]*?secondaryDestructive: true,/,
    );
  });
});
