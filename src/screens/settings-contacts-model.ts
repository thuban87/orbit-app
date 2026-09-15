import type { SettingsStackParamList } from "@/navigation/types";

/**
 * Contacts & Relationships category section order (§E). The screen renders these
 * sections top-to-bottom; `settings-contacts-model.test.ts` reads this constant
 * to assert the §E order (Contact Sources → Relationship Structure → Contact
 * Management).
 */
export const SETTINGS_CONTACTS_SECTION_ORDER = [
  "contact-sources",
  "relationship-structure",
  "contact-management",
] as const;

export type SettingsContactsSectionKey =
  (typeof SETTINGS_CONTACTS_SECTION_ORDER)[number];

/**
 * In-place handlers the Contacts screen wires (no route to navigate to). The
 * device-Contacts permission/status surface, contact import, resumable reconcile
 * ("Check linked contacts"), and the phone-region override modal each migrate
 * their exact monolith behaviour rather than navigating to a manager.
 */
export type SettingsContactsAction =
  | "contacts-permission"
  | "import"
  | "reconcile"
  | "phone-region";

/**
 * A param-less registered Settings-stack route name. The Contacts category only
 * navigates to param-less managers (CustomFields, Archived, BulkReview) and holds
 * the param-less `CategoryManagement` reservation, so constraining to this subset
 * lets `navigation.navigate(row.route)` type-check without a per-row param.
 */
type SettingsStackRoute = {
  [K in keyof SettingsStackParamList]: undefined extends SettingsStackParamList[K]
    ? K
    : never;
}[keyof SettingsStackParamList];

/**
 * A row that navigates to a registered Settings-stack route (a canonical manager
 * reused by navigation, never reimplemented — e.g. CustomFields, Archived,
 * BulkReview).
 */
export type SettingsContactsRouteRow = {
  readonly kind: "route";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly route: SettingsStackRoute;
};

/**
 * A row that invokes an in-place handler (permission surface, import, reconcile,
 * phone-region modal) rather than navigating.
 */
export type SettingsContactsActionRow = {
  readonly kind: "action";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly action: SettingsContactsAction;
};

/**
 * A reserved IA slot (D-03 / §K): holds a stable internal route NAME and its
 * section-order position for a FUTURE Category Management phase, but the screen
 * renders NO row for it. Inert by construction — `isActiveContactsRow` returns
 * false — so it never becomes a tappable dead placeholder. Task 2 inserts the
 * `CategoryManagement` reservation into Relationship Structure.
 */
export type SettingsContactsReservedRow = {
  readonly kind: "reserved";
  readonly key: string;
  readonly route: SettingsStackRoute;
  readonly reason: string;
};

export type SettingsContactsRow =
  | SettingsContactsRouteRow
  | SettingsContactsActionRow
  | SettingsContactsReservedRow;

export type SettingsContactsSection = {
  readonly key: SettingsContactsSectionKey;
  readonly title: string;
  readonly rows: ReadonlyArray<SettingsContactsRow>;
};

/**
 * A row the screen actually renders. Everything except the inert `reserved`
 * slot is "active"; the D-03 reservation is deliberately excluded so no dead
 * Categories placeholder ever ships (§K no-dead-placeholders).
 */
export function isActiveContactsRow(
  row: SettingsContactsRow,
): row is SettingsContactsRouteRow | SettingsContactsActionRow {
  return row.kind !== "reserved";
}

/**
 * The Contacts & Relationships sections (§E), authored in section order. Each
 * row names either a destination route (reused canonical manager) or a migrated
 * in-place action. The phone-region override is ordered LOWER within Contact
 * Sources (§E) — it is a formatting fallback, not a primary source action.
 */
export const SETTINGS_CONTACTS_SECTIONS: ReadonlyArray<SettingsContactsSection> =
  Object.freeze([
    {
      key: "contact-sources",
      title: "Contact Sources",
      rows: [
        {
          kind: "action",
          key: "contacts-permission",
          title: "Contacts access",
          subtitle:
            "Let Orbit read your phone contacts to import and keep linked people up to date.",
          action: "contacts-permission",
        },
        {
          kind: "action",
          key: "import-contacts",
          title: "Import contacts",
          subtitle:
            "Choose people from your phone and review each import first.",
          action: "import",
        },
        {
          kind: "action",
          key: "check-linked-contacts",
          title: "Check linked contacts",
          subtitle: "Review changes from linked people in your phone.",
          action: "reconcile",
        },
        {
          kind: "route",
          key: "review-flagged",
          title: "Review flagged items",
          subtitle: "Fix import details Orbit could not read.",
          route: "BulkReview",
        },
        // Phone-region override sits LOWER within Contact Sources (§E): it is a
        // formatting fallback for numbers entered without a country code, not a
        // primary contact-source action.
        {
          kind: "action",
          key: "phone-region",
          title: "Phone number region",
          subtitle:
            "Used to format phone numbers entered without a country code.",
          action: "phone-region",
        },
      ],
    },
    {
      key: "relationship-structure",
      title: "Relationship Structure",
      rows: [
        {
          kind: "route",
          key: "custom-fields",
          title: "Custom Fields",
          subtitle: "Define the fields your contacts can carry.",
          route: "CustomFields",
        },
        // Task 2 inserts the CategoryManagement reserved slot (D-03) here.
      ],
    },
    {
      key: "contact-management",
      title: "Contact Management",
      rows: [
        {
          kind: "route",
          key: "archived",
          title: "Archived contacts",
          subtitle: "People you've moved out of your active orbit.",
          route: "Archived",
        },
      ],
    },
  ]);
