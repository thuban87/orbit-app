import { BIN, CHECK_LINKED_CONTACTS } from "@/constants/glossary";
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

/** Every param-less registered Settings-stack route name. */
type ParamlessSettingsRoute = {
  [K in keyof SettingsStackParamList]: undefined extends SettingsStackParamList[K]
    ? K
    : never;
}[keyof SettingsStackParamList];

/**
 * The Settings-stack routes the Contacts category navigates to: the
 * param-less managers (CustomFields, Archived, UnboundContacts, BulkReview)
 * and `CategoryManagement`. Listed explicitly (38.9 review IN-06) so adding a
 * route to the Settings stack can never grow this union past the size at
 * which TypeScript stops matching it against `navigate`'s per-route overloads
 * (it stops decomposing unions past 25 members). `satisfies` keeps every
 * entry a registered, param-less Settings route, so
 * `navigation.navigate(row.route)` type-checks without a per-row param.
 */
export const SETTINGS_CONTACTS_ROUTES = [
  "CustomFields",
  "Archived",
  "UnboundContacts",
  "BulkReview",
  "CategoryManagement",
] as const satisfies readonly ParamlessSettingsRoute[];

type SettingsStackRoute = (typeof SETTINGS_CONTACTS_ROUTES)[number];

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
 * A reserved IA slot for destinations that are intentionally not live yet.
 * Inert by construction — `isActiveContactsRow` returns false — so it can never
 * become a tappable dead placeholder.
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
 * slot is "active"; reservations remain deliberately excluded so no dead
 * placeholder can ship (§K no-dead-placeholders).
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
          title: CHECK_LINKED_CONTACTS,
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
        {
          kind: "route",
          key: "category-management",
          title: "Categories",
          subtitle: "Organize contacts into your own relationship groups.",
          route: "CategoryManagement",
        },
      ],
    },
    {
      key: "contact-management",
      title: "Contact Management",
      rows: [
        {
          kind: "route",
          key: "archived",
          title: BIN,
          subtitle:
            "People you've moved to the Bin. Restore them or delete them permanently.",
          route: "Archived",
        },
        // 38.12 D-97 (owner, Q-05): beside the Bin; the Contacts ⋯ entry
        // stays. Subtitle wording is this plan's.
        {
          kind: "route",
          key: "unbound-contacts",
          title: "Unbound contacts",
          subtitle:
            "People outside your active orbit. Open someone to bind them.",
          route: "UnboundContacts",
        },
      ],
    },
  ]);

/** The paused-import counts the Import contacts row reads (D-111; B-6). */
export interface ImportResumeCounts {
  /** pending + needs_review + failed rows (convergence c5 F-2). */
  readonly peopleLeft: number;
  /** Committed contacts with a staged photo still to add (B-6). */
  readonly photosLeft: number;
}

/** What the Contacts screen knows about paused work on focus. */
export interface SettingsContactsResumeState {
  /** The newest resumable import, or null when none. */
  readonly importResume: ImportResumeCounts | null;
  /** Cards left in the newest pending check, or null when none. */
  readonly checkCardsLeft: number | null;
}

/**
 * The subtitle a row shows (38.12 D-105, D-111): paused work replaces the
 * normal subtitle on its own row until it is finished or discarded. People
 * left win over photos left; a photo-only import says photos are left, never
 * "0 left" (B-6). Every other row keeps its authored subtitle.
 */
export function contactsRowSubtitle(
  row: SettingsContactsActionRow | SettingsContactsRouteRow,
  resume: SettingsContactsResumeState,
): string {
  if (row.kind === "action" && row.action === "import") {
    const paused = resume.importResume;
    if (paused && paused.peopleLeft > 0)
      return `Finish your import (${paused.peopleLeft} left)`;
    if (paused && paused.photosLeft > 0)
      return `Finish adding photos (${paused.photosLeft} left)`;
  }
  if (
    row.kind === "action" &&
    row.action === "reconcile" &&
    resume.checkCardsLeft !== null &&
    resume.checkCardsLeft > 0
  ) {
    return `Finish your check (${resume.checkCardsLeft} left)`;
  }
  return row.subtitle;
}

/**
 * Whether tapping Import contacts first asks Resume / Discard (D-111): only
 * while people are still left, failed rows included (F-2). Photo-only work
 * does not block a new import this way (this plan only, 38.12-25).
 */
export function importEntryNeedsPrecheck(
  resume: ImportResumeCounts | null,
): boolean {
  return resume !== null && resume.peopleLeft > 0;
}

/**
 * Whether the Import contacts row opens the paused session's photo recovery
 * (the route the resume prompt's Resume uses) instead of a new import (B-6).
 */
export function importRowOpensPhotoRecovery(
  resume: ImportResumeCounts | null,
): boolean {
  return resume !== null && resume.peopleLeft === 0 && resume.photosLeft > 0;
}
