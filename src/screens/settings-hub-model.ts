import type { SettingsRegisteredRoute } from "@/navigation/settings-routes";
import type { RootStackParamList } from "@/navigation/types";
import { ADD_WIDGET_ACTION } from "./settings-add-widget";

/**
 * The subset of registered Settings routes reachable with a BARE
 * `navigation.navigate(name)` — i.e. whose params are optional/`undefined`. A
 * hub directory row is a top-level jump with no context to pass, so it can only
 * target a params-free route. This deliberately EXCLUDES the params-required
 * Backup sub-routes (`RestorePreview` needs a preview token, `RestoreResult`
 * needs restore counts) that Plan 37-07 added to the registration contract for
 * dual-home: those are reached only from WITHIN the restore flow, never as a hub
 * destination. `Backup` (undefined params) remains a valid Data & Backup target.
 */
type ParamlessSettingsRoute = {
  [K in SettingsRegisteredRoute]: undefined extends RootStackParamList[K]
    ? K
    : never;
}[SettingsRegisteredRoute];

/**
 * Canonical §A top-level category order (dossier §A). Every category now has a
 * dedicated hub sub-route (Appearance, Contacts & Relationships, Interactions,
 * Notifications, Orrery, Data & Backup, AI, About). This is the anchor
 * `settings-hub-model.test.ts` reads to assert §A ordering. The transitional
 * `SettingsMore` monolith scaffold was retired in Plan 08 and never was a §A
 * category, so it does not appear here.
 */
export const SETTINGS_CATEGORY_ORDER = [
  "appearance",
  "contacts",
  "interactions",
  "notifications",
  "orrery",
  "data-backup",
  "ai",
  "about",
] as const;

export type SettingsCategoryKey = (typeof SETTINGS_CATEGORY_ORDER)[number];

/**
 * A hub directory entry. A DISCRIMINATED UNION from the outset (§L): a
 * `kind:"route"` row navigates to a registered Settings sub-route; a
 * `kind:"action"` row invokes an in-place handler (e.g. the Plan 08 "Add Orbit
 * widget" utility row) rather than navigating. Modelling the action row as a
 * route would mis-type it as a navigation target it is not.
 */
export type SettingsHubRouteEntry = {
  readonly kind: "route";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  /** Typed against the runtime registration contract — an unregistered or
   *  reserved (D-03) name fails to type-check. Narrowed to the params-free
   *  subset: a hub row is a bare `navigate(name)` with no context to pass, so
   *  params-required routes (the Backup restore sub-routes) can't be targeted. */
  readonly route: ParamlessSettingsRoute;
};

export type SettingsHubActionEntry = {
  readonly kind: "action";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  /** Stable action identifier the hub screen switches on (no route exists). */
  readonly action: string;
};

export type SettingsHubRow = SettingsHubRouteEntry | SettingsHubActionEntry;

/**
 * The hub directory rows, authored in §A order. Per §A the rows carry NO live
 * setting values — title + subtitle only. After Plan 08 the full §A category
 * hierarchy is present (Appearance → About) followed by the bottom utility
 * (`kind:"action"`) "Add Orbit widget" row (§L). The transitional "More settings"
 * (`SettingsMore`) row was removed once every group migrated into its category.
 */
export const SETTINGS_HUB_ROWS: ReadonlyArray<SettingsHubRow> = Object.freeze([
  {
    kind: "route",
    key: "appearance",
    title: "Appearance",
    subtitle: "Theme, mode, accent, and background",
    icon: "palette",
    route: "SettingsAppearance",
  },
  {
    kind: "route",
    key: "contacts",
    title: "Contacts & Relationships",
    subtitle: "Contact sources, custom fields, and archived people",
    icon: "contacts",
    route: "SettingsContacts",
  },
  {
    kind: "route",
    key: "interactions",
    title: "Interactions",
    subtitle: "Message defaults, dashboard swipe, and Interaction Assist",
    icon: "chat",
    route: "SettingsInteractions",
  },
  {
    kind: "route",
    key: "notifications",
    title: "Notifications",
    subtitle: "Reminders, birthdays, weekly digest, and delivery time",
    icon: "bell",
    route: "SettingsNotifications",
  },
  {
    kind: "route",
    key: "orrery",
    title: "Orrery",
    subtitle: "Display density, relationship satellites, and Systems",
    icon: "orbit",
    route: "SettingsOrrery",
  },
  {
    // Data & Backup (§A index 5 / D-08). A second canonical entry point into the
    // one Backup screen tree; the generic `Backup` route resolves within the
    // Settings stack (§I — no forked alias). The Backup bottom tab stays (§R).
    kind: "route",
    key: "data-backup",
    title: "Data & Backup",
    subtitle: "Export, restore, encryption, and automatic backups",
    icon: "database",
    route: "Backup",
  },
  {
    kind: "route",
    key: "ai",
    title: "AI",
    subtitle: "Connection, model, personalization, and data permissions",
    icon: "sparkles",
    route: "SettingsAI",
  },
  {
    // About Orbit (§A index 7 / §K). The final §A category — a basic leaf
    // (product name + semantic version only). The last category row, after AI.
    kind: "route",
    key: "about",
    title: "About Orbit",
    subtitle: "App name and version",
    icon: "info",
    route: "SettingsAbout",
  },
  {
    // Home Screen Widget access (§L). A UTILITY row modeled as `kind:"action"`
    // (the discriminated-union arm from Plan 01), NOT a navigation route — it
    // invokes the existing `requestPinWidget` pin path in place. It sits AFTER
    // the primary category/About hierarchy and does NOT get a dedicated category.
    kind: "action",
    key: "add-widget",
    title: "Add Orbit widget",
    subtitle: "Pin the Orbit widget to your home screen",
    icon: "widget",
    action: ADD_WIDGET_ACTION,
  },
]);
